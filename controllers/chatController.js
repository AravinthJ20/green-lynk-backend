const Message = require('../models/Message');
const Group = require('../models/Group');
const User = require('../models/User');
const ChatMedia = require('../models/ChatMedia');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const isConnected = async (userId, otherUserId) => {
  const user = await User.findById(userId).select('connections');
  return user?.connections.some((entry) => entry.toString() === otherUserId.toString());
};

const populateMessageDetails = (query) => query.populate('sender', 'username avatar').populate('attachments');

const uploadsRoot = path.join(__dirname, '..', 'uploads', 'chat-media');

const ensureUploadsDir = async () => {
  await fs.promises.mkdir(uploadsRoot, { recursive: true });
};

exports.uploadMedia = async (req, res) => {
  try {
    const { fileName, mimeType, dataUrl } = req.body;
    if (!fileName || !mimeType || !dataUrl) {
      return res.status(400).json({ error: 'Missing upload data' });
    }

    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid file payload' });
    }

    const [, encodedMimeType, base64Data] = match;
    if (encodedMimeType !== mimeType) {
      return res.status(400).json({ error: 'MIME type mismatch' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const extension = path.extname(fileName) || '';
    const generatedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`;
    const category = mimeType.startsWith('image/') ? 'image' : 'file';

    await ensureUploadsDir();

    const absolutePath = path.join(uploadsRoot, generatedName);
    await fs.promises.writeFile(absolutePath, buffer);

    const media = await ChatMedia.create({
      owner: req.user._id,
      fileName: generatedName,
      originalName: fileName,
      mimeType,
      size: buffer.length,
      storagePath: absolutePath,
      publicUrl: `/uploads/chat-media/${generatedName}`,
      category
    });

    res.status(201).json(media);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getChats = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).select('connections');
    const allowedConnectionIds = new Set(currentUser.connections.map((entry) => entry.toString()));

    const individualChats = await Message.aggregate([
      { $match: { $or: [{ sender: req.user._id }, { recipient: req.user._id }], group: { $exists: false } } },
      { $sort: { timestamp: -1 } },
      { $group: { _id: { $cond: [{ $eq: ['$sender', req.user._id] }, '$recipient', '$sender'] }, lastMessage: { $first: '$$ROOT' } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: '$user._id', username: '$user.username', avatar: '$user.avatar', online: '$user.online', lastSeen: '$user.lastSeen', lastMessage: 1 } }
    ]).then((items) => items.filter((item) => allowedConnectionIds.has(item._id.toString())));

    const groups = await Group.find({ members: req.user._id }).lean();
    const groupChats = await Promise.all(groups.map(async (group) => {
      const lastMessage = await Message.findOne({ group: group._id }).sort({ timestamp: -1 }).populate('sender', 'username avatar').lean();
      return { _id: group._id, name: group.name, avatar: group.avatar, group: true, members: group.members, lastMessage };
    }));

    const chats = [...individualChats, ...groupChats].sort((a, b) => {
      const aTime = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const bTime = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
      return bTime - aTime;
    });

    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPersonalMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const connected = await isConnected(req.user._id, userId);
    if (!connected) {
      return res.status(403).json({ error: 'Direct chat is only available for accepted connections' });
    }

    const messages = await populateMessageDetails(Message.find({
      $or: [
        { sender: req.user._id, recipient: userId },
        { sender: userId, recipient: req.user._id }
      ],
      group: { $exists: false }
    }).sort({ timestamp: 1 }));

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (!message.readBy.includes(req.user._id)) message.readBy.push(req.user._id);
    await message.save();
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
