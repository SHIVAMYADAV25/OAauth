/**
 * PKCE Utilities
 * Implements S256 code_challenge verification
 */

const crypto = require('crypto');

/**
 * Verify PKCE code_verifier against stored code_challenge
 * code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))
 */
function verifyPKCE(codeVerifier, codeChallenge) {
  if (!codeVerifier || !codeChallenge) {
    throw new Error('Missing code_verifier or code_challenge');
  }

  const computed = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  if (computed !== codeChallenge) {
    throw new Error('PKCE verification failed: code_verifier does not match code_challenge');
  }

  return true;
}

/**
 * Validate code_challenge_method (only S256 supported)
 */
function validateChallengeMethod(method) {
  if (method !== 'S256') {
    throw new Error('Only S256 code_challenge_method is supported');
  }
}

module.exports = { verifyPKCE, validateChallengeMethod };