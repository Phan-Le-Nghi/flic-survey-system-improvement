const { sql, connectDB } = require('./config/db');

async function test() {
  await connectDB();
  const res = await sql.query`SELECT id, form_id, trang_thai FROM PheDuyet WHERE trang_thai = 'pending'`;
  console.log("Pending approvals:", res.recordset);
  process.exit(0);
}
test();
