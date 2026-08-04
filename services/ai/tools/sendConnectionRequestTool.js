const { sendPushNotification } = require('../../../utils/push');
const {
  includesId,
  removeId,
  escapeRegExp,
  findBestUserMatch,
  formatCandidateList,
  loadRelationshipUsers
} = require('./agentToolUtils');

const sendConnectionRequest = async ({ currentUserId, username }) => {
  const trimmedUsername = `${username || ''}`.trim();
  if (!trimmedUsername) return { ok: false, message: 'Please tell me who to connect with.' };

  const { user, candidates } = await findBestUserMatch(trimmedUsername, currentUserId);
  if (!user) {
    if (candidates.length === 0) return { ok: false, message: `I couldn't find anyone named "${trimmedUsername}".` };
    return {
      ok: false,
      message: `I found multiple people matching "${trimmedUsername}": ${formatCandidateList(candidates)}. Please be more specific.`
    };
  }

  const { currentUser, targetUser } = await loadRelationshipUsers(currentUserId, user._id);
  if (!currentUser || !targetUser) return { ok: false, message: 'User not found.' };

  const targetId = targetUser._id.toString();
  if (includesId(currentUser.connections, targetId)) {
    return { ok: true, message: `You are already connected with ${targetUser.username}.` };
  }
  if (includesId(currentUser.connectionRequestsSent, targetId)) {
    return { ok: true, message: `You already sent a connection request to ${targetUser.username}.` };
  }

  currentUser.ignoredUsers = removeId(currentUser.ignoredUsers || [], targetId);
  currentUser.rejectedUsers = removeId(currentUser.rejectedUsers || [], targetId);
  targetUser.ignoredUsers = removeId(targetUser.ignoredUsers || [], currentUserId.toString());
  targetUser.rejectedUsers = removeId(targetUser.rejectedUsers || [], currentUserId.toString());

  if (includesId(currentUser.connectionRequestsReceived, targetId)) {
    currentUser.connectionRequestsReceived = removeId(currentUser.connectionRequestsReceived, targetId);
    targetUser.connectionRequestsSent = removeId(targetUser.connectionRequestsSent, currentUserId.toString());
    if (!includesId(currentUser.connections, targetId)) currentUser.connections.push(targetUser._id);
    if (!includesId(targetUser.connections, currentUserId.toString())) targetUser.connections.push(currentUser._id);
    await Promise.all([currentUser.save(), targetUser.save()]);
    return { ok: true, message: `${targetUser.username} had already requested you, so I accepted and connected you both.` };
  }

  currentUser.connectionRequestsSent.push(targetUser._id);
  targetUser.connectionRequestsReceived.push(currentUser._id);
  targetUser.lastConnectionDecisionReminderAt = null;
  await Promise.all([currentUser.save(), targetUser.save()]);

  await sendPushNotification(targetUser, {
    title: 'New connection request',
    body: `${currentUser.username} wants to connect with you.`,
    type: 'connection-request',
    url: '/requests'
  });

  return { ok: true, message: `I found ${targetUser.username} and sent your connection request successfully.` };
};

const definition = {
  name: 'send_connection_request',
  description: 'Send a connection request to another Green Lynk user.',
  parameters: { username: 'Exact or partial username to connect with.' }
};

const execute = async ({ context, args }) =>
  sendConnectionRequest({ currentUserId: context.userId, username: args.username });

module.exports = {
  definition,
  execute,
  sendConnectionRequest
};
