/**
 * OIDC Client Registry (DB-based)
 */
const axios = require("axios");
const SdkApp = require("../../../auth-microservice/src/models/SdkApp.js");

// ─────────────────────────────────────────────────────────────────────────────
// Find client by clientId
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';

// const clients = [];

async function findClient(clientId) {
  try {
    const res = await axios.get(`${AUTH_SERVICE_URL}/internal/sync/client/${clientId}`, {
      headers: {
        'x-internal-api-key': process.env.INTERNAL_API_KEY
      }
    });

    console.log(res.data);

    return res.data
  } catch (err) {
    console.error('[getClient]', err.response?.data || err.message);
    return null;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Get client (used by authorize route)
// ─────────────────────────────────────────────────────────────────────────────
async function getClient(clientId) {
  const client = await findClient(clientId);
  console.log(client)

  if (!client) return null;

  return client;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate redirect URI
// ─────────────────────────────────────────────────────────────────────────────
function validateRedirectUri(client, redirectUri) {
  if (!client) return false;
  console.log('--- VALIDATING REDIRECT URI ---');
  console.log('Incoming:', redirectUri);
  console.log('Stored:', client);

  return (client.redirectUris || []).includes(redirectUri);
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate client secret (if needed)
// ─────────────────────────────────────────────────────────────────────────────
function validateClientSecret(client, secret) {
  return client.clientSecret === secret;
}

module.exports = {
  getClient,
  validateRedirectUri,
  validateClientSecret
};