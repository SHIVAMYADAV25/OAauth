const mongoose = require('mongoose');
const crypto = require('crypto');

const appSchema = new mongoose.Schema({
  appId:       { type: String, unique: true, default: () => crypto.randomUUID() },
  developerId: { type: String, required: true, index: true },

  // App info
  name:        { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  website:     { type: String, trim: true },
  logoUrl:     { type: String },

  // OIDC client credentials (used internally between services)
  clientId:     { type: String, unique: true, default: () => `app_${crypto.randomBytes(8).toString('hex')}` },
  clientSecret: { type: String, default: () => crypto.randomBytes(32).toString('hex') },

  // SDK key — this is what developers put in their .env
  // It is scoped to this app only and never exposes internal secrets
  sdkKey: {
    type: String,
    unique: true,
    default: () => `sdk_live_${crypto.randomBytes(24).toString('hex')}`,
  },

  // OIDC config
  redirectUris:  { type: [String], required: true },
  allowedScopes: { type: [String], default: ['openid', 'profile', 'email'] },

  // Stats
  totalLogins: { type: Number, default: 0 },
  active:      { type: Boolean, default: true },
}, { timestamps: true });

appSchema.methods.toPublic = function () {
  return {
    appId:         this.appId,
    name:          this.name,
    description:   this.description,
    website:       this.website,
    clientId:      this.clientId,
    clientSecret:  this.clientSecret,
    sdkKey:        this.sdkKey,
    redirectUris:  this.redirectUris,
    allowedScopes: this.allowedScopes,
    totalLogins:   this.totalLogins,
    active:        this.active,
    createdAt:     this.createdAt,
  };
};

// Never expose clientSecret or internal credentials in list views
appSchema.methods.toSafePublic = function () {
  return {
    appId:        this.appId,
    name:         this.name,
    description:  this.description,
    website:      this.website,
    clientId:     this.clientId,
    sdkKey:       this.sdkKey,
    redirectUris: this.redirectUris,
    totalLogins:  this.totalLogins,
    active:       this.active,
    createdAt:    this.createdAt,
  };
};

module.exports = mongoose.model('App', appSchema);