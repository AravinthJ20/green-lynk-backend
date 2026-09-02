const mongoose = require('mongoose');

const agentReminderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, required: true, trim: true, maxlength: 500 },
  remindAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['scheduled', 'sent', 'cancelled'], default: 'scheduled', index: true },
  notifiedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AgentReminder', agentReminderSchema);
