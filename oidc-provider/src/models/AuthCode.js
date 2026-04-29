/**
 * Authorization Code Model
 * Short-lived codes used in the OIDC Authorization Code Flow
 */

const mongoose = require('mongoose');

const authCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  userId: { type: String, required: true },
  redirectUri: { type: String, required: true },
  scope: { type: String, required: true },
  codeChallenge: { type: String, required: true },
  codeChallengeMethod: { type: String, default: 'S256' },
  nonce: { type: String },
  used: { type: Boolean, default: false },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    index: { expireAfterSeconds: 0 },
  },
  createdAt: { type: Date, default: Date.now },
});

// Prevent replay attacks
authCodeSchema.methods.consume = async function () {
  if (this.used) throw new Error('Authorization code already used');
  if (this.expiresAt < new Date()) throw new Error('Authorization code expired');
  this.used = true;
  await this.save();
};

module.exports = mongoose.model('AuthCode', authCodeSchema);