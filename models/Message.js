const mongoose = require('mongoose');

// 消息模式
const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 500
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// 复合索引 - 加速未读消息查询
messageSchema.index({ conversation: 1, sender: 1, read: 1 });

module.exports = mongoose.model('Message', messageSchema);
