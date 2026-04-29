/**
 * Session Service — Auth Microservice
 *
 * All session operations. Shared by both /session (internal) and /sdk (external) routes.
 *
 * KEY CHANGE: No User model here. The auth-microservice is not an identity store —
 * the OIDC provider owns identity. We accept identity claims from a verified id_token
 * and embed a snapshot in the session document. This eliminates the duplicate User
 * collection that could drift from the OIDC provider's source of truth.
 */

const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const Session = require('../models/Session.js');

const ACCESS_TOKEN_SECRET  = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET;
const ACCESS_EXPIRES_IN    = process.env.ACCESS_TOKEN_EXPIRES || '15m';
const REFRESH_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || '30', 10);

if (!ACCESS_TOKEN_SECRET) {
  throw new Error('ACCESS_TOKEN_SECRET env var is required');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * @param {{ sub, email, name, picture, roles }} userSnapshot
 */
function generateAccessToken(userSnapshot) {
  return jwt.sign(
    {
      sub:   userSnapshot.sub,
      email: userSnapshot.email,
      name:  userSnapshot.name,
      roles: userSnapshot.roles || ['user'],
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN, issuer: 'auth-microservice' }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function parseDeviceName(userAgent = '') {
  if (!userAgent)                       return 'Unknown Device';
  if (/iPhone|iPad/i.test(userAgent))   return 'iOS Device';
  if (/Android/i.test(userAgent))       return 'Android Device';
  if (/Windows/i.test(userAgent))       return 'Windows PC';
  if (/Macintosh/i.test(userAgent))     return 'Mac';
  if (/Linux/i.test(userAgent))         return 'Linux';
  return 'Unknown Device';
}

function toPublicProfile(snapshot) {
  return {
    sub:     snapshot.sub,
    email:   snapshot.email,
    name:    snapshot.name,
    picture: snapshot.picture || null,
    roles:   snapshot.roles   || ['user'],
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Issue a new session for a verified identity.
 *
 * The caller (SDK gateway or internal route) is responsible for having already
 * verified the OIDC id_token. We trust the claims passed in here.
 *
 * @param {{ sub, email, name, picture }} identity   — from verified OIDC id_token
 * @param {{ userAgent, ip }}            deviceMeta
 * @param {string}                       [appId]     — which developer app owns this session
 */
async function createSession(identity, deviceMeta = {}, appId = null) {
  const userSnapshot = {
    sub:     identity.sub,
    email:   identity.email,
    name:    identity.name,
    picture: identity.picture || null,
    roles:   identity.roles   || ['user'],
  };

  const rawRefreshToken = generateRefreshToken();
  const accessToken     = generateAccessToken(userSnapshot);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS);

  await Session.create({
    userId:           userSnapshot.sub,
    userSnapshot,                          // embedded — no separate User collection needed
    refreshTokenHash: hashToken(rawRefreshToken),
    appId:            appId || null,
    deviceInfo: {
      userAgent:  deviceMeta.userAgent,
      ip:         deviceMeta.ip,
      deviceName: parseDeviceName(deviceMeta.userAgent),
    },
    expiresAt,
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: toPublicProfile(userSnapshot),
  };
}

/**
 * Rotate a refresh token (one-time use).
 * Reads user identity from the session's embedded snapshot — no User DB lookup.
 *
 * @param {string}               rawRefreshToken
 * @param {{ userAgent, ip }}    deviceMeta
 */
async function refreshSession(rawRefreshToken, deviceMeta = {}) {
  const tokenHash = hashToken(rawRefreshToken);

  const session = await Session.findOne({
    refreshTokenHash: tokenHash,
    revoked:          false,
  });

  if (!session)           throw new Error('invalid_token: refresh token not found');
  if (!session.isValid()) throw new Error('invalid_token: session expired or revoked');

  const snapshot = session.userSnapshot;
  if (!snapshot?.sub) throw new Error('invalid_token: session has no identity snapshot');

  // Rotate — revoke old, issue new
  session.revoked = true;
  await session.save();

  const newRawRefreshToken = generateRefreshToken();
  const accessToken        = generateAccessToken(snapshot);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS);

  await Session.create({
    userId:           snapshot.sub,
    userSnapshot:     snapshot,             // carry the snapshot forward unchanged
    refreshTokenHash: hashToken(newRawRefreshToken),
    appId:            session.appId,
    deviceInfo: {
      userAgent:  deviceMeta.userAgent  || session.deviceInfo?.userAgent,
      ip:         deviceMeta.ip         || session.deviceInfo?.ip,
      deviceName: parseDeviceName(deviceMeta.userAgent || session.deviceInfo?.userAgent),
    },
    expiresAt,
  });

  return {
    accessToken,
    refreshToken: newRawRefreshToken,
    user: toPublicProfile(snapshot),
  };
}

/**
 * Revoke a single session by refresh token.
 */
async function logout(rawRefreshToken) {
  if (!rawRefreshToken) return;
  const tokenHash = hashToken(rawRefreshToken);
  await Session.findOneAndUpdate({ refreshTokenHash: tokenHash }, { revoked: true });
}

/**
 * Revoke all sessions for a user (force-logout all devices).
 */
async function revokeAllSessions(userId) {
  const result = await Session.updateMany(
    { userId, revoked: false },
    { revoked: true }
  );
  return { revoked: result.modifiedCount };
}

/**
 * List active, non-expired sessions for a user.
 */
async function getSessions(userId) {
  return Session.find({
    userId,
    revoked:   false,
    expiresAt: { $gt: new Date() },
  }).sort({ lastUsedAt: -1 });
}

/**
 * Verify an access token (synchronous).
 * Returns the decoded payload or throws.
 */
function verifyToken(token) {
  return jwt.verify(token, ACCESS_TOKEN_SECRET, { issuer: 'auth-microservice' });
}

module.exports = {
  createSession,
  refreshSession,
  logout,
  revokeAllSessions,
  getSessions,
  verifyToken,
};