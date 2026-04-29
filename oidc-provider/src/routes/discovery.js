/**
 * OIDC Discovery Routes
 * /.well-known/openid-configuration
 * /.well-known/jwks.json
 */

const express = require('express');
const router = express.Router();
const { getJWKS } = require('../utils/keyManager.js');

router.get('/openid-configuration', (req, res) => {
  const issuer = process.env.ISSUER || 'http://localhost:3001';

  res.json({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    registration_endpoint: `${issuer}/register`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'profile', 'email'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    claims_supported: ['sub', 'email', 'name', 'picture', 'email_verified', 'iss', 'aud', 'exp', 'iat'],
    code_challenge_methods_supported: ['S256'],
    grant_types_supported: ['authorization_code'],
  });
});

router.get('/jwks.json', async (req, res) => {
  try {
    const jwks = await getJWKS();
    res.json(jwks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load JWKS' });
  }
});

module.exports = router;