const { sql, connectDB } = require('./config/db');

async function test() {
  try {
    await connectDB();
    const result = await sql.query('SELECT id, ten_dang_nhap, ho_ten, vai_tro FROM NhanVien');
    console.table(result.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
