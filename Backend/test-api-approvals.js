const { sql, connectDB } = require('./config/db');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function test() {
  try {
    await connectDB();
    const token = jwt.sign({ id: 1, vai_tro: 'admin' }, process.env.JWT_SECRET || 'flic_secret_key_2026');
    console.log('Token:', token);

    // global fetch is available in Node 18+
    const res = await fetch('http://localhost:3000/api/approvals', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Approvals count:', data.length);
    console.log(data.find(a => a.form_id === 160));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
