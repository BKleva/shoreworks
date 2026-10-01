(function () {
  const form = document.getElementById('login-form');
  const errorBanner = document.getElementById('error-banner');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBanner.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    const password = document.getElementById('password').value;

    try {
      const res = await fetch('/api/auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        window.location.href = '/admin';
        return;
      }

      errorBanner.textContent = data.error || 'Sign in failed';
      errorBanner.style.display = 'block';
    } catch (err) {
      errorBanner.textContent = 'Network error. Please try again.';
      errorBanner.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });
})();
