/**
 * JWT Utilities - Auth Microservice
 * Issues short-lived access tokens and long-lived refresh tokens (HS256)
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error('ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be set in environment');
}

/**
 * Generate a signed access token (short-lived, 15 min)
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.sub,
      email: user.email,
      name: user.name,
      roles: user.roles || ['user'],
      type: 'access',
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRY, issuer: 'auth-microservice' }
  );
}

/**
 * Generate a random refresh token (opaque, stored as hash)
 */
function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

/**
 * Hash a refresh token before DB storage (SHA-256)
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify an access token — returns decoded payload or throws
 */
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET, { issuer: 'auth-microservice' });
}

/**
 * Decode without verifying (for debugging only — never trust this in auth flows)
 */
function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyAccessToken,
  decodeToken,
  REFRESH_EXPIRY,
};