const User = require('../models/User');

const toIdString = (value) => value.toString();
const includesId = (list, targetId) => list.some((entry) => toIdString(entry) === targetId);
const removeId = (list, targetId) => list.filter((entry) => toIdString(entry) !== targetId);

exports.getRequests = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id)
      .populate('connectionRequestsReceived', 'username email avatar online lastSeen')
      .populate('connectionRequestsSent', 'username email avatar online lastSeen');

    res.json({
      incoming: currentUser.connectionRequestsReceived,
      outgoing: currentUser.connectionRequestsSent
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.sendRequest = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot send request to yourself' });
    }

    if (includesId(req.user.connections, targetUser._id)) {
      return res.status(400).json({ error: 'You are already connected' });
    }

    if (includesId(req.user.connectionRequestsSent || [], targetUser._id)) {
      return res.status(400).json({ error: 'Request already sent' });
    }

    req.user.connectionRequestsSent = [...new Set([...(req.user.connectionRequestsSent || []), targetUser._id])];
    targetUser.connectionRequestsReceived = [...new Set([...(targetUser.connectionRequestsReceived || []), req.user._id])];

    await Promise.all([req.user.save(), targetUser.save()]);
    res.json({ message: 'Connection request sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.acceptRequest = async (req, res) => {
  try {
    const requester = await User.findById(req.params.userId);
    if (!requester) return res.status(404).json({ error: 'User not found' });

    if (!includesId(req.user.connectionRequestsReceived || [], requester._id)) {
      return res.status(400).json({ error: 'No incoming request from this user' });
    }

    req.user.connections = [...new Set([...(req.user.connections || []), requester._id])];
    requester.connections = [...new Set([...(requester.connections || []), req.user._id])];
    req.user.connectionRequestsReceived = removeId(req.user.connectionRequestsReceived || [], requester._id);
    requester.connectionRequestsSent = removeId(requester.connectionRequestsSent || [], req.user._id);

    await Promise.all([req.user.save(), requester.save()]);
    res.json({ message: 'Connection request accepted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const requester = await User.findById(req.params.userId);
    if (!requester) return res.status(404).json({ error: 'User not found' });

    if (!includesId(req.user.connectionRequestsReceived || [], requester._id)) {
      return res.status(400).json({ error: 'No incoming request from this user' });
    }

    req.user.connectionRequestsReceived = removeId(req.user.connectionRequestsReceived || [], requester._id);
    requester.connectionRequestsSent = removeId(requester.connectionRequestsSent || [], req.user._id);

    await Promise.all([req.user.save(), requester.save()]);
    res.json({ message: 'Connection request rejected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
