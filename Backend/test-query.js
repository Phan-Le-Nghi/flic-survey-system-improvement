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

async function getTableColumns(tableName) {
  const req = new sql.Request();
  req.input("tableName", sql.NVarChar, tableName);
  const result = await req.query(`
    SELECT c.name AS COLUMN_NAME
    FROM sys.columns c
    INNER JOIN sys.objects o ON o.object_id = c.object_id
    INNER JOIN sys.schemas s ON s.schema_id = o.schema_id
    WHERE o.type = 'U'
      AND o.name = @tableName
      AND s.name = 'dbo'
  `);
  return new Set(result.recordset.map(row => row.COLUMN_NAME));
}

async function getFormCategorySql(formColumns) {
  const hasLoaiKhaoSat = formColumns.has("loai_khao_sat_id");
  if (!hasLoaiKhaoSat) {
    return { select: "N'Khac'", join: "" };
  }

  const loaiColumns = await getTableColumns("LoaiKhaoSat");
  const categoryColumn = loaiColumns.has("danh_muc") ? "danh_muc" : "ten_loai";

  return {
    select: categoryColumn ? `lk.${categoryColumn}` : "N'Khac'",
    join: "LEFT JOIN LoaiKhaoSat lk ON lk.id = f.loai_khao_sat_id"
  };
}

async function test() {
  try {
    await sql.connect(config);
    
    const formColumns = await getTableColumns("Form");
    const { select: categorySelect, join: categoryJoin } = await getFormCategorySql(formColumns);
    
    let query = `
      SELECT f.id, f.ten_form, ${categorySelect} AS danh_muc, 
             COALESCE(f.ngay_xoa, f.ngay_cap_nhat) AS ngay_xoa,
             n.ho_ten AS nguoi_tao,
             nx.ho_ten AS nguoi_xoa,
             f.ly_do_xoa
      FROM Form f
      ${categoryJoin}
      LEFT JOIN NhanVien n ON n.id = f.nhan_vien_id
      LEFT JOIN NhanVien nx ON nx.id = f.nguoi_xoa_id
      WHERE f.trang_thai = 'deleted'
    `;
    
    const result = await sql.query(query);
    console.log("Success:", result.recordset);
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}
test();
