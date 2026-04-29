/**
 * JWT Utilities for OIDC Provider
 * Signs ID tokens using RS256 with rotating key IDs
 */

const { SignJWT } = require('jose');
const { getPrivateKey } = require('./keyManager.js');

/**
 * Sign an ID Token (RS256)
 */
async function signIdToken({ sub, email, name, picture, aud, nonce, expiresIn = '1h' }) {
  const { key, kid } = await getPrivateKey();
  const issuer = process.env.ISSUER || 'http://localhost:3001';

  const payload = {
    sub,
    email,
    name,
    ...(picture && { picture }),
    ...(nonce && { nonce }),
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(issuer)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);

  return token;
}

/**
 * Sign an Access Token (RS256) - opaque-style but JWT for userinfo
 */
async function signAccessToken({ sub, scope, aud, expiresIn = '1h' }) {
  const { key, kid } = await getPrivateKey();
  const issuer = process.env.ISSUER || 'http://localhost:3001';

  const token = await new SignJWT({ sub, scope })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(issuer)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);

  return token;
}

module.exports = { signIdToken, signAccessToken };