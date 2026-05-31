const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  content: { type: String, default: '', trim: true },
  type: { type: String, enum: ['text', 'image', 'file', 'sticker', 'mixed'], default: 'text' },
  sticker: { type: String, trim: true, default: '' },
  attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ChatMedia' }],
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  readAt: { type: Date },
  deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

messageSchema.pre('validate', function (next) {
  const hasContent = Boolean(this.content?.trim());
  const hasSticker = Boolean(this.sticker?.trim());
  const hasAttachments = Array.isArray(this.attachments) && this.attachments.length > 0;

  if (!hasContent && !hasSticker && !hasAttachments) {
    this.invalidate('content', 'A message requires text, sticker, or attachment');
  }

  next();
});

module.exports = mongoose.model('Message', messageSchema);
