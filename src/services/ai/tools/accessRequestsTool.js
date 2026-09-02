const User = require('../../../models/User');

const definition = {
  name: 'accept_all_requests',
  description: 'Accept all pending incoming connection requests for the current user.',
  parameters: {}
};

const execute = async ({ context }) => {
  const currentUser = await User.findById(context.userId);
  if (!currentUser) return { ok: false, message: 'Unable to load your account.' };

  const pendingIds = (currentUser.connectionRequestsReceived || []).map((entry) => entry.toString());
  if (pendingIds.length === 0) {
    return { ok: true, message: 'You have no pending connection requests.' };
  }

  let acceptedCount = 0;
  for (const pendingId of pendingIds) {
    const targetUser = await User.findById(pendingId);
    if (!targetUser) continue;

    const targetId = targetUser._id.toString();
    currentUser.connectionRequestsReceived = currentUser.connectionRequestsReceived.filter((entry) => entry.toString() !== targetId);
    targetUser.connectionRequestsSent = targetUser.connectionRequestsSent.filter((entry) => entry.toString() !== context.userId.toString());

    if (!currentUser.connections.some((entry) => entry.toString() === targetId)) currentUser.connections.push(targetUser._id);
    if (!targetUser.connections.some((entry) => entry.toString() === context.userId.toString())) targetUser.connections.push(context.userId);

    await targetUser.save();
    acceptedCount += 1;
  }

  await currentUser.save();
  return {
    ok: true,
    message: acceptedCount === 1 ? 'I accepted 1 pending connection request.' : `I accepted all ${acceptedCount} pending connection requests.`
  };
};

module.exports = {
  definition,
  execute
};
