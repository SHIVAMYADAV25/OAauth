/**
 * apps.js — application management UI logic
 */

let currentApps = [];

// ── Load & render apps list ──────────────────────────────────────────────────
async function loadApps() {
  const grid = document.getElementById('apps-grid');
  const empty = document.getElementById('apps-empty');

  try {
    const data = await API.listApps();
    currentApps = data.apps || [];

    // Clear existing cards (keep empty placeholder)
    grid.querySelectorAll('.app-card').forEach(c => c.remove());

    if (currentApps.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    currentApps.forEach(app => {
      const card = buildAppCard(app);
      grid.appendChild(card);
    });
  } catch (err) {
    showToast('Failed to load applications', 'error');
  }
}

function buildAppCard(app) {
  const card = document.createElement('div');
  card.className = 'app-card';
  card.dataset.appId = app.appId;

  const initial = app.name.charAt(0).toUpperCase();
  const desc = app.description || 'No description provided';
  const badgeClass = app.active ? '' : 'inactive';
  const badgeText = app.active ? 'Active' : 'Inactive';

  card.innerHTML = `
    <div class="app-card-top">
      <div class="app-icon">${initial}</div>
      <div class="app-badge ${badgeClass}">${badgeText}</div>
    </div>
    <div class="app-name">${escHtml(app.name)}</div>
    <div class="app-desc">${escHtml(desc)}</div>
    <div class="app-client-id">${app.clientId}</div>
  `;

  card.addEventListener('click', () => showAppDetail(app.appId));
  return card;
}

// ── App detail view ──────────────────────────────────────────────────────────
async function showAppDetail(appId) {
  const app = currentApps.find(a => a.appId === appId) || await API.getApp(appId).then(d => d.app);

  // console.log("Clicked appId:", appId);

  switchView('app-detail', null);
  document.getElementById('topbar-title').textContent = app.name;

  const container = document.getElementById('view-app-detail');
  const initial = app.name.charAt(0).toUpperCase();
  const redirectTags = (app.redirectUris || []).map(u =>
  `<span class="redirect-tag">${escHtml(u)}</span>`
).join('');
  const scopePills = (app.allowedScopes || []).map(s =>
  `<span class="redirect-tag">${s}</span>`
).join('');


  container.innerHTML = `
    <button class="back-btn" onclick="switchView('apps', document.querySelector('[data-view=apps]'))">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      Back to Applications
    </button>

    <div class="detail-header">
      <div class="detail-icon">${initial}</div>
      <div class="detail-info">
        <h2>${escHtml(app.name)}</h2>
        <p>${escHtml(app.description || 'No description')}${app.website ? ` · <a href="${escHtml(app.website)}" target="_blank" rel="noopener">${escHtml(app.website)}</a>` : ''}</p>
      </div>
    </div>

    <div class="detail-grid">
      <!-- Credentials -->
      <div class="detail-card full">
        <div class="detail-card-label">Client Credentials</div>
        <div class="cred-row">
          <span class="cred-label">Client ID</span>
          <span class="cred-value" id="cred-client-id">${app.clientId}</span>
          <button class="copy-btn" onclick="copyText('${app.clientId}', this)">Copy</button>
        </div>
        <div class="cred-row">
          <span class="cred-label">Client Secret</span>
          <span class="cred-value secret" id="cred-secret">••••••••••••••••••••••••••••••••</span>
          <button class="copy-btn" id="btn-reveal-secret" onclick="revealSecret('${app.appId}', '${app.clientSecret}')">Reveal</button>
        </div>
      </div>

      <!-- Redirect URIs -->
      <div class="detail-card">
        <div class="detail-card-label">Redirect URIs</div>
        <div>${redirectTags}</div>
      </div>

      <!-- Scopes -->
      <div class="detail-card">
        <div class="detail-card-label">Allowed Scopes</div>
        <div>${scopePills}</div>
      </div>

      <!-- SDK Config snippet -->
      <div class="detail-card full">
        <div class="detail-card-label">SDK Quick Start</div>
        <div id="sdk-snippet-loading" style="color:var(--text-3);font-size:13px;">Loading config...</div>
        <div id="sdk-snippet" class="hidden"></div>
      </div>
    </div>

    <!-- Actions -->
    <div class="detail-actions">
      <button class="btn-ghost" onclick="showRotateConfirm('${app.appId}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Rotate Secret
      </button>
      <button class="btn-ghost" onclick="switchView('docs', document.querySelector('[data-view=docs]'))">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Full SDK Guide
      </button>
      <button class="btn-danger" onclick="confirmDeleteApp('${app.appId}', '${escHtml(app.name)}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        Delete App
      </button>
    </div>
  `;

  // Load SDK snippet
  loadSdkSnippet(app.appId);
}

async function loadSdkSnippet(appId) {
  try {
    const cfg = await API.getSdkConfig(appId);
    const loading = document.getElementById('sdk-snippet-loading');
    const snippet = document.getElementById('sdk-snippet');
    if (!loading || !snippet) return;
    loading.style.display = 'none';
    snippet.classList.remove('hidden');
    snippet.innerHTML = buildCodeBlock('.env', 'env', cfg.envFile) +
      buildCodeBlock('Initialize SDK', 'js', cfg.sdkInit) +
      buildCodeBlock('Express Routes', 'js', cfg.expressRoutes);
  } catch (e) {
    const el = document.getElementById('sdk-snippet-loading');
    if (el) el.textContent = 'Could not load SDK config.';
  }
}

function revealSecret(appId, secret) {
  const el = document.getElementById('cred-secret');
  const btn = document.getElementById('btn-reveal-secret');
  if (!el || !btn) return;
  el.textContent = secret;
  btn.textContent = 'Copy';
  btn.onclick = () => copyText(secret, btn);
}

// ── Create app form ──────────────────────────────────────────────────────────
async function handleCreateApp() {
  const name        = document.getElementById('app-name').value.trim();
  const description = document.getElementById('app-desc').value.trim();
  const website     = document.getElementById('app-website').value.trim();
  const rawUris     = document.getElementById('app-redirects').value.trim();
  const errEl       = document.getElementById('new-app-error');

  errEl.classList.add('hidden');

  if (!name) { errEl.textContent = 'Application name is required'; errEl.classList.remove('hidden'); return; }

  const redirectUris = rawUris.split('\n').map(s => s.trim()).filter(Boolean);
  if (redirectUris.length === 0) { errEl.textContent = 'At least one redirect URI is required'; errEl.classList.remove('hidden'); return; }

  const btn = document.getElementById('btn-create-app');
  btn._orig = btn.innerHTML;
  btn.innerHTML = `<span class="spinner"></span> Creating...`;
  btn.disabled = true;

  try {
    const data = await API.createApp({ name, description, website, redirectUris });
    const app = data.app;

    // Reset form
    ['app-name','app-desc','app-website','app-redirects'].forEach(id => document.getElementById(id).value = '');

    // Reload apps list
    await loadApps();

    // Show credentials modal
    showCredentialsModal(app);
  } catch (err) {
    errEl.textContent = err.message || 'Failed to create application';
    errEl.classList.remove('hidden');
  } finally {
    btn.innerHTML = btn._orig;
    btn.disabled = false;
  }
}

function showCredentialsModal(app) {
  document.getElementById('modal-title').textContent = `${app.name} — Credentials`;
  document.getElementById('modal-body').innerHTML = `
    <div class="cred-notice">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>Copy your Client Secret now. You won't be able to see it again without rotating it.</span>
    </div>
    <div class="cred-row">
      <span class="cred-label">Client ID</span>
      <span class="cred-value">${app.clientId}</span>
      <button class="copy-btn" onclick="copyText('${app.clientId}', this)">Copy</button>
    </div>
    <div class="cred-row">
      <span class="cred-label">Client Secret</span>
      <span class="cred-value secret">${app.clientSecret}</span>
      <button class="copy-btn" onclick="copyText('${app.clientSecret}', this)">Copy</button>
    </div>
    <div class="cred-row">
      <span class="cred-label">Redirect URI</span>
      <span class="cred-value">${app.redirectUris[0]}</span>
      <button class="copy-btn" onclick="copyText('${app.redirectUris[0]}', this)">Copy</button>
    </div>
    <button class="btn-primary" style="margin-top:8px" onclick="closeModal(); showAppDetail('${app.appId}')">View App Details & SDK Setup →</button>
  `;
  document.getElementById('modal-backdrop').classList.remove('hidden');
}

// ── Rotate secret confirm ────────────────────────────────────────────────────
function showRotateConfirm(appId) {
  document.getElementById('modal-title').textContent = 'Rotate Client Secret';
  document.getElementById('modal-body').innerHTML = `
    <p style="color:var(--text-2);font-size:14px;margin-bottom:16px">
      This will invalidate your current client secret. You'll need to update your environment variables immediately.
    </p>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="doRotateSecret('${appId}')">Rotate Secret</button>
    </div>
  `;
  document.getElementById('modal-backdrop').classList.remove('hidden');
}

async function doRotateSecret(appId) {
  try {
    const data = await API.rotateSecret(appId);
    closeModal();
    showToast('Secret rotated. Update your environment variables.', 'success');
    // Refresh detail view
    currentApps = currentApps.map(a => a.appId === appId ? data.app : a);
    showAppDetail(appId);
  } catch (err) {
    showToast('Failed to rotate secret', 'error');
  }
}

// ── Delete confirm ───────────────────────────────────────────────────────────
function confirmDeleteApp(appId, name) {
  document.getElementById('modal-title').textContent = 'Delete Application';
  document.getElementById('modal-body').innerHTML = `
    <p style="color:var(--text-2);font-size:14px;margin-bottom:16px">
      Are you sure you want to delete <strong style="color:var(--text-1)">${escHtml(name)}</strong>?
      This will revoke all credentials and cannot be undone.
    </p>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="doDeleteApp('${appId}')">Delete Application</button>
    </div>
  `;
  document.getElementById('modal-backdrop').classList.remove('hidden');
}

async function doDeleteApp(appId) {
  try {
    await API.deleteApp(appId);
    closeModal();
    showToast('Application deleted', 'success');
    switchView('apps', document.querySelector('[data-view=apps]'));
    await loadApps();
  } catch (err) {
    showToast('Failed to delete application', 'error');
  }
}

// ── Util ─────────────────────────────────────────────────────────────────────
function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.style.color = 'var(--accent)';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 2000);
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildCodeBlock(label, lang, code) {
  const id = 'cb-' + Math.random().toString(36).slice(2);
  return `
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">${escHtml(label)}</span>
        <button class="code-block-copy" onclick="copyCodeBlock('${id}', this)">Copy</button>
      </div>
      <pre id="${id}">${escHtml(code)}</pre>
    </div>`;
}

function copyCodeBlock(id, btn) {
  const text = document.getElementById(id)?.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = orig, 2000);
  });
}

function setupAppListeners() {
  document.getElementById('btn-create-app').addEventListener('click', handleCreateApp);
  document.getElementById('app-redirects').addEventListener('keydown', e => {
    if (e.key === 'Enter') e.stopPropagation(); // allow newlines
  });
}
