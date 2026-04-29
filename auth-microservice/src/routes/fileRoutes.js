/**
 * File Upload Routes  —  /sdk/file/*
 *
 * These routes are called by developer apps via the SDK.
 * They require the x-sdk-key header (handled by requireSdkKey middleware).
 *
 * Routes:
 *   GET  /sdk/file/config         — returns upload constraints for the app
 *   POST /sdk/file/sign-upload    — issues a short-lived signed upload token
 *                                   (for direct-to-provider uploads from browser)
 *   POST /sdk/file/log            — record an upload that happened client-side
 *
 * These routes extend the auth-microservice and drop into routes/sdk.js
 * (add: router.use('/file', fileRouter) after requireSdkKey is applied).
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');

// ── In-memory signed token store ──────────────────────────────────────────────
// In production: use Redis with a 5-minute TTL
const signedTokens = new Map();

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Sweep expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of signedTokens) {
    if (v.expiresAt < now) signedTokens.delete(k);
  }
}, 60 * 1000);

// ── GET /sdk/file/config ──────────────────────────────────────────────────────
/**
 * Returns the file upload constraints configured for this app.
 * The SDK reads these at init time so the developer doesn't need to
 * hard-code limits on both the server and client.
 */
router.get('/config', (req, res) => {
  const app = req.sdkApp;
  return res.json({
    appId:          app.appId,
    appName:        app.name,
    // These defaults are returned so SDK-powered upload UIs can
    // respect the same constraints without a second config source.
    defaults: {
      maxSize:       10 * 1024 * 1024,  // 10 MB — configure per app in DB if needed
      maxFiles:      10,
      allowedTypes:  null,              // null = all allowed
    },
    // The gateway URL itself (useful for SDK auto-discovery)
    gatewayUrl: `${req.protocol}://${req.get('host')}`,
  });
});

// ── POST /sdk/file/sign-upload ────────────────────────────────────────────────
/**
 * Issues a short-lived (5-minute) signed token for a direct-to-provider upload.
 *
 * Body:
 *   { fileName, mimeType, size, folder?, meta? }
 *
 * Returns:
 *   { uploadToken, expiresAt }
 *
 * The developer's client-side code can exchange this token for provider-specific
 * upload credentials (ImageKit auth params, Cloudinary signature, S3 presigned URL, etc.)
 * without exposing any server-side secrets.
 *
 * NOTE: The actual provider credential generation happens in the developer's
 * FileClient middleware on their own server — this token just proves the gateway
 * approved this specific file metadata.
 */
router.post('/sign-upload', express.json(), (req, res) => {
  const { fileName, mimeType, size, folder, meta } = req.body;

  if (!fileName || !mimeType || size == null) {
    return res.status(400).json({
      error:             'invalid_request',
      error_description: 'fileName, mimeType, size are required',
    });
  }

  // Basic size sanity check (10 GB hard ceiling from gateway)
  if (size > 10 * 1024 * 1024 * 1024) {
    return res.status(413).json({
      error:             'file_too_large',
      error_description: 'File exceeds the 10 GB gateway limit',
    });
  }

  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TOKEN_TTL_MS;

  signedTokens.set(token, {
    appId:    req.sdkApp.appId,
    fileName,
    mimeType,
    size,
    folder:   folder || 'uploads',
    meta:     meta   || {},
    expiresAt,
  });

  return res.json({
    uploadToken: token,
    expiresAt:   new Date(expiresAt).toISOString(),
    ttlSeconds:  TOKEN_TTL_MS / 1000,
  });
});

// ── POST /sdk/file/verify-token ───────────────────────────────────────────────
/**
 * Verify a signed upload token. Called by the developer's FileClient
 * before accepting a direct upload from the browser.
 *
 * Body: { uploadToken }
 * Returns: { valid, fileName, mimeType, size, folder, meta } | { valid: false }
 */
router.post('/verify-token', express.json(), (req, res) => {
  const { uploadToken } = req.body;
  if (!uploadToken) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'uploadToken required' });
  }

  const record = signedTokens.get(uploadToken);
  if (!record || record.expiresAt < Date.now() || record.appId !== req.sdkApp.appId) {
    return res.json({ valid: false, error: 'Token expired or not found' });
  }

  // One-time use
  signedTokens.delete(uploadToken);

  return res.json({
    valid:    true,
    fileName: record.fileName,
    mimeType: record.mimeType,
    size:     record.size,
    folder:   record.folder,
    meta:     record.meta,
  });
});

// ── POST /sdk/file/log ────────────────────────────────────────────────────────
/**
 * Log a completed client-side upload.
 * Useful for audit trails when files are uploaded directly to the provider
 * (bypassing the developer's server entirely).
 *
 * Body: { fileId, url, fileName, mimeType, size, provider, meta? }
 */
router.post('/log', express.json(), (req, res) => {
  const { fileId, url, fileName, mimeType, size, provider } = req.body;

  if (!fileId || !url || !fileName) {
    return res.status(400).json({
      error:             'invalid_request',
      error_description: 'fileId, url, fileName are required',
    });
  }

  // In a real deployment: persist to DB / audit log
  console.log(`[FileSDK/Log] App ${req.sdkApp.appId} uploaded "${fileName}" (${provider}) — ${url}`);

  return res.json({ logged: true, timestamp: new Date().toISOString() });
});

module.exports = router;