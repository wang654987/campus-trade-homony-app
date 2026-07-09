const mongoose = require('mongoose');

// 连接数据库
const connectDB = async () => {
  try {
    const conn = await mongoose.connect('mongodb://127.0.0.1:27017/campus_trade');
    console.log(`MongoDB 已连接: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB 连接失败: ${error.message}`);
    process.exit(1);
  }
};

// 导出连接数据库函数
module.exports = connectDB;
