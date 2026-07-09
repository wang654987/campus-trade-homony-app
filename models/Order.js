/**
 * 购买订单模型
 *
 * 记录每一笔购买交易。创建订单时：
 *   1. 将关联商品状态设为 'sold'
 *   2. 删除所有用户对该商品的收藏
 *   3. 买家可从"购买记录"查看
 */

const mongoose = require('mongoose');

// 订单模式
const orderSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['completed', 'cancelled'],
    default: 'completed'
  }
}, { timestamps: true });

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
