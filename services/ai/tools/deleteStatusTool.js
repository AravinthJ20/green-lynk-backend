const { statusFeatureEnabled } = require('../../../config/env');
const Status = require('../../../models/Status');

const definition = {
  name: 'delete_latest_status',
  description: 'Delete the current user latest active status.',
  parameters: {}
};

const execute = async ({ context }) => {
  if (!statusFeatureEnabled) {
    return { ok: false, message: 'Status feature is currently disabled.' };
  }

  const latest = await Status.findOne({
    owner: context.userId,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!latest) {
    return { ok: false, message: 'You do not have an active status to delete.' };
  }

  await Status.deleteOne({ _id: latest._id, owner: context.userId });
  return { ok: true, message: 'I deleted your latest status.' };
};

module.exports = {
  definition,
  execute
};
