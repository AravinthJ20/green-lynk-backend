const User = require('../../../models/User');

const toIdString = (value) => value.toString();

const includesId = (list = [], targetId) => list.some((entry) => toIdString(entry) === targetId);

const removeId = (list = [], targetId) => list.filter((entry) => toIdString(entry) !== targetId);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findUsersByName = async (name, currentUserId) => {
  const trimmed = `${name || ''}`.trim();
  if (!trimmed) return [];

  return User.find({
    _id: { $ne: currentUserId },
    username: new RegExp(`^${escapeRegExp(trimmed)}$`, 'i')
  }).select(
    'username email avatar online lastSeen location interests connections connectionRequestsSent connectionRequestsReceived'
  );
};

const findBestUserMatch = async (name, currentUserId) => {
  const exact = await findUsersByName(name, currentUserId);
  if (exact.length === 1) return { user: exact[0], candidates: exact };
  if (exact.length > 1) return { user: null, candidates: exact };

  const fuzzy = await User.find({
    _id: { $ne: currentUserId },
    username: new RegExp(escapeRegExp(`${name || ''}`.trim()), 'i')
  })
    .select('username email avatar online lastSeen location interests connections connectionRequestsSent connectionRequestsReceived')
    .limit(8);

  if (fuzzy.length === 1) return { user: fuzzy[0], candidates: fuzzy };
  return { user: null, candidates: fuzzy };
};

const formatCandidateList = (candidates) =>
  candidates.map((entry) => entry.username).join(', ');

const loadRelationshipUsers = async (currentUserId, targetId) => {
  const [currentUser, targetUser] = await Promise.all([
    User.findById(currentUserId),
    User.findById(targetId)
  ]);
  return { currentUser, targetUser };
};

const parseReminderTime = (whenText) => {
  const raw = `${whenText || ''}`.trim().toLowerCase();
  if (!raw) return null;

  const now = new Date();
  let base = new Date(now);

  const relativeMatch = raw.match(/\bin\s+(\d+)\s+(minutes?|mins?|hours?|hrs?)\b/);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2];
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const milliseconds = /^h/.test(unit) ? amount * 60 * 60 * 1000 : amount * 60 * 1000;
    return new Date(now.getTime() + milliseconds);
  }

  if (/\btomorrow\b/.test(raw)) {
    base.setDate(base.getDate() + 1);
  } else if (/\btoday\b/.test(raw) || /\btonight\b/.test(raw)) {
    // keep current date
  }

  const timeMatch = raw.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] || 0);
    const meridiem = (timeMatch[3] || '').toLowerCase();

    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    if (hours > 23 || minutes > 59) return null;
    if (!meridiem && /\btonight\b/.test(raw) && hours >= 1 && hours <= 11) hours += 12;
    if (!meridiem && hours <= 23) {
      // 24h or bare hour — keep as-is
    }

    base.setHours(hours, minutes, 0, 0);
  } else if (/\btomorrow\b/.test(raw)) {
    base.setHours(9, 0, 0, 0);
  } else {
    return null;
  }

  if (base.getTime() <= Date.now()) {
    base.setDate(base.getDate() + 1);
  }

  return base;
};

module.exports = {
  toIdString,
  includesId,
  removeId,
  escapeRegExp,
  findBestUserMatch,
  formatCandidateList,
  loadRelationshipUsers,
  parseReminderTime
};
