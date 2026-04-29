/**
 * SDK Gateway Routes  —  /sdk/*
 *
 * The ONLY routes external developers call.
 * Authentication is via x-sdk-key (their per-app SDK key).
 * Internal credentials (INTERNAL_API_KEY, clientSecret, etc.) never leave the server.
 *
 * Routes:
 *   GET  /sdk/config               — safe app config (issuer, clientId, redirectUris)
 *   POST /sdk/session/create       — create session after OIDC callback
 *   POST /sdk/session/refresh      — rotate refresh token
 *   POST /sdk/session/logout       — revoke one session
 *   POST /sdk/session/logout-all   — revoke all user sessions
 *   GET  /sdk/session/list/:userId — list active sessions
 *   POST /sdk/token/verify         — verify an access token (gateway fallback)
 */

const express = require('express');
const router  = express.Router();
const { requireSdkKey } = require('../middleware/sdkAuth.js');
const {
  createSession,
  refreshSession,
  logout,
  revokeAllSessions,
  getSessions,
  verifyToken,
} = require('../utils/sessionService.js');
const fileRouter = require('./fileRoutes');

router.use(requireSdkKey);
router.use('/file', fileRouter);
router.use(express.json());

// ── GET /sdk/config ───────────────────────────────────────────────────────────
router.get('/config', (req, res) => {
  const { clientId, oidcIssuer, redirectUris, allowedScopes, name } = req.sdkApp;
  return res.json({ clientId, oidcIssuer, redirectUris, allowedScopes, appName: name });
});

// ── POST /sdk/session/create ──────────────────────────────────────────────────
/**
 * Body: { sub, email, name, picture, userAgent?, ip? }
 *
 * KEY CHANGE: The SDK client now forwards userAgent + ip from the developer's
 * incoming request so device metadata is the end-user's browser, not the
 * developer's server. Falls back to the raw HTTP headers if not provided.
 */
router.post('/session/create', async (req, res) => {
  const { sub, email, name, picture, userAgent, ip } = req.body;

  if (!sub || !email || !name) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'sub, email, name are required',
    });
  }

  try {
    const deviceMeta = {
      // Prefer client-forwarded metadata (the real end-user device);
      // fall back to the raw request headers (the developer's server).
      userAgent: userAgent || req.headers['user-agent'],
      ip:        ip        || req.ip || req.headers['x-forwarded-for'],
    };

    const result = await createSession(
      { sub, email, name, picture },
      deviceMeta,
      req.sdkApp.appId
    );
    return res.status(201).json(result);
  } catch (err) {
    console.error('[SDK/Session/Create]', err);
    return res.status(500).json({ error: 'server_error', error_description: err.message });
  }
});

// ── POST /sdk/session/refresh ─────────────────────────────────────────────────
router.post('/session/refresh', async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'refreshToken required',
    });
  }

  try {
    const deviceMeta = {
      userAgent: req.body.userAgent || req.headers['user-agent'],
      ip:        req.body.ip        || req.ip || req.headers['x-forwarded-for'],
    };
    const result = await refreshSession(refreshToken, deviceMeta);
    return res.json(result);
  } catch (err) {
    const status = err.message.startsWith('invalid_token') ? 401 : 500;
    return res.status(status).json({
      error:             'invalid_token',
      error_description: err.message,
    });
  }
});

// ── POST /sdk/session/logout ──────────────────────────────────────────────────
router.post('/session/logout', async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
  try {
    await logout(refreshToken);
    return res.json({ success: true });
  } catch (err) {
    console.error('[SDK/Session/Logout]', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── POST /sdk/session/logout-all ──────────────────────────────────────────────
router.post('/session/logout-all', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'userId required',
    });
  }
  try {
    const result = await revokeAllSessions(userId);
    return res.json(result);
  } catch (err) {
    console.error('[SDK/Session/LogoutAll]', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── GET /sdk/session/list/:userId ─────────────────────────────────────────────
router.get('/session/list/:userId', async (req, res) => {
  try {
    const sessions = await getSessions(req.params.userId);
    return res.json({
      sessions: sessions.map((s) => ({
        id:         s._id,
        deviceName: s.deviceInfo?.deviceName,
        ip:         s.deviceInfo?.ip,
        lastUsedAt: s.lastUsedAt,
        createdAt:  s.createdAt,
        expiresAt:  s.expiresAt,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── POST /sdk/token/verify ────────────────────────────────────────────────────
/**
 * Gateway fallback for access token verification.
 * The SDK's protect() middleware verifies tokens locally via JWKS by default
 * (no round-trip needed). This endpoint exists for clients that opt out of
 * local verification (localVerify: false) or for non-Node consumers.
 */
router.post('/token/verify', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'token required',
    });
  }

  try {
    const payload = verifyToken(token);
    return res.json({ valid: true, payload });
  } catch (err) {
    return res.status(401).json({
      valid:             false,
      error:             'invalid_token',
      error_description: err.message,
    });
  }
});

module.exports = router;