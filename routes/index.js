const express = require('express');
const router = express.Router();
const { chat } = require('../services/claude');

// In-memory session store (use Redis in production)
const sessions = new Map();

/**
 * GET /health
 * Basic health check — confirms server + API key are set up
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Villa Eleni Hotel AI Receptionist',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ? 'configured' : 'MISSING'
  });
});

/**
 * POST /test-chat
 * Text-based testing interface. Maintains conversation history via sessionId.
 *
 * Body: { message: string, sessionId?: string }
 * Response: { reply: string, sessionId: string, toolsUsed: Array, history: number }
 */
router.post('/test-chat', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required and must be a non-empty string' });
  }

  const sid = sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  console.log(`\n📱 [${sid}] User: "${message}"`);

  // Load or create session history
  const history = sessions.get(sid) || [];

  // Append new user message
  history.push({ role: 'user', content: message });

  try {
    const { reply, updatedMessages, toolsUsed } = await chat(history, sid);

    // Save updated history (cap at 50 messages to avoid token overflow)
    const trimmed = updatedMessages.slice(-50);
    sessions.set(sid, trimmed);

    res.json({
      reply,
      sessionId: sid,
      toolsUsed: toolsUsed.map(t => t.tool),
      history: trimmed.length
    });
  } catch (error) {
    console.error(`❌ [${sid}] Error:`, error.message);
    res.status(500).json({
      error: 'Something went wrong processing your request.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /voice
 * Voice/webhook integration endpoint (Twilio, Vonage, etc.)
 * Accepts speech-to-text input, returns text for TTS.
 *
 * Body: { transcript: string, callSid?: string, from?: string }
 * Response: { reply: string, callSid: string, shouldHandoff: boolean }
 */
router.post('/voice', async (req, res) => {
  const { transcript, callSid, from } = req.body;

  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return res.status(400).json({ error: 'transcript is required' });
  }

  const sid = callSid || `call-${Date.now()}`;
  console.log(`\n📞 [${sid}] Voice transcript from ${from || 'unknown'}: "${transcript}"`);

  const history = sessions.get(sid) || [];
  history.push({ role: 'user', content: transcript });

  try {
    const { reply, updatedMessages, toolsUsed } = await chat(history, sid);

    sessions.set(sid, updatedMessages.slice(-50));

    const shouldHandoff = toolsUsed.some(t => t.tool === 'handoffToHuman');

    res.json({
      reply,
      callSid: sid,
      shouldHandoff,
      toolsUsed: toolsUsed.map(t => t.tool)
    });
  } catch (error) {
    console.error(`❌ [${sid}] Voice error:`, error.message);
    res.status(500).json({
      reply: 'I apologise, we are experiencing a technical issue. Let me transfer you to our team.',
      shouldHandoff: true,
      callSid: sid
    });
  }
});

/**
 * DELETE /test-chat/:sessionId
 * Clear a session (useful for testing)
 */
router.delete('/test-chat/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId);
    res.json({ message: `Session ${sessionId} cleared.` });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

module.exports = router;
