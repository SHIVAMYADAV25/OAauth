/**
 * Auth Microservice — Main Entry Point
 *
 * Port 3002 (internal)
 *
 * Route namespaces:
 *   /session/*         — internal (INTERNAL_API_KEY)  — used by OIDC provider / internal services
 *   /sdk/*             — public   (x-sdk-key)         — used by developer apps via the SDK
 *   /internal/sync/*   — internal (INTERNAL_API_KEY)  — used by developer-portal to sync app records
 */

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const sessionRouter     = require('./routes/session.js');
const sdkRouter         = require('./routes/sdk.js');
const internalSyncRouter = require('./routes/internalSync.js');

const app  = express();
const PORT = process.env.PORT || 3002;

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(morgan('combined'));
app.use(cookieParser());

// console.log(typeof sessionRouter);
// console.log(typeof sdkRouter);
// console.log(typeof internalSyncRouter);

// CORS — SDK routes are called from developer apps (any origin)
// Internal routes are called server-to-server (no browser, CORS irrelevant but harmless)
app.use(cors({ origin: true, credentials: true }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Tighter limit on SDK routes (externally accessible)
const sdkLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => req.headers['x-sdk-key'] || req.ip,
  message: { error: 'too_many_requests' },
});

// Loose limit on internal routes (service-to-service)
const internalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  message: { error: 'too_many_requests' },
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Internal session management (called by OIDC provider or other internal services)
app.use('/session', internalLimiter, sessionRouter);

// Public SDK gateway (called by developer apps via @authbase/sdk)
app.use('/sdk', sdkLimiter, sdkRouter);



// Internal sync (called by developer-portal when apps are created/updated)
app.use('/internal/sync', internalLimiter, internalSyncRouter);

// Health
app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'auth-microservice' })
);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function start() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/auth-microservice'
    );
    console.log('[DB] Connected to MongoDB',process.env.MONGODB_URI);

    app.listen(PORT, () => {
      
      console.log(`\n🔑 Auth Microservice running on http://localhost:${PORT}`);
      console.log(`   /session/*       → internal (INTERNAL_API_KEY)`);
      console.log(`   /sdk/*           → public   (x-sdk-key)`);
      console.log(`   /internal/sync/* → internal (INTERNAL_API_KEY)\n`);
    });
  } catch (err) {
    console.error('[Startup] Fatal:', err);
    process.exit(1);
  }
}

start();

module.exports = app;