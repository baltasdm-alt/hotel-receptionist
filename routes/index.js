const express = require('express');
const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Villa Eleni Hotel AI Receptionist'
  });
});

// Test chat (dummy για τώρα)
router.post('/test-chat', (req, res) => {
  const { message } = req.body;

  res.json({
    reply: `Έλαβα το μήνυμά σου: "${message}"`
  });
});

module.exports = router;