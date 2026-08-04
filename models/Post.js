const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, trim: true, default: '' },
    media: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ChatMedia' }],
    visibility: {
      type: String,
      enum: ['public', 'connections', 'private'],
      default: 'connections'
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    commentsCount: { type: Number, default: 0 },
    isArchived: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Post', postSchema);
