/**
 * OIDC Provider - Main Entry Point
 * Implements OIDC Authorization Code Flow with PKCE (RFC 7636)
 */

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const discoveryRouter = require('./routes/discovery');
const authorizeRouter = require('./routes/authorize');
const tokenRouter = require('./routes/token');
const userinfoRouter = require('./routes/userinfo');
const registerRouter = require('./routes/register');
// const { loadClients } = require('./utils/clients');
const { loadKeys } = require('./utils/keyManager');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Security Middleware ---
app.use(helmet({ contentSecurityPolicy: false })); // CSP off for login page simplicity
app.use(cors({
  origin: (origin, cb) => cb(null, true), // Configure per your needs
  credentials: true,
}));
app.use(morgan('combined'));

// --- Rate Limiting ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: 'too_many_requests', error_description: 'Rate limit exceeded, try again later' },
});

const tokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'too_many_requests' },
});

// --- Routes ---
app.use('/.well-known', discoveryRouter);
app.use('/authorize', authLimiter, authorizeRouter);
app.use('/token', tokenLimiter, tokenRouter);
app.use('/userinfo', userinfoRouter);
app.use('/register', registerRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', issuer: process.env.ISSUER }));

// --- Bootstrap ---
async function start() {
  try {
    // Load RSA keys
    await loadKeys();

    // Load registered clients
    // await loadClients();

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/oidc-provider');
    console.log('[DB] Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`\n🔐 OIDC Provider running on http://localhost:${PORT}`);
      console.log(`   Issuer: ${process.env.ISSUER || 'http://localhost:' + PORT}`);
      console.log(`   Discovery: http://localhost:${PORT}/.well-known/openid-configuration\n`);
    });
  } catch (err) {
    console.error('[Startup] Fatal error:', err);
    process.exit(1);
  }
}

start();

module.exports = app;