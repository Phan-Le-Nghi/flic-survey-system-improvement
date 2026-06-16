require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

connectDB();

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/staff',         require('./routes/staff'));
app.use('/api/forms',         require('./routes/forms'));
app.use('/api/approvals',     require('./routes/approvals'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/feedback',      require('./routes/feedback'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/favorites',     require('./routes/favorites'));
app.use('/api/share',         require('./routes/share'));
app.use('/api/library',       require('./routes/library'));
app.use('/api/audit-logs',    require('./routes/auditLogs'));

app.get('/', (req, res) => res.json({ message: 'FLIC Backend đang chạy ✅', version: '1.0.0' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server chạy tại http://localhost:${PORT}`));
