const User = require('../../../models/User');

const definition = {
  name: 'manage_requests',
  description: 'Accept all pending connection requests for the current user.',
  parameters: {}
};

const execute = async ({ context }) => {
  const currentUser = await User.findById(context.userId).select('connectionRequestsReceived connections');
  if (!currentUser) return { ok: false, message: 'Unable to load your user account.' };

  const pendingIds = (currentUser.connectionRequestsReceived || []).map((entry) => entry.toString());
  if (pendingIds.length === 0) {
    return { ok: true, message: 'You have no pending requests.' };
  }

  for (const pendingId of pendingIds) {
    const targetUser = await User.findById(pendingId);
    if (!targetUser) continue;

    const targetId = targetUser._id.toString();
    currentUser.connectionRequestsReceived = currentUser.connectionRequestsReceived.filter((entry) => entry.toString() !== targetId);
    targetUser.connectionRequestsSent = targetUser.connectionRequestsSent.filter((entry) => entry.toString() !== context.userId.toString());

    if (!currentUser.connections.some((entry) => entry.toString() === targetId)) currentUser.connections.push(targetUser._id);
    if (!targetUser.connections.some((entry) => entry.toString() === context.userId.toString())) targetUser.connections.push(context.userId);

    await targetUser.save();
  }

  await currentUser.save();

  return { ok: true, message: `Accepted ${pendingIds.length} pending requests.` };
};

module.exports = {
  definition,
  execute
};