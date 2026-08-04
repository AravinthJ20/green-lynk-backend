const User = require('../../../models/User');
const { sendPushNotification } = require('../../../utils/push');
const {
  includesId,
  removeId,
  escapeRegExp,
  findBestUserMatch,
  formatCandidateList,
  loadRelationshipUsers
} = require('./agentToolUtils');

const searchUsers = async ({ currentUserId, query }) => {
  const trimmedQuery = `${query || ''}`.trim();
  if (!trimmedQuery) return { ok: false, message: 'Please tell me who to search for.' };

  const { user, candidates } = await findBestUserMatch(trimmedQuery, currentUserId);
  if (user) {
    return {
      ok: true,
      message: `I found ${user.username}.`,
      data: { user: { _id: user._id, username: user.username, online: user.online } }
    };
  }

  if (candidates.length === 0) {
    return { ok: false, message: `I couldn't find anyone named "${trimmedQuery}".` };
  }

  return {
    ok: false,
    message: `I found multiple people matching "${trimmedQuery}": ${formatCandidateList(candidates)}. Please be more specific.`
  };
};

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

const acceptAllPendingRequests = async ({ currentUserId }) => {
  const currentUser = await User.findById(currentUserId);
  if (!currentUser) return { ok: false, message: 'Unable to load your account.' };

  const pendingIds = [...(currentUser.connectionRequestsReceived || [])];
  if (pendingIds.length === 0) {
    return { ok: true, message: 'You have no pending connection requests.' };
  }

  let acceptedCount = 0;
  for (const pendingId of pendingIds) {
    const targetUser = await User.findById(pendingId);
    if (!targetUser) continue;

    const targetId = targetUser._id.toString();
    currentUser.connectionRequestsReceived = removeId(currentUser.connectionRequestsReceived, targetId);
    targetUser.connectionRequestsSent = removeId(targetUser.connectionRequestsSent, currentUserId.toString());
    currentUser.rejectedUsers = removeId(currentUser.rejectedUsers || [], targetId);
    currentUser.ignoredUsers = removeId(currentUser.ignoredUsers || [], targetId);
    targetUser.rejectedUsers = removeId(targetUser.rejectedUsers || [], currentUserId.toString());
    targetUser.ignoredUsers = removeId(targetUser.ignoredUsers || [], currentUserId.toString());

    if (!includesId(currentUser.connections, targetId)) currentUser.connections.push(targetUser._id);
    if (!includesId(targetUser.connections, currentUserId.toString())) targetUser.connections.push(currentUser._id);

    await targetUser.save();
    acceptedCount += 1;
  }

  await currentUser.save();
  return {
    ok: true,
    message: acceptedCount === 1
      ? 'I accepted 1 pending connection request.'
      : `I accepted all ${acceptedCount} pending connection requests.`
  };
};

const searchFriendsByLocation = async ({ currentUserId, location }) => {
  const trimmed = `${location || ''}`.trim();
  if (!trimmed) return { ok: false, message: 'Please tell me which location to search.' };

  const currentUser = await User.findById(currentUserId).select('connections');
  if (!currentUser) return { ok: false, message: 'Unable to load your account.' };
  const connectionIds = currentUser?.connections || [];
  const users = await User.find({
    _id: { $in: connectionIds },
    location: new RegExp(escapeRegExp(trimmed), 'i')
  }).select('username location online interests');

  if (users.length === 0) {
    return { ok: true, message: `I could not find any of your connections from ${trimmed}.` };
  }

  const names = users.map((entry) => entry.username).join(', ');
  return {
    ok: true,
    message: users.length === 1
      ? `I found 1 connection from ${trimmed}: ${names}.`
      : `I found ${users.length} connections from ${trimmed}: ${names}.`,
    data: { users: users.map((entry) => ({ _id: entry._id, username: entry.username, location: entry.location })) }
  };
};

const recommendByInterest = async ({ currentUserId, interest }) => {
  const trimmed = `${interest || ''}`.trim();
  if (!trimmed) return { ok: false, message: 'Please tell me which interest to look for.' };

  const currentUser = await User.findById(currentUserId).select(
    'connections connectionRequestsSent connectionRequestsReceived ignoredUsers rejectedUsers'
  );
  if (!currentUser) return { ok: false, message: 'Unable to load your account.' };

  const excluded = new Set([
    currentUserId.toString(),
    ...(currentUser.connections || []).map(toIdString),
    ...(currentUser.connectionRequestsSent || []).map(toIdString),
    ...(currentUser.connectionRequestsReceived || []).map(toIdString),
    ...(currentUser.ignoredUsers || []).map(toIdString),
    ...(currentUser.rejectedUsers || []).map(toIdString)
  ]);

  const matches = await User.find({
    interests: new RegExp(escapeRegExp(trimmed), 'i')
  })
    .select('username interests location bio online')
    .limit(25);

  const ranked = matches
    .filter((entry) => !excluded.has(entry._id.toString()))
    .map((entry) => {
      const interestHits = (entry.interests || []).filter((item) =>
        new RegExp(escapeRegExp(trimmed), 'i').test(item)
      ).length;
      return { entry, score: interestHits + (entry.online ? 0.5 : 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ entry }) => entry);

  if (ranked.length === 0) {
    return { ok: true, message: `I could not find people interested in ${trimmed} right now.` };
  }

  const names = ranked.map((entry) => entry.username).join(', ');
  return {
    ok: true,
    message: `Here are people interested in ${trimmed}: ${names}.`,
    data: {
      users: ranked.map((entry) => ({
        _id: entry._id,
        username: entry.username,
        interests: entry.interests,
        location: entry.location
      }))
    }
  };
};

module.exports = {
  searchUsers,
  sendConnectionRequest,
  acceptAllPendingRequests,
  searchFriendsByLocation,
  recommendByInterest
};
