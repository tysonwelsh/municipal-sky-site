<?php
// Runtime SVG sanitizer for visitor-generated artwork
// (PLAN-USER-PROMPTS-CONTRACTS C3).
//
// Pure function: no globals, no I/O, no side effects. REJECT, NEVER REPAIR —
// the input is either returned byte-identical or refused with a reason.
// Repair would create parser-differential bugs between PHP's libxml and the
// browser's SVG parser, and the whole trust boundary rests on the two seeing
// the same document.
//
// ONE NAMED NORMALIZATION (owner, 2026-10-02): CDATA sections are unwrapped,
// not refused. How a model writes SVG is part of what the drawer measures, so
// a usable drawing is not thrown away over a harmless wrapper (the case: Kimi
// K3 wrapping its <style> CSS in <![CDATA[ … ]]>), and the fact is RECORDED,
// not hidden: the verdict carries 'normalized' => ['cdata_unwrapped' => n]
// and jd2-generate files it in jd2_generations.normalized. Each CDATA
// section becomes an ordinary text node with the same content BEFORE any
// rule runs, so its bytes meet exactly the checks any other text meets (the
// <style> CSS scan for url()/@import/expression/escapes/'<'): a payload
// rejects with the same reason it would get written without the wrapper.
// Only then is the document re-serialized from the DOM (empty elements
// written open/close, never self-closing — see jd_svg_serialize()), and the
// re-serialized string is run through this whole function again, unchanged
// rules and no normalization, so what is returned is a string the strict
// byte-identical regime itself accepts. Only a normalized drawing is
// re-serialized; every other input still passes byte-identical. Processing
// instructions and comments inside the raw-text elements stay refused.
//
// THE CLIENT HALF (2026-10-02): the drawer inlines every drawing through
// DOMParser('image/svg+xml') + importNode, never innerHTML, so the browser
// builds the same XML tree this file judged — see "the inline parse" at
// svgParse in art/junk-drawer/jd-core.js and art/junk-drawer/CLAUDE.md.

const JD_SVG_NS = 'http://www.w3.org/2000/svg';

// C3.1 step 1 — 300 KB.
const JD_SVG_MAX_BYTES = 307200;

// C3.2 — allowlist by localName, case-sensitive, SVG namespace only.
// Deliberately absent and never to be added without a contracts revision:
// script, foreignObject, image, feImage, a, view, metadata, animation,
// audio, video, iframe, handler.
const JD_SVG_ALLOWED_ELEMENTS = [
    // Structure
    'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'switch',
    // Shapes
    'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    // Text
    'text', 'tspan', 'textPath',
    // Paint
    'linearGradient', 'radialGradient', 'stop', 'pattern',
    // Clip/mask
    'clipPath', 'mask',
    // Markers
    'marker',
    // Style (text content scanned — C3.4)
    'style',
    // Filters
    'filter', 'feBlend', 'feColorMatrix', 'feComponentTransfer',
    'feComposite', 'feConvolveMatrix', 'feDiffuseLighting',
    'feDisplacementMap', 'feDistantLight', 'feDropShadow', 'feFlood',
    'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feMerge',
    'feMergeNode', 'feMorphology', 'feOffset', 'fePointLight',
    'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence',
    // SMIL
    'animate', 'animateTransform', 'animateMotion', 'mpath', 'set',
];

// C3.3 rule 4 — attributes whose values may legitimately hold a reference,
// and which therefore must not hold an absolute or protocol-relative one.
// `base` is xml:base reduced to its local name by jd_svg_attr_name(): it
// re-roots the resolution of every relative reference in its subtree, so a
// same-document `#fragment` that passed rule 2 would resolve off-origin.
const JD_SVG_REF_ATTRS = ['href', 'src', 'style', 'values', 'from', 'to', 'by', 'base'];

// Allowlisted elements whose contents the HTML parser reads as raw text.
// The drawer no longer inlines with innerHTML (the header's client half);
// the rule stays for any reader that still might. Inlined with innerHTML,
// inside an HTML integration point (`desc`, `title`) these two are
// tokenized as HTML, not XML: whatever bytes sit between the tags are
// literal source, so a `</style>` or
// `</title>` buried in a comment — invisible to an element walk and to
// textContent — closes the element and turns the rest into real HTML nodes;
// comments inside them are refused. (A CDATA section was the other carrier:
// it is now unwrapped into a text node and re-serialized, which escapes its
// '<' — see the header.)
const JD_SVG_RAW_TEXT_ELEMENTS = ['style', 'title'];

// C3.3 rule 6 — elements that can retarget another element's attribute.
const JD_SVG_ANIMATION_ELEMENTS = ['animate', 'set', 'animateTransform', 'animateMotion'];

/**
 * @return array{ok:true,svg:string,normalized?:array{cdata_unwrapped:int}}|array{ok:false,reason:string}
 *
 * 'normalized' is present only when something was changed; then 'svg' is the
 * re-serialized document, otherwise it is the input, byte-identical.
 */
function jd_sanitize_svg(string $svg): array
{
    // 1. Size cap, before any parsing work is spent on the input.
    if (strlen($svg) > JD_SVG_MAX_BYTES) {
        return ['ok' => false, 'reason' => 'too_large'];
    }

    // 2. Pre-parse scan on the raw string. Closes XXE and entity expansion
    //    regardless of what any parser flag does later.
    if (stripos($svg, '<!DOCTYPE') !== false || stripos($svg, '<!ENTITY') !== false) {
        return ['ok' => false, 'reason' => 'doctype_forbidden'];
    }

    // 3. Parse. Defense in depth behind step 2; LIBXML_NOENT is never set.
    $previousLoader = function_exists('libxml_get_external_entity_loader')
        ? libxml_get_external_entity_loader()
        : null;
    $previousErrors = libxml_use_internal_errors(true);
    libxml_set_external_entity_loader(static fn() => null);

    try {
        $doc = new DOMDocument();
        $parsed = $doc->loadXML($svg, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();
        if ($parsed === false || $doc->documentElement === null) {
            return ['ok' => false, 'reason' => 'parse_error'];
        }

        // 4. Root check.
        $root = $doc->documentElement;
        if ($root->localName !== 'svg' || $root->namespaceURI !== JD_SVG_NS) {
            return ['ok' => false, 'reason' => 'bad_root'];
        }
        if (!$root->hasAttribute('viewBox')) {
            return ['ok' => false, 'reason' => 'no_viewbox'];
        }

        // 5. CDATA sections become text nodes, before any rule runs (the
        //    header's one named normalization).
        $cdataUnwrapped = jd_svg_unwrap_cdata($doc);

        // 5a. Node types, over the WHOLE document — including the nodes that
        //     sit outside the root element, and the ones the element walk in
        //     5b cannot see. Runs first so a structural violation is reported
        //     wherever it hides.
        $reason = jd_svg_scan_node_types($doc);
        if ($reason !== null) {
            return ['ok' => false, 'reason' => $reason];
        }

        // 5b. Depth-first walk over every element node; first violation wins.
        $reason = jd_svg_walk($root);
        if ($reason !== null) {
            return ['ok' => false, 'reason' => $reason];
        }

        $clean = $cdataUnwrapped > 0 ? jd_svg_serialize($doc) : null;
    } finally {
        libxml_clear_errors();
        libxml_use_internal_errors($previousErrors);
        libxml_set_external_entity_loader($previousLoader);
    }

    // 6. Pass — the original string, untouched.
    if ($clean === null) {
        return ['ok' => true, 'svg' => $svg];
    }

    // 7. A normalized drawing: the re-serialized document, re-checked from
    //    the top under the unchanged rules. It holds no CDATA, so this pass
    //    normalizes nothing and answers byte-identical or with a reason (in
    //    practice only too_large, if escaping grew text past the cap).
    $recheck = jd_sanitize_svg($clean);
    if (empty($recheck['ok'])) {
        return $recheck;
    }
    if (isset($recheck['normalized']) || $recheck['svg'] !== $clean) {
        return ['ok' => false, 'reason' => 'parse_error'];   // unreachable: the fixed point failed
    }
    return ['ok' => true, 'svg' => $clean, 'normalized' => ['cdata_unwrapped' => $cdataUnwrapped]];
}

// Replace every CDATA section in the document with a text node carrying the
// same characters; returns how many there were. Collected first, replaced
// after, so the traversal never walks a list it is mutating. Iterative for
// the reason given at jd_svg_scan_node_types().
function jd_svg_unwrap_cdata(DOMDocument $doc): int
{
    $found = [];
    $stack = [$doc];
    while ($stack) {
        $node = array_pop($stack);
        foreach ($node->childNodes as $child) {
            if ($child->nodeType === XML_CDATA_SECTION_NODE) {
                $found[] = $child;
            } elseif ($child->hasChildNodes()) {
                $stack[] = $child;
            }
        }
    }
    foreach ($found as $cdata) {
        $cdata->parentNode->replaceChild($doc->createTextNode($cdata->data), $cdata);
    }
    return count($found);
}

// The root element as XML: no declaration (the stored drawing starts at
// <svg, as jd_extract_svg() leaves it), text escaped by libxml (so no literal
// '<' or '</style' can survive inside a text node), UTF-8 kept as characters.
// LIBXML_NOEMPTYTAG writes every empty element as <x></x>: inside an HTML
// integration point (<desc>, <title>) the innerHTML parser ignores the
// self-closing slash on a <style/> or <title/> and reads the rest of the
// document as its raw text, so libxml's default <style/> for an empty
// <style></style> would turn a safe input into an unsafe output.
function jd_svg_serialize(DOMDocument $doc): string
{
    return (string) $doc->saveXML($doc->documentElement, LIBXML_NOEMPTYTAG);
}

// Every node in the document that is not an element: processing
// instructions are refused outright, comments only inside the raw text
// elements. CDATA sections never reach this scan — jd_svg_unwrap_cdata() has
// already made them text — so one found here is refused as before. Iterative rather than recursive — a 300 KB input can nest
// tens of thousands of elements deep and PHP recursion would run out of
// stack before the sanitizer ran out of rules.
function jd_svg_scan_node_types(DOMNode $root): ?string
{
    $stack = [$root];
    while ($stack) {
        $node = array_pop($stack);

        $isRawText = $node instanceof DOMElement
            && $node->namespaceURI === JD_SVG_NS
            && in_array($node->localName, JD_SVG_RAW_TEXT_ELEMENTS, true);

        foreach ($node->childNodes as $child) {
            switch ($child->nodeType) {
                case XML_ELEMENT_NODE:
                    $stack[] = $child;
                    break;
                case XML_TEXT_NODE:
                    break;
                case XML_COMMENT_NODE:
                    // See JD_SVG_RAW_TEXT_ELEMENTS.
                    if ($isRawText) {
                        return 'element_not_allowed';
                    }
                    break;
                default:
                    // Processing instructions (and, defensively, any CDATA
                    // section the unwrap step did not convert). Nothing an
                    // LLM legitimately draws needs one, and both are ways of
                    // carrying bytes that one parser calls inert data and
                    // the other calls markup.
                    return 'element_not_allowed';
            }
        }
    }
    return null;
}

// Document-order depth-first traversal. Returns the first rejection reason.
function jd_svg_walk(DOMElement $root): ?string
{
    $stack = [$root];
    while ($stack) {
        /** @var DOMElement $element */
        $element = array_pop($stack);

        $reason = jd_svg_check_element($element);
        if ($reason !== null) {
            return $reason;
        }

        $children = [];
        foreach ($element->childNodes as $child) {
            if ($child->nodeType === XML_ELEMENT_NODE) {
                $children[] = $child;
            }
        }
        // Pushed in reverse so the stack pops them in document order.
        for ($i = count($children) - 1; $i >= 0; $i--) {
            $stack[] = $children[$i];
        }
    }
    return null;
}

function jd_svg_check_element(DOMElement $element): ?string
{
    // Namespace before allowlist: this is what makes HTML smuggling and
    // foreignObject-content games structurally impossible.
    if ($element->namespaceURI !== JD_SVG_NS) {
        return 'foreign_namespace';
    }
    if (!in_array($element->localName, JD_SVG_ALLOWED_ELEMENTS, true)) {
        return 'element_not_allowed';
    }

    $isAnimation = in_array($element->localName, JD_SVG_ANIMATION_ELEMENTS, true);

    foreach ($element->attributes as $attribute) {
        $reason = jd_svg_check_attribute($attribute, $isAnimation);
        if ($reason !== null) {
            return $reason;
        }
    }

    if ($element->localName === 'style') {
        $reason = jd_svg_check_css($element->textContent);
        if ($reason !== null) {
            return $reason;
        }
    }

    return null;
}

// C3.3 — checked in this order; first hit rejects.
function jd_svg_check_attribute(DOMAttr $attribute, bool $isAnimation): ?string
{
    $name = jd_svg_attr_name($attribute);
    $value = $attribute->value;

    // 1. Event handlers.
    if (str_starts_with($name, 'on')) {
        return 'event_handler';
    }

    // 2. href / xlink:href in any namespace: same-document fragments only.
    //    (An undeclared xlink prefix leaves localName as 'xlink:href', which
    //    jd_svg_attr_name() normalizes — the obfuscation buys nothing.)
    if ($name === 'href') {
        if (!preg_match('/^#[^#\s]+$/', $value)) {
            return 'external_ref';
        }
    }

    // 3. Every url() must be same-document.
    if (stripos($value, 'url(') !== false && !jd_svg_urls_are_local($value)) {
        return 'external_url';
    }

    // 4. Scheme smuggling. The first regex applies to every value; the second
    //    only to attributes that can carry a reference — presentation
    //    attributes cannot fetch anything without url(), covered by rule 3.
    //    Both run against a whitespace-stripped copy: browsers discard tabs
    //    and newlines inside a URL before resolving its scheme, so
    //    "java&#10;script:" is a live scheme and must not read as inert text.
    $squeezed = preg_replace('/[\x00-\x20]+/', '', $value);
    if (preg_match('/(javascript|vbscript):/i', $squeezed)) {
        return 'dangerous_uri';
    }
    if (in_array($name, JD_SVG_REF_ATTRS, true) && preg_match('#(?:https?:|data:|//)#i', $squeezed)) {
        return 'external_url';
    }

    // 5. Inline style.
    if ($name === 'style' && jd_svg_check_css($value) !== null) {
        return 'style_external';
    }

    // 6. SMIL guard: animating a safe attribute into an unsafe one. Current
    //    browsers refuse to animate an event handler, but no SVG attribute
    //    legitimately begins with "on", so the target name is held to the
    //    same rule as rule 1 rather than to today's browser behaviour.
    if ($isAnimation && $name === 'attributename') {
        $target = strtolower(trim($value));
        if (str_starts_with($target, 'on')) {
            return 'event_handler';
        }
        if ($target === 'href' || $target === 'xlink:href') {
            return 'animated_href';
        }
    }

    return null;
}

// Lowercased local name, taken from the qualified name so that an undeclared
// namespace prefix cannot hide an attribute from the rules above.
function jd_svg_attr_name(DOMAttr $attribute): string
{
    $qualified = strtolower($attribute->nodeName);
    $colon = strrpos($qualified, ':');
    return $colon === false ? $qualified : substr($qualified, $colon + 1);
}

// C3.4 — every url( must be immediately followed by #, '# or "#.
function jd_svg_urls_are_local(string $value): bool
{
    $offset = 0;
    while (($position = stripos($value, 'url(', $offset)) !== false) {
        $rest = substr($value, $position + 4);
        if (!preg_match('/^(?:#|\'#|"#)/', $rest)) {
            return false;
        }
        $offset = $position + 4;
    }
    return true;
}

// C3.4 — raw CSS text, from a <style> element or a style attribute.
function jd_svg_check_css(string $css): ?string
{
    // A backslash in CSS is an escape sequence, and an escape defeats every
    // literal scan below: "\75 rl(https://…)" is a url() token to a browser
    // and plain text to strpos. Legitimate SVG styling never needs one, so
    // the whole construct is refused rather than decoded — decoding would be
    // the parser-differential trap this sanitizer exists to avoid.
    if (str_contains($css, '\\')) {
        return 'style_external';
    }
    // A `<` cannot reach CSS text as markup — XML would have parsed it as a
    // tag — so it arrives only entity-encoded or out of an unwrapped CDATA
    // section. Either way it is refused: in raw-text HTML it is the start of
    // a `</style>` breakout, and CSS never needs one.
    if (str_contains($css, '<')) {
        return 'style_external';
    }
    if (stripos($css, '@import') !== false) {
        return 'style_external';
    }
    if (!jd_svg_urls_are_local($css)) {
        return 'style_external';
    }
    if (stripos($css, 'expression(') !== false) {
        return 'style_external';
    }
    // image-set() and cross-fade() accept a bare <string> URL, so a remote
    // fetch can be written with no url( token at all and the locality scan
    // above never sees it. An inlined <style> is a document stylesheet: that
    // fetch would run for the whole page and hand the viewer's IP to a third
    // party. Whitespace is squeezed out first for the same reason as C3.3
    // rule 4 — a browser strips it before resolving a scheme.
    $squeezed = preg_replace('/[\x00-\x20]+/', '', $css);
    if (preg_match('#(?:https?:|ftp:|data:|//)#i', $squeezed)) {
        return 'style_external';
    }
    if (stripos($css, 'data:') !== false) {
        return 'style_external';
    }
    return null;
}
