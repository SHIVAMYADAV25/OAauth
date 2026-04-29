const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Developer = require('../model/Developer.js');
const { requireAuth } = require('../middleware/auth.js');

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function signToken(dev) {
  return jwt.sign(
    { id: dev.id, email: dev.email, name: dev.name },
    process.env.PORTAL_JWT_SECRET,
    { expiresIn: '7d', issuer: 'authbase-portal' }
  );
}

// POST /api/auth/register
router.post('/register', express.json(), async (req, res) => {
  const { name, email, password, company } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'validation', message: 'name, email, password required' });
  if (password.length < 8)
    return res.status(400).json({ error: 'validation', message: 'Password must be at least 8 characters' });

  try {
    const existing = await Developer.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'conflict', message: 'Email already registered' });

    const dev = await Developer.create({ name, email, passwordHash: password, company });
    const token = signToken(dev);
    res.cookie('portalToken', token, COOKIE_OPTS);
    return res.status(201).json({ developer: dev.toPublic(), token });
  } catch (err) {
    console.error('[Register]', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', express.json(), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'validation', message: 'email and password required' });

  try {
    const dev = await Developer.findOne({ email: email.toLowerCase() });
    if (!dev || !(await dev.verifyPassword(password)))
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password' });

    const token = signToken(dev);
    res.cookie('portalToken', token, COOKIE_OPTS);
    return res.json({ developer: dev.toPublic(), token });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const dev = await Developer.findOne({ _id: req.developer.id });
  if (!dev) return res.status(404).json({ error: 'not_found' });
  return res.json({ developer: dev.toPublic() });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('portalToken');
  return res.json({ success: true });
});

module.exports = router;
