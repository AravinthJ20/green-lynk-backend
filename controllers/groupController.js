const Group = require('../models/Group');
const Message = require('../models/Message');

const populateMessageDetails = (query) => query.populate('sender', 'username avatar').populate('attachments');

exports.createGroup = async (req, res) => {
  try {
    const { name, description, members } = req.body;
    if (!name || !Array.isArray(members) || members.length === 0) return res.status(400).json({ error: 'Invalid group data' });

    const memberSet = [...new Set([...members.map(String), req.user._id.toString()])];
    const group = new Group({ name, description: description || '', members: memberSet, admin: req.user._id });
    await group.save();

    const groupData = await Group.findById(group._id).populate('members', 'username avatar online').populate('admin', 'username avatar');
    res.status(201).json(groupData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id }).populate('members', 'username avatar online').populate('admin', 'username avatar');
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getGroup = async (req, res) => {
  try {
    const group = await Group.findOne({ _id: req.params.groupId, members: req.user._id }).populate('members', 'username avatar online').populate('admin', 'username avatar');
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getGroupMessages = async (req, res) => {
  try {
    const group = await Group.findOne({ _id: req.params.groupId, members: req.user._id });
    if (!group) return res.status(403).json({ error: 'Not a member' });
    const messages = await populateMessageDetails(Message.find({ group: req.params.groupId }).sort({ timestamp: 1 }));
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addMembers = async (req, res) => {
  try {
    const { memberIds } = req.body;
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!group.members.some((member) => member.toString() === req.user._id.toString())) return res.status(403).json({ error: 'Not authorized' });

    const newMembers = memberIds.filter((id) => !group.members.some((member) => member.toString() === id.toString()));
    group.members.push(...newMembers);
    await group.save();

    const groupData = await Group.findById(group._id).populate('members', 'username avatar online');
    res.json(groupData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.leaveGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!group.members.some((member) => member.toString() === req.user._id.toString())) return res.status(400).json({ error: 'Not a member' });

    group.members = group.members.filter((member) => member.toString() !== req.user._id.toString());
    if (group.members.length === 0) {
      await group.remove();
      return res.json({ message: 'Group deleted' });
    }

    if (group.admin.toString() === req.user._id.toString()) group.admin = group.members[0];
    await group.save();
    res.json({ message: 'Left group' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
