<footer class="site-footer">
    <div class="content-frame">
        <p class="text-text">© 2025&ndash;<?php echo date('Y'); ?> Municipal Sky &middot; <a
                href="/privacy.php">Privacy</a></p>
        <form class="subscribe" id="subscribeForm" novalidate>
            <div class="subscribe__row">
                <input class="subscribe__input" type="email" id="subscribeEmail" name="email"
                    placeholder="you@example.com" autocomplete="email" aria-label="Email address" required>
                <!-- Honeypot: hidden from people, irresistible to bots. -->
                <input class="subscribe__hp" type="text" name="website" tabindex="-1" autocomplete="off"
                    aria-hidden="true">
                <button class="subscribe__btn" type="submit">Subscribe</button>
            </div>
            <p class="subscribe__msg" id="subscribeMsg" role="status" aria-live="polite"></p>
            <span class="subscribe__margin" aria-hidden="true">
                <span class="subscribe__margin-arrow">&lt;--</span>
                <span class="subscribe__margin-body">
                    <em class="subscribe__margin-quote">&ldquo;When you&rsquo;re seller and commodity<br>You gotta sell
                        yourself immodestly&rdquo;</em>
                    <span class="subscribe__margin-attr">&mdash; Purple Mountains</span>
                </span>
            </span>
        </form>
    </div>
    <script>
        (function () {
            var form = document.getElementById('subscribeForm');
            if (!form) return;
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var email = document.getElementById('subscribeEmail');
                var msg = document.getElementById('subscribeMsg');
                var btn = form.querySelector('.subscribe__btn');
                if (!email.value || !email.checkValidity()) {
                    msg.textContent = 'Please enter a valid email address.';
                    msg.className = 'subscribe__msg is-error';
                    return;
                }
                btn.disabled = true;
                msg.textContent = 'Submitting…';
                msg.className = 'subscribe__msg';
                fetch('/api/subscribe.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email.value,
                        website: form.website.value,
                        source: window.location.pathname
                    })
                })
                    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
                    .then(function (res) {
                        if (res.ok && res.d.success) {
                            msg.textContent = res.d.message || 'Thanks — you are on the list.';
                            msg.className = 'subscribe__msg is-success';
                            form.reset();
                        } else {
                            msg.textContent = (res.d && res.d.error) || 'Something went wrong.';
                            msg.className = 'subscribe__msg is-error';
                        }
                    })
                    .catch(function () {
                        msg.textContent = 'Network error. Please try again.';
                        msg.className = 'subscribe__msg is-error';
                    })
                    .finally(function () { btn.disabled = false; });
            });
        })();
    </script>
</footer>
</body>

</html>