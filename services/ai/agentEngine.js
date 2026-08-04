const { parseIntent, INTENT_HELP } = require('./intentParser');
const { planWithAi, finalizeAgentResponse } = require('./aiPlanner');
const { executeAgentPlan } = require('./agentExecutor');
const memoryManager = require('./memoryManager');
const toolRegistry = require('./tools');

const buildFallbackPlan = (message) => {
  const parsed = parseIntent(message);
  return {
    tool: parsed.intent,
    intent: parsed.intent,
    confidence: parsed.confidence,
    arguments: parsed.slots || {},
    reason: 'Fallback local parser plan.'
  };
};

const resolveClarification = async ({ userId, message, pending }) => {
  const normalized = `${message || ''}`.trim().toLowerCase();

  if (!pending || pending.type !== 'clarify_action') {
    return null;
  }

  if (pending.phase === 'choice') {
    if (/^(status|post|post as status|status post|as status|status please)$/i.test(normalized)) {
      await memoryManager.clearContext(userId);
      return {
        tool: 'create_status',
        intent: 'create_status',
        confidence: 1,
        arguments: { text: pending.text || pending.originalText },
        reason: 'User chose status after clarification.'
      };
    }

    if (/^(message|direct message|dm|send message)$/i.test(normalized)) {
      const content = pending.text.replace(/^(?:send\s+)?(.+?)\s+message(?:s)?\s+to\s+everyone$/i, '$1').trim();
      await memoryManager.setContext(userId, {
        type: 'clarify_action',
        phase: 'recipient',
        originalText: pending.originalText,
        text: content || pending.text
      });
      return {
        tool: 'clarify_action',
        intent: 'clarify_action',
        confidence: 1,
        arguments: {
          text: `I can only send a direct message to a specific person. Who should I send "${content || pending.text}" to?`
        },
        reason: 'Requested recipient for direct message after clarification.'
      };
    }

    if (/^(cancel|nevermind|stop)$/i.test(normalized)) {
      await memoryManager.clearContext(userId);
      return {
        tool: 'unknown',
        intent: 'unknown',
        confidence: 0.8,
        arguments: {},
        reason: 'User cancelled the pending clarification.'
      };
    }

    return {
      tool: 'clarify_action',
      intent: 'clarify_action',
      confidence: 0.95,
      arguments: {
        text: 'Please reply with either "status" or "message" so I can continue.'
      },
      reason: 'Ask user to choose between status and direct message.'
    };
  }

  if (pending.phase === 'recipient') {
    await memoryManager.clearContext(userId);
    if (!normalized) {
      return {
        tool: 'clarify_action',
        intent: 'clarify_action',
        confidence: 0.95,
        arguments: { text: 'Please tell me the person to send this message to.' },
        reason: 'Asked again for recipient because response was empty.'
      };
    }

    return {
      tool: 'send_message',
      intent: 'send_message',
      confidence: 1,
      arguments: {
        username: normalized,
        content: pending.text
      },
      reason: 'User provided a recipient after choosing direct message.'
    };
  }

  return null;
};

const buildClarificationPlan = async (message) => {
  const normalized = `${message || ''}`.trim();
  return {
    tool: 'clarify_action',
    intent: 'clarify_action',
    confidence: 0.9,
    arguments: { text: normalized },
    reason: 'Clarify whether the user wants a status or a direct message.'
  };
};

const processAgentMessage = async ({ userId, message }) => {
  const pending = await memoryManager.getContext(userId);
  const context = { userId };

  if (pending) {
    const plan = await resolveClarification({ userId, message, pending });
    if (plan) {
      const result = await executeAgentPlan({ context, plan });
      return { ...result, planner: 'clarification' };
    }
  }

  let plan;
  try {
    plan = await planWithAi({ message });
  } catch (error) {
    plan = null;
  }

  if (!plan) {
    plan = buildFallbackPlan(message);
  }

  if (plan.intent === 'clarify_action') {
    await memoryManager.setContext(userId, {
      type: 'clarify_action',
      phase: 'choice',
      originalText: message,
      text: message
    });
  }

  await memoryManager.appendConversationEntry(userId, {
    role: 'user',
    text: message,
    timestamp: new Date().toISOString()
  });

  const result = await executeAgentPlan({ context, plan });

  if (plan.source === 'ai' && plan.intent !== 'clarify_action') {
    try {
      const finalReply = await finalizeAgentResponse({ message, plan, toolResult: result });
      if (finalReply) {
        result.reply = finalReply;
      }
    } catch (error) {
      console.warn('Agent finalization failed:', error.message);
    }
  }

  await memoryManager.appendConversationEntry(userId, {
    role: 'agent',
    text: result.reply || result.message || '',
    ok: result.ok !== false,
    action: result.action || null,
    data: result.data || null,
    tool: plan.tool,
    args: plan.arguments || {},
    timestamp: new Date().toISOString()
  });

  return {
    ...result,
    planner: plan.source || 'agent-engine'
  };
};

const getAgentCapabilities = () => ({
  reply: INTENT_HELP,
  agent: {
    architecture: 'agent-engine',
    planner: process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai-responses-api' : 'fallback-local-parser'),
    tools: toolRegistry.exportedTools()
  },
  scenarios: toolRegistry.getToolNames()
});

module.exports = {
  processAgentMessage,
  getAgentCapabilities
};