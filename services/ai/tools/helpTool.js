const definition = {
  name: 'help',
  description: 'Explain what the Green Lynk AI agent can do.',
  parameters: {}
};

const execute = async () => ({
  ok: true,
  message: 'I can help you connect with people, send messages, post statuses, accept connection requests, search by interest or location, and set reminders.'
});

module.exports = {
  definition,
  execute
};
