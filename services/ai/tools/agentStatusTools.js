const Status = require('../../../models/Status');
const { statusFeatureEnabled } = require('../../../config/env');

const createStatusPost = async ({ currentUserId, text }) => {
  if (!statusFeatureEnabled) {
    return { ok: false, message: 'Status posting is currently disabled.' };
  }

  const trimmedText = `${text || ''}`.trim();
  if (!trimmedText) return { ok: false, message: 'Please tell me what to post as your status.' };

  const status = await Status.create({
    owner: currentUserId,
    text: trimmedText,
    background: '#17324f',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  return { ok: true, message: 'Your status has been posted.', data: { statusId: status._id } };
};

const deleteLatestStatus = async ({ currentUserId }) => {
  if (!statusFeatureEnabled) {
    return { ok: false, message: 'Status feature is currently disabled.' };
  }

  const latest = await Status.findOne({
    owner: currentUserId,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!latest) {
    return { ok: false, message: 'You do not have an active status to delete.' };
  }

  await Status.deleteOne({ _id: latest._id, owner: currentUserId });
  return { ok: true, message: 'I deleted your latest status.' };
};

module.exports = {
  createStatusPost,
  deleteLatestStatus
};
