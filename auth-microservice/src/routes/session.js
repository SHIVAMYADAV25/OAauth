/**
 * Session Routes
 * POST /session/create      - Create a new session after OIDC login
 * POST /session/refresh     - Rotate refresh token
 * POST /session/logout      - Revoke session
 * POST /session/logout-all  - Revoke all user sessions
 * GET  /session/list        - List active sessions (session dashboard)
 * POST /token/verify        - Verify an access token
 */

const express = require('express');
const router = express.Router();
const { requireInternalKey } = require('../middleware/internalAuth.js');
const {
  createSession,
  refreshSession,
  logout,
  revokeAllSessions,
  getSessions,
  verifyToken,
} = require('../utils/sessionService.js');

// All routes require internal API key
router.use(requireInternalKey);

// POST /session/create
router.post('/create', express.json(), async (req, res) => {
  const { sub, email, name, picture } = req.body;

  if (!sub || !email || !name) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'sub, email, name required' });
  }

  try {
    const deviceMeta = {
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.headers['x-forwarded-for'],
    };

    const result = await createSession({ sub, email, name, picture }, deviceMeta);
    return res.status(201).json(result);
  } catch (err) {
    console.error('[Session/Create]', err);
    return res.status(500).json({ error: 'server_error', error_description: err.message });
  }
});

// POST /session/refresh
router.post('/refresh', express.json(), async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'refreshToken required' });
  }

  try {
    const deviceMeta = {
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.headers['x-forwarded-for'],
    };
    const result = await refreshSession(refreshToken, deviceMeta);
    return res.json(result);
  } catch (err) {
    console.error('[Session/Refresh]', err.message);
    const status = err.message.startsWith('invalid_token') ? 401 : 500;
    return res.status(status).json({ error: 'invalid_token', error_description: err.message });
  }
});

// POST /session/logout
router.post('/logout', express.json(), async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
  try {
    await logout(refreshToken);
    return res.json({ success: true });
  } catch (err) {
    console.error('[Session/Logout]', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /session/logout-all
router.post('/logout-all', express.json(), async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'invalid_request', error_description: 'userId required' });

  try {
    const result = await revokeAllSessions(userId);
    return res.json(result);
  } catch (err) {
    console.error('[Session/LogoutAll]', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// GET /session/list/:userId
router.get('/list/:userId', async (req, res) => {
  try {
    const sessions = await getSessions(req.params.userId);
    return res.json({ sessions: sessions.map(s => ({
      id: s._id,
      deviceName: s.deviceInfo?.deviceName,
      ip: s.deviceInfo?.ip,
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }))});
  } catch (err) {
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /token/verify
router.post('/verify', express.json(), (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'invalid_request', error_description: 'token required' });

  try {
    const payload = verifyToken(token);
    return res.json({ valid: true, payload });
  } catch (err) {
    return res.status(401).json({ valid: false, error: 'invalid_token', error_description: err.message });
  }
});

module.exports = router;