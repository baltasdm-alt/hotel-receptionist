require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// Homepage UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Routes
const routes = require('./routes');
app.use('/', routes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nVilla Eleni Hotel AI Receptionist`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Routes: GET / | GET /health | POST /test-chat | POST /voice`);
  console.log(`Anthropic API Key: ${process.env.ANTHROPIC_API_KEY ? 'Set' : 'MISSING'}`);
  console.log(`${'-'.repeat(50)}\n`);
});

module.exports = app;