/**
 * User Model - OIDC Provider
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    sub: {
      type: String,
      unique: true,
      required: true,
      default: () => require('crypto').randomUUID(),
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    name: { type: String, required: true },
    picture: { type: String },
    emailVerified: { type: Boolean, default: false },
    provider: { type: String, enum: ['local', 'google', 'github'], default: 'local' },
    providerId: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (this.isModified('passwordHash') && this.passwordHash && !this.passwordHash.startsWith('$2')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
  next();
});

userSchema.methods.verifyPassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.toOIDCProfile = function () {
  return {
    sub: this.sub,
    email: this.email,
    name: this.name,
    picture: this.picture,
    email_verified: this.emailVerified,
  };
};

module.exports = mongoose.model('User', userSchema);