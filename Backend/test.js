const {sql, connectDB} = require('./config/db');
connectDB().then(async () => {
  const req = new sql.Request();
  try {
    await req.query("DELETE FROM ChiTietPhanHoi WHERE phan_hoi_id IN (SELECT id FROM PhanHoi WHERE form_id = 130)");
    await req.query("DELETE FROM PhanHoi WHERE form_id = 130");
    console.log("Deleted feedbacks for form 130 successfully");
  } catch (err) {
    console.log(err.message);
  }
  process.exit(0);
});
