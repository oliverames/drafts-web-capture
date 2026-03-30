require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes and middleware
const captureRoutes = require('./routes/capture');
const authMiddleware = require('./middleware/auth');
const { initializeDatabase } = require('./database/db');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Rate limiting for security
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Initialize database
initializeDatabase();

// Apply auth middleware to all routes except root
app.use((req, res, next) => {
  if (req.path === '/' || req.path.startsWith('/public/')) {
    return next();
  }
  authMiddleware(req, res, next);
});

// Routes
app.use('/api', captureRoutes);

// Root route - serve the web interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Drafts Web Capture server running on port ${PORT}`);
  console.log(`Access the web interface at http://localhost:${PORT}`);
  if (process.env.CAPTURE_PASSWORD) {
    console.log('Password protection is enabled');
  } else {
    console.warn('WARNING: No password set! Set CAPTURE_PASSWORD in .env file');
  }
});

module.exports = app;