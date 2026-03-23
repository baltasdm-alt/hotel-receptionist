const express = require('express');
const router = express.Router();

// Force UTF-8 για σωστά ελληνικά
router.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Villa Eleni Hotel AI Receptionist'
  });
});

// Simple chat test
router.post('/test-chat', (req, res) => {
  try {
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({
        reply: 'Δεν έλαβα μήνυμα.'
      });
    }

    return res.json({
      reply: `Καταχώρησα το αίτημά σας για "${message}". Θα θέλατε να μου πείτε αριθμό ατόμων και τύπο δωματίου;`
    });
  } catch (error) {
    console.error('POST /test-chat error:', error);
    return res.status(500).json({
      reply: 'Υπήρξε ένα προσωρινό σφάλμα. Δοκιμάστε ξανά.'
    });
  }
});

// Voice endpoint
router.post('/voice', (req, res) => {
  try {
    const { transcript } = req.body || {};

    return res.json({
      reply: transcript
        ? `Έλαβα το μήνυμά σας: ${transcript}`
        : 'Δεν έλαβα φωνητικό μήνυμα.'
    });
  } catch (error) {
    console.error('POST /voice error:', error);
    return res.status(500).json({
      reply: 'Voice endpoint error.'
    });
  }
});

module.exports = router;
