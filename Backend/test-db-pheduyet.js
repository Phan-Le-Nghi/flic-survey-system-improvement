const { sql, connectDB } = require('./config/db');

async function test() {
  try {
    await connectDB();
    const result = await sql.query('SELECT * FROM PheDuyet WHERE form_id = 160');
    console.log(result.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
