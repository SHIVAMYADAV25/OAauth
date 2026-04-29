/**
 * /register endpoint
 * Creates a new user account (for development/testing)
 * In production, integrate your existing user management system
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User.js');
const crypto = require('crypto');

router.post('/', express.json(), async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'email, password, and name are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'conflict', error_description: 'Email already registered' });
    }

    const user = await User.create({
      sub: crypto.randomUUID(),
      email: email.toLowerCase(),
      passwordHash: password, // pre-save hook will hash it
      name,
      provider: 'local',
    });

    // res.redirect("")

    return res.status(201).json({
      sub: user.sub,
      email: user.email,
      name: user.name,
      created: true,
    });
  } catch (err) {
    console.error('[Register] Error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;