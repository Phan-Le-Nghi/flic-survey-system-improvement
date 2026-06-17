const { sql, connectDB } = require('./config/db');

async function createTable() {
  try {
    await connectDB();
    const result = await sql.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ThongBao_DaDoc' AND xtype='U')
      BEGIN
          CREATE TABLE ThongBao_DaDoc (
              id INT IDENTITY(1,1) PRIMARY KEY,
              thong_bao_id INT NOT NULL REFERENCES ThongBao(id) ON DELETE CASCADE,
              nhan_vien_id INT NOT NULL REFERENCES NhanVien(id) ON DELETE CASCADE,
              ngay_doc DATETIME NOT NULL DEFAULT GETDATE(),
              CONSTRAINT UQ_ThongBao_NhanVien UNIQUE (thong_bao_id, nhan_vien_id)
          );
          PRINT 'Table ThongBao_DaDoc created successfully.';
      END
      ELSE
      BEGIN
          PRINT 'Table ThongBao_DaDoc already exists.';
      END
    `);
    console.log("Migration executed.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

createTable();
