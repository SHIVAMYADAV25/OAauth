/**
 * Internal Sync Routes  —  /internal/sync
 *
 * Called ONLY by the developer-portal backend using INTERNAL_API_KEY.
 * Keeps SdkApp records in sync when developers create/update/delete apps.
 * Never exposed to external developers.
 *
 * Routes:
 *   POST   /internal/sync/app                      — upsert an app record
 *   DELETE /internal/sync/app/:appId               — soft-delete an app
 *   POST   /internal/sync/app/:appId/rotate-key    — issue new SDK key
 *   GET    /internal/sync/app/:appId/status        — sync health check (NEW)
 *   GET    /internal/client/:clientId              — resolve client by OIDC clientId
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { requireInternalKey } = require('../middleware/internalAuth.js');
const SdkApp = require('../models/SdkApp.js');

router.use(requireInternalKey);
router.use(express.json());

// ── POST /internal/sync/app ───────────────────────────────────────────────────
router.post('/app', async (req, res) => {
  const {
    appId,
    sdkKey,
    clientId,
    clientSecret,
    redirectUris,
    allowedScopes,
    name,
    developerId,
  } = req.body;

  if (!appId || !sdkKey || !clientId || !clientSecret || !redirectUris) {
    return res.status(400).json({
      error:             'invalid_request',
      error_description: 'appId, sdkKey, clientId, clientSecret, redirectUris required',
    });
  }

  // Validate sdkKey format — accept both live and test keys
  if (!sdkKey.startsWith('sdk_live_') && !sdkKey.startsWith('sdk_test_')) {
    return res.status(400).json({
      error:             'invalid_request',
      error_description: 'sdkKey must start with sdk_live_ or sdk_test_',
    });
  }

  try {
    const oidcIssuer = process.env.OIDC_PROVIDER_URL || 'http://localhost:3001';

    const app = await SdkApp.findOneAndUpdate(
      { appId },
      {
        appId,
        sdkKey,
        clientId,
        clientSecret,
        oidcIssuer,
        redirectUris,
        allowedScopes: allowedScopes || ['openid', 'profile', 'email'],
        name,
        developerId,
        active: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`[Sync] App "${name}" (${appId}) upserted`);
    return res.json({ synced: true, appId: app.appId });
  } catch (err) {
    console.error('[Sync/App]', err);
    return res.status(500).json({ error: 'server_error', error_description: err.message });
  }
});

// ── DELETE /internal/sync/app/:appId ──────────────────────────────────────────
router.delete('/app/:appId', async (req, res) => {
  try {
    await SdkApp.findOneAndUpdate({ appId: req.params.appId }, { active: false });
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── POST /internal/sync/app/:appId/rotate-key ─────────────────────────────────
router.post('/app/:appId/rotate-key', async (req, res) => {
  try {
    // Preserve the key prefix (live vs test) when rotating
    const existing = await SdkApp.findOne({ appId: req.params.appId });
    const prefix   = existing?.sdkKey?.startsWith('sdk_test_') ? 'sdk_test_' : 'sdk_live_';
    const newSdkKey = `${prefix}${crypto.randomBytes(24).toString('hex')}`;

    const app = await SdkApp.findOneAndUpdate(
      { appId: req.params.appId },
      { sdkKey: newSdkKey },
      { new: true }
    );

    if (!app) return res.status(404).json({ error: 'not_found' });
    return res.json({ sdkKey: newSdkKey });
  } catch (err) {
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── GET /internal/sync/app/:appId/status ──────────────────────────────────────
/**
 * Health check: returns whether an app is synced and active in the microservice.
 * Used by the portal's GET /api/apps/:appId/sync-status to surface sync failures.
 */
router.get('/app/:appId/status', async (req, res) => {
  try {
    const app = await SdkApp.findOne({ appId: req.params.appId });
    if (!app) return res.json({ active: false, reason: 'not_found' });
    return res.json({ active: app.active, appId: app.appId });
  } catch (err) {
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── GET /internal/client/:clientId ───────────────────────────────────────────
// Resolve a full app record by OIDC clientId (used during token exchange validation)
router.get('/client/:clientId', async (req, res) => {
  const app = await SdkApp.findOne({ clientId: req.params.clientId, active: true });
  if (!app) return res.status(404).json({ error: 'not_found' });
  return res.json(app);
});

module.exports = router;