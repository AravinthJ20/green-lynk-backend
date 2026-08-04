const mongoose = require('mongoose');

const agentMemorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  context: { type: mongoose.Schema.Types.Mixed, default: null },
  conversation: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AgentMemory', agentMemorySchema);
