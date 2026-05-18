const sql = require("mssql/msnodesqlv8");

// ⚠️  Đổi "NGUYENTHUY" thành tên SQL Server instance của bạn
// Xem tên instance: mở SQL Server Management Studio → nhìn vào "Server name"
// Ví dụ: localhost\SQLEXPRESS  hoặc  localhost\MSSQLSERVER

const config = {
  connectionString:
    "Driver={ODBC Driver 17 for SQL Server};Server=ADMIN-PC\\MSSQLSERVER01;Database=FLIC_DB;Trusted_Connection=yes;",
  options: {
    trustServerCertificate: true,
  },
};
const connectDB = async () => {
  try {
    await sql.connect(config);
    console.log("✅ Kết nối SQL Server thành công!");
  } catch (err) {
    console.error("❌ Kết nối thất bại:", err.message);
    process.exit(1);
  }
};

module.exports = { connectDB, sql };
