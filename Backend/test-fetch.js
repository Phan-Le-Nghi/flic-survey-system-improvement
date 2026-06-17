const jwt = require('jsonwebtoken');
require('dotenv').config();
const token = jwt.sign({ id: 1, vai_tro: 'admin' }, process.env.JWT_SECRET || 'flic_secret_key_2026', { expiresIn: '1d' });

fetch('http://localhost:3000/api/approvals/undefined/approve', {
  method: 'PATCH',
  headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({})
}).then(res => Promise.all([res.status, res.text()])).then(console.log).catch(console.error);
