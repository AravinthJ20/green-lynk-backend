const AgentMemory = require('../../models/AgentMemory');

const getContext = async (userId) => {
  if (!userId) return null;
  const memory = await AgentMemory.findOne({ user: userId }).lean();
  return memory?.context || null;
};

const setContext = async (userId, context) => {
  if (!userId) return null;
  return AgentMemory.findOneAndUpdate(
    { user: userId },
    { context, updatedAt: new Date() },
    { upsert: true, new: true }
  );
};

const clearContext = async (userId) => {
  if (!userId) return null;
  return AgentMemory.findOneAndUpdate(
    { user: userId },
    { context: null, updatedAt: new Date() },
    { new: true }
  );
};

const appendConversationEntry = async (userId, entry) => {
  if (!userId) return null;
  return AgentMemory.findOneAndUpdate(
    { user: userId },
    { $push: { conversation: entry }, updatedAt: new Date() },
    { upsert: true, new: true }
  );
};

const getConversation = async (userId) => {
  if (!userId) return [];
  const memory = await AgentMemory.findOne({ user: userId }).lean();
  return memory?.conversation || [];
};

module.exports = {
  getContext,
  setContext,
  clearContext,
  appendConversationEntry,
  getConversation
};
