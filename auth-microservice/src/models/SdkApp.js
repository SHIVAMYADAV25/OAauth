/**
 * SdkApp Model — Auth Microservice
 *
 * Synced from developer-portal when a developer creates/updates an app.
 * The auth-microservice uses this to validate SDK keys and resolve
 * clientId, allowed redirectUris, etc. — without ever exposing the
 * internal INTERNAL_API_KEY to developers.
 */

const mongoose = require('mongoose');

const sdkAppSchema = new mongoose.Schema(
  {
    // Mirrors App.appId from developer-portal
    appId: { type: String, required: true, unique: true },

    // The developer-facing key — only this is shared externally
    sdkKey: { type: String, required: true, unique: true, index: true },

    // OIDC client credentials resolved server-side (never sent to developer)
    clientId:     { type: String, required: true },
    clientSecret: { type: String, required: true },

    // OIDC issuer URL (resolved server-side)
    oidcIssuer: { type: String, required: true },

    // Allowed redirect URIs for this app
    redirectUris: { type: [String], required: true },

    // Allowed scopes
    allowedScopes: { type: [String], default: ['openid', 'profile', 'email'] },

    // App metadata
    name:        { type: String },
    developerId: { type: String },

    // Soft-delete
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/**
 * Resolve full OIDC config from an SDK key.
 * Returns null if key is invalid or app is inactive.
 */
sdkAppSchema.statics.resolveByKey = async function (sdkKey) {
  return this.findOne({ sdkKey, active: true });
};

module.exports = mongoose.model('SdkApp', sdkAppSchema);