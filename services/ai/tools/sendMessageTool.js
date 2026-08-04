const User = require('../../../models/User');
const Message = require('../../../models/Message');
const { getIO } = require('../../../utils/realtime');
const { sendPushNotification } = require('../../../utils/push');
const { includesId, findBestUserMatch } = require('./agentToolUtils');

const definition = {
  name: 'send_message',
  description: 'Send a direct text message to an accepted connection.',
  parameters: {
    username: 'Exact or partial username to message.',
    content: 'Message text to send.'
  }
};

const execute = async ({ context, args }) => {
  const trimmedContent = `${args.content || ''}`.trim();
  if (!trimmedContent) return { ok: false, message: 'Please tell me what message to send.' };
  const trimmedUsername = `${args.username || ''}`.trim();
  if (!trimmedUsername) return { ok: false, message: 'Please tell me who to message.' };

  const { user, candidates } = await findBestUserMatch(trimmedUsername, context.userId);
  if (!user) {
    if (candidates.length === 0) return { ok: false, message: `I couldn't find anyone named "${trimmedUsername}".` };
    return {
      ok: false,
      message: `I found multiple people matching "${trimmedUsername}": ${candidates.map((entry) => entry.username).join(', ')}. Please be more specific.`
    };
  }

  const currentUser = await User.findById(context.userId).select('username connections pushSubscriptions');
  if (!currentUser) return { ok: false, message: 'Unable to load your account.' };
  if (!includesId(currentUser.connections, user._id.toString())) {
    return { ok: false, message: `You can only message accepted connections. Connect with ${user.username} first.` };
  }

  const message = new Message({
    sender: context.userId,
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
    io.to(context.userId.toString()).emit('new-message', message);
  }

  await sendPushNotification(recipient, {
    title: currentUser.username,
    body: trimmedContent,
    tag: `message-${message._id}`,
    url: '/chat'
  });

  return { ok: true, message: `Done! Your message has been sent to ${user.username}.` };
};

module.exports = {
  definition,
  execute
};