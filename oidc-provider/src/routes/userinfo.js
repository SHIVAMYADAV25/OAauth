/**
 * /userinfo endpoint
 * Returns user claims for a valid access_token
 */

const express = require('express');
const router = express.Router();
const { jwtVerify, createRemoteJWKSet } = require('jose');
const User = require('../models/User.js');
const { getPublicKey } = require('../utils/keyManager.js');

async function verifyAccessToken(token) {
  const { key } = await getPublicKey();
  const issuer = process.env.ISSUER || 'http://localhost:3001';

  const { payload } = await jwtVerify(token, key, {
    issuer,
    algorithms: ['RS256'],
  });

  return payload;
}

router.get('/', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'invalid_token', error_description: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyAccessToken(token);
    const user = await User.findOne({ sub: payload.sub });

    if (!user) {
      return res.status(404).json({ error: 'not_found', error_description: 'User not found' });
    }

    return res.json(user.toOIDCProfile());
  } catch (err) {
    if (err.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({ error: 'invalid_token', error_description: 'Token expired' });
    }
    console.error('[UserInfo] Error:', err.message);
    return res.status(401).json({ error: 'invalid_token', error_description: 'Token verification failed' });
  }
});

module.exports = router;