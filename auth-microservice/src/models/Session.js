/**
 * Session Model — Auth Microservice
 *
 * Stores hashed refresh tokens with device/IP metadata and an embedded
 * userSnapshot so refresh token rotation never needs a separate User lookup.
 *
 * KEY CHANGE: Added `userSnapshot` subdocument. The auth-microservice no longer
 * maintains a User collection — identity is owned by the OIDC provider and
 * embedded here at session-creation time from the verified id_token claims.
 */

const mongoose = require('mongoose');

const userSnapshotSchema = new mongoose.Schema(
  {
    sub:     { type: String, required: true },
    email:   { type: String, required: true },
    name:    { type: String, required: true },
    picture: { type: String, default: null },
    roles:   { type: [String], default: ['user'] },
  },
  { _id: false }   // embedded subdoc, no own _id needed
);

const sessionSchema = new mongoose.Schema(
  {
    userId:           { type: String, required: true, index: true }, // OIDC sub — kept for fast queries
    userSnapshot:     { type: userSnapshotSchema, required: true },  // identity snapshot at login time
    refreshTokenHash: { type: String, required: true },
    appId:            { type: String, default: null },               // which developer app owns this session
    deviceInfo: {
      userAgent:  { type: String },
      ip:         { type: String },
      deviceName: { type: String },
    },
    revoked:   { type: Boolean, default: false },
    expiresAt: {
      type:     Date,
      required: true,
      index:    { expireAfterSeconds: 0 },  // MongoDB TTL — auto-deletes expired docs
    },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Fast path for token lookup (the hot path on every refresh)
sessionSchema.index({ refreshTokenHash: 1, revoked: 1 });

// Fast path for listing/revoking all sessions for a user
sessionSchema.index({ userId: 1, revoked: 1, expiresAt: 1 });

sessionSchema.methods.isValid = function () {
  return !this.revoked && this.expiresAt > new Date();
};

module.exports = mongoose.model('Session', sessionSchema);