const { includesId, findBestUserMatch } = require('./agentToolUtils');
const Message = require('../../../models/Message');
const User = require('../../../models/User');

const definition = {
  name: 'summarize_chat',
  description: 'Summarize recent direct chat messages with an accepted connection.',
  parameters: { username: 'Exact or partial username whose chat should be summarized.' }
};

const execute = async ({ context, args }) => {
  const trimmedUsername = `${args.username || ''}`.trim();
  if (!trimmedUsername) return { ok: false, message: 'Please tell me which conversation to summarize.' };

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
    return { ok: false, message: `You are not connected with ${user.username}, so I cannot summarize that chat.` };
  }

  const messages = await Message.find({
    group: { $exists: false },
    isDeleted: { $ne: true },
    type: { $ne: 'call' },
    $or: [
      { sender: context.userId, recipient: user._id },
      { sender: user._id, recipient: context.userId }
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
  definition,
  execute
};