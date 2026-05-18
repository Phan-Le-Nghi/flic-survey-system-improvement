const express  = require('express');
const router   = express.Router();
const { sql }  = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { err500, validId } = require('../utils/helpers');

const VALID_STATUS   = new Set(['pending', 'approved', 'rejected']);
const VALID_PRIORITY = new Set(['low', 'medium', 'high']);


async function getApprovalById(id) {
  const r = await sql.query`SELECT id,form_id,nhan_vien_id,do_uu_tien,trang_thai,ghi_chu,ngay_yeu_cau,ngay_xu_ly FROM PheDuyet WHERE id=${id}`;
  return r.recordset[0] || null;
}

// GET /api/approvals
router.get('/', authMiddleware, authorize('view_approval'), async (req, res) => {
  try {
    const status   = req.query.status;
    const priority = req.query.priority;

    if (status   && !VALID_STATUS.has(status))   return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    if (priority && !VALID_PRIORITY.has(priority)) return res.status(400).json({ message: 'Độ ưu tiên không hợp lệ' });

    const req2 = new sql.Request();
    let where = 'WHERE 1=1';
    if (status)   { where += ' AND a.trang_thai=@status';   req2.input('status',   sql.NVarChar, status); }
    if (priority) { where += ' AND a.do_uu_tien=@priority'; req2.input('priority', sql.NVarChar, priority); }

    const result = await req2.query(`
      SELECT a.id,a.form_id,a.nhan_vien_id,a.do_uu_tien,a.trang_thai,a.ngay_yeu_cau,a.ngay_xu_ly,a.ghi_chu,f.ten_form,f.danh_muc,n.ho_ten AS nguoi_gui
      FROM PheDuyet a LEFT JOIN Form f ON f.id=a.form_id LEFT JOIN NhanVien n ON n.id=a.nhan_vien_id
      ${where} ORDER BY a.ngay_yeu_cau DESC
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
    const result = await sql.query`
      SELECT a.*,f.ten_form,f.danh_muc,n.ho_ten AS nguoi_gui
      FROM PheDuyet a LEFT JOIN Form f ON f.id=a.form_id LEFT JOIN NhanVien n ON n.id=a.nhan_vien_id
      WHERE a.id=${approvalId}
    `;
    if (!result.recordset[0]) return res.status(404).json({ message: 'Không tìm thấy yêu cầu phê duyệt' });
    res.json(result.recordset[0]);
  } catch (err) {
    err500(res, err);
  }
});

// POST /api/approvals
router.post('/', authMiddleware, async (req, res) => {
  const formId   = Number(req.body.form_id);
  const doUuTien = VALID_PRIORITY.has(req.body.do_uu_tien) ? req.body.do_uu_tien : 'medium';
  const ghiChu   = typeof req.body.ghi_chu === 'string' ? req.body.ghi_chu.trim() : null;

  if (!validId(formId)) return res.status(400).json({ message: 'form_id không hợp lệ' });

  try {
    const form = await sql.query`SELECT id FROM Form WHERE id=${formId}`;
    if (!form.recordset.length) return res.status(404).json({ message: 'Không tìm thấy biểu mẫu' });

    const pending = await sql.query`SELECT TOP 1 id FROM PheDuyet WHERE form_id=${formId} AND trang_thai='pending'`;
    if (pending.recordset.length) return res.status(400).json({ message: 'Biểu mẫu này đang có yêu cầu chờ phê duyệt' });

    const result = await sql.query`
      INSERT INTO PheDuyet (form_id,nhan_vien_id,do_uu_tien,trang_thai,ghi_chu)
      OUTPUT INSERTED.id
      VALUES (${formId},${req.user.id},${doUuTien},'pending',${ghiChu})
    `;
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
// Cập nhập đồng thời trạng thái của yêu cầu phê duyệt và biểu mẫu liên quan
    await sql.query`UPDATE PheDuyet SET trang_thai='approved',ghi_chu=${ghiChu},ngay_xu_ly=GETDATE() WHERE id=${approvalId}`;
    await sql.query`UPDATE Form SET trang_thai='active',ngay_cap_nhat=GETDATE() WHERE id=${approval.form_id}`;
    res.json({ message: 'Đã phê duyệt thành công' });
  } catch (err) {
    err500(res, err);
  }
});

// PATCH /api/approvals/:id/reject
router.patch('/:id/reject', authMiddleware, authorize('approve'), async (req, res) => {
  const approvalId = Number(req.params.id);
  const ghiChu = typeof req.body.ghi_chu === 'string' ? req.body.ghi_chu.trim() : null;
  if (!validId(approvalId)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    const approval = await getApprovalById(approvalId);
    if (!approval) return res.status(404).json({ message: 'Không tìm thấy yêu cầu phê duyệt' });
    if (approval.trang_thai === 'rejected') return res.status(400).json({ message: 'Yêu cầu này đã bị từ chối trước đó' });

    await sql.query`UPDATE PheDuyet SET trang_thai='rejected',ghi_chu=${ghiChu},ngay_xu_ly=GETDATE() WHERE id=${approvalId}`;
    await sql.query`UPDATE Form SET trang_thai='rejected',ngay_cap_nhat=GETDATE() WHERE id=${approval.form_id}`;
    res.json({ message: 'Đã từ chối yêu cầu' });
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
    await sql.query`UPDATE Form SET trang_thai='draft',ngay_cap_nhat=GETDATE() WHERE id=${approval.form_id}`;
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
