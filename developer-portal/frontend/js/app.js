/**
 * app.js — SPA bootstrap, view router, global utilities
 */

let currentDeveloper = null;

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  setupAuthListeners();
  setupAppListeners();

  try {
    const data = await API.me();
    onAuthSuccess(data.developer);
  } catch {
    showAuthPage();
  }
}

// ── Auth state ────────────────────────────────────────────────────────────────
function onAuthSuccess(developer) {
  currentDeveloper = developer;
  showDashboard(developer);
}

function showAuthPage() {
  document.getElementById('page-auth').classList.remove('hidden');
  document.getElementById('page-dashboard').classList.add('hidden');
}

function showDashboard(developer) {
  document.getElementById('page-auth').classList.add('hidden');
  document.getElementById('page-dashboard').classList.remove('hidden');

  // Populate sidebar
  const initial = developer.name.charAt(0).toUpperCase();
  document.getElementById('dev-avatar').textContent = initial;
  document.getElementById('dev-name').textContent = developer.name;
  document.getElementById('dev-plan').textContent = capitalize(developer.plan) + ' Plan';

  // Load default view
  renderDocs();
  loadApps();
  switchView('apps', document.querySelector('[data-view=apps]'));
}

// ── View router ───────────────────────────────────────────────────────────────
function switchView(viewName, navEl) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));

  // Show target view
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.remove('hidden');

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  // Update topbar title
  const titles = {
    'apps':       'Applications',
    'new-app':    'New Application',
    'docs':       'SDK Setup Guide',
    'app-detail': 'Application Details',
  };
  document.getElementById('topbar-title').textContent = titles[viewName] || 'Dashboard';
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
