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
      whereClause += ` AND n.hanh_dong = @action`;
      request.input('action', sql.NVarChar, action);
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
        ISNULL(f.ten_form, CASE WHEN n.doi_tuong = 'system' THEN N'Hệ thống' ELSE N'Biểu mẫu đã xóa' END) AS formName, 
        n.chi_tiet AS detail,
        n.doi_tuong_id AS formId
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
    const { actionType, formId, detail } = req.body;
    
    // Lấy user id từ token
    const nhan_vien_id = req.user ? req.user.id : null;
    
    if (!actionType) {
      return res.status(400).json({ message: 'Thiếu actionType (hanh_dong)' });
    }

    const request = new sql.Request();
    request.input('nhan_vien_id', sql.Int, nhan_vien_id);
    request.input('hanh_dong', sql.NVarChar(50), actionType);
    request.input('doi_tuong', sql.NVarChar(50), formId ? 'form' : 'system');
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

module.exports = router;
