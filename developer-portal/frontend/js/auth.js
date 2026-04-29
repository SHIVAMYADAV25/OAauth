/**
 * auth.js — developer portal login / register logic
 */

function showLogin() {
  document.getElementById('form-login').classList.remove('hidden');
  document.getElementById('form-register').classList.add('hidden');
}

function showRegister() {
  document.getElementById('form-register').classList.remove('hidden');
  document.getElementById('form-login').classList.add('hidden');
}

function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  btn.innerHTML = isText
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (loading) {
    btn._originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span>`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._originalText || btn.innerHTML;
    btn.disabled = false;
  }
}

function showAuthError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}
function clearAuthError(id) {
  document.getElementById(id).classList.add('hidden');
}

async function handleLogin() {
  clearAuthError('login-error');
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) return showAuthError('login-error', 'Please fill in all fields');

  setLoading('btn-login', true);
  try {
    const data = await API.login({ email, password });
    onAuthSuccess(data.developer);
  } catch (err) {
    showAuthError('login-error', err.message || 'Login failed');
  } finally {
    setLoading('btn-login', false);
  }
}

async function handleRegister() {
  clearAuthError('register-error');
  const name     = document.getElementById('reg-name').value.trim();
  const company  = document.getElementById('reg-company').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  if (!name || !email || !password) return showAuthError('register-error', 'Name, email, and password are required');
  if (password.length < 8) return showAuthError('register-error', 'Password must be at least 8 characters');

  setLoading('btn-register', true);
  try {
    const data = await API.register({ name, company, email, password });
    onAuthSuccess(data.developer);
  } catch (err) {
    showAuthError('register-error', err.message || 'Registration failed');
  } finally {
    setLoading('btn-register', false);
  }
}

async function logout() {
  await API.logout().catch(() => {});
  showAuthPage();
}

function setupAuthListeners() {
  document.getElementById('btn-login').addEventListener('click', handleLogin);
  document.getElementById('btn-register').addEventListener('click', handleRegister);

  // Enter key support
  ['login-email','login-password'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') handleLogin();
    });
  });
  ['reg-name','reg-company','reg-email','reg-password'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') handleRegister();
    });
  });
}
