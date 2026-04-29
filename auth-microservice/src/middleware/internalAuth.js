/**
 * Internal API Key Middleware
 * Protects service-to-service endpoints from public access
 */

function requireInternalKey(req, res, next) {
  const key = req.headers['x-internal-api-key'];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'unauthorized', error_description: 'Invalid internal API key' });
  }
  next();
}

module.exports = { requireInternalKey };