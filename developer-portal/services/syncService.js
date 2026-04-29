/**
 * Portal Sync Service
 *
 * Called by the developer portal whenever an app is created, updated, or deleted.
 * Keeps the auth-microservice's SdkApp collection in sync.
 * Uses INTERNAL_API_KEY — never exposed to developers.
 *
 * KEY CHANGE: Sync failures are now thrown (not swallowed). The caller in
 * apps.js decides whether to surface the error to the developer. This makes
 * a failed sync immediately visible instead of silently producing an SDK key
 * that doesn't work.
 */

const axios = require('axios');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

if (!INTERNAL_API_KEY) {
  console.warn('[SyncService] WARNING: INTERNAL_API_KEY not set — app sync will fail');
}

function internalRequest(method, path, data = {}) {
  return axios({
    method,
    url:     `${AUTH_SERVICE_URL}${path}`,
    data,
    headers: { 'x-internal-api-key': INTERNAL_API_KEY },
    timeout: 5000,
  });
}

/**
 * Sync a newly created or updated app to the auth-microservice.
 *
 * THROWS on failure — callers should catch and decide how to handle.
 * For create/update routes, a sync failure means the SDK key won't work,
 * so the developer should know immediately.
 *
 * @param {object} app — Mongoose App document
 */
async function syncAppToAuthService(app) {
  await internalRequest('POST', '/internal/sync/app', {
    appId:         app.appId,
    sdkKey:        app.sdkKey,
    clientId:      app.clientId,
    clientSecret:  app.clientSecret,
    redirectUris:  app.redirectUris,
    allowedScopes: app.allowedScopes,
    name:          app.name,
    developerId:   app.developerId,
  });
  console.log(`[Sync] ✓ App "${app.name}" (${app.appId}) synced`);
}

/**
 * Soft-delete an app in the auth-microservice (SDK key stops working immediately).
 *
 * Non-fatal on failure — the app is already soft-deleted in the portal DB,
 * and the TTL on stale SdkApp records will eventually clean up. Log loudly.
 *
 * @param {string} appId
 */
async function deleteAppFromAuthService(appId) {
  try {
    await internalRequest('DELETE', `/internal/sync/app/${appId}`);
    console.log(`[Sync] ✓ App ${appId} deactivated`);
  } catch (err) {
    // Non-fatal: portal already soft-deleted the app. Log so ops can see it.
    console.error(`[Sync] ✗ Failed to deactivate ${appId} in auth-microservice:`, err.response?.data || err.message);
  }
}

/**
 * Rotate the SDK key for an app.
 * Returns the new SDK key so the portal can persist it.
 *
 * THROWS on failure — if the auth-microservice doesn't update its key,
 * the portal and microservice will be out of sync and the new key won't work.
 *
 * @param   {string} appId
 * @returns {Promise<string>} newSdkKey
 */
async function rotateSdkKey(appId) {
  const { data } = await internalRequest('POST', `/internal/sync/app/${appId}/rotate-key`);
  return data.sdkKey;
}

/**
 * Check whether the auth-microservice has a specific appId synced and active.
 * Use this to diagnose sync failures — call it after a failed create/update
 * and surface the result in your health dashboard.
 *
 * Returns true if the app is live in the microservice, false otherwise.
 *
 * @param {string} appId
 */
async function isSyncedToAuthService(appId) {
  try {
    const { data } = await internalRequest('GET', `/internal/sync/app/${appId}/status`);
    return data.active === true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  syncAppToAuthService,
  deleteAppFromAuthService,
  rotateSdkKey,
  isSyncedToAuthService,
};