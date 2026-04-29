/**
 * User Model - Auth Microservice
 * Mirrors identity from OIDC provider (sub is the source of truth)
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    sub: { type: String, required: true, unique: true }, // from OIDC id_token
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    picture: { type: String },
    roles: { type: [String], default: ['user'] },
    lastLoginAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.methods.toPublicProfile = function () {
  return {
    sub: this.sub,
    email: this.email,
    name: this.name,
    picture: this.picture,
    roles: this.roles,
  };
};

module.exports = mongoose.model('User', userSchema);