/**
 * SDK Gateway Middleware
 *
 * Validates the developer-facing SDK key on /sdk/* routes.
 * Resolves app config (clientId, clientSecret, oidcIssuer, redirectUris)
 * and attaches it to req.sdkApp — internal credentials never leave the server.
 *
 * KEY CHANGE: Accepts sdk_test_ keys (for development/staging) in addition
 * to sdk_live_ keys. The format check was previously hardcoded to sdk_live_.
 */

const SdkApp = require('../models/SdkApp.js');

async function requireSdkKey(req, res, next) {
  const key =
    req.headers['x-sdk-key'] ||
    (req.headers.authorization?.startsWith('Bearer sdk_')
      ? req.headers.authorization.slice(7)
      : null);

  if (!key || (!key.startsWith('sdk_live_') && !key.startsWith('sdk_test_'))) {
    return res.status(401).json({
      error:             'unauthorized',
      error_description: 'Missing or invalid SDK key. Include x-sdk-key header.',
    });
  }

  try {
    const app = await SdkApp.resolveByKey(key);
    if (!app) {
      return res.status(401).json({
        error:             'unauthorized',
        error_description: 'SDK key not found or app is inactive.',
      });
    }

    req.sdkApp = app;
    return next();
  } catch (err) {
    console.error('[SdkGateway]', err.message);
    return res.status(500).json({ error: 'server_error' });
  }
}

module.exports = { requireSdkKey };