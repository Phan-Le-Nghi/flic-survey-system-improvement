const sql = require("mssql");
require("dotenv").config();

const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "1433", 10),
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function connectDB() {
  try {
    await sql.connect(dbConfig);
    console.log("✅ Kết nối SQL Server thành công!");
  } catch (err) {
    console.error("❌ Kết nối thất bại:", err.message);
    throw err;
  }
}

module.exports = {
  sql,
  connectDB,
};