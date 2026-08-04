const Status = require('../../../models/Status');
const User = require('../../../models/User');

const definition = {
  name: 'fetch_posts',
  description: 'Fetch recent status posts from the current user and connections.',
  parameters: { limit: 'Optional number of statuses to retrieve.' }
};

const execute = async ({ context, args }) => {
  const limit = Number(args.limit) || 10;
  const currentUser = await User.findById(context.userId).select('connections');
  const connectionIds = (currentUser?.connections || []).map((entry) => entry.toString());
  const allowedOwnerIds = [context.userId.toString(), ...connectionIds];

  const statuses = await Status.find({
    owner: { $in: allowedOwnerIds },
    expiresAt: { $gt: new Date() }
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('owner', 'username avatar');

  return {
    ok: true,
    message: `Fetched ${statuses.length} statuses.`,
    data: statuses
  };
};

module.exports = {
  definition,
  execute
};