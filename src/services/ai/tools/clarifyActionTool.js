const definition = {
  name: 'clarify_action',
  description: 'Ask the user whether they want to post a status or send a direct message when the intent is ambiguous.',
  parameters: { text: 'The ambiguous user input to clarify.' }
};

const executeClarifyAction = async ({ text }) => {
  const normalized = `${text || ''}`.trim();
  if (!normalized) {
    return {
      ok: true,
      message: 'Do you want to post a status or send a direct message?'
    };
  }

  return {
    ok: true,
    message: `I heard "${normalized}". Should I post this as a status or send it as a direct message?`
  };
};

const execute = async ({ args }) => executeClarifyAction({ text: args.text });

module.exports = {
  definition,
  execute,
  executeClarifyAction
};
