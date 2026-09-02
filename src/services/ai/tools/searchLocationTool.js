const User = require('../../../models/User');
const { escapeRegExp } = require('./agentToolUtils');

const definition = {
  name: 'search_location',
  description: 'Search the current user connections by location.',
  parameters: { location: 'Location to search for.' }
};

const execute = async ({ context, args }) => {
  const trimmed = `${args.location || ''}`.trim();
  if (!trimmed) return { ok: false, message: 'Please tell me which location to search.' };

  const currentUser = await User.findById(context.userId).select('connections');
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

module.exports = {
  definition,
  execute
};