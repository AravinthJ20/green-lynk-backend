const Status = require('../../../models/Status');
const { statusFeatureEnabled } = require('../../../config/env');

const definition = {
  name: 'create_status',
  description: 'Create a text status post for the current user.',
  parameters: { text: 'Status text to post.' }
};

const execute = async ({ context, args }) => {
  if (!statusFeatureEnabled) {
    return { ok: false, message: 'Status posting is currently disabled.' };
  }

  const trimmedText = `${args.text || ''}`.trim();
  if (!trimmedText) return { ok: false, message: 'Please tell me what to post as your status.' };

  const status = await Status.create({
    owner: context.userId,
    text: trimmedText,
    background: '#17324f',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  return { ok: true, message: 'Your status has been posted.', data: { statusId: status._id } };
};

module.exports = {
  definition,
  execute
};
