const User = require('../../../models/User');
const { toIdString, escapeRegExp } = require('./agentToolUtils');

const definition = {
  name: 'recommend_interest',
  description: 'Recommend discoverable people who match an interest.',
  parameters: { interest: 'Interest or technology to match.' }
};

const execute = async ({ context, args }) => {
  const trimmed = `${args.interest || ''}`.trim();
  if (!trimmed) return { ok: false, message: 'Please tell me which interest to look for.' };

  const currentUser = await User.findById(context.userId).select(
    'connections connectionRequestsSent connectionRequestsReceived ignoredUsers rejectedUsers'
  );
  if (!currentUser) return { ok: false, message: 'Unable to load your account.' };

  const excluded = new Set([
    context.userId.toString(),
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
  definition,
  execute
};
