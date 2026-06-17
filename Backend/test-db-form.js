const { sql, connectDB } = require('./config/db');

async function test() {
  try {
    await connectDB();
    const result = await sql.query('SELECT id, ten_form, trang_thai FROM Form ORDER BY id DESC');
    console.log(result.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
