/**
 * /token endpoint
 * Exchanges authorization code for id_token + access_token
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User.js');
const AuthCode = require('../models/AuthCode.js');
const { getClient, validateRedirectUri } = require('../utils/clients.js');
const { verifyPKCE } = require('../utils/pkce.js');
const { signIdToken, signAccessToken } = require('../utils/jwt.js');

router.post('/', express.json(), express.urlencoded({ extended: true }), async (req, res) => {
  const { grant_type, code, client_id, client_secret, redirect_uri, code_verifier } = req.body;

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  if (!code || !client_id || !redirect_uri || !code_verifier) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing required parameters: code, client_id, redirect_uri, code_verifier',
    });
  }

  try {
    // Validate client
    const client = await getClient(client_id);
    if (!client) {
      return res.status(401).json({ error: 'invalid_client', error_description: 'Unknown client_id' });
    }

    if (client.client_secret && client_secret !== client.client_secret) {
      return res.status(401).json({ error: 'invalid_client', error_description: 'Invalid client_secret' });
    }

    if (!validateRedirectUri(client, redirect_uri)) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
    }

    // Find & validate authorization code
    const authCode = await AuthCode.findOne({ code, clientId: client_id });
    if (!authCode) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or unknown authorization code' });
    }

    // Consume code (prevents replay)
    try {
      await authCode.consume();
    } catch (e) {
      return res.status(400).json({ error: 'invalid_grant', error_description: e.message });
    }

    if (authCode.redirectUri !== redirect_uri) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
    }

    // Verify PKCE
    try {
      verifyPKCE(code_verifier, authCode.codeChallenge);
    } catch (e) {
      return res.status(400).json({ error: 'invalid_grant', error_description: e.message });
    }

    // Load user
    const user = await User.findOne({ sub: authCode.userId });
    if (!user) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'User not found' });
    }

    const profile = user.toOIDCProfile();

    // Sign tokens
    const [id_token, access_token] = await Promise.all([
      signIdToken({
        sub: profile.sub,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        aud: client_id,
        nonce: authCode.nonce,
        expiresIn: '1h',
      }),
      signAccessToken({
        sub: profile.sub,
        scope: authCode.scope,
        aud: client_id,
        expiresIn: '1h',
      }),
    ]);

    return res.json({
      access_token,
      id_token,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: authCode.scope,
    });
  } catch (err) {
    console.error('[Token] Error:', err);
    return res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

module.exports = router;