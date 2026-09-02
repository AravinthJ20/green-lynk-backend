const { parseIntent } = require('./intentParser');
const { planWithAi } = require('./aiPlanner');
const { executeAgentPlan } = require('./agentExecutor');

class GreenLynkAgent {
  constructor({ planner = planWithAi, fallbackParser = parseIntent, executor = executeAgentPlan } = {}) {
    this.planner = planner;
    this.fallbackParser = fallbackParser;
    this.executor = executor;
    this.pendingClarifications = new Map();
  }

  createFallbackPlan(message) {
    const parsed = this.fallbackParser(message);
    return {
      tool: parsed.intent,
      intent: parsed.intent,
      confidence: parsed.confidence,
      arguments: parsed.slots || {},
      reason: 'Fallback local parser plan.'
    };
  }

  getPendingClarification(userId) {
    return this.pendingClarifications.get(String(userId));
  }

  setPendingClarification(userId, pending) {
    this.pendingClarifications.set(String(userId), pending);
  }

  clearPendingClarification(userId) {
    this.pendingClarifications.delete(String(userId));
  }

  normalizeBroadcastText(originalText) {
    const raw = `${originalText || ''}`.trim();
    let normalized = raw.replace(/^send\s+/i, '');
    normalized = normalized.replace(/\s+message(?:s)?\s+to\s+everyone$/i, ' everyone');
    normalized = normalized.replace(/\s+to\s+everyone$/i, ' everyone');
    normalized = normalized.replace(/\s+everyone\s*$/i, ' everyone');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : normalized;
  }

  normalizeBroadcastMessageText(originalText) {
    let normalized = this.normalizeBroadcastText(originalText);
    normalized = normalized.replace(/\s+message$/i, '').trim();
    return normalized;
  }

  resolvePendingClarification(userId, message, pending) {
    const normalized = `${message || ''}`.trim();
    const lower = normalized.toLowerCase();

    if (!pending || pending.type !== 'clarify_action') {
      return null;
    }

    if (pending.phase === 'choice') {
      if (/^(status|post|post as status|status post|as status|status please)$/i.test(lower)) {
        this.clearPendingClarification(userId);
        return {
          tool: 'create_status',
          intent: 'create_status',
          confidence: 1,
          arguments: {
            text: this.normalizeBroadcastText(pending.originalText)
          },
          reason: 'User selected status after clarification.'
        };
      }

      if (/^(message|direct message|dm|send message)$/i.test(lower)) {
        const content = this.normalizeBroadcastMessageText(pending.originalText);
        this.setPendingClarification(userId, {
          type: 'clarify_action',
          phase: 'recipient',
          originalText: pending.originalText,
          sendContent: content
        });

        return {
          tool: 'clarify_action',
          intent: 'clarify_action',
          confidence: 1,
          arguments: {
            text: `I can only send a direct message to a specific person. Who should I send "${content}" to?`
          },
          reason: 'Ask for recipient after the user chose message.'
        };
      }

      if (/^(cancel|nevermind|stop)$/i.test(lower)) {
        this.clearPendingClarification(userId);
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
        reason: 'Clarify whether the user wants a status or direct message.'
      };
    }

    if (pending.phase === 'recipient') {
      if (!normalized) {
        return {
          tool: 'clarify_action',
          intent: 'clarify_action',
          confidence: 0.95,
          arguments: {
            text: 'Please tell me the person to send this message to.'
          },
          reason: 'Ask for recipient again.'
        };
      }

      this.clearPendingClarification(userId);
      return {
        tool: 'send_message',
        intent: 'send_message',
        confidence: 1,
        arguments: {
          username: normalized,
          content: pending.sendContent || this.normalizeBroadcastMessageText(pending.originalText)
        },
        reason: 'User provided a recipient for direct message.'
      };
    }

    return null;
  }

  async plan({ userId, message }) {
    const pending = this.getPendingClarification(userId);
    if (pending) {
      const resolved = this.resolvePendingClarification(userId, message, pending);
      if (resolved) {
        return { plan: resolved, planner: 'pending' };
      }
    }

    try {
      const plan = await this.planner({ message });
      if (plan) {
        if (plan.intent === 'clarify_action') {
          this.setPendingClarification(userId, {
            type: 'clarify_action',
            phase: 'choice',
            originalText: message
          });
        }
        return { plan, planner: 'ai' };
      }
    } catch (error) {
      console.warn('AI agent planner failed, falling back to local parser:', error.message);
    }

    const fallbackPlan = this.createFallbackPlan(message);
    if (fallbackPlan.intent === 'clarify_action') {
      this.setPendingClarification(userId, {
        type: 'clarify_action',
        phase: 'choice',
        originalText: message
      });
    }

    return {
      plan: fallbackPlan,
      planner: 'fallback'
    };
  }

  async run({ userId, message }) {
    const context = { userId };
    const { plan, planner } = await this.plan({ userId, message });
    const result = await this.executor({ context, plan });

    return {
      ...result,
      planner
    };
  }
}

module.exports = {
  GreenLynkAgent
};
