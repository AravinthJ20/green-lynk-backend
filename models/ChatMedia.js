const mongoose = require('mongoose');

const chatMediaSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true, trim: true },
  originalName: { type: String, required: true, trim: true },
  mimeType: { type: String, required: true, trim: true },
  size: { type: Number, required: true },
  storagePath: { type: String, required: true, trim: true },
  publicUrl: { type: String, required: true, trim: true },
  category: { type: String, enum: ['image', 'file'], required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatMedia', chatMediaSchema);
