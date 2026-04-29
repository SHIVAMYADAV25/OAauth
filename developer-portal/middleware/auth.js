const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = req.cookies?.portalToken || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'unauthorized', message: 'Login required' });

  try {
    req.developer = jwt.verify(token, process.env.PORTAL_JWT_SECRET);
    next();
  } catch (err) {
    res.clearCookie('portalToken');
    return res.status(401).json({ error: 'token_expired', message: 'Session expired, please login again' });
  }
}

module.exports = { requireAuth };
