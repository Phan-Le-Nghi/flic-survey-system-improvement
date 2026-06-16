const express  = require('express');
const router   = express.Router();
const { sql }  = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { err500, validId } = require('../utils/helpers');

const VALID_STATUS   = new Set(['pending', 'approved', 'rejected']);
const VALID_PRIORITY = new Set(['low', 'normal', 'urgent', 'medium', 'high']);

function normalizePriority(value) {
  if (value === 'medium') return 'normal';
  if (value === 'high') return 'urgent';
  return VALID_PRIORITY.has(value) ? value : 'normal';
}

function normalizeApprovalDeadline(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setSeconds(0, 0);
  return date;
}

async function getTableColumns(tableName) {
  const req = new sql.Request();
  req.input('tableName', sql.NVarChar, tableName);
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

async function getApprovalSenderColumn() {
  const columns = await getTableColumns('PheDuyet');
  if (columns.has('nguoi_gui_id')) return 'nguoi_gui_id';
  if (columns.has('nhan_vien_id')) return 'nhan_vien_id';
  return null;
}

async function ensureApprovalOptionalColumns() {
  const columns = await getTableColumns('PheDuyet');
  if (!columns.has('han_chot_duyet')) {
    await sql.query`ALTER TABLE PheDuyet ADD han_chot_duyet DATETIME NULL`;
    columns.add('han_chot_duyet');
  }
  return columns;
}

async function resolveNhanVienId(...candidates) {
  for (const candidate of candidates) {
    const id = Number(candidate);
    if (!validId(id)) continue;
    const req = new sql.Request();
    req.input('id', sql.Int, id);
    const result = await req.query('SELECT TOP 1 id FROM NhanVien WHERE id = @id');
    if (result.recordset[0]) return id;
  }
  const result = await sql.query`SELECT TOP 1 id FROM NhanVien ORDER BY CASE WHEN vai_tro='admin' THEN 0 ELSE 1 END, id`;
  return result.recordset[0]?.id || null;
}


async function getApprovalById(id) {
  const senderColumn = await getApprovalSenderColumn();
  const senderSelect = senderColumn ? `${senderColumn} AS nhan_vien_id` : 'NULL AS nhan_vien_id';
  const columns = await ensureApprovalOptionalColumns();
  const rejectReasonSelect = columns.has('ly_do_tu_choi') ? 'ly_do_tu_choi' : 'NULL AS ly_do_tu_choi';
  const deadlineSelect = columns.has('han_chot_duyet') ? 'han_chot_duyet' : 'NULL AS han_chot_duyet';
  const r = await new sql.Request()
    .input('id', sql.Int, id)
    .query(`SELECT id,form_id,${senderSelect},do_uu_tien,trang_thai,ghi_chu,${rejectReasonSelect},${deadlineSelect},ngay_yeu_cau,ngay_xu_ly FROM PheDuyet WHERE id=@id`);
  return r.recordset[0] || null;
}

// GET /api/approvals
router.get('/', authMiddleware, authorize('view_approval'), async (req, res) => {
  try {
    const senderColumn = await getApprovalSenderColumn();
    const senderSelect = senderColumn ? `a.${senderColumn} AS nhan_vien_id` : 'NULL AS nhan_vien_id';
    const senderJoin = senderColumn ? `LEFT JOIN NhanVien n ON n.id=a.${senderColumn}` : 'LEFT JOIN NhanVien n ON 1=0';
    const status   = req.query.status;
    const priority = req.query.priority;

    if (status   && !VALID_STATUS.has(status))   return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    if (priority && !VALID_PRIORITY.has(priority)) return res.status(400).json({ message: 'Độ ưu tiên không hợp lệ' });
    const priorityFilter = priority ? normalizePriority(priority) : '';

    const req2 = new sql.Request();
    let where = 'WHERE 1=1';
    if (status)   { where += ' AND a.trang_thai=@status';   req2.input('status',   sql.NVarChar, status); }
    if (priorityFilter) { where += ' AND a.do_uu_tien=@priority'; req2.input('priority', sql.NVarChar, priorityFilter); }

    const columns = await ensureApprovalOptionalColumns();
    const rejectReasonSelect = columns.has('ly_do_tu_choi') ? 'a.ly_do_tu_choi' : 'NULL AS ly_do_tu_choi';
    const deadlineSelect = columns.has('han_chot_duyet') ? 'a.han_chot_duyet' : 'NULL AS han_chot_duyet';
    const result = await req2.query(`
      SELECT a.id,a.form_id,${senderSelect},a.do_uu_tien,a.trang_thai,a.ngay_yeu_cau,a.ngay_xu_ly,a.ghi_chu,${rejectReasonSelect},${deadlineSelect},f.ten_form,lk.danh_muc,n.ho_ten AS nguoi_gui
      FROM PheDuyet a
      LEFT JOIN Form f ON f.id=a.form_id
      LEFT JOIN LoaiKhaoSat lk ON lk.id=f.loai_khao_sat_id
      ${senderJoin}
      ${where}
      ORDER BY
        CASE
          WHEN a.trang_thai = 'pending' AND a.do_uu_tien = 'urgent' THEN 0
          WHEN a.trang_thai = 'pending' THEN 1
          WHEN a.trang_thai = 'rejected' THEN 2
          WHEN a.trang_thai = 'approved' THEN 3
          ELSE 4
        END,
        a.ngay_yeu_cau DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    err500(res, err);
  }
});

// GET /api/approvals/stats
router.get('/stats', authMiddleware, authorize('view_approval'), async (req, res) => {
  try {
    const result = await sql.query`
      SELECT COUNT(*) AS tong,
        SUM(CASE WHEN trang_thai='pending'  THEN 1 ELSE 0 END) AS cho_duyet,
        SUM(CASE WHEN trang_thai='approved' THEN 1 ELSE 0 END) AS da_duyet,
        SUM(CASE WHEN trang_thai='rejected' THEN 1 ELSE 0 END) AS tu_choi
      FROM PheDuyet
    `;
    res.json(result.recordset[0]);
  } catch (err) {
    err500(res, err);
  }
});

// GET /api/approvals/:id
router.get('/:id', authMiddleware, authorize('view_approval'), async (req, res) => {
  const approvalId = Number(req.params.id);
  if (!validId(approvalId)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    const senderColumn = await getApprovalSenderColumn();
    const senderSelect = senderColumn ? `a.${senderColumn} AS nhan_vien_id` : 'NULL AS nhan_vien_id';
    const senderJoin = senderColumn ? `LEFT JOIN NhanVien n ON n.id=a.${senderColumn}` : 'LEFT JOIN NhanVien n ON 1=0';
    const result = await new sql.Request()
      .input('id', sql.Int, approvalId)
      .query(`
      SELECT a.*,${senderSelect},f.ten_form,lk.danh_muc,n.ho_ten AS nguoi_gui
      FROM PheDuyet a
      LEFT JOIN Form f ON f.id=a.form_id
      LEFT JOIN LoaiKhaoSat lk ON lk.id=f.loai_khao_sat_id
      ${senderJoin}
      WHERE a.id=@id
    `);
    if (!result.recordset[0]) return res.status(404).json({ message: 'Không tìm thấy yêu cầu phê duyệt' });
    res.json(result.recordset[0]);
  } catch (err) {
    err500(res, err);
  }
});

// POST /api/approvals
router.post('/', authMiddleware, async (req, res) => {
  const formId   = Number(req.body.form_id);
  const doUuTien = normalizePriority(req.body.do_uu_tien);
  const ghiChu   = typeof req.body.ghi_chu === 'string' ? req.body.ghi_chu.trim() : null;
  const lyDoDuyetGap = typeof req.body.ly_do_duyet_gap === 'string' ? req.body.ly_do_duyet_gap.trim() : '';
  const hanChotDuyet = normalizeApprovalDeadline(req.body.han_chot_duyet);

  if (!validId(formId)) return res.status(400).json({ message: 'form_id không hợp lệ' });
  if (req.body.han_chot_duyet && !hanChotDuyet) return res.status(400).json({ message: 'Hạn chót phê duyệt không hợp lệ' });
  if (hanChotDuyet && hanChotDuyet < new Date()) return res.status(400).json({ message: 'Hạn chót phê duyệt không được ở quá khứ' });
  try {
    const form = await sql.query`SELECT id,nhan_vien_id FROM Form WHERE id=${formId}`;
    if (!form.recordset.length) return res.status(404).json({ message: 'Không tìm thấy biểu mẫu' });
    const formRow = form.recordset[0];

    const pending = await sql.query`SELECT TOP 1 id FROM PheDuyet WHERE form_id=${formId} AND trang_thai='pending'`;
    if (pending.recordset.length) return res.status(400).json({ message: 'Biểu mẫu này đang có yêu cầu chờ phê duyệt' });

    const senderColumn = await getApprovalSenderColumn();
    const senderId = await resolveNhanVienId(req.user?.id, formRow.nhan_vien_id);
    if (!senderColumn) return res.status(500).json({ message: 'Bảng PheDuyet thiếu cột người gửi' });
    if (!senderId) return res.status(400).json({ message: 'Không tìm thấy nhân viên hợp lệ để gửi phê duyệt' });

    const insertReq = new sql.Request();
    insertReq.input('formId', sql.Int, formId);
    insertReq.input('senderId', sql.Int, senderId);
    insertReq.input('doUuTien', sql.NVarChar, doUuTien);
    insertReq.input('ghiChu', sql.NVarChar, ghiChu);
    insertReq.input('hanChotDuyet', sql.DateTime, hanChotDuyet);
    const columns = await ensureApprovalOptionalColumns();
    const deadlineField = columns.has('han_chot_duyet') ? ',han_chot_duyet' : '';
    const deadlineValue = columns.has('han_chot_duyet') ? ',@hanChotDuyet' : '';
    const result = await insertReq.query(`
      INSERT INTO PheDuyet (form_id,${senderColumn},do_uu_tien,trang_thai,ghi_chu${deadlineField})
      OUTPUT INSERTED.id
      VALUES (@formId,@senderId,@doUuTien,'pending',@ghiChu${deadlineValue})
    `);
    await sql.query`UPDATE Form SET trang_thai='pending',ngay_cap_nhat=GETDATE() WHERE id=${formId}`;
    res.status(201).json({ message: 'Đã gửi yêu cầu phê duyệt', id: result.recordset[0].id });
  } catch (err) {
    err500(res, err);
  }
});

// PATCH /api/approvals/:id/approve
router.patch('/:id/approve', authMiddleware, authorize('approve'), async (req, res) => {
  const approvalId = Number(req.params.id);
  const ghiChu = typeof req.body.ghi_chu === 'string' ? req.body.ghi_chu.trim() : null;
  if (!validId(approvalId)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    const approval = await getApprovalById(approvalId);
    if (!approval) return res.status(404).json({ message: 'Không tìm thấy yêu cầu phê duyệt' });
    if (approval.trang_thai === 'approved') return res.status(400).json({ message: 'Yêu cầu này đã được phê duyệt trước đó' });
// Cập nhật đồng thời trạng thái của yêu cầu phê duyệt và biểu mẫu liên quan
    const updateResult = await sql.query`
      UPDATE PheDuyet
      SET trang_thai='approved',ghi_chu=${ghiChu},ngay_xu_ly=GETDATE()
      OUTPUT INSERTED.id, INSERTED.form_id, INSERTED.trang_thai, INSERTED.ngay_yeu_cau, INSERTED.ngay_xu_ly
      WHERE id=${approvalId}
    `;
    await sql.query`UPDATE Form SET trang_thai='active',ngay_cap_nhat=GETDATE() WHERE id=${approval.form_id}`;
    res.json({ message: 'Đã phê duyệt thành công', approval: updateResult.recordset[0] });
  } catch (err) {
    err500(res, err);
  }
});

// PATCH /api/approvals/:id/reject
router.patch('/:id/reject', authMiddleware, authorize('approve'), async (req, res) => {
  const approvalId = Number(req.params.id);
  const ghiChu = typeof req.body.ghi_chu === 'string'
    ? req.body.ghi_chu.trim()
    : typeof req.body.ly_do_tu_choi === 'string'
      ? req.body.ly_do_tu_choi.trim()
      : null;
  if (!validId(approvalId)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    const approval = await getApprovalById(approvalId);
    if (!approval) return res.status(404).json({ message: 'Không tìm thấy yêu cầu phê duyệt' });
    if (approval.trang_thai === 'rejected') return res.status(400).json({ message: 'Yêu cầu này đã bị từ chối trước đó' });

    const columns = await getTableColumns('PheDuyet');
    const req2 = new sql.Request();
    req2.input('id', sql.Int, approvalId);
    req2.input('ghi_chu', sql.NVarChar, ghiChu);
    const reasonUpdate = columns.has('ly_do_tu_choi') ? ',ly_do_tu_choi=@ghi_chu' : '';
    const reasonOutput = columns.has('ly_do_tu_choi') ? ', INSERTED.ly_do_tu_choi' : '';
    const updateResult = await req2.query(`
      UPDATE PheDuyet
      SET trang_thai='rejected',ghi_chu=@ghi_chu${reasonUpdate},ngay_xu_ly=GETDATE()
      OUTPUT INSERTED.id, INSERTED.form_id, INSERTED.trang_thai, INSERTED.ghi_chu${reasonOutput}, INSERTED.ngay_yeu_cau, INSERTED.ngay_xu_ly
      WHERE id=@id
    `);
    await sql.query`UPDATE Form SET trang_thai='rejected',ngay_cap_nhat=GETDATE() WHERE id=${approval.form_id}`;
    res.json({ message: 'Đã từ chối yêu cầu', approval: updateResult.recordset[0] });
  } catch (err) {
    err500(res, err);
  }
});

// PATCH /api/approvals/:id/resubmit
router.patch('/:id/resubmit', authMiddleware, async (req, res) => {
  const approvalId = Number(req.params.id);
  if (!validId(approvalId)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    const approval = await getApprovalById(approvalId);
    if (!approval) return res.status(404).json({ message: 'Không tìm thấy yêu cầu phê duyệt' });

    const isOwner = Number(approval.nhan_vien_id) === Number(req.user.id);
    if (!isOwner && req.user.vai_tro !== 'admin')
      return res.status(403).json({ message: 'Bạn không có quyền gửi lại yêu cầu này' });
    if (approval.trang_thai !== 'rejected')
      return res.status(400).json({ message: 'Chỉ yêu cầu bị từ chối mới có thể gửi lại' });

    const existing = await sql.query`SELECT TOP 1 id FROM PheDuyet WHERE form_id=${approval.form_id} AND trang_thai='pending' AND id<>${approvalId}`;
    if (existing.recordset.length) return res.status(400).json({ message: 'Biểu mẫu này đang có yêu cầu chờ phê duyệt' });

    await sql.query`UPDATE PheDuyet SET trang_thai='pending',ghi_chu=NULL,ngay_yeu_cau=GETDATE(),ngay_xu_ly=NULL WHERE id=${approvalId}`;
    await sql.query`UPDATE Form SET trang_thai='pending',ngay_cap_nhat=GETDATE() WHERE id=${approval.form_id}`;
    res.json({ message: 'Đã gửi lại yêu cầu phê duyệt' });
  } catch (err) {
    err500(res, err);
  }
});

// DELETE /api/approvals/:id
router.delete('/:id', authMiddleware, authorize('approve'), async (req, res) => {
  const approvalId = Number(req.params.id);
  if (!validId(approvalId)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    if (!await getApprovalById(approvalId)) return res.status(404).json({ message: 'Không tìm thấy yêu cầu phê duyệt' });
    await sql.query`DELETE FROM PheDuyet WHERE id=${approvalId}`;
    res.json({ message: 'Đã xóa yêu cầu phê duyệt' });
  } catch (err) {
    err500(res, err);
  }
});

module.exports = router;
