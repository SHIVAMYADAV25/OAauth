/**
 * Developer Portal — App Management Routes  (/api/apps)
 *
 * Every mutation (create / update / delete / rotate-secret) is synced
 * to the auth-microservice so the developer's SDK key works immediately.
 *
 * KEY CHANGES:
 * - syncAppToAuthService now throws on failure, so the developer sees an error
 *   instead of getting a silently broken SDK key.
 * - Added GET /api/apps/:appId/sync-status so developers can check whether
 *   their app is live in the auth-microservice (useful after a failed sync).
 * - sdk-config now shows the new handleCallbackAndCreateSession pattern.
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const App     = require('../model/App.js');
const { requireAuth } = require('../middleware/auth.js');
const {
  syncAppToAuthService,
  deleteAppFromAuthService,
  rotateSdkKey,
  isSyncedToAuthService,
} = require('../services/syncService.js');

router.use(requireAuth);
router.use(express.json());

// ── GET /api/apps ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const apps = await App.find({ developerId: req.developer.id, active: true })
      .sort({ createdAt: -1 });

    res.set('Cache-Control', 'no-store');
    return res.json({ apps: apps.map((a) => a.toSafePublic()) });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ── POST /api/apps ────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, description, website, redirectUris } = req.body;

  if (!name || !redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
    return res.status(400).json({
      error:   'validation',
      message: 'name and at least one redirectUri required',
    });
  }

  for (const uri of redirectUris) {
    try { new URL(uri); } catch {
      return res.status(400).json({ error: 'validation', message: `Invalid redirect URI: ${uri}` });
    }
  }

  let app;
  try {
    app = await App.create({ developerId: req.developer.id, name, description, website, redirectUris });
  } catch (err) {
    console.error('[Apps/Create] DB error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }

  // Sync to auth-microservice — THROWS on failure so the developer knows their
  // SDK key won't work. We soft-delete the portal record to stay consistent.
  try {
    await syncAppToAuthService(app);
  } catch (err) {
    console.error('[Apps/Create] Sync failed — rolling back app:', err.message);
    app.active = false;
    await app.save().catch(() => {}); // best-effort rollback
    return res.status(502).json({
      error:   'sync_failed',
      message: 'App was created but could not be synced to the auth service. Please try again.',
    });
  }

  return res.status(201).json({ app: app.toPublic() });
});

// ── GET /api/apps/:appId ──────────────────────────────────────────────────────
router.get('/:appId', async (req, res) => {
  const app = await App.findOne({ appId: req.params.appId, developerId: req.developer.id });
  if (!app) return res.status(404).json({ error: 'not_found' });
  return res.json({ app: app.toPublic() });
});

// ── PATCH /api/apps/:appId ────────────────────────────────────────────────────
router.patch('/:appId', async (req, res) => {
  const { name, description, website, redirectUris } = req.body;
  const app = await App.findOne({ appId: req.params.appId, developerId: req.developer.id });
  if (!app) return res.status(404).json({ error: 'not_found' });

  if (name)                                           app.name        = name;
  if (description !== undefined)                      app.description = description;
  if (website     !== undefined)                      app.website     = website;
  if (redirectUris && Array.isArray(redirectUris))    app.redirectUris = redirectUris;

  await app.save();

  try {
    await syncAppToAuthService(app);
  } catch (err) {
    console.error('[Apps/Update] Sync failed:', err.message);
    return res.status(502).json({
      error:   'sync_failed',
      message: 'App was updated locally but sync to the auth service failed. Your SDK key may be stale.',
    });
  }

  return res.json({ app: app.toPublic() });
});

// ── POST /api/apps/:appId/rotate-secret ───────────────────────────────────────
router.post('/:appId/rotate-secret', async (req, res) => {
  const app = await App.findOne({ appId: req.params.appId, developerId: req.developer.id });
  if (!app) return res.status(404).json({ error: 'not_found' });

  app.clientSecret = crypto.randomBytes(32).toString('hex');
  await app.save();

  try {
    await syncAppToAuthService(app);
  } catch (err) {
    console.error('[Apps/RotateSecret] Sync failed:', err.message);
    return res.status(502).json({
      error:   'sync_failed',
      message: 'Secret was rotated locally but sync failed. OIDC logins may break until sync is restored.',
    });
  }

  return res.json({
    app:     app.toPublic(),
    message: 'Client secret rotated. Your SDK key is unchanged — no redeploy needed.',
  });
});

// ── POST /api/apps/:appId/rotate-sdk-key ──────────────────────────────────────
router.post('/:appId/rotate-sdk-key', async (req, res) => {
  const app = await App.findOne({ appId: req.params.appId, developerId: req.developer.id });
  if (!app) return res.status(404).json({ error: 'not_found' });

  try {
    const newSdkKey = await rotateSdkKey(app.appId);
    app.sdkKey = newSdkKey;
    await app.save();

    return res.json({
      sdkKey:  newSdkKey,
      message: 'SDK key rotated. Update SDK_KEY in your environment and redeploy.',
    });
  } catch (err) {
    console.error('[Apps/RotateSdkKey]', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ── DELETE /api/apps/:appId ───────────────────────────────────────────────────
router.delete('/:appId', async (req, res) => {
  const app = await App.findOne({ appId: req.params.appId, developerId: req.developer.id });
  if (!app) return res.status(404).json({ error: 'not_found' });

  app.active = false;
  await app.save();

  // Non-fatal — portal is authoritative; microservice cleanup is best-effort
  await deleteAppFromAuthService(app.appId);

  return res.json({ success: true });
});

// ── GET /api/apps/:appId/sync-status ──────────────────────────────────────────
/**
 * Lets developers check whether their app is live in the auth-microservice.
 * Useful after a failed create/update — if this returns { synced: false },
 * they know their SDK key won't work and they should retry the operation.
 */
router.get('/:appId/sync-status', async (req, res) => {
  const app = await App.findOne({ appId: req.params.appId, developerId: req.developer.id });
  if (!app) return res.status(404).json({ error: 'not_found' });

  const synced = await isSyncedToAuthService(app.appId);
  return res.json({
    appId:  app.appId,
    synced,
    message: synced
      ? 'App is active in the auth service. Your SDK key is working.'
      : 'App is NOT synced to the auth service. SDK key calls will fail. Try updating the app to re-trigger sync.',
  });
});

// ── GET /api/apps/:appId/sdk-config ───────────────────────────────────────────
router.get('/:appId/sdk-config', async (req, res) => {
  const app = await App.findOne({ appId: req.params.appId, developerId: req.developer.id });
  if (!app) return res.status(404).json({ error: 'not_found' });

  const sdkGatewayUrl = process.env.SDK_GATEWAY_URL || 'http://localhost:3002';

  return res.json({
    envFile: [
      `# AuthBase SDK — ${app.name}`,
      `SDK_KEY=${app.sdkKey}`,
      `SDK_GATEWAY_URL=${sdkGatewayUrl}`,
      `OIDC_REDIRECT_URI=${app.redirectUris[0]}`,
    ].join('\n'),

    sdkInit: [
      `const { AuthClient } = require('@authbase/sdk');`,
      ``,
      `const auth = new AuthClient({`,
      `  sdkKey:      process.env.SDK_KEY,`,
      `  gatewayUrl:  process.env.SDK_GATEWAY_URL,`,
      `  redirectUri: process.env.OIDC_REDIRECT_URI,`,
      `  // localVerify: true  (default) — tokens verified locally via JWKS, no gateway round-trip`,
      `});`,
    ].join('\n'),

    // Updated to use the new one-call convenience method
    expressRoutes: [
      `app.get('/login', auth.login);`,
      ``,
      `app.get('/callback', async (req, res) => {`,
      `  // One call: handles OIDC exchange + session creation`,
      `  const { accessToken, refreshToken, user } = await auth.handleCallbackAndCreateSession(req);`,
      `  res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'lax' });`,
      `  res.json({ accessToken, user });`,
      `});`,
      ``,
      `app.get('/me', auth.protect(), (req, res) => res.json(req.user));`,
      ``,
      `// Pre-built handlers — no boilerplate needed`,
      `app.post('/refresh', auth.refreshRoute());`,
      `app.post('/logout',  auth.logoutRoute());`,
    ].join('\n'),
  });
});

module.exports = router;