const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Group = require('../models/Group');
const ChatMedia = require('../models/ChatMedia');
const JWT_SECRET = process.env.JWT_SECRET || 'strangers-play-secret';

const hasConnection = async (userId, otherUserId) => {
  const user = await User.findById(userId).select('connections');
  return user?.connections.some((entry) => entry.toString() === otherUserId.toString());
};

const determineMessageType = ({ content, sticker, attachments }) => {
  const hasContent = Boolean(content?.trim());
  const hasSticker = Boolean(sticker?.trim());
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  if (hasSticker) return 'sticker';
  if (hasAttachments && hasContent) return 'mixed';
  if (hasAttachments) {
    return attachments.every((entry) => entry.category === 'image') ? 'image' : 'file';
  }

  return 'text';
};

const hydrateAttachments = async (attachmentIds, ownerId) => {
  if (!Array.isArray(attachmentIds) || attachmentIds.length === 0) return [];

  const attachments = await ChatMedia.find({
    _id: { $in: attachmentIds },
    owner: ownerId
  });

  if (attachments.length !== attachmentIds.length) {
    throw new Error('Some attachments are invalid');
  }

  return attachments;
};

const populateMessageDetails = (message) => message.populate('sender', 'username avatar').populate('attachments');

module.exports = (io) => {
  const activeCalls = new Map();

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) throw new Error('Authentication error');

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findOne({ _id: decoded._id, 'tokens.token': token });
      if (!user) throw new Error('Authentication error');

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    await User.findByIdAndUpdate(user._id, { online: true, socketId: socket.id, lastSeen: new Date() });

    socket.join(user._id.toString());

    io.emit('user-status', { userId: user._id.toString(), online: true, lastSeen: new Date() });

    socket.on('join-group', async (groupId) => {
      const group = await Group.findById(groupId);
      if (group && group.members.some((member) => member.toString() === user._id.toString())) {
        socket.join(groupId);
      }
    });

    socket.on('personal-message', async ({ recipientId, content = '', tempId, attachmentIds = [], sticker = '' }) => {
      if (!(await hasConnection(user._id, recipientId))) {
        socket.emit('message-error', { tempId, error: 'You can only message accepted connections.' });
        return;
      }

      let attachments = [];
      try {
        attachments = await hydrateAttachments(attachmentIds, user._id);
      } catch (error) {
        socket.emit('message-error', { tempId, error: error.message });
        return;
      }

      const message = new Message({
        sender: user._id,
        recipient: recipientId,
        content,
        sticker,
        attachments: attachments.map((entry) => entry._id),
        type: determineMessageType({ content, sticker, attachments }),
        status: 'sent'
      });
      await message.save();
      const populatedMessage = await populateMessageDetails(message);

      const recipient = await User.findById(recipientId);
      const delivered = recipient?.socketId;
      if (delivered) {
        message.status = 'delivered';
        message.deliveredTo = [recipient._id];
        await message.save();
      }

      io.to(recipientId).emit('new-message', populatedMessage);
      socket.emit('message-sent', { tempId, messageId: message._id.toString(), message: populatedMessage });
      if (delivered) {
        socket.emit('message-delivered', { messageId: message._id, status: 'delivered' });
      }
    });

    socket.on('group-message', async ({ groupId, content = '', tempId, attachmentIds = [], sticker = '' }) => {
      const group = await Group.findById(groupId);
      if (!group || !group.members.some((member) => member.toString() === user._id.toString())) return;

      let attachments = [];
      try {
        attachments = await hydrateAttachments(attachmentIds, user._id);
      } catch (error) {
        socket.emit('message-error', { tempId, error: error.message });
        return;
      }

      const message = new Message({
        sender: user._id,
        group: groupId,
        content,
        sticker,
        attachments: attachments.map((entry) => entry._id),
        type: determineMessageType({ content, sticker, attachments }),
        status: 'sent'
      });
      await message.save();
      const populatedMessage = await populateMessageDetails(message);

      socket.to(groupId).emit('new-group-message', populatedMessage);
      socket.emit('message-sent', { tempId, messageId: message._id.toString(), message: populatedMessage });
    });

    socket.on('mark-as-read', async ({ chatUserId, senderId, messageIds }) => {
      if (!messageIds || messageIds.length === 0) return;
      try {
        const resolvedSenderId = senderId || chatUserId;
        if (!resolvedSenderId) return;
        await Message.updateMany(
          { _id: { $in: messageIds }, sender: resolvedSenderId, recipient: user._id, status: { $ne: 'read' } },
          { $set: { status: 'read', readAt: new Date() }, $addToSet: { readBy: user._id } }
        );
        io.to(resolvedSenderId.toString()).emit('messages-read', { messageIds, readerId: user._id });
      } catch (err) {
        console.error('Mark as read error:', err);
      }
    });

    socket.on('mark-group-messages-read', async ({ groupId, messageIds }) => {
      if (!groupId || !messageIds || messageIds.length === 0) return;

      try {
        await Message.updateMany(
          { _id: { $in: messageIds }, group: groupId, readBy: { $ne: user._id } },
          { $addToSet: { readBy: user._id } }
        );

        io.to(groupId).emit('group-messages-read', { messageIds, readerId: user._id });
      } catch (err) {
        console.error('Mark group messages as read error:', err);
      }
    });

    socket.on('typing', async ({ recipientId, isTyping }) => {
      if (!recipientId) return;
      if (!(await hasConnection(user._id, recipientId))) return;

      const recipient = await User.findById(recipientId);
      if (!recipient?.socketId) return;

      io.to(recipient.socketId).emit('typing', {
        senderId: user._id.toString(),
        isTyping,
        senderName: user.username
      });
    });

    socket.on('group-typing', async ({ groupId, isTyping }) => {
      const group = await Group.findById(groupId);
      if (!group) return;

      socket.to(groupId).emit('group-typing', {
        groupId,
        senderId: user._id.toString(),
        isTyping,
        senderName: user.username
      });
    });

    socket.on('leave-group', (groupId) => {
      if (groupId) {
        socket.leave(groupId);
      }
    });

    socket.on('call-request', async ({ recipientId, callId, type, offer }) => {
      if (!recipientId || !callId) return;
      if (!(await hasConnection(user._id, recipientId))) return;

      const recipient = await User.findById(recipientId);
      if (!recipient?.socketId) return;

      activeCalls.set(callId, {
        callerId: user._id.toString(),
        recipientId: recipientId.toString(),
        type,
        offer: offer || null
      });

      io.to(recipient.socketId).emit('call-request', {
        callId,
        caller: {
          _id: user._id.toString(),
          username: user.username,
          avatar: user.avatar
        },
        type
      });
    });

    socket.on('call-answer', async ({ recipientId, callId, answer }) => {
      if (!recipientId || !callId) return;

      const recipient = await User.findById(recipientId);
      if (!recipient?.socketId) return;

      io.to(recipient.socketId).emit('call-answer', { callId, answer });
    });

    socket.on('ice-candidate', async ({ recipientId, callId, candidate }) => {
      if (!recipientId || !callId || !candidate) return;

      const recipient = await User.findById(recipientId);
      if (!recipient?.socketId) return;

      io.to(recipient.socketId).emit('ice-candidate', { callId, candidate });
    });

    socket.on('call-rejected', async ({ recipientId, callId }) => {
      if (!recipientId || !callId) return;

      activeCalls.delete(callId);
      const recipient = await User.findById(recipientId);
      if (!recipient?.socketId) return;

      io.to(recipient.socketId).emit('call-rejected', { callId });
    });

    socket.on('call-ended', async ({ recipientId, callId }) => {
      if (!recipientId || !callId) return;

      activeCalls.delete(callId);
      const recipient = await User.findById(recipientId);
      if (!recipient?.socketId) return;

      io.to(recipient.socketId).emit('call-ended', { callId });
    });

    socket.on('get-call-offer', ({ callId }, callback) => {
      callback?.(activeCalls.get(callId) || null);
      activeCalls.delete(callId);
    });

    socket.on('disconnect', async () => {
      await User.findByIdAndUpdate(user._id, { online: false, socketId: null, lastSeen: new Date() });
      io.emit('user-status', { userId: user._id.toString(), online: false, lastSeen: new Date() });
    });
  });
};
