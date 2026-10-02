<?php
$page_title = 'Privacy Policy - Municipal Sky';
$page_description = 'How Municipal Sky collects and uses information, including the Onomatopoeia Bot and The Junk Drawer.';
include 'includes/header.php';
?>

<!-- Main Content -->
<div class="main-wrapper">
    <div class="content-frame">
        <div class="post-container">
            <h1 class="section-title">Privacy Policy</h1>
            <div class="section-divider"></div>

            <div class="prose-flow">
                <p><strong>Effective date:</strong> June 16, 2026<br>
                    <strong>Last updated:</strong> October 1, 2026
                </p>

                <p>This site, Municipal Sky (&ldquo;the site,&rdquo; &ldquo;I,&rdquo; &ldquo;me&rdquo;), is a
                    personal project. This policy explains what information the site collects, why, and what choices
                    you have. Questions or requests:
                    <a href="mailto:tysonwelsh@gmail.com">tysonwelsh@gmail.com</a>.
                </p>

                <p>Most of the site is for reading, looking and listening. Four features collect personal information:
                    the <strong>Onomatopoeia Bot</strong>, the <strong>email signup</strong> in the footer,
                    <strong>The Junk Drawer</strong> when you take a turn, and <strong>reader accounts</strong> on A
                    Thousand Flowers. Some pages also count visits, as described below.
                </p>

                <h2>1. Information collected</h2>
                <p><strong>When you use the Onomatopoeia Bot:</strong></p>
                <ul>
                    <li><strong>The text you submit</strong> &mdash; the word, sound, or description you type for the
                        bot to transcribe.</li>
                    <li><strong>The AI-generated responses</strong> shown to you.</li>
                    <li><strong>Your feedback</strong> &mdash; if you rate the responses, your preference rating (a
                        1&ndash;7 value).</li>
                    <li><strong>Technical information</strong> &mdash; your <strong>IP address</strong> (stored as a
                        session identifier to group activity from a single visit), a timestamp, and the model settings
                        used (e.g., temperature).</li>
                </ul>
                <p>This information is stored in a database I control. Some submitted prompts may be reused as the
                    example prompts the bot suggests to other visitors, so please don&rsquo;t type anything you
                    wouldn&rsquo;t want shown.</p>

                <p><strong>When you sign up for email updates (the footer form):</strong></p>
                <ul>
                    <li><strong>Your email address.</strong></li>
                    <li><strong>The date you signed up</strong> and <strong>which page you signed up from</strong> (a
                        page path such as &ldquo;/chatbots/&rdquo; &mdash; not personal to you). I do not store your IP
                        address with your signup.</li>
                </ul>

                <p><strong>When you create a reader account on A Thousand Flowers:</strong></p>
                <ul>
                    <li><strong>Your username</strong>, your <strong>password</strong> (stored only as a one-way hash,
                        never as the password itself), when the account was created, and when you last signed in.</li>
                </ul>

                <p><strong>Across the rest of the site:</strong></p>
                <ul>
                    <li><strong>Visit counts</strong> &mdash; some pages record that they were viewed, and sometimes
                        that a button was used (e.g., a chart was downloaded or a piece was played). Each record carries
                        a <strong>daily-rotating visitor code</strong>: a one-way hash of your IP address mixed with a
                        secret value and the date. It lets me count how many different visitors came on a given day; it
                        changes at midnight UTC, so it cannot follow you from one day to the next, and your raw IP address
                        is not stored with it.</li>
                    <li><strong>Server logs</strong> &mdash; like most web hosts, my hosting provider automatically logs
                        standard request data (including IP addresses) for security and operation. The site&rsquo;s own
                        error logs can also contain IP addresses and text submitted to the bot. These logs are kept for a
                        limited time.</li>
                </ul>

                <p><strong>Cookies and browser storage:</strong> the site uses <strong>no advertising or analytics
                        cookies</strong> and no third-party advertising or analytics trackers. The A Thousand Flowers
                    pages set one session cookie, which keeps you signed in and expires when you close your browser.
                    Some pages keep small settings in your browser&rsquo;s own storage (for example a chosen theme, sound
                    settings, or arcade scores); these stay on your device. The Junk Drawer&rsquo;s device code, which
                    <em>is</em> sent to me, is described in section 4.</p>

                <h2>2. How the information is used</h2>
                <ul>
                    <li>To <strong>operate</strong> the bot and The Junk Drawer &mdash; generate and return their
                        responses.</li>
                    <li>To <strong>study and improve</strong> them &mdash; analyzing submissions and ratings to compare
                        how different AI models perform. This is a creative/research project.</li>
                    <li>To <strong>send occasional email updates</strong>, if you have signed up for them.</li>
                    <li>To <strong>keep track of the site</strong> &mdash; I receive a daily summary email of recent
                        activity (see section 3).</li>
                    <li>To <strong>maintain and secure</strong> the site.</li>
                </ul>
                <p>I <strong>do not sell</strong> your information, and I do not use it for advertising.</p>

                <h2>3. Third parties</h2>
                <p><strong>AI providers.</strong> To generate responses, the bot and The Junk Drawer send <strong>the
                        text you submit</strong> to third-party AI services:</p>
                <ul>
                    <li><strong>Anthropic (Claude)</strong> &mdash;
                        <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener">privacy
                            policy</a>.
                    </li>
                    <li><strong>OpenAI</strong> &mdash;
                        <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener">privacy
                            policy</a>.
                    </li>
                    <li><strong>Moonshot AI (Kimi)</strong> &mdash;
                        <a href="https://platform.moonshot.ai/docs/agreement/userprivacy" target="_blank"
                            rel="noopener">privacy policy</a>.
                    </li>
                    <li><strong>Google (Gemini)</strong> &mdash;
                        <a href="https://policies.google.com/privacy" target="_blank"
                            rel="noopener">privacy policy</a>.
                    </li>
                </ul>
                <p>Your input is processed by these providers under their own privacy policies. <strong>Please
                        don&rsquo;t enter personal, sensitive, or confidential information into the bot or The Junk
                        Drawer.</strong></p>

                <p><strong>Hosting.</strong> My hosting provider stores the data and serves the site.</p>

                <p><strong>Email.</strong> I receive a daily summary of site activity at my Gmail address. It includes
                    recent bot prompts and responses, new Junk Drawer prompts, visit counts, and the email addresses of
                    new subscribers, so copies of those are held by Google as my email provider.</p>

                <p><strong>Fonts and code libraries.</strong> Some pages load fonts or code libraries from outside
                    services &mdash; Google Fonts, d3js.org, cdnjs (Cloudflare), and the Tailwind CSS CDN. When a page
                    does, your browser connects to that service directly, which gives it your IP address and the address
                    of the page, under its own privacy policy. The site&rsquo;s main pages use fonts hosted on this
                    site.</p>

                <p>I don&rsquo;t otherwise share your information with third parties, except where required by
                    law.</p>

                <h2>4. The Junk Drawer &mdash; taking a turn</h2>
                <p>The Junk Drawer lets you describe an object and have four different AI models each draw it. The turn
                    card summarizes what happens and links to this section. Each turn is stored with the version of the
                    following disclosure that was current when you sent it:</p>
                <blockquote>
                    <p>When you take a turn, the words you type are sent to four AI providers &mdash; Anthropic
                        (Claude), OpenAI (GPT), Moonshot AI (Kimi), and Google (Gemini) &mdash; which each draw an
                        object from them. Your prompt, the drawings that come back, your ratings, a daily-rotating
                        visitor code made from your IP address, and a random device code your browser keeps (so the
                        turns and grades from one device can be studied together) are stored so the results can be
                        studied and the feature kept honest. Once you have rated every drawing, your prompt and the
                        drawings join the public drawer, where other visitors can see them, unless you tick
                        &ldquo;keep this one out of the drawer&rdquo; before you finish.</p>
                </blockquote>

                <p><strong>What is stored, in the categories app stores use:</strong></p>
                <ul>
                    <li><strong>User Content</strong> &mdash; the prompt text you type, stored exactly as you wrote it,
                        and the SVG drawings the four models return.</li>
                    <li><strong>Usage Data</strong> &mdash; your ratings: the overall grade and any per-axis annotations
                        you choose to give each drawing, any short notes you attach, whether you flagged a drawing as
                        broken or offensive, and which of the drawings you preferred (or that you called it a tie).
                    </li>
                    <li><strong>Identifiers</strong> &mdash; a <strong>daily-rotating visitor code</strong>. It is a
                        one-way hash of your IP address mixed with a secret value and today&rsquo;s date. Your raw IP
                        address is <strong>not</strong> stored with your turn. Because the date is part of it, the code
                        changes every day at midnight UTC: it can group one visitor&rsquo;s turns within a single day
                        &mdash; which is how the daily limits work &mdash; and it cannot be used to follow you from one
                        day to the next.</li>
                    <li><strong>Identifiers</strong> &mdash; a <strong>random device code</strong> (since 10 September
                        2026). The first time you send a turn &mdash; never on a mere visit &mdash; the page makes a
                        random code, keeps it in your browser&rsquo;s local storage for this site, and sends it with
                        each turn you take, so the turns and grades that came from one browser can be studied together
                        even across days. It is a random number: it is not made from your IP address or from anything
                        about you or your device, it is not shared with anyone, and it is not used for advertising.
                        Clearing this site&rsquo;s data in your browser removes it; a new one is made only if you take
                        another turn.</li>
                    <li><strong>Diagnostics</strong> &mdash; which model drew which side, the exact model version and
                        settings used, how long each drawing took, the provider&rsquo;s token counts, and whether the
                        drawing arrived cleanly, failed, or was refused by the site&rsquo;s safety check on generated
                        images.</li>
                </ul>

                <p><strong>Who receives your prompt:</strong> the words you type are sent to
                    <strong>Anthropic (Claude)</strong>, <strong>OpenAI (GPT)</strong>, <strong>Moonshot AI
                    (Kimi)</strong> and <strong>Google (Gemini)</strong> &mdash; all named in section 3
                    above, with links to their privacy policies. As with the bot,
                    <strong>please don&rsquo;t type personal, sensitive, or confidential information into it.</strong>
                </p>

                <p><strong>What other visitors see:</strong> when you have graded every drawing and ranked them, your
                    turn &mdash; <strong>your prompt, exactly as you typed it, and the drawings</strong> &mdash; joins
                    the public drawer, where anyone visiting can see it, and the prompt and the grades can appear in the
                    drawer&rsquo;s public statistics. Your ratings notes, visitor code and device code are never shown.
                    To keep a turn private, tick <strong>&ldquo;keep this one out of the drawer&rdquo;</strong> on the
                    last card before you finish; a turn you leave half-rated is not shown either. I may also remove any
                    turn from the drawer, and I may add a published turn to the drawer&rsquo;s permanent collection,
                    which is kept in the site&rsquo;s public source-code repository.</p>

                <p><strong>What stays on your device:</strong> the turn you have in progress and the drawings you keep
                    are held in your browser&rsquo;s own session storage, which is local to your device and is not sent
                    to me. The random device code described above is also held in your browser (local storage), and that
                    one is sent with each turn.</p>

                <p><strong>Why it is kept and for how long:</strong> the point of the feature is comparing how different
                    AI models draw the same brief, so prompts, drawings, ratings, and preferences are kept
                    <strong>indefinitely</strong> as research data, including the ones where a model failed or produced
                    something unusable. To ask for yours to be deleted, email
                    <a href="mailto:tysonwelsh@gmail.com">tysonwelsh@gmail.com</a>; because no account is stored,
                    please include the approximate date and time you took the turn and roughly what you typed, so I
                    can find it. If you can, include your device code &mdash; in your browser&rsquo;s developer tools it
                    is the local-storage entry named <code>jd-device</code> for this site &mdash; and I can find every
                    turn from that browser at once. I will take a published turn out of the drawer; if it was added to
                    the permanent collection, I will remove it from the site, though earlier copies can remain in the
                    public repository&rsquo;s history.</p>

                <h2>5. Legal basis (for EU/UK/EEA users)</h2>
                <p>Where the GDPR or UK GDPR applies, I process this information on the basis of <strong>legitimate
                        interests</strong> &mdash; operating and improving a small creative project &mdash; balanced
                    against your rights. For a <strong>reader account</strong>, the basis is providing the account you
                    asked for. For <strong>email updates</strong>, I rely on your <strong>consent</strong>, which you
                    give by submitting the signup form and can withdraw at any time by unsubscribing.</p>

                <h2>6. Data retention</h2>
                <p>I keep bot submissions and feedback, and Junk Drawer turns, <strong>indefinitely</strong> for the
                    project&rsquo;s research purposes. If you subscribe to email updates, I keep your email address until
                    you unsubscribe. Reader accounts are kept until you ask me to delete yours. Visit counts may also be
                    kept indefinitely. Daily summary emails stay in my inbox until I delete them. You can ask me to
                    delete data associated with you at any time (see &ldquo;Your rights&rdquo; below).</p>

                <h2>7. Your rights</h2>
                <p>Depending on where you live (e.g., the EU/UK under GDPR, or California under the CCPA), you may have
                    the right to <strong>access, correct, delete, or restrict</strong> the information I hold about you,
                    to <strong>object to</strong> processing, and to <strong>data portability</strong>. California
                    residents also have the right to know what is collected and to deletion; <strong>I do not sell
                        personal information</strong>.</p>
                <p>To make a request, email <a href="mailto:tysonwelsh@gmail.com">tysonwelsh@gmail.com</a>. The site
                    has no accounts other than A Thousand Flowers&rsquo;, so to find your data I may need details such
                    as the approximate date and time you used a feature, what you typed, or your Junk Drawer device
                    code. <strong>To unsubscribe from email updates</strong>, email me and I will remove your address
                    promptly. EU/UK users also have the right to lodge a complaint with their local data protection
                    authority.</p>

                <h2>8. International users</h2>
                <p>The site is operated in the United States and information is stored there. The AI providers in
                    section 3 may process your text in other countries; Moonshot AI is based in China. If you use the
                    site from outside the U.S., you consent to these transfers.</p>

                <h2>9. Children</h2>
                <p>The site is not directed to children under 13, and I do not knowingly collect information from
                    them. If you are under 13, please don&rsquo;t use the Onomatopoeia Bot, The Junk Drawer, the email
                    signup, or reader accounts.</p>

                <h2>10. &ldquo;Do Not Track&rdquo;</h2>
                <p>The site does not track users across third-party websites, so it does not respond to browser
                    &ldquo;Do Not Track&rdquo; signals.</p>

                <h2>11. Changes to this policy</h2>
                <p>I may update this policy from time to time. The &ldquo;Last updated&rdquo; date above reflects the
                    latest version.</p>

                <h2>12. Contact</h2>
                <p>Municipal Sky &mdash; <a href="mailto:tysonwelsh@gmail.com">tysonwelsh@gmail.com</a></p>
            </div>
        </div>
    </div>
</div>

<?php include 'includes/footer.php'; ?>
