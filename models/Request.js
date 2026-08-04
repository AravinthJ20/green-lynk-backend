const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'ignored'],
      default: 'pending'
    },
    message: { type: String, trim: true, default: '' },
    handledAt: { type: Date }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Request', requestSchema);
