const definition = {
  name: 'small_talk',
  description: 'Respond to greetings or simple conversational phrases without performing an app action.',
  parameters: { text: 'The phrase or greeting to respond to.' }
};

const executeSmallTalk = async ({ text }) => {
  const normalized = `${text || ''}`.trim().toLowerCase();
  if (!normalized) {
    return { ok: true, message: 'Hello! How can I help you today?' };
  }

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(normalized)) {
    return { ok: true, message: 'Hi there! I can help you connect, message, post statuses, or manage requests.' };
  }

  if (/^(how are you\??|whats up\??|what's up\??)$/i.test(normalized)) {
    return { ok: true, message: 'I am ready to help. You can ask me to connect with someone, post a status, or accept requests.' };
  }

  if (/^(thank you|thanks)\b/.test(normalized)) {
    return { ok: true, message: 'You are welcome! Let me know if you want to do anything in Green Lynk.' };
  }

  return { ok: true, message: 'I am not sure how to do that yet. Try asking me to connect with someone or post a status.' };
};

const execute = async ({ args }) => executeSmallTalk({ text: args.text });

module.exports = {
  definition,
  execute,
  executeSmallTalk
};
