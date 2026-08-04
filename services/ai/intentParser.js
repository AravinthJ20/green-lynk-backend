const stripQuotes = (value) => `${value || ''}`.trim().replace(/^["'`]+|["'`]+$/g, '').trim();

const INTENT_HELP = `I can help you take actions on Green Lynk and answer simple greetings. Try:
- Connect me with Rahul
- Accept all pending requests
- Tell Rahul I'll be online at 8 PM
- Post "Happy Sunday everyone!"
- Delete my latest status
- Call Rahul
- Show everyone from Chennai
- Recommend people interested in Node.js
- Summarize my conversation with Rahul
- Remind me to call Rahul tomorrow at 6 PM
- Hi Rahul
- Hello
- How are you?`;

const parseIntent = (rawMessage) => {
  const message = `${rawMessage || ''}`.trim();
  if (!message) {
    return { intent: 'help', confidence: 1 };
  }

  const normalized = message.replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();

  if (/^(help|what can you do|commands)\b/.test(lower)) {
    return { intent: 'help', confidence: 1 };
  }

  if (/accept\s+all\s+pending(?:\s+requests?)?/.test(lower) || /accept\s+all\s+requests?/.test(lower)) {
    return { intent: 'accept_all_requests', confidence: 0.95 };
  }

  if (/delete\s+(?:my\s+)?latest\s+status/.test(lower) || /delete\s+(?:my\s+)?status/.test(lower)) {
    return { intent: 'delete_latest_status', confidence: 0.95 };
  }

  let match = normalized.match(/^(?:post|create\s+status)\s+["'`](.+?)["'`]\s*$/i);
  if (match) {
    return { intent: 'create_status', confidence: 0.95, slots: { text: stripQuotes(match[1]) } };
  }

  match = normalized.match(/^(?:post|create\s+status)\s+(.+)$/i);
  if (match) {
    return { intent: 'create_status', confidence: 0.9, slots: { text: stripQuotes(match[1]) } };
  }

  match = normalized.match(
    /^remind\s+me\s+to\s+(.+?)\s+(tomorrow(?:\s+at\s+.+)?|today(?:\s+at\s+.+)?|tonight(?:\s+at\s+.+)?|at\s+.+|in\s+\d+\s+(?:minutes?|mins?|hours?|hrs?))$/i
  );
  if (match) {
    return {
      intent: 'create_reminder',
      confidence: 0.92,
      slots: { text: stripQuotes(match[1]), whenText: stripQuotes(match[2]) }
    };
  }

  match = normalized.match(/^remind\s+me\s+to\s+(.+)$/i);
  if (match) {
    return {
      intent: 'create_reminder',
      confidence: 0.7,
      slots: { text: stripQuotes(match[1]), whenText: 'tomorrow at 9 AM' }
    };
  }

  match = normalized.match(/^(?:summarize|summary\s+of)\s+(?:my\s+)?(?:conversation|chat|messages?)\s+with\s+(.+)$/i);
  if (match) {
    return { intent: 'summarize_chat', confidence: 0.93, slots: { username: stripQuotes(match[1]) } };
  }

  match = normalized.match(/^recommend\s+(?:people|users|friends)?\s*(?:interested\s+in|who\s+like|into)?\s*(.+)$/i);
  if (match) {
    return { intent: 'recommend_interest', confidence: 0.9, slots: { interest: stripQuotes(match[1]) } };
  }

  match = normalized.match(/^(?:show|find|list)\s+(?:everyone|people|friends|connections)\s+from\s+(.+)$/i);
  if (match) {
    return { intent: 'search_location', confidence: 0.92, slots: { location: stripQuotes(match[1]) } };
  }

  match = normalized.match(/^(?:show|find|list)\s+(?:everyone|people|friends|connections)\s+in\s+(.+)$/i);
  if (match) {
    return { intent: 'search_location', confidence: 0.9, slots: { location: stripQuotes(match[1]) } };
  }

  match = normalized.match(/^(?:call|start\s+(?:a\s+)?(?:voice\s+)?call\s+with|voice\s+call)\s+(.+)$/i);
  if (match) {
    return { intent: 'start_call', confidence: 0.93, slots: { username: stripQuotes(match[1]) } };
  }

  match = normalized.match(/^(?:connect(?:\s+me)?(?:\s+with)?|send\s+(?:a\s+)?(?:connection\s+)?request\s+to)\s+(.+)$/i);
  if (match) {
    return { intent: 'send_connection_request', confidence: 0.93, slots: { username: stripQuotes(match[1]) } };
  }

  match = normalized.match(/^tell\s+(.+?)\s+(?:that\s+|saying\s+)?(.+)$/i);
  if (match) {
    return {
      intent: 'send_message',
      confidence: 0.9,
      slots: { username: stripQuotes(match[1]), content: stripQuotes(match[2]) }
    };
  }

  match = normalized.match(/^send\s+(.+?)\s+to\s+(.+)$/i);
  if (match) {
    return {
      intent: 'send_message',
      confidence: 0.9,
      slots: { username: stripQuotes(match[2]), content: stripQuotes(match[1]) }
    };
  }

  match = normalized.match(/^(?:message|dm|text)\s+(.+?)\s*[:\-]\s*(.+)$/i);
  if (match) {
    return {
      intent: 'send_message',
      confidence: 0.9,
      slots: { username: stripQuotes(match[1]), content: stripQuotes(match[2]) }
    };
  }

  match = normalized.match(/^send\s+(?:a\s+)?message\s+to\s+(.+?)\s+(?:saying\s+|that\s+|:\s*)(.+)$/i);
  if (match) {
    return {
      intent: 'send_message',
      confidence: 0.92,
      slots: { username: stripQuotes(match[1]), content: stripQuotes(match[2]) }
    };
  }

  match = normalized.match(/^(?:send|broadcast)\s+(.+?)\s+message(?:s)?\s+(?:to|for)\s+(?:everyone|all|the group|the team)$/i);
  if (match) {
    return { intent: 'clarify_action', confidence: 0.92, slots: { text: stripQuotes(normalized) } };
  }

  match = normalized.match(/^(?:send|broadcast)\s+(.+?)\s+(?:to|for)\s+(?:everyone|all|the group|the team)$/i);
  if (match) {
    return {
      intent: 'create_status',
      confidence: 0.92,
      slots: { text: stripQuotes(match[1]) }
    };
  }

  const ambiguousBroadcast = /^(?:send\s+)?(?:good\s+(?:morning|afternoon|evening)|happy\s+\w+|hello\s+everyone|hi\s+everyone|hey\s+everyone|good\s+night|good\s+day)\b/i;
  if (ambiguousBroadcast.test(normalized) && !/(?:to|for)\s+/i.test(normalized)) {
    return { intent: 'clarify_action', confidence: 0.9, slots: { text: stripQuotes(normalized) } };
  }

  match = normalized.match(/^(?:hi|hello|hey)\s+(.+)$/i);
  if (match) {
    return {
      intent: 'send_message',
      confidence: 0.92,
      slots: { username: stripQuotes(match[1]), content: 'Hi' }
    };
  }

  if (/^(?:hi|hello|hey|good morning|good afternoon|good evening|how are you\??|what's up\??|whats up\??|thanks|thank you)\b/i.test(normalized)) {
    return { intent: 'small_talk', confidence: 0.95, slots: { text: normalized } };
  }
  match = normalized.match(/^(?:find|search(?:\s+for)?)\s+(.+)$/i);
  if (match) {
    return { intent: 'search_user', confidence: 0.75, slots: { query: stripQuotes(match[1]) } };
  }

  return { intent: 'unknown', confidence: 0.2, slots: { raw: normalized } };
};

module.exports = {
  parseIntent,
  INTENT_HELP
};
