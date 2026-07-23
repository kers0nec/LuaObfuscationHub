async function loginWithApiKey() {
  const input = document.getElementById('apiKeyInput');
  const button = document.getElementById('apiLoginButton');
  const apiKey = input.value.trim();

  if (!apiKey) {
    alert('Enter your API key.');
    input.focus();
    return;
  }

  button.disabled = true;
  button.textContent = 'Signing in...';

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Login failed');
    }

    window.location.href = data.redirect || '/dashboard';
  } catch (error) {
    alert(error.message || 'Login failed');
  } finally {
    button.disabled = false;
    button.textContent = 'Login with API Key';
  }
}

document.getElementById('apiLoginButton')?.addEventListener('click', loginWithApiKey);
document.getElementById('apiKeyInput')?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') loginWithApiKey();
});
