const basicAuth = require('basic-auth');

const authMiddleware = (req, res, next) => {
  // Check if password is required
  if (!process.env.CAPTURE_PASSWORD || process.env.CAPTURE_PASSWORD === '') {
    return next(); // No password required
  }

  const user = basicAuth(req);
  
  if (!user || !user.pass) {
    res.set('WWW-Authenticate', 'Basic realm="Drafts Capture"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (user.pass !== process.env.CAPTURE_PASSWORD) {
    res.set('WWW-Authenticate', 'Basic realm="Drafts Capture"');
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Authentication successful
  next();
};

module.exports = authMiddleware;