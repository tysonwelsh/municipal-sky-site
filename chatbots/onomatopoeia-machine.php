<?php
$page_title = 'The Onomatopoeia Machine - Municipal Sky';
$page_description = 'Experimental art at the human-machine interface: describe a sound, and two AI models transcribe it into inventive onomatopoeia for you to compare.';
$page_image = '/images/onomatopoeia-machine-share.png';
include '../includes/header.php';
?>
<link rel="stylesheet" href="onomatopoeia-bot.css?v=1">
<div class="main-wrapper">
    <div class="content-frame">
        <div class="post-container">
        </div>
        <div class="mobile-not-supported">
            <div class="mobile-message-paper">
                <div class="ascii-border">+========================+<br>| SCREEN SIZE ERROR
                    |<br>+========================+</div>

                <h2>Display Too Small</h2>

                <p class="paragraph-first">This application requires a larger display to function properly.</p>

                <p class="paragraph-second">Please access the Onomatopoeia Machine using a desktop or laptop computer
                    for the full experience.</p>

                <div class="ascii-border-bottom">+-----------------------+<br>| Municipal Sky
                    |<br>+-----------------------+</div>
            </div>
        </div>
        <div class="app-container wide-container">
            <section class="chatbot-container">

                <!-- UPDATED: Display container with molded plastic design -->
                <div class="display-container">

                    <div class="chat-area">
                        <div class="chat-columns-wrapper" id="chatColumnsWrapper">
                            <div class="welcome-overlay" id="welcomeOverlay">
                                <div class="welcome-content">
                                    <div class="ascii-container">
                                        <h2 class="ascii-main-title">ONOMATOPOEIA MACHINE</h2>
                                    </div>
                                    <div class="welcome-epigraph">
                                        <p>"<i>Sllt</i>. The nethermost deck of the first machine jogged forward
                                            its
                                            flyboard
                                            with <i>sllt</i> the first batch of quirefolded papers. <i>Sllt</i>. Almost
                                            human the way
                                            it <i>sllt</i> to call attention. Doing its level best to speak. That door
                                            too <i>sllt</i>
                                            creaking, asking to be shut. Everything speaks in its own way. <i>Sllt</i>."
                                        </p>
                                        <p class="epigraph-attribution">— <em>Ulysses</em> 7.174-177</p>
                                    </div>
                                </div>
                            </div>
                            <div class="prompt-strips">
                                <div class="prompt-strips-container" id="promptStripsContainer">
                                </div>
                            </div>
                            <div class="prompt-header-strips">
                                <div class="prompt-header-strips-container" id="promptHeaderStrips">
                                </div>
                            </div>
                            <div class="footer-strips">
                                <div class="footer-strips-container" id="footerStripsContainer">
                                </div>
                            </div>
                            <div class="chat-column bot-a" id="claudeColumn">
                                <div class="header-strips">
                                    <div class="header-strips-container" id="claudeHeaderStrips">
                                    </div>
                                </div>
                                <div class="message-border-strips">
                                    <div class="message-border-strips-container" id="claudeMessageBorders">
                                    </div>
                                </div>
                                <div class="chat-messages" id="claudeMessages">
                                    <div class="messages-container">
                                    </div>
                                </div>
                            </div>
                            <div class="chat-column bot-b" id="geminiColumn">
                                <div class="header-strips">
                                    <div class="header-strips-container" id="geminiHeaderStrips">
                                    </div>
                                </div>
                                <div class="message-border-strips">
                                    <div class="message-border-strips-container" id="geminiMessageBorders">
                                    </div>
                                </div>
                                <div class="chat-messages" id="geminiMessages">
                                    <div class="messages-container">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="status-feedback-display tv-display" id="statusFeedbackDisplay">
                        <div class="tv-content" id="statusContent">
                            <span class="tv-emoji">📖</span>
                            <div class="display-text">Describe something that makes a distinctive sound, and<br>marvel
                                as competing chatbots transcribe it into text!<br>Need some ideas? Hit the
                                8-ball button for a random prompt.</div>
                        </div>

                        <div class="feedback-mode" id="feedbackContent" style="display: none;">
                            <div class="feedback-content">
                                <div class="feedback-question">Which response do you like best?</div>
                                <div class="feedback-controls">
                                    <div class="intensity-signals" id="intensitySignals">
                                        <div class="signal signal-left">
                                            <span></span><span></span><span></span><span></span><span></span>
                                            <span></span><span></span><span></span><span></span><span></span>
                                            <span></span><span></span><span></span><span></span><span></span>
                                        </div>
                                        <div class="signal signal-right">
                                            <span></span><span></span><span></span><span></span><span></span>
                                            <span></span><span></span><span></span><span></span><span></span>
                                            <span></span><span></span><span></span><span></span><span></span>
                                        </div>
                                    </div>
                                    <div class="feedback-slider-labels">
                                        <span>Much Better</span>
                                        <span>Better</span>
                                        <span>Slightly Better</span>
                                        <span>Same</span>
                                        <span>Slightly Better</span>
                                        <span>Better</span>
                                        <span>Much Better</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="tv-scanlines"></div>
                    </div>

                </div>

                <div class="persistent-slider-container">
                    <div class="slider-wrapper">
                        <input type="range" min="1" max="7" value="4" step="0.01" class="feedback-slider"
                            id="feedbackSlider" disabled>
                    </div>
                </div>

                <div class="chat-input-section" id="inputSection">
                    <div class="chat-input" id="chatInputArea">
                        <div class="input-wrapper">
                            <!-- MODIFIED: Status lights moved here -->
                            <div class="temp-slider-container">
                                <div class="status-indicators">
                                    <div class="status-light bot-a-status" id="botAStatus" title="Response A Status">
                                        <div class="status-light-inner"></div>
                                    </div>
                                    <div class="status-light bot-b-status" id="botBStatus" title="Response B Status">
                                        <div class="status-light-inner"></div>
                                    </div>
                                </div>
                                <div class="temp-slider-track">
                                    <div class="temp-roller-wheel"></div>
                                    <div class="temp-indicator-line"></div>
                                    <input type="range" id="temperatureSlider" class="temp-slider" min="0" max="100"
                                        value="80">
                                </div>
                            </div>
                            <div class="input-side">
                                <textarea id="userInput"
                                    placeholder="Enter a machine, animal, event, instrument, or some other entity that makes noise..."
                                    maxlength="200" rows="3"></textarea>
                            </div>
                            <div class="buttons-side">
                                <div class="buttons-container">
                                    <button class="btn btn-illuminated send-btn" id="sendBtn">
                                        <span class="btn-illuminated-face">Transmit</span>
                                    </button>

                                    <!-- New container for the bottom row -->
                                    <div class="button-footer-row">
                                        <button class="btn btn-illuminated random-btn" id="randomBtn">
                                            <span class="btn-illuminated-face">🎱</span>
                                        </button>
                                        <div class="signature-label label-screenprint">
                                            <div class="line1">Onomatopoeia Machine</div>
                                            <div class="line2">Municipal Sky</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <input type="hidden" id="temperatureValue" value="0.80">
                    </div>
                </div>

            </section>
        </div>


        </section>
    </div>
</div>
</div>

<script>
    // Configuration
    const API_BASE_URL = '';
    let currentFeedbackData = null;
    let selectedRating = null;
    let isFirstMessage = true;
    let randomPrompts = []; // Store prompts globally
    let lastUsedPrompt = null; // Track last used prompt to avoid repetition

    // Animation controller class for better management
    class ScrollAnimationController {
        constructor() {
            this.isAnimating = false;
            this.animationQueue = [];
        }

        async animate() {
            if (this.isAnimating) {
                return new Promise((resolve) => {
                    this.animationQueue.push(resolve);
                });
            }

            this.isAnimating = true;
            const wrapper = document.getElementById('chatColumnsWrapper');
            const claudeContainer = document.querySelector('#claudeMessages .messages-container');
            const geminiContainer = document.querySelector('#geminiMessages .messages-container');
            const claudeHeaders = document.getElementById('claudeHeaderStrips');
            const geminiHeaders = document.getElementById('geminiHeaderStrips');
            const claudeMessageBorders = document.getElementById('claudeMessageBorders');
            const geminiMessageBorders = document.getElementById('geminiMessageBorders');
            const promptStrips = document.getElementById('promptStripsContainer');
            const promptHeaders = document.getElementById('promptHeaderStrips');
            const footerStrips = document.getElementById('footerStripsContainer');
            const welcomeOverlay = document.getElementById('welcomeOverlay');

            // Add scrolling classes to trigger CSS animations
            wrapper.classList.add('scrolling');
            claudeHeaders.classList.add('scrolling');
            geminiHeaders.classList.add('scrolling');
            claudeMessageBorders.classList.add('scrolling');
            geminiMessageBorders.classList.add('scrolling');
            promptStrips.classList.add('scrolling');
            promptHeaders.classList.add('scrolling');
            footerStrips.classList.add('scrolling');

            // If welcome overlay is visible, scroll it too
            if (welcomeOverlay && welcomeOverlay.style.display !== 'none') {
                welcomeOverlay.classList.add('scrolling');
            }

            if (claudeContainer) claudeContainer.classList.add('scrolling');
            if (geminiContainer) geminiContainer.classList.add('scrolling');

            // Wait for animation to complete
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Clean up
            wrapper.classList.remove('scrolling');
            claudeHeaders.classList.remove('scrolling');
            geminiHeaders.classList.remove('scrolling');
            claudeMessageBorders.classList.remove('scrolling');
            geminiMessageBorders.classList.remove('scrolling');
            promptStrips.classList.remove('scrolling');
            promptHeaders.classList.remove('scrolling');
            footerStrips.classList.remove('scrolling');

            // Hide welcome overlay after first scroll
            if (welcomeOverlay && welcomeOverlay.classList.contains('scrolling')) {
                welcomeOverlay.style.display = 'none';
                welcomeOverlay.classList.remove('scrolling');
            }

            // Reset positions
            this.resetStripPositions('.header-strip', -24);
            this.resetStripPositions('.prompt-strip', -90);
            this.resetStripPositions('.prompt-header-strip', -30);
            this.resetStripPositions('.message-border-strip', -142);
            this.resetStripPositions('.footer-strip', -60);

            // Clear messages
            if (claudeContainer) claudeContainer.remove();
            if (geminiContainer) geminiContainer.remove();

            // Create fresh containers
            this.createFreshContainers();

            this.isAnimating = false;

            // Process any queued animations
            while (this.animationQueue.length > 0) {
                const resolve = this.animationQueue.shift();
                resolve();
            }
        }

        resetStripPositions(selector, minTop) {
            const allStrips = document.querySelectorAll(selector);
            allStrips.forEach(strip => {
                const currentTop = parseInt(strip.style.top);
                const newTop = currentTop - 360;
                strip.style.transition = 'none';
                if (newTop < minTop) {
                    strip.style.top = `${newTop + (12 * 360)}px`;
                } else {
                    strip.style.top = `${newTop}px`;
                }
                strip.offsetHeight; // Force reflow
                strip.style.transition = '';
            });
        }

        setCurrentPrompt(promptText) {
            const allPrompts = document.querySelectorAll('.prompt-strip');
            allPrompts.forEach(strip => {
                const topPosition = parseInt(strip.style.top);
                if (topPosition === 373) { // Will be at 13px after -360px scroll
                    const textElement = strip.querySelector('.prompt-strip-text');
                    textElement.textContent = promptText;
                }
            });
        }

        setCurrentRating(rating) {
            const allFooterStrips = document.querySelectorAll('.footer-strip');
            const isMobile = window.innerWidth <= 768;
            allFooterStrips.forEach(strip => {
                const topPosition = parseInt(strip.style.top);
                const targetPreScrollPosition = isMobile ? 493 : 225;
                if (topPosition === targetPreScrollPosition) {
                    const bubbles = strip.querySelectorAll('.scantron-bubble');
                    bubbles.forEach(b => b.classList.remove('marked'));
                    if (rating >= 1 && rating <= 7) {
                        bubbles[rating - 1].classList.add('marked');
                    }
                }
            });
        }

        createFreshContainers() {
            const claudeMessages = document.getElementById('claudeMessages');
            const geminiMessages = document.getElementById('geminiMessages');

            if (!claudeMessages.querySelector('.messages-container')) {
                const container = document.createElement('div');
                container.className = 'messages-container';
                claudeMessages.appendChild(container);
            }

            if (!geminiMessages.querySelector('.messages-container')) {
                const container = document.createElement('div');
                container.className = 'messages-container';
                geminiMessages.appendChild(container);
            }
        }
    }

    // Create global animation controller
    const scrollController = new ScrollAnimationController();

    // Load prompts from JSON file
    async function loadPrompts() {
        try {
            const response = await fetch('prompts.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            randomPrompts = data.prompts;
            console.log(`Loaded ${randomPrompts.length} prompts from JSON`);
        } catch (error) {
            console.error('Failed to load prompts from JSON:', error);
            // Fallback to a few hardcoded prompts if file fails to load
            randomPrompts = [
                'rain on window',
                'old car starting',
                'cat purring',
                'thunder in the distance',
                'coffee percolating'
            ];
            console.log('Using fallback prompts');
        }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', function () {
        checkApiStatus();
        generateStrips();
        loadPrompts(); // Load prompts when page loads

        // Input handling
        const userInput = document.getElementById('userInput');
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.addEventListener('click', sendMessage);

        userInput.addEventListener('input', function (e) {
            sendBtn.disabled = e.target.value.trim() === '';
        });

        userInput.addEventListener('keypress', function (event) {
            if (event.key === 'Enter' && !event.shiftKey && !sendBtn.disabled) {
                event.preventDefault();
                sendMessage();
            }
        });

        const slider = document.getElementById('feedbackSlider');
        slider.addEventListener('input', handleSliderInput);

        // Temperature slider functionality
        const tempSlider = document.getElementById('temperatureSlider');
        const tempValueField = document.getElementById('temperatureValue');
        const rollerWheel = document.querySelector('.temp-roller-wheel');
        const indicatorLine = document.querySelector('.temp-indicator-line');

        tempSlider.addEventListener('input', function () {
            // Convert 0-100 range to 0.50-1.00
            const value = (0.50 + (this.value / 100) * 0.50).toFixed(2);
            tempValueField.value = value;
            console.log('Temperature value:', value);

            // Both indicator and texture should move together
            // Map slider value (0-100) to position (100%-0%)
            const position = 100 - this.value;

            // Move the indicator line
            indicatorLine.style.setProperty('--indicator-position', `${position}%`);

            // Move the roller texture at the same rate
            rollerWheel.style.setProperty('--roller-position', `${position}%`);
        });

        // Set initial position for both elements
        const initialValue = tempSlider.value;
        const initialPosition = 100 - initialValue;
        document.querySelector('.temp-roller-wheel').style.setProperty('--roller-position', `${initialPosition}%`);
        document.querySelector('.temp-indicator-line').style.setProperty('--indicator-position', `${initialPosition}%`);

        // Set initial temperature value based on new scale
        const initialTemp = (0.50 + (initialValue / 100) * 0.50).toFixed(2);
        tempValueField.value = initialTemp;
        console.log('Initial temperature value:', initialTemp);

        // Add random button functionality
        const randomBtn = document.getElementById('randomBtn');
        if (randomBtn) {
            randomBtn.addEventListener('click', function () {
                if (randomPrompts.length === 0) {
                    console.error('No prompts available');
                    return;
                }

                let randomPrompt;

                // If we have more than one prompt, avoid repetition
                if (randomPrompts.length > 1) {
                    do {
                        randomPrompt = randomPrompts[Math.floor(Math.random() * randomPrompts.length)];
                    } while (randomPrompt === lastUsedPrompt);
                } else {
                    // If only one prompt, just use it
                    randomPrompt = randomPrompts[0];
                }

                lastUsedPrompt = randomPrompt;
                userInput.value = randomPrompt;
                sendBtn.disabled = false;
            });
        }

        // Simulate initial API check on load
        const botAStatus = document.getElementById('botAStatus');
        const botBStatus = document.getElementById('botBStatus');

        // Show checking state
        botAStatus.classList.add('loading');
        botBStatus.classList.add('loading');

        // Check actual API status
        checkApiStatus();
    });

    // Generate all strips
    function generateStrips() {
        // Generate header strips
        const claudeHeaderContainer = document.getElementById('claudeHeaderStrips');
        const geminiHeaderContainer = document.getElementById('geminiHeaderStrips');
        claudeHeaderContainer.innerHTML = '';
        geminiHeaderContainer.innerHTML = '';

        for (let i = 0; i < 12; i++) {
            const topPosition = (i * 360) + 109 - 360;

            const claudeStrip = document.createElement('div');
            claudeStrip.className = 'header-strip bot-a';
            claudeStrip.textContent = 'Response A';
            claudeStrip.style.top = `${topPosition}px`;
            claudeHeaderContainer.appendChild(claudeStrip);

            const geminiStrip = document.createElement('div');
            geminiStrip.className = 'header-strip bot-b';
            geminiStrip.textContent = 'Response B';
            geminiStrip.style.top = `${topPosition}px`;
            geminiHeaderContainer.appendChild(geminiStrip);
        }

        // Generate prompt strips
        const promptContainer = document.getElementById('promptStripsContainer');
        promptContainer.innerHTML = '';

        for (let i = 0; i < 12; i++) {
            const topPosition = (i * 360) - 347;
            const promptStrip = document.createElement('div');
            promptStrip.className = 'prompt-strip';
            promptStrip.style.top = `${topPosition}px`;
            promptStrip.dataset.index = i;

            const promptText = document.createElement('div');
            promptText.className = 'prompt-strip-text';
            promptText.textContent = '';
            promptStrip.appendChild(promptText);

            promptContainer.appendChild(promptStrip);
        }

        // Generate prompt header strips
        const promptHeaderContainer = document.getElementById('promptHeaderStrips');
        promptHeaderContainer.innerHTML = '';

        for (let i = 0; i < 12; i++) {
            const topPosition = (i * 360) - 347;
            const headerStrip = document.createElement('div');
            headerStrip.className = 'prompt-header-strip';
            headerStrip.textContent = 'PROMPT:';
            headerStrip.style.top = `${topPosition}px`;
            promptHeaderContainer.appendChild(headerStrip);
        }

        // Generate message border strips
        const claudeBorderContainer = document.getElementById('claudeMessageBorders');
        const geminiBorderContainer = document.getElementById('geminiMessageBorders');
        claudeBorderContainer.innerHTML = '';
        geminiBorderContainer.innerHTML = '';

        for (let i = 0; i < 12; i++) {
            const topPosition = (i * 360) + 109 - 360;

            const claudeBorder = document.createElement('div');
            claudeBorder.className = 'message-border-strip bot-a';
            claudeBorder.style.top = `${topPosition}px`;
            claudeBorderContainer.appendChild(claudeBorder);

            const geminiBorder = document.createElement('div');
            geminiBorder.className = 'message-border-strip bot-b';
            geminiBorder.style.top = `${topPosition}px`;
            geminiBorderContainer.appendChild(geminiBorder);
        }

        // Generate footer strips
        generateFooterStrips();
    }

    // Generate footer strips (separate function for resize handling)
    function generateFooterStrips() {
        const footerContainer = document.getElementById('footerStripsContainer');
        footerContainer.innerHTML = '';
        const isMobile = window.innerWidth <= 768;

        for (let i = 0; i < 12; i++) {
            const topPosition = isMobile ? (i * 360) + 493 - 360 : (i * 360) + 225 - 360;
            const footerStrip = document.createElement('div');
            footerStrip.className = 'footer-strip';
            footerStrip.style.top = `${topPosition}px`;
            footerStrip.dataset.index = i;

            const bubbleContainer = document.createElement('div');
            bubbleContainer.className = 'scantron-bubbles';

            for (let j = 1; j <= 7; j++) {
                const bubble = document.createElement('div');
                bubble.className = 'scantron-bubble';
                bubble.dataset.value = j;

                const dot = document.createElement('div');
                dot.className = 'scantron-dot';
                bubble.appendChild(dot);

                bubbleContainer.appendChild(bubble);
            }

            footerStrip.appendChild(bubbleContainer);
            footerContainer.appendChild(footerStrip);
        }
    }

    // Add resize listener
    let resizeTimeout;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function () {
            generateFooterStrips();
        }, 250);
    });

    async function checkApiStatus() {
        console.log('Starting API health check...');
        const botAStatus = document.getElementById('botAStatus');
        const botBStatus = document.getElementById('botBStatus');

        try {
            const response = await fetch(`${API_BASE_URL}/api/health.php`);
            console.log('Health check response status:', response.status);
            const responseText = await response.text();

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, response: ${responseText}`);
            }

            let data;
            try {
                data = JSON.parse(responseText);
                console.log('Parsed health check data:', data);
            } catch (parseError) {
                console.error('Failed to parse JSON response:', parseError);
                throw new Error('API returned invalid JSON');
            }

            // Update status lights based on API health
            if (data.claude) {
                botAStatus.classList.remove('loading', 'error');
                botAStatus.classList.add('active');
            } else {
                botAStatus.classList.remove('loading', 'active');
                botAStatus.classList.add('error');
            }

            // FIXED: Changed from data.gemini to data.openai
            if (data.openai) {
                botBStatus.classList.remove('loading', 'error');
                botBStatus.classList.add('active');
            } else {
                botBStatus.classList.remove('loading', 'active');
                botBStatus.classList.add('error');
            }

            // FIXED: Changed from data.gemini to data.openai
            if (data.claude || data.openai) {
                document.getElementById('sendBtn').disabled = false;
                console.log('Send button enabled - at least one API is working');
            }
        } catch (error) {
            console.error('Health check failed:', error);
            document.getElementById('sendBtn').disabled = false;
            console.log('Send button enabled anyway for testing');

            // Show error state on both lights
            botAStatus.classList.remove('loading', 'active');
            botAStatus.classList.add('error');
            botBStatus.classList.remove('loading', 'active');
            botBStatus.classList.add('error');

            // MODIFIED: Display an error message in the TV display
            showStatus('⚠️', 'Connection to Onomatopoeia Machine failed.<br>Please refresh the page to try again.');
        }
    }

    // Updated show status function for new TV display
    function showStatus(icon, text, textClass = '') {
        const statusContent = document.getElementById('statusContent');
        const feedbackContent = document.getElementById('feedbackContent');

        // Hide feedback content
        feedbackContent.style.display = 'none';

        // Show status content
        statusContent.style.display = 'flex';

        // Update content
        if (icon === 'loading') {
            statusContent.innerHTML = `
            <div class="loader"></div>
            <div class="display-text">${text}</div>
        `;
        } else {
            statusContent.innerHTML = `
            <span class="tv-emoji">${icon}</span>
            <div class="display-text">${text}</div>
        `;
        }
    }

    function showFeedback() {
        const statusContent = document.getElementById('statusContent');
        const feedbackContent = document.getElementById('feedbackContent');

        // Hide status content
        statusContent.style.display = 'none';

        // Show feedback content
        feedbackContent.style.display = 'flex';

        // Enable feedback slider
        const slider = document.getElementById('feedbackSlider');
        slider.disabled = false;
        slider.value = 4;
        selectedRating = 4;

        // Enable transmit button for feedback submission
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.disabled = false;
        sendBtn.classList.add('feedback-mode');
        // Keep the button text as "Transmit"

        // Disable random button during feedback mode
        const randomBtn = document.getElementById('randomBtn');
        randomBtn.disabled = true;

        // Disable textarea and show feedback message
        const userInput = document.getElementById('userInput');
        userInput.disabled = true;
        userInput.placeholder = 'Rate the responses above, then click Transmit to submit your feedback';
        userInput.value = '';

        // Add the click listener when feedback is enabled
        const signalsContainer = document.getElementById('intensitySignals');
        signalsContainer.addEventListener('click', handleSignalClick);

        // Animate bars to ready state
        animateBarsToReady();
    }

    function setPromptTextImmediate(promptText) {
        const allPrompts = document.querySelectorAll('.prompt-strip');
        allPrompts.forEach(strip => {
            const topPosition = parseInt(strip.style.top);
            if (topPosition === 13) {
                const textElement = strip.querySelector('.prompt-strip-text');
                textElement.classList.add('typing');
                typewriterEffectForPrompt(textElement, promptText);
            }
        });
    }

    function typewriterEffectForPrompt(element, text) {
        let index = 0;
        const speed = 30;
        element.textContent = '';

        function typeChar() {
            if (index < text.length) {
                element.textContent = text.substring(0, index + 1);
                index++;
                setTimeout(typeChar, speed);
            } else {
                element.classList.remove('typing');
            }
        }
        typeChar();
    }

    async function sendMessage() {
        const sendBtn = document.getElementById('sendBtn');
        const botAStatus = document.getElementById('botAStatus');
        const botBStatus = document.getElementById('botBStatus');

        // Check if we're in feedback mode
        if (sendBtn.classList.contains('feedback-mode')) {
            // Handle feedback submission
            await submitFeedback();
            return;
        }

        const input = document.getElementById('userInput');
        const message = input.value.trim();
        if (!message) return;

        // Get the temperature value from hidden field
        const temperatureValue = parseFloat(document.getElementById('temperatureValue').value);
        console.log('Sending message with temperature value:', temperatureValue);

        input.value = '';
        document.getElementById('sendBtn').disabled = true;
        document.getElementById('randomBtn').disabled = true;
        clearFeedback();

        // Show loading animation
        showStatus('loading', 'Please stand by...');

        // Show loading state on status lights
        botAStatus.classList.remove('active', 'error');
        botAStatus.classList.add('loading');
        botBStatus.classList.remove('active', 'error');
        botBStatus.classList.add('loading');

        const claudeAiMessages = document.querySelectorAll('#claudeMessages .ai-message, #claudeMessages .error-message');
        const geminiAiMessages = document.querySelectorAll('#geminiMessages .ai-message, #geminiMessages .error-message');

        if (isFirstMessage) {
            await scrollController.animate();
            setPromptTextImmediate(message);
            isFirstMessage = false;
        } else if (claudeAiMessages.length > 0 || geminiAiMessages.length > 0) {
            scrollController.setCurrentPrompt(message);
            await scrollController.animate();
        } else {
            setPromptTextImmediate(message);
        }

        // Loading animation is already showing, so just make the API call
        try {
            const response = await fetch(`${API_BASE_URL}/api/chat.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    sliderValue: temperatureValue
                }),
            });

            const data = await response.json();

            // FIXED: Changed from gemini_response to openai_response
            currentFeedbackData = {
                user_message: message,
                claude_response: data.claude?.success ? data.claude.message : null,
                openai_response: data.openai?.success ? data.openai.message : null,
                slider_value: temperatureValue,
                model_a: data.model_a,
                model_b: data.model_b
            };

            let claudeTypingPromise = Promise.resolve();
            let geminiTypingPromise = Promise.resolve();

            if (data.claude?.success) {
                botAStatus.classList.remove('loading', 'error');
                botAStatus.classList.add('active');
                claudeTypingPromise = addMessage('claudeMessages', data.claude.message, 'ai');
            } else {
                botAStatus.classList.remove('loading', 'active');
                botAStatus.classList.add('error');
                addMessage('claudeMessages', data.claude?.message || 'Error occurred', 'error');
            }

            // FIXED: Changed from data.gemini to data.openai
            if (data.openai?.success) {
                botBStatus.classList.remove('loading', 'error');
                botBStatus.classList.add('active');
                geminiTypingPromise = addMessage('geminiMessages', data.openai.message, 'ai');
            } else {
                botBStatus.classList.remove('loading', 'active');
                botBStatus.classList.add('error');
                addMessage('geminiMessages', data.openai?.message || 'Error occurred', 'error');
            }

            await Promise.all([claudeTypingPromise, geminiTypingPromise]);

            // FIXED: Changed from data.gemini to data.openai
            if (data.claude?.success && data.openai?.success) {
                showFeedback();
            } else {
                // MODIFIED: Show an error message if one or both bots fail.
                let errorMessage = "An error occurred. Please try your request again.";
                if (!data.claude?.success && !data.openai?.success) {
                    errorMessage = "Both models are currently unavailable.<br>Please try again later.";
                } else if (!data.claude?.success) {
                    errorMessage = "Model A failed to respond.<br>You can try your request again.";
                } else if (!data.openai?.success) {
                    errorMessage = "Model B failed to respond.<br>You can try your request again.";
                }
                showStatus('⚠️', errorMessage);

                document.getElementById('sendBtn').disabled = false;
                document.getElementById('randomBtn').disabled = false;

                // Don't reset the status lights - they should reflect actual API status
            }
        } catch (error) {
            console.error('Chat error:', error);

            // Show error state on both lights
            botAStatus.classList.remove('loading', 'active');
            botAStatus.classList.add('error');
            botBStatus.classList.remove('loading', 'active');
            botBStatus.classList.add('error');

            // Return to ready state
            showStatus('⚠️', 'A connection error occurred.<br>Please check your network and try again.');
            addMessage('claudeMessages', 'Connection error. Please try again.', 'error');
            addMessage('geminiMessages', 'Connection error. Please try again.', 'error');
            document.getElementById('sendBtn').disabled = false;
            document.getElementById('randomBtn').disabled = false;
        }
    }

    function addMessage(containerId, text, type) {
        const container = document.getElementById(containerId);
        let messagesContainer = container.querySelector('.messages-container');

        if (!messagesContainer) {
            messagesContainer = document.createElement('div');
            messagesContainer.className = 'messages-container';
            container.appendChild(messagesContainer);
        }

        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}-message`;
        messagesContainer.appendChild(messageEl);

        if (type === 'ai') {
            messageEl.classList.add('typing');
            return typewriterEffect(messageEl, text);
        } else {
            messageEl.textContent = text;
            return Promise.resolve();
        }
    }

    function typewriterEffect(element, text) {
        return new Promise((resolve) => {
            let index = 0;
            const speed = 60;

            function typeChar() {
                if (index < text.length) {
                    element.textContent = text.substring(0, index + 1);
                    index++;
                    setTimeout(typeChar, speed);
                } else {
                    element.classList.remove('typing');
                    resolve();
                }
            }
            typeChar();
        });
    }

    function handleSliderInput(event) {
        const value = parseFloat(event.target.value);
        updateSignalBars(value, true);
        selectedRating = Math.round(value);
    }

    function updateSignalBars(value, isReady = false) {
        const leftBars = document.querySelectorAll('.signal-left span');
        const rightBars = document.querySelectorAll('.signal-right span');

        leftBars.forEach(bar => bar.classList.remove('active', 'ready'));
        rightBars.forEach(bar => bar.classList.remove('active', 'ready'));

        if (value === -1) return;

        if (isReady) {
            leftBars.forEach(bar => bar.classList.add('ready'));
            rightBars.forEach(bar => bar.classList.add('ready'));
        }

        if (value < 4) {
            const intensity = (4 - value) / 3;
            const barsToActivate = Math.round(intensity * 15);
            for (let i = 14; i >= 15 - barsToActivate; i--) {
                leftBars[i].classList.remove('ready');
                leftBars[i].classList.add('active');
            }
        } else if (value > 4) {
            const intensity = (value - 4) / 3;
            const barsToActivate = Math.round(intensity * 15);
            for (let i = 0; i < barsToActivate; i++) {
                rightBars[i].classList.remove('ready');
                rightBars[i].classList.add('active');
            }
        } else if (value === 4) {
            leftBars[14].classList.remove('ready');
            leftBars[14].classList.add('active');
            rightBars[0].classList.remove('ready');
            rightBars[0].classList.add('active');
        }
    }

    function handleSignalClick(event) {
        const signalsContainer = document.getElementById('intensitySignals');
        const slider = document.getElementById('feedbackSlider');
        const rect = signalsContainer.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const percent = clickX / rect.width;
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        let newValue = min + (max - min) * percent;
        newValue = Math.max(min, Math.min(max, newValue));
        slider.value = newValue;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    }

    async function submitFeedback() {
        if (!currentFeedbackData || !selectedRating) return;

        // Disable slider immediately
        document.getElementById('feedbackSlider').disabled = true;

        // Disable both buttons during transition
        const sendBtn = document.getElementById('sendBtn');
        const randomBtn = document.getElementById('randomBtn');
        sendBtn.disabled = true;
        randomBtn.disabled = true;

        // Stage: Thank you with prayer hands
        showStatus('🙏', 'Thank you!<br>Your feedback is <em>truly</em> valuable.', 'thank-you');
        scrollController.setCurrentRating(selectedRating);
        updateSignalBars(-1);

        // Remove the click listener when feedback is disabled
        const signalsContainer = document.getElementById('intensitySignals');
        signalsContainer.removeEventListener('click', handleSignalClick);

        await scrollController.animate();

        // Show loading animation after scroll
        showStatus('loading', 'Please stand by...');

        // Wait for loading animation
        setTimeout(() => {
            // Return to ready state
            showStatus('📖', 'Describe something that makes a distinctive sound.<br>Marvel as competing chatbots transcribe it into text.', 'placeholder');

            // NOW re-enable buttons after transition is complete
            sendBtn.disabled = false;
            sendBtn.classList.remove('feedback-mode');
            randomBtn.disabled = false;

            // Re-enable textarea and restore placeholder
            const userInput = document.getElementById('userInput');
            userInput.disabled = false;
            userInput.placeholder = 'Enter a machine, animal, event, instrument, or some other entity that makes noise...';

            // Reset status lights to active (assuming APIs are still healthy)
            const botAStatus = document.getElementById('botAStatus');
            const botBStatus = document.getElementById('botBStatus');

            // Keep lights active unless there was an error
            botAStatus.classList.remove('loading', 'error');
            botAStatus.classList.add('active');
            botBStatus.classList.remove('loading', 'error');
            botBStatus.classList.add('active');
        }, 2500);

        try {
            await fetch(`${API_BASE_URL}/api/feedback.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...currentFeedbackData,
                    preference_rating: selectedRating
                }),
            });
        } catch (error) {
            console.error('Feedback error:', error);
        }

        clearFeedback();
    }

    function clearFeedback() {
        const slider = document.getElementById('feedbackSlider');
        slider.value = 4;
        slider.disabled = true;
        selectedRating = null;
        updateSignalBars(-1);
    }

    function animateBarsToReady() {
        const leftBars = document.querySelectorAll('.signal-left span');
        const rightBars = document.querySelectorAll('.signal-right span');

        const animationSequence = [
            { left: 14, right: 0, delay: 0 }, { left: 13, right: 1, delay: 50 },
            { left: 12, right: 2, delay: 100 }, { left: 11, right: 3, delay: 150 },
            { left: 10, right: 4, delay: 200 }, { left: 9, right: 5, delay: 250 },
            { left: 8, right: 6, delay: 300 }, { left: 7, right: 7, delay: 350 },
            { left: 6, right: 8, delay: 400 }, { left: 5, right: 9, delay: 450 },
            { left: 4, right: 10, delay: 500 }, { left: 3, right: 11, delay: 550 },
            { left: 2, right: 12, delay: 600 }, { left: 1, right: 13, delay: 650 },
            { left: 0, right: 14, delay: 700 }
        ];

        animationSequence.forEach(({ left, right, delay }) => {
            setTimeout(() => {
                leftBars[left].classList.add('ready');
                rightBars[right].classList.add('ready');
            }, delay);
        });

        setTimeout(() => {
            leftBars[14].classList.remove('ready');
            leftBars[14].classList.add('active');
            rightBars[0].classList.remove('ready');
            rightBars[0].classList.add('active');
        }, 750);
    }
</script>

<?php include '../includes/footer.php'; ?>