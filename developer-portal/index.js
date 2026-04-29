require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRouter = require('./routes/auth.js');
const appsRouter = require('./routes/apps.js');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true, credentials: true }));
app.use(morgan('dev'));
app.use(cookieParser());

app.use(rateLimit({ windowMs: 60000, max: 100 }));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/apps', appsRouter);

// Serve static frontend
app.use(express.static(path.join(__dirname, './frontend')));

// SPA fallback — all non-API routes serve the frontend
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'not_found' });
 res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

async function start() {
  const MONGO_URI = process.env.MONGODB_URI;

  if (!MONGO_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  await mongoose.connect(MONGO_URI);
  console.log('[DB] Connected');
  app.listen(PORT, () => console.log(`\n🌐 Developer Portal → http://localhost:${PORT}\n`));
}

start().catch(err => { console.error(err); process.exit(1); });
