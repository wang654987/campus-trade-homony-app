const mongoose = require('mongoose');

// 连接数据库
//流程：
// 1. 创建数据库连接
// 2. 删除旧的索引
// 3. 创建新的索引
const connectDB = async () => {
  try {
    const conn = await mongoose.connect('mongodb://127.0.0.1:27017/campus_trade');
    try {
      await mongoose.connection.collection('conversations').dropIndex('participants_1_product_1');
      console.log('MongoDB removed old conversations participants/product unique index');
    } catch (indexError) {
      if (indexError.codeName !== 'IndexNotFound') {
        console.warn(`MongoDB old index cleanup skipped: ${indexError.message}`);
      }
    }
    console.log(`MongoDB 已连接: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB 连接失败: ${error.message}`);
    process.exit(1);
  }
};

// 导出连接数据库函数
module.exports = connectDB;
