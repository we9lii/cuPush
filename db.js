const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+03:00' // توقيت السعودية
});

// تحويل الـ Pool ليدعم الـ Promises لاستخدام async/await
const promisePool = pool.promise();

module.exports = promisePool;