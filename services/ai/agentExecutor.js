const toolRegistry = require('./tools');

const getToolByName = (name) => toolRegistry.getToolByName(name);

const getFallbackResponse = (plan) => {
  const normalizedIntent = `${plan.intent || ''}`.trim().toLowerCase();
  const userText = plan.arguments?.text || plan.slots?.text || '';

  if (normalizedIntent === 'small_talk') {
    return {
      ok: true,
      reply: userText ? `Hey there! You said: ${userText}` : 'Hi there! I can help you with Green Lynk actions like messaging, status posts, and requests.',
      message: 'Handled small talk.',
      action: null,
      data: null
    };
  }

  if (normalizedIntent === 'help') {
    return {
      ok: true,
      reply: 'I can help you connect with people, send messages, post statuses, and manage connection requests. Try sending something like “Connect me with Rahul” or “Post Happy Sunday everyone!”',
      message: 'Provided help response.',
      action: null,
      data: null
    };
  }

  if (normalizedIntent === 'unknown') {
    return {
      ok: true,
      reply: 'I did not understand that request. Please try asking me to connect, message, post a status, or manage requests.',
      message: 'Unknown intent response.',
      action: null,
      data: null
    };
  }

  return null;
};

const executeAgentPlan = async ({ context, plan }) => {
  const tool = getToolByName(plan.tool || plan.intent);
  if (!tool) {
    const fallback = getFallbackResponse(plan);
    if (fallback) return fallback;

    return {
      ok: false,
      message: `Unknown tool: ${plan.tool || plan.intent}`,
      reply: null,
      action: null,
      data: null
    };
  }

  const args = plan.arguments || plan.slots || {};
  const result = await tool.execute({ context, args });

  return {
    ok: result.ok !== false,
    message: result.message || 'Done.',
    reply: result.reply || result.message || null,
    data: result.data || null,
    action: result.action || null,
    tool: tool.definition.name
  };
};

module.exports = {
  executeAgentPlan
};