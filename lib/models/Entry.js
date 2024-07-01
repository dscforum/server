const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const EntrySchema = new Schema({
  title: {
    type: String,
    required: true,
    max: 100
  },
  category: {
    type: String,
    enum: ['announcements', 'updates', 'discussions'],
    required: true
  },
  content: {
    type: String,
    required: true,
    max: 1024
  },
  publisherId: {
    type: String,
    required: true
  },
  publishedAt: {
    type: Date,
    default: new Date()
  },
  flags: {
    isPinned: {
      type: Boolean,
      default: false
    }
  },
  replyCount: {
    type: Number,
    default: 0
  },
  replies: [
    {
      content: {
        type: String,
        required: true,
        max: 1024
      },
      publisherId: {
        type: String,
        required: true
      },
      publishedAt: {
        type: Date,
        default: new Date()
      }
    }
  ]
});

module.exports = mongoose.model('Entry', EntrySchema);