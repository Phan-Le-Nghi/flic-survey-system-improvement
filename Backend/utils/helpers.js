// ── Shared backend utilities ─────────────────────────────────────

/** Chuẩn hoá lỗi 500 về 1 dòng */
const err500 = (res, err, msg = 'Lỗi server') =>
  res.status(500).json({ message: msg, error: err.message });

/** Kiểm tra ID nguyên dương */
const validId = id => Number.isInteger(id) && id > 0;

// ── PhanHoi column helpers (dùng chung cho feedback & reports) ────
const OPTIONAL_PHANHOI_FIELDS = ['lop', 'khoa', 'giao_vien', 'ma_hoc_vien', 'so_dien_thoai'];

async function getPhanHoiColumns(sql) {
  const r = await sql.query`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='PhanHoi'`;
  return new Set(r.recordset.map(row => row.COLUMN_NAME));
}

function buildFeedbackSelect(columns) {
  const optional = OPTIONAL_PHANHOI_FIELDS.map(n => columns.has(n) ? `ph.${n}` : `NULL AS ${n}`);
  return `ph.id,ph.ho_ten,ph.email,ph.danh_gia,ph.noi_dung,ph.trang_thai,ph.cam_xuc,ph.ngay_gui,ph.tra_loi,ph.ngay_tra_loi,${optional.join(',')},f.ten_form`;
}

function optionalField(columns, name, alias = name) {
  return columns.has(name) ? `ph.${name}` : `NULL AS ${alias}`;
}

module.exports = { err500, validId, getPhanHoiColumns, buildFeedbackSelect, optionalField, OPTIONAL_PHANHOI_FIELDS };
