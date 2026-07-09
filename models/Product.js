const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    default: '',
    maxlength: 500
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  category: {
    type: String,
    required: true,
    enum: ['电子产品', '书籍教材', '生活用品', '衣物鞋帽', '运动器材', '其他']
  },
  condition: {
    type: String,
    required: true,
    enum: ['全新', '几乎全新', '轻微使用', '明显痕迹']
  },
  images: {
    type: [String],
    default: []
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'sold', 'removed'],
    default: 'active'
  },
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 搜索索引
productSchema.index({ title: 'text', description: 'text' });
// 卖家索引 - 加速"我的发布"查询
productSchema.index({ seller: 1 });

module.exports = mongoose.model('Product', productSchema);
