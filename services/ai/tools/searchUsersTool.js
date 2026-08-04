const User = require('../../../models/User');

const definition = {
  name: 'search_user',
  description: 'Search for a Green Lynk user by username.',
  parameters: { query: 'Username or search query.' }
};

const execute = async ({ context, args }) => {
  const query = `${args.query || ''}`.trim();
  if (!query) return { ok: false, message: 'Please provide a search query.' };

  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const users = await User.find({
    _id: { $ne: context.userId },
    $or: [
      { username: regex },
      { location: regex },
      { interests: regex }
    ]
  })
    .limit(10)
    .select('username avatar location interests');

  return {
    ok: true,
    message: `Found ${users.length} users matching your query.`,
    data: users
  };
};

module.exports = {
  definition,
  execute
};