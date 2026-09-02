const User = require('../../../models/User');
const Message = require('../../../models/Message');
const { getIO } = require('../../../utils/realtime');
const { sendPushNotification } = require('../../../utils/push');
const { includesId, findBestUserMatch } = require('./agentToolUtils');

const sendMessageToUser = async ({ currentUserId, username, content }) => {
  const trimmedContent = `${content || ''}`.trim();
  if (!trimmedContent) return { ok: false, message: 'Please tell me what message to send.' };
  const trimmedUsername = `${username || ''}`.trim();
  if (!trimmedUsername) return { ok: false, message: 'Please tell me who to message.' };

  const { user, candidates } = await findBestUserMatch(trimmedUsername, currentUserId);
  if (!user) {
    if (candidates.length === 0) return { ok: false, message: `I couldn't find anyone named "${trimmedUsername}".` };
    return {
      ok: false,
      message: `I found multiple people matching "${trimmedUsername}": ${candidates.map((entry) => entry.username).join(', ')}. Please be more specific.`
    };
  }

  const currentUser = await User.findById(currentUserId).select('username connections pushSubscriptions');
  if (!currentUser) return { ok: false, message: 'Unable to load your account.' };
  if (!includesId(currentUser.connections, user._id.toString())) {
    return { ok: false, message: `You can only message accepted connections. Connect with ${user.username} first.` };
  }

  const message = new Message({
    sender: currentUserId,
    recipient: user._id,
    content: trimmedContent,
    type: 'text',
    status: 'sent'
  });
  await message.save();
  await message.populate([{ path: 'sender', select: 'username avatar' }]);

  const recipient = await User.findById(user._id);
  const io = getIO();
  if (recipient?.socketId) {
    message.status = 'delivered';
    message.deliveredTo = [recipient._id];
    await message.save();
  }

  if (io) {
    io.to(user._id.toString()).emit('new-message', message);
    io.to(currentUserId.toString()).emit('new-message', message);
  }

  await sendPushNotification(recipient, {
    title: currentUser.username,
    body: trimmedContent,
    tag: `message-${message._id}`,
    url: '/chat'
  });

  return { ok: true, message: `Done! Your message has been sent to ${user.username}.` };
};

const summarizeChat = async ({ currentUserId, username }) => {
  const trimmedUsername = `${username || ''}`.trim();
  if (!trimmedUsername) return { ok: false, message: 'Please tell me which conversation to summarize.' };

  const { user, candidates } = await findBestUserMatch(trimmedUsername, currentUserId);
  if (!user) {
    if (candidates.length === 0) return { ok: false, message: `I couldn't find anyone named "${trimmedUsername}".` };
    return {
      ok: false,
      message: `I found multiple people matching "${trimmedUsername}": ${candidates.map((entry) => entry.username).join(', ')}. Please be more specific.`
    };
  }

  const currentUser = await User.findById(currentUserId).select('connections');
  if (!currentUser) return { ok: false, message: 'Unable to load your account.' };
  if (!includesId(currentUser.connections, user._id.toString())) {
    return { ok: false, message: `You are not connected with ${user.username}, so I cannot summarize that chat.` };
  }

  const messages = await Message.find({
    group: { $exists: false },
    isDeleted: { $ne: true },
    type: { $ne: 'call' },
    $or: [
      { sender: currentUserId, recipient: user._id },
      { sender: user._id, recipient: currentUserId }
    ]
  })
    .sort({ timestamp: -1 })
    .limit(40)
    .populate('sender', 'username');

  if (messages.length === 0) {
    return { ok: true, message: `You do not have any messages with ${user.username} yet.` };
  }

  const chronological = [...messages].reverse();
  const lines = chronological
    .filter((entry) => entry.content?.trim())
    .map((entry) => `${entry.sender?.username || 'Someone'}: ${entry.content.trim()}`);

  if (lines.length === 0) {
    return { ok: true, message: `Your recent chat with ${user.username} has media or calls, but little text to summarize.` };
  }

  const preview = lines.slice(-12);
  const participants = new Set(chronological.map((entry) => entry.sender?.username).filter(Boolean));
  const summary = [
    `Conversation with ${user.username} (${messages.length} recent messages).`,
    `Participants: ${[...participants].join(', ')}.`,
    'Recent highlights:',
    ...preview.map((line) => `- ${line}`)
  ].join('\n');

  return { ok: true, message: summary };
};

module.exports = {
  sendMessageToUser,
  summarizeChat
};
