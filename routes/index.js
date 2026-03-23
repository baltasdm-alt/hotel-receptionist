const express = require('express');
const router = express.Router();

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Force UTF-8
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

// AI Chat (Claude)
router.post('/test-chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        reply: 'Δεν έλαβα μήνυμα.'
      });
    }

    const systemPrompt = `
You are Elena, the AI receptionist of a 4-star hotel in Greece.

Your role:
- Speak naturally and politely like a real receptionist
- Be warm, friendly, and professional
- Help guests with bookings, rooms, facilities, and policies
- Ask smart follow-up questions
- Ask ONE question at a time
- Do NOT repeat what the guest already said

Tone:
- Elegant
- Helpful
- Human, not robotic

Keep answers short and clear.
`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: message
        }
      ]
    });

    const reply = response.content[0].text;

    res.json({ reply });

  } catch (error) {
    console.error('Claude error:', error);
    res.status(500).json({
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
