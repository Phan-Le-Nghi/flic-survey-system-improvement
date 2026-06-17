const express = require('express');
const router = express.Router();
const { sql } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { err500 } = require('../utils/helpers');

// ── GET /api/audit-logs ──────────────────────────────────────────
// Lấy danh sách nhật ký hoạt động, có hỗ trợ search, filter ngày và action
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, action, start_date, end_date } = req.query;

    let whereClause = 'WHERE 1=1';
    const request = new sql.Request();

    if (search) {
      whereClause += ` AND (nv.ho_ten LIKE '%' + @search + '%' OR f.ten_form LIKE '%' + @search + '%')`;
      request.input('search', sql.NVarChar, search);
    }

    if (action && action !== 'all') {
      if (action === 'delete') {
        whereClause += ` AND n.hanh_dong IN ('delete', 'DELETE', 'hard_delete', N'Xóa phản hồi', N'Xóa vĩnh viễn')`;
      } else if (action === 'edit') {
        whereClause += ` AND n.hanh_dong IN ('edit', 'EDIT', 'update', 'UPDATE')`;
      } else if (action === 'create') {
        whereClause += ` AND n.hanh_dong IN ('create', 'CREATE')`;
      } else if (action === 'restore') {
        whereClause += ` AND n.hanh_dong IN ('restore', 'RESTORE')`;
      } else if (action === 'approve') {
        whereClause += ` AND n.hanh_dong IN ('approve', 'APPROVE')`;
      } else if (action === 'reject') {
        whereClause += ` AND n.hanh_dong IN ('reject', 'REJECT')`;
      } else {
        whereClause += ` AND n.hanh_dong = @action`;
        request.input('action', sql.NVarChar, action);
      }
    }

    if (start_date) {
      whereClause += ` AND CAST(n.thoi_gian AS DATE) >= @start_date`;
      request.input('start_date', sql.Date, start_date);
    }

    if (end_date) {
      whereClause += ` AND CAST(n.thoi_gian AS DATE) <= @end_date`;
      request.input('end_date', sql.Date, end_date);
    }

    const query = `
      SELECT 
        n.id, 
        n.thoi_gian AS time, 
        ISNULL(nv.ho_ten, 'Hệ thống') AS [user], 
        ISNULL(nv.vai_tro, 'system') AS role, 
        n.hanh_dong AS actionType, 
        CASE 
          WHEN n.doi_tuong = 'form' THEN 
             CASE WHEN n.doi_tuong_id IS NULL THEN N'Nhiều biểu mẫu' ELSE ISNULL(f.ten_form, N'Biểu mẫu đã xóa') END
          WHEN n.doi_tuong = 'feedback' THEN 
             ISNULL((SELECT TOP 1 f2.ten_form FROM Form f2 JOIN PhanHoi ph ON ph.form_id = f2.id WHERE ph.id = n.doi_tuong_id), N'Phản hồi từ biểu mẫu đã xóa')
          ELSE N'Hệ thống'
        END AS formName, 
        n.chi_tiet AS detail,
        CASE 
          WHEN n.doi_tuong = 'feedback' THEN 
            (SELECT TOP 1 ph.form_id FROM PhanHoi ph WHERE ph.id = n.doi_tuong_id)
          ELSE n.doi_tuong_id 
        END AS formId
      FROM NhatKyHoatDong n
      LEFT JOIN NhanVien nv ON n.nhan_vien_id = nv.id
      LEFT JOIN Form f ON n.doi_tuong_id = f.id AND n.doi_tuong = 'form'
      ${whereClause}
      ORDER BY n.thoi_gian DESC
    `;

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    err500(res, err, 'Lỗi server khi lấy danh sách nhật ký hoạt động');
  }
});

// ── POST /api/audit-logs ─────────────────────────────────────────
// Ghi nhận một hoạt động mới vào hệ thống
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { actionType, formId, formName, detail, targetType } = req.body;

    // Lấy user id từ token
    const nhan_vien_id = req.user ? req.user.id : null;

    if (!actionType) {
      return res.status(400).json({ message: 'Thiếu actionType (hanh_dong)' });
    }

    const request = new sql.Request();
    request.input('nhan_vien_id', sql.Int, nhan_vien_id);
    request.input('hanh_dong', sql.NVarChar(50), actionType);
    
    // Xử lý đối tượng (form, system, notification, feedback...)
    let finalTargetType = targetType;
    if (!finalTargetType) {
      const actionLower = actionType.toLowerCase();
      const isFormAction = ['create', 'edit', 'delete', 'hard_delete', 'restore', 'approve', 'reject'].includes(actionLower) || actionLower.includes('xóa');
      finalTargetType = (formId || isFormAction) ? 'form' : 'system';
      
      if (formName === 'Hệ thống') {
        finalTargetType = 'system';
      }
    }
    request.input('doi_tuong', sql.NVarChar(50), finalTargetType);
    
    request.input('doi_tuong_id', sql.Int, formId ? Number(formId) : null);
    request.input('chi_tiet', sql.NVarChar(sql.MAX), detail || null);

    const query = `
      INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
      VALUES (@nhan_vien_id, @hanh_dong, @doi_tuong, @doi_tuong_id, @chi_tiet)
    `;

    await request.query(query);
    res.status(201).json({ message: 'Đã lưu nhật ký hoạt động' });
  } catch (err) {
    err500(res, err, 'Lỗi khi lưu nhật ký hoạt động');
  }
});

// ── CLEANUP JOB ──────────────────────────────────────────────────
// Tự động xóa các nhật ký hoạt động cũ hơn 30 ngày (chạy mỗi 12 giờ)
setInterval(async () => {
  try {
    const result = await sql.query`
      DELETE FROM NhatKyHoatDong
      WHERE thoi_gian < DATEADD(day, -30, GETDATE())
    `;
    if (result.rowsAffected[0] > 0) {
      console.log(`[AuditLogs] Đã tự động dọn dẹp ${result.rowsAffected[0]} nhật ký cũ hơn 30 ngày.`);
    }
  } catch (error) {
    console.error('[AuditLogs] Lỗi khi dọn dẹp nhật ký cũ:', error);
  }
}, 12 * 60 * 60 * 1000);

// Chạy dọn dẹp ngay lúc khởi động server (đợi 5 giây để đảm bảo DB đã kết nối)
setTimeout(async () => {
  try {
    const result = await sql.query`
      DELETE FROM NhatKyHoatDong
      WHERE thoi_gian < DATEADD(day, -30, GETDATE())
    `;
    if (result.rowsAffected[0] > 0) {
      console.log(`[AuditLogs] (Startup) Đã tự động dọn dẹp ${result.rowsAffected[0]} nhật ký cũ hơn 30 ngày.`);
    }
  } catch (error) {
    console.error('[AuditLogs] Lỗi khi dọn dẹp nhật ký cũ lúc startup:', error);
  }
}, 5000);

module.exports = router;