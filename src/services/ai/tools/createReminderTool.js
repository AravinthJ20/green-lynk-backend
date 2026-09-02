const AgentReminder = require('../../../models/AgentReminder');
const { parseReminderTime } = require('./agentToolUtils');

const definition = {
  name: 'create_reminder',
  description: 'Create a reminder and schedule notification for the current user.',
  parameters: {
    text: 'Reminder task text.',
    whenText: 'Natural-language time phrase, for example tomorrow at 6 PM.'
  }
};

const execute = async ({ context, args }) => {
  const reminderText = `${args.text || ''}`.trim();
  if (!reminderText) return { ok: false, message: 'Please tell me what to remind you about.' };

  const remindAt = parseReminderTime(args.whenText);
  if (!remindAt) {
    return {
      ok: false,
      message: 'I could not understand the reminder time. Try something like "tomorrow at 6 PM".'
    };
  }

  const reminder = await AgentReminder.create({
    user: context.userId,
    text: reminderText,
    remindAt,
    status: 'scheduled'
  });

  return {
    ok: true,
    message: `Got it. I will remind you to ${reminderText} on ${remindAt.toLocaleString()}.`,
    data: { reminderId: reminder._id, remindAt }
  };
};

module.exports = {
  definition,
  execute
};
