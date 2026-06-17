// ── Shared backend utilities ─────────────────────────────────────

const err500 = (res, err, msg = 'Lỗi server') => {
  console.error('[err500]', msg, err);
  return res.status(500).json({ message: msg, error: err.message });
};

/** Kiểm tra ID nguyên dương */
const validId = id => Number.isInteger(id) && id > 0;

// ── PhanHoi column helpers (dùng chung cho feedback & reports) ────
const OPTIONAL_PHANHOI_FIELDS = ['lop', 'khoa', 'giao_vien', 'ma_hoc_vien', 'so_dien_thoai'];

async function getPhanHoiColumns(sql) {
  const r = await sql.query`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'PhanHoi'
  `;
  return new Set(r.recordset.map(row => row.COLUMN_NAME));
}

function buildFeedbackSelect(columns) {
  const field = name => columns.has(name) ? `ph.${name}` : `NULL AS ${name}`;
  const aliasField = (alias, candidates) => {
    const found = candidates.find(name => columns.has(name));
    return found ? `ph.${found} AS ${alias}` : `NULL AS ${alias}`;
  };
  const optional = OPTIONAL_PHANHOI_FIELDS.map(field);
  return [
    field('id'),
    field('form_id'),
    aliasField('ho_ten', ['ho_ten', 'ho_ten_nguoi_gui']),
    aliasField('email', ['email', 'email_nguoi_gui']),
    field('danh_gia'),
    field('noi_dung'),
    field('trang_thai'),
    field('cam_xuc'),
    field('ngay_gui'),
    field('tra_loi'),
    field('ngay_tra_loi'),
    ...optional,
    'f.ten_form'
  ].join(',');
}

function optionalField(columns, name, alias = name) {
  return columns.has(name) ? `ph.${name}` : `NULL AS ${alias}`;
}

module.exports = { err500, validId, getPhanHoiColumns, buildFeedbackSelect, optionalField, OPTIONAL_PHANHOI_FIELDS };
