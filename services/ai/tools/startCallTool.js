const User = require('../../../models/User');
const { includesId, findBestUserMatch } = require('./agentToolUtils');

const definition = {
  name: 'start_call',
  description: 'Prepare a voice call with an online accepted connection.',
  parameters: { username: 'Exact or partial username to call.' }
};

const execute = async ({ context, args }) => {
  const trimmedUsername = `${args.username || ''}`.trim();
  if (!trimmedUsername) return { ok: false, message: 'Please tell me who to call.' };

  const { user, candidates } = await findBestUserMatch(trimmedUsername, context.userId);
  if (!user) {
    if (candidates.length === 0) return { ok: false, message: `I couldn't find anyone named "${trimmedUsername}".` };
    return {
      ok: false,
      message: `I found multiple people matching "${trimmedUsername}": ${candidates.map((entry) => entry.username).join(', ')}. Please be more specific.`
    };
  }

  const currentUser = await User.findById(context.userId).select('connections');
  if (!currentUser) return { ok: false, message: 'Unable to load your account.' };
  if (!includesId(currentUser.connections, user._id.toString())) {
    return { ok: false, message: `You need to be connected with ${user.username} before starting a call.` };
  }

  if (!user.online) {
    return { ok: false, message: `${user.username} is currently offline. Try again when they are online.` };
  }

  return {
    ok: true,
    message: `${user.username} is online and connected. Opening a call for you now.`,
    action: {
      type: 'start_call',
      userId: user._id.toString(),
      username: user.username,
      mode: 'voice'
    }
  };
};

module.exports = {
  definition,
  execute
};
