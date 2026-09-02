const { processAgentMessage, getAgentCapabilities } = require('../services/ai/agentEngine');
const { getConversation } = require('../services/ai/memoryManager');

exports.chat = async (req, res) => {
  try {
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await processAgentMessage({
      userId: req.user._id,
      message
    });

    res.json({
      reply: result.reply,
      intent: result.intent,
      tool: result.tool || result.intent,
      planner: result.planner || null,
      ok: result.ok !== false,
      action: result.action || null,
      data: result.data || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Agent failed to process your request' });
  }
};

exports.capabilities = async (req, res) => {
  const capabilities = getAgentCapabilities();
  const history = await getConversation(req.user._id);
  res.json({ ...capabilities, history });
};
