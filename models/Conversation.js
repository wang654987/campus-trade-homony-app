const mongoose = require('mongoose');

// Conversation Schema
const conversationSchema = new mongoose.Schema({
    participants: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    required: true,
    validate: {
      validator: arr => Array.isArray(arr) && arr.length === 2,
      message: '会话必须且只能包含两个参与者'
    }
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  participantKey: {
    type: String,
    required: true
  },
  lastMessage: {
    content: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: Date
  }
}, {
  timestamps: true
});

// participants is an array, so use a stable pair key for uniqueness.
conversationSchema.index(
  { product: 1, participantKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      product: { $type: 'objectId' },
      participantKey: { $type: 'string' }
    }
  }
);

module.exports = mongoose.model('Conversation', conversationSchema);
