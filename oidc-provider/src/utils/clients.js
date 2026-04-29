/**
 * OIDC Client Registry (API-based)
 */

const axios = require("axios");

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:3002";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// Axios instance (better control)
const api = axios.create({
  baseURL: AUTH_SERVICE_URL,
  timeout: 5000, // ⏱️ prevents hanging requests
});

/**
 * Find client by clientId
 */
async function findClient(clientId) {
  if (!INTERNAL_API_KEY) {
    console.error("[getClient] INTERNAL_API_KEY missing");
    return null;
  }

  try {
    const res = await api.get(`/internal/sync/client/${clientId}`, {
      headers: {
        "x-internal-api-key": INTERNAL_API_KEY,
      },
    });

    // Only log minimal info (safe)
    console.log("[getClient] fetched:", {
      clientId: res.data?.clientId,
      name: res.data?.name,
    });

    return res.data;
  } catch (err) {
    console.error(
      "[getClient]",
      err.response?.status,
      err.response?.data || err.message
    );
    return null;
  }
}

/**
 * Get client (used by authorize route)
 */
async function getClient(clientId) {
  const client = await findClient(clientId);

  if (!client) {
    console.warn("[getClient] client not found:", clientId);
    return null;
  }

  return client;
}

/**
 * Validate redirect URI
 */
function validateRedirectUri(client, redirectUri) {
  if (!client) return false;

  console.log("[validateRedirectUri]", {
    incoming: redirectUri,
    allowed: client.redirectUris,
  });

  return (client.redirectUris || []).includes(redirectUri);
}

/**
 * Validate client secret (if needed)
 */
function validateClientSecret(client, secret) {
  return client?.clientSecret === secret;
}

module.exports = {
  getClient,
  validateRedirectUri,
  validateClientSecret,
};