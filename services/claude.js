const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { toolDefinitions, executeTool, hotelInfo } = require('./hotelTools');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Load system prompt and inject hotel name dynamically
const systemPromptTemplate = fs.readFileSync(
  path.join(__dirname, '../prompts/systemPrompt.txt'),
  'utf8'
);
const systemPrompt = systemPromptTemplate.replace(/Villa Eleni Beach Hotel/g, hotelInfo.name);

/**
 * Run one conversation turn with full agentic tool loop.
 * Handles multi-step tool calls automatically.
 *
 * @param {Array} messages - Full conversation history (Anthropic format)
 * @param {string} sessionId - Session ID for logging
 * @returns {{ reply: string, updatedMessages: Array, toolsUsed: Array }}
 */
async function chat(messages, sessionId = 'unknown') {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`💬 [${sessionId}] New turn | History: ${messages.length} messages`);
  console.log(`${'─'.repeat(60)}`);

  const toolsUsed = [];
  let currentMessages = [...messages];

  // Agentic loop — keeps running until Claude gives a final text reply
  while (true) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools: toolDefinitions,
      messages: currentMessages
    });

    console.log(`\n🤖 Claude stop_reason: ${response.stop_reason}`);

    // ── Case 1: Claude wants to use a tool ──────────────────────────────────
    if (response.stop_reason === 'tool_use') {
      // Add Claude's tool-use response to message history
      currentMessages.push({
        role: 'assistant',
        content: response.content
      });

      // Process all tool calls in this response
      const toolResultContent = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        const toolResult = executeTool(block.name, block.input);
        toolsUsed.push({ tool: block.name, input: block.input, result: toolResult });

        toolResultContent.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(toolResult)
        });
      }

      // Feed tool results back into the conversation
      currentMessages.push({
        role: 'user',
        content: toolResultContent
      });

      // Continue the loop to let Claude process tool results
      continue;
    }

    // ── Case 2: Claude has a final text reply ────────────────────────────────
    if (response.stop_reason === 'end_turn') {
      const replyText = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();

      console.log(`\n📤 [${sessionId}] Reply: "${replyText}"`);
      if (toolsUsed.length > 0) {
        console.log(`🔧 Tools used this turn: ${toolsUsed.map(t => t.tool).join(', ')}`);
      }

      // Add Claude's reply to history
      currentMessages.push({
        role: 'assistant',
        content: response.content
      });

      return {
        reply: replyText,
        updatedMessages: currentMessages,
        toolsUsed
      };
    }

    // ── Unexpected stop reason ───────────────────────────────────────────────
    console.error(`⚠️ Unexpected stop_reason: ${response.stop_reason}`);
    return {
      reply: "I'm sorry, something went wrong on our end. Let me transfer you to a team member.",
      updatedMessages: currentMessages,
      toolsUsed
    };
  }
}

module.exports = { chat };
