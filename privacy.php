<?php
$page_title = 'Privacy Policy - Municipal Sky';
$page_description = 'How Municipal Sky collects and uses information, including the Onomatopoeia Bot.';
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
                    <strong>Last updated:</strong> August 9, 2026
                </p>

                <p>This site, Municipal Sky (&ldquo;the site,&rdquo; &ldquo;I,&rdquo; &ldquo;me&rdquo;), is a
                    personal project. This policy explains what information the site collects, why, and what choices
                    you have. Questions or requests:
                    <a href="mailto:tysonwelsh@gmail.com">tysonwelsh@gmail.com</a>.
                </p>

                <p>The site is largely static. Three features collect personal information: the
                    <strong>Onomatopoeia Bot</strong>, the <strong>email signup</strong> in the footer, and
                    <strong>The Junk Drawer</strong> when you take a turn and describe an object for it. A separate,
                    anonymous usage counter is described below.
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
                <p>This information is stored in a database I control.</p>

                <p><strong>When you sign up for email updates (the footer form):</strong></p>
                <ul>
                    <li><strong>Your email address.</strong></li>
                    <li><strong>The date you signed up</strong> and <strong>which page you signed up from</strong> (a
                        page path such as &ldquo;/chatbots/&rdquo; &mdash; not personal to you). I do not store your IP
                        address or other identifying information with your signup.</li>
                </ul>

                <p><strong>Across the rest of the site:</strong></p>
                <ul>
                    <li><strong>Anonymous usage counts</strong> &mdash; some pages tally aggregate events (e.g., how
                        many times a chart was viewed or downloaded). These counts contain <strong>no IP address,
                            location, or other identifying information</strong> and cannot be linked to you.</li>
                    <li><strong>Server logs</strong> &mdash; like most web hosts, my hosting provider may automatically
                        log standard request data (including IP addresses) for security and operation. These are
                        managed by the host and kept for a limited time.</li>
                </ul>
                <p><strong>The site does not use cookies or other tracking technologies, and there are no third-party
                        advertising or analytics trackers.</strong></p>

                <h2>2. How the information is used</h2>
                <ul>
                    <li>To <strong>operate the bot</strong> &mdash; generate and return onomatopoeia responses.</li>
                    <li>To <strong>study and improve</strong> the bot &mdash; analyzing submissions and preference
                        ratings to compare how different AI models perform. This is a creative/research project.</li>
                    <li>To <strong>send occasional email updates</strong>, if you have signed up for them.</li>
                    <li>To <strong>maintain and secure</strong> the site.</li>
                </ul>
                <p>I <strong>do not sell</strong> your information, and I do not use it for advertising.</p>

                <h2>3. AI providers (third-party processing)</h2>
                <p>To generate responses, the bot sends <strong>the text you submit</strong> to third-party AI
                    services:</p>
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
                        don&rsquo;t
                        enter personal, sensitive, or confidential information into the bot.</strong></p>
                <p>I also rely on my <strong>hosting provider</strong> to store data and serve the site. I don&rsquo;t
                    otherwise share your information with third parties, except where required by law.</p>

                <h2>4. The Junk Drawer &mdash; taking a turn</h2>
                <p>The Junk Drawer lets you describe an object and have four different AI models each draw it. Before
                    your first turn, the page shows you this and asks you to agree to it:</p>
                <blockquote>
                    <p>When you take a turn, the words you type are sent to four AI providers &mdash; Anthropic
                        (Claude), OpenAI (GPT), Moonshot AI (Kimi), and Google (Gemini) &mdash; which each
                        draw an object from them. Your prompt, the drawings that come back, your ratings, and an
                        anonymous daily-rotating visitor code are stored so the results can be studied and the feature
                        kept honest. Nothing you type here is shown to other visitors.</p>
                </blockquote>

                <p><strong>What is stored, in the categories app stores use:</strong></p>
                <ul>
                    <li><strong>User Content</strong> &mdash; the prompt text you type, stored exactly as you wrote it,
                        and the SVG drawings the four models return.</li>
                    <li><strong>Usage Data</strong> &mdash; your ratings: the overall grade and any per-axis annotations
                        you choose to give each drawing, any short notes you attach, whether you flagged a drawing as
                        broken or offensive, and which of the drawings you preferred (or that you called it a tie).
                    </li>
                    <li><strong>Identifiers</strong> &mdash; an <strong>anonymous, daily-rotating visitor code</strong>.
                        It is a one-way hash of your IP address mixed with a secret value and today&rsquo;s date. Your
                        raw IP address is <strong>not</strong> stored with your turn. Because the date is part of it,
                        the code changes every day at midnight UTC: it can group one visitor&rsquo;s turns within a
                        single day &mdash; which is how the daily limits work &mdash; and it cannot be used to follow
                        you from one day to the next.</li>
                    <li><strong>Diagnostics</strong> &mdash; which model drew which side, the exact model version and
                        settings used, how long each drawing took, the provider&rsquo;s token counts, and whether the
                        drawing arrived cleanly, failed, or was refused by the site&rsquo;s safety check on generated
                        images.</li>
                </ul>

                <p><strong>Who receives your prompt:</strong> the words you type are sent to
                    <strong>Anthropic (Claude)</strong>, <strong>OpenAI (GPT)</strong>, <strong>Moonshot AI
                    (Kimi)</strong> and <strong>Google (Gemini)</strong> &mdash; all named in section 3
                    above, with links to their privacy policies &mdash; and to nobody else. As with the bot,
                    <strong>please don&rsquo;t type personal, sensitive, or confidential information into it.</strong>
                </p>

                <p><strong>What stays on your device:</strong> your agreement to the disclosure above, the turn you have
                    in progress, and the drawings you keep are held in your browser&rsquo;s own session storage. That is
                    local to your device and is not sent to me. <strong>Drawings made from visitor prompts are never
                        shown to other visitors</strong> &mdash; the ones you keep appear only in your own copy of the
                    drawer.</p>

                <p><strong>Why it is kept and for how long:</strong> the point of the feature is comparing how different
                    AI models draw the same brief, so prompts, drawings, ratings, and preferences are kept
                    <strong>indefinitely</strong> as research data, including the ones where a model failed or produced
                    something unusable. To ask for yours to be deleted, email
                    <a href="mailto:tysonwelsh@gmail.com">tysonwelsh@gmail.com</a>; because no account and no lasting
                    identifier is stored, please include the approximate date and time you took the turn and roughly
                    what you typed, so I can find it.</p>

                <h2>5. Legal basis (for EU/UK/EEA users)</h2>
                <p>Where the GDPR or UK GDPR applies, I process this information on the basis of <strong>legitimate
                        interests</strong> &mdash; operating and improving a small creative tool &mdash; balanced
                    against your rights. For <strong>email updates</strong>, I rely on your <strong>consent</strong>,
                    which you give by submitting the signup form and can withdraw at any time by unsubscribing.</p>

                <h2>6. Data retention</h2>
                <p>I keep bot submissions and feedback <strong>indefinitely</strong> for the project&rsquo;s research
                    purposes. If you subscribe to email updates, I keep your email address until you unsubscribe.
                    Anonymous usage counts may also be kept indefinitely, as they identify no one. You can ask me to
                    delete data associated with you at any time (see &ldquo;Your rights&rdquo; below).</p>

                <h2>7. Your rights</h2>
                <p>Depending on where you live (e.g., the EU/UK under GDPR, or California under the CCPA), you may have
                    the right to <strong>access, correct, delete, or restrict</strong> the information I hold about you,
                    to <strong>object to</strong> processing, and to <strong>data portability</strong>. California
                    residents also have the right to know what is collected and to deletion; <strong>I do not sell
                        personal information</strong>.</p>
                <p>To make a request, email <a href="mailto:tysonwelsh@gmail.com">tysonwelsh@gmail.com</a>. Because the
                    only identifier I store is an IP address tied to a session, I may need that information (e.g., the
                    approximate date and time you used the bot) to locate your data. <strong>To unsubscribe from email
                        updates</strong>, email me and I will remove your address promptly. EU/UK users also have the
                    right to lodge a complaint with their local data protection authority.</p>

                <h2>8. International users</h2>
                <p>The site is operated in the United States and information is processed and stored there. If you use
                    the site from outside the U.S., you consent to that transfer.</p>

                <h2>9. Children</h2>
                <p>The site is not directed to children under 13, and I do not knowingly collect information from
                    them.</p>

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