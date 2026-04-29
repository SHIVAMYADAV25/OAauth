/**
 * docs.js — SDK Setup Guide content
 */

function renderDocs() {
  const container = document.getElementById('docs-content');

  const steps = [
    {
      title: 'Install the SDK',
      desc: 'Add the AuthBase SDK to your Node.js project.',
      code: {
        label: 'bash',
        content: `# npm
npm install @authbase/sdk

# yarn
yarn add @authbase/sdk

# pnpm
pnpm add @authbase/sdk`
      }
    },
    {
      title: 'Configure Environment Variables',
      desc: 'Copy your credentials from the app\'s credential panel and add them to your <code>.env</code> file. Never commit this file.',
      code: {
        label: '.env',
        content: `# AuthBase — copy from your app's credential panel
OIDC_ISSUER=https://auth.yourdomain.com
OIDC_CLIENT_ID=app_a1b2c3d4e5f6g7h8
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=https://myapp.com/callback

# Auth Microservice
AUTH_SERVICE_URL=https://sessions.yourdomain.com
INTERNAL_API_KEY=your-internal-api-key

# Same as AUTH_SERVICE ACCESS_TOKEN_SECRET (enables fast local verify)
ACCESS_TOKEN_SECRET=your-access-token-secret`
      },
      extra: `<div class="cred-notice" style="margin-top:12px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:2px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Add <code style="font-family:var(--font-mono);color:var(--text-1)">.env</code> to your <code style="font-family:var(--font-mono);color:var(--text-1)">.gitignore</code>. Never expose your Client Secret or Internal API Key publicly.</span>
      </div>`
    },
    {
      title: 'Initialize the AuthClient',
      desc: 'Create a single <code>AuthClient</code> instance and export it. Import it wherever you need auth logic.',
      code: {
        label: 'auth.js',
        content: `const { AuthClient } = require('@authbase/sdk');

const auth = new AuthClient({
  issuer:            process.env.OIDC_ISSUER,
  clientId:          process.env.OIDC_CLIENT_ID,
  clientSecret:      process.env.OIDC_CLIENT_SECRET,
  redirectUri:       process.env.OIDC_REDIRECT_URI,
  authServiceUrl:    process.env.AUTH_SERVICE_URL,
  internalApiKey:    process.env.INTERNAL_API_KEY,
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
});

module.exports = auth;`
      }
    },
    {
      title: 'Add Login, Callback & Logout Routes',
      desc: 'Wire the three auth routes into your Express app. The SDK handles all the PKCE, token exchange, and session creation automatically.',
      code: {
        label: 'index.js (Express)',
        content: `const express = require('express');
const cookieParser = require('cookie-parser');
const auth = require('./auth'); // your AuthClient instance

const app = express();
app.use(express.json());
app.use(cookieParser());

// 1. Login — redirect to OIDC provider
app.get('/login', auth.login);

// 2. Callback — exchange code → session tokens
app.get('/callback', async (req, res) => {
  const user   = await auth.handleCallback(req);
  const tokens = await auth.createSession(user, req);

  // Refresh token in httpOnly cookie (not accessible via JS)
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // Access token returned to client — store in memory
  res.json({ accessToken: tokens.accessToken, user: tokens.user });
});

// 3. Logout
app.post('/logout', async (req, res) => {
  await auth.logout(req.cookies.refreshToken);
  res.clearCookie('refreshToken');
  res.json({ success: true });
});`
      }
    },
    {
      title: 'Protect Routes',
      desc: 'Use <code>auth.protect()</code> as middleware on any route that requires authentication. <code>req.user</code> will contain the verified user payload.',
      code: {
        label: 'routes.js',
        content: `// Basic protected route
app.get('/me', auth.protect(), (req, res) => {
  res.json({ user: req.user });
});

// Role-based access control
app.get('/admin', auth.protect(), auth.requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin area', user: req.user });
});

// Optional auth — works for guests too
app.get('/feed', auth.protect({ optional: true }), (req, res) => {
  const greeting = req.user ? \`Hello \${req.user.name}\` : 'Hello, guest';
  res.json({ greeting, authenticated: !!req.user });
});`
      }
    },
    {
      title: 'Handle Token Refresh',
      desc: 'Access tokens expire in 15 minutes. Use the <code>/refresh</code> endpoint to silently get a new one using the httpOnly cookie. On your client, call this when you receive a 401 response.',
      code: {
        label: 'refresh.js (server route)',
        content: `// Server-side refresh route
app.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'no_session' });

  try {
    const tokens = await auth.refresh(refreshToken);

    // Rotate the cookie with the new refresh token
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken: tokens.accessToken });
  } catch (err) {
    res.clearCookie('refreshToken');
    res.status(401).json({ error: 'refresh_failed' });
  }
});`
      },
      extra: `
      <div style="margin-top:16px">
        <div class="detail-card-label" style="margin-bottom:12px">Client-side fetch interceptor example</div>
        <div class="code-block">
          <div class="code-block-header">
            <span class="code-block-lang">client.js (browser)</span>
            <button class="code-block-copy" onclick="copyCodeBlock('cb-interceptor', this)">Copy</button>
          </div>
          <pre id="cb-interceptor">let accessToken = null;

async function apiFetch(url, opts = {}) {
  if (!accessToken) {
    const res = await fetch('/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) { window.location = '/login'; return; }
    const data = await res.json();
    accessToken = data.accessToken;
  }

  const res = await fetch(url, {
    ...opts,
    credentials: 'include',
    headers: { ...opts.headers, Authorization: \`Bearer \${accessToken}\` },
  });

  if (res.status === 401) {
    accessToken = null; // force refresh on next call
    return apiFetch(url, opts);
  }

  return res;
}</pre>
        </div>
      </div>`
    },
    {
      title: 'Session Management (Optional)',
      desc: 'AuthBase tracks every login session with device info. You can show users their active sessions and let them revoke individual devices.',
      code: {
        label: 'sessions.js',
        content: `// List all active sessions for the logged-in user
app.get('/sessions', auth.protect(), async (req, res) => {
  const sessions = await auth.getSessions(req.user.sub);
  res.json({ sessions });
});

// Revoke a specific session (pass sessionId from the list)
app.delete('/sessions/:id', auth.protect(), async (req, res) => {
  // Revoke all — or implement per-session revoke via your auth microservice
  await auth.revokeAllSessions(req.user.sub);
  res.clearCookie('refreshToken');
  res.json({ success: true });
});`
      }
    },
  ];

  container.innerHTML = `<div class="docs-steps">${steps.map((s, i) => buildStep(i + 1, s)).join('')}</div>`;

  // Open first step by default
  container.querySelector('.step-item')?.classList.add('open');
}

function buildStep(num, step) {
  const codeHtml = step.code ? buildCodeBlock(step.code.label, '', step.code.content) : '';
  const extraHtml = step.extra || '';
  const descHtml = step.desc.replace(/<code>/g, '<code style="font-family:var(--font-mono);background:var(--bg-4);padding:2px 6px;border-radius:3px;font-size:12px;color:var(--accent-2)">');
  return `
    <div class="step-item">
      <div class="step-header" onclick="toggleStep(this.parentElement)">
        <div class="step-num">${num}</div>
        <span class="step-title">${step.title}</span>
        <svg class="step-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="step-body">
        <p class="step-desc">${descHtml}</p>
        ${codeHtml}
        ${extraHtml}
      </div>
    </div>`;
}

function toggleStep(el) {
  el.classList.toggle('open');
}
