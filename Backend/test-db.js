require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT),
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function test() {
  try {
    await sql.connect(config);
    const result = await sql.query("SELECT id, ten_form, trang_thai, ngay_xoa, ngay_cap_nhat, nguoi_xoa_id, ly_do_xoa FROM Form WHERE trang_thai = 'deleted'");
    console.log(result.recordset);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
test();
