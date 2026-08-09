<?php
// Runtime SVG sanitizer for visitor-generated artwork
// (PLAN-USER-PROMPTS-CONTRACTS C3).
//
// Pure function: no globals, no I/O, no side effects. REJECT, NEVER REPAIR —
// the input is either returned byte-identical or refused with a reason.
// Repair would create parser-differential bugs between PHP's libxml and the
// browser's SVG parser, and the whole trust boundary rests on the two seeing
// the same document.

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
const JD_SVG_REF_ATTRS = ['href', 'src', 'style', 'values', 'from', 'to', 'by'];

// Allowlisted elements whose contents the HTML parser reads as raw text.
// The stored SVG is inlined with innerHTML, and inside an HTML integration
// point (`desc`, `title`) these two are tokenized as HTML, not XML: whatever
// bytes sit between the tags are literal source, so a `</style>` or
// `</title>` buried in a CDATA section or a comment — both invisible to an
// element walk, and a comment is invisible to textContent as well — closes
// the element and turns the rest into real HTML nodes. Only text children
// are permitted inside them.
const JD_SVG_RAW_TEXT_ELEMENTS = ['style', 'title'];

// C3.3 rule 6 — elements that can retarget another element's attribute.
const JD_SVG_ANIMATION_ELEMENTS = ['animate', 'set', 'animateTransform', 'animateMotion'];

/**
 * @return array{ok:true,svg:string}|array{ok:false,reason:string}
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
    } finally {
        libxml_clear_errors();
        libxml_use_internal_errors($previousErrors);
        libxml_set_external_entity_loader($previousLoader);
    }

    // 6. Pass — the original string, untouched.
    return ['ok' => true, 'svg' => $svg];
}

// Every node in the document that is not an element: CDATA sections and
// processing instructions are refused outright, comments only inside the raw
// text elements. Iterative rather than recursive — a 300 KB input can nest
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
                    // CDATA sections and processing instructions. Nothing an
                    // LLM legitimately draws needs either, and both are ways
                    // of carrying bytes that one parser calls inert data and
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
    // tag — so it arrives only entity-encoded or smuggled in a node type
    // jd_svg_scan_node_types() already refuses. Backstop for both.
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
