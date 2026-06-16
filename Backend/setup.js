/**
 * setup.js  –  Chạy MỘT LẦN sau khi đã tạo database bằng schema.sql
 *
 * Script này sẽ:
 *   1. Kết nối SQL Server
 *   2. Hash tất cả mật khẩu PLACEHOLDER bằng bcrypt
 *   3. In thông tin đăng nhập mặc định
 *
 * Chạy: node setup.js
 */

const bcrypt = require("bcrypt");
const { sql, connectDB } = require("./config/db");

const accounts = [
  { ten_dang_nhap: "admin",  mat_khau: "Admin@123" },
  { ten_dang_nhap: "nvminh", mat_khau: "Staff@123" },
  { ten_dang_nhap: "tthoa",  mat_khau: "Staff@123" },
  { ten_dang_nhap: "lvdung", mat_khau: "Staff@123" },
  { ten_dang_nhap: "ptlan",  mat_khau: "Staff@123" },
];

async function setup() {
  try {
    console.log("🔧 FLIC Setup Script bắt đầu...\n");

    await connectDB();

    for (const acc of accounts) {
      const hash = await bcrypt.hash(acc.mat_khau, 10);

      const result = await sql.query`
        UPDATE NhanVien
        SET mat_khau = ${hash}
        WHERE ten_dang_nhap = ${acc.ten_dang_nhap}
      `;

      if (result.rowsAffected[0] > 0) {
        console.log(`✅ Hash xong: ${acc.ten_dang_nhap}`);
      } else {
        console.log(`⚠️ Không tìm thấy tài khoản: ${acc.ten_dang_nhap}`);
      }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 Setup hoàn tất! Thông tin đăng nhập:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  Admin   : admin   / Admin@123");
    console.log("  Staff : nvminh  / Staff@123");
    console.log("  Staff   : tthoa   / Staff@123");
    console.log("  Staff   : lvdung  / Staff@123");
    console.log("  Staff   : ptlan   / Staff@123");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("👉 Bây giờ chạy: node server.js\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi setup:", err);
    process.exit(1);
  }
}

setup();
