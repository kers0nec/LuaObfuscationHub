(function () {
  function showError(message) {
    let el = document.getElementById('authError');
    if (!el) {
      el = document.createElement('p');
      el.id = 'authError';
      el.style.color = '#ff4d6d';
      el.style.fontSize = '0.8125rem';
      el.style.textAlign = 'center';
      const helper = document.querySelector('.helper-text');
      helper.parentNode.insertBefore(el, helper);
    }
    el.textContent = message;
  }

  async function loginWithApiKey() {
    const input = document.getElementById('apiKeyInput');
    const button = document.getElementById('apiLoginButton');
    const apiKey = (input.value || '').trim();

    if (!apiKey) {
      showError('Enter an API key first.');
      return;
    }

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Checking...';

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const data = await response.json();

      if (!response.ok) {
        showError(data.error || 'Login failed');
        return;
      }

      window.location.href = data.redirect || '/dashboard';
    } catch (error) {
      showError('Could not reach the server. Try again.');
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  document.getElementById('apiLoginButton').addEventListener('click', loginWithApiKey);
  document.getElementById('apiKeyInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') loginWithApiKey();
  });
})();
