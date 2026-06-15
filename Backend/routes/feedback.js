const express = require('express');
const router  = express.Router();
const { sql } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { err500, validId, getPhanHoiColumns, buildFeedbackSelect } = require('../utils/helpers');

let feedbackRatingConstraintReady = false;
async function ensureFeedbackRatingConstraint() {
  if (feedbackRatingConstraintReady) return;
  await sql.query`
    IF EXISTS (
      SELECT 1 FROM sys.check_constraints
      WHERE name = 'CHK_ChiTietPhanHoi_Diem'
    )
    BEGIN
      ALTER TABLE ChiTietPhanHoi DROP CONSTRAINT CHK_ChiTietPhanHoi_Diem;
    END
    ALTER TABLE ChiTietPhanHoi
    ADD CONSTRAINT CHK_ChiTietPhanHoi_Diem
    CHECK (diem_danh_gia IS NULL OR diem_danh_gia BETWEEN 0 AND 10);
  `;
  feedbackRatingConstraintReady = true;
}

// ── POST /api/feedback (public – không cần đăng nhập) ────────────
router.post('/', async (req, res) => {
  const { form_id, ho_ten, email, danh_gia, cam_xuc, noi_dung, lop, khoa, giao_vien } = req.body;
  if (!form_id) return res.status(400).json({ message: 'Thiếu form_id' });
  if (!noi_dung) return res.status(400).json({ message: 'Thiếu noi_dung' });
  try {
    const formId = Number(form_id);
    if (!Number.isInteger(formId) || formId <= 0) {
      return res.status(400).json({ message: 'form_id không hợp lệ' });
    }

    const formRequest = new sql.Request();
    formRequest.input('form_id', sql.Int, formId);
    const formResult = await formRequest.query(`
      SELECT TOP 1 id, trang_thai, ngay_dong
      FROM Form
      WHERE id = @form_id
    `);
    const form = formResult.recordset[0];
    if (!form) return res.status(404).json({ message: 'Không tìm thấy biểu mẫu' });

    const closeDate = form.ngay_dong ? new Date(form.ngay_dong) : null;
    const isExpired = closeDate && closeDate < new Date();
    if (form.trang_thai !== 'active' || isExpired) {
      return res.status(400).json({ message: 'Biểu mẫu đã đóng, không nhận phản hồi mới' });
    }

    const columns = await getPhanHoiColumns(sql);
    const request = new sql.Request();
    const fields = [];
    const values = [];
    const addField = (column, param, type, value) => {
      if (!columns.has(column)) return;
      fields.push(column);
      values.push('@' + param);
      request.input(param, type, value);
    };

    addField('form_id', 'form_id', sql.Int, formId);
    addField('ho_ten', 'ho_ten', sql.NVarChar(100), ho_ten || null);
    addField('ho_ten_nguoi_gui', 'ho_ten_nguoi_gui', sql.NVarChar(100), ho_ten || null);
    addField('email', 'email', sql.NVarChar(150), email || null);
    addField('email_nguoi_gui', 'email_nguoi_gui', sql.NVarChar(150), email || null);
    addField('danh_gia', 'danh_gia', sql.Int, danh_gia || null);
    addField('cam_xuc', 'cam_xuc', sql.NVarChar(20), cam_xuc || 'neutral');
    addField('noi_dung', 'noi_dung', sql.NVarChar(1000), noi_dung);
    addField('lop', 'lop', sql.NVarChar(50), lop || null);
    addField('khoa', 'khoa', sql.NVarChar(100), khoa || null);
    addField('giao_vien', 'giao_vien', sql.NVarChar(100), giao_vien || null);

    if (!fields.includes('form_id')) {
      return res.status(500).json({ message: 'Bảng PhanHoi thiếu cột form_id' });
    }

    const result = await request.query(`
      INSERT INTO PhanHoi (${fields.join(', ')})
      OUTPUT INSERTED.id
      VALUES (${values.join(', ')})
    `);
    const newId = result.recordset[0].id;
    res.status(201).json({ id: newId, message: 'Đã lưu phản hồi' });
  } catch (err) {
    err500(res, err, 'Lỗi khi lưu phản hồi');
  }
});

// ── POST /api/feedback/:id/chitiet (public – không cần đăng nhập) ─
router.post('/:id/chitiet', async (req, res) => {
  const phan_hoi_id = Number(req.params.id);
  if (!validId(phan_hoi_id)) return res.status(400).json({ message: 'ID không hợp lệ' });

  const { chi_tiet } = req.body;
  if (!Array.isArray(chi_tiet) || chi_tiet.length === 0) {
    return res.status(400).json({ message: 'Thiếu dữ liệu chi tiết' });
  }

  try {
    await ensureFeedbackRatingConstraint();
    for (const row of chi_tiet) {
      const hasRating = row.diem_danh_gia !== undefined && row.diem_danh_gia !== null && row.diem_danh_gia !== '';
      const request = new sql.Request();
      request.input('phan_hoi_id',   sql.Int,           phan_hoi_id);
      request.input('cau_hoi_id',    sql.Int,           Number(row.cau_hoi_id));
      request.input('lua_chon_id',   sql.Int,           row.lua_chon_id   ? Number(row.lua_chon_id)   : null);
      request.input('diem_danh_gia', sql.Int,           hasRating ? Number(row.diem_danh_gia) : null);
      request.input('noi_dung',      sql.NVarChar(1000),row.noi_dung      || null);
      await request.query(`
        INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, lua_chon_id, diem_danh_gia, noi_dung_tra_loi)
        VALUES (@phan_hoi_id, @cau_hoi_id, @lua_chon_id, @diem_danh_gia, @noi_dung)
      `);
    }
    res.status(201).json({ message: 'Đã lưu chi tiết phản hồi' });
  } catch (err) {
    err500(res, err, 'Lỗi khi lưu chi tiết phản hồi');
  }
});

// ── GET /api/feedback?form_id=&trang_thai=&cam_xuc= ──────────────
router.get('/', authMiddleware, authorize('view_feedback'), async (req, res) => {
  try {
    const { form_id, trang_thai, cam_xuc } = req.query;
    const columns = await getPhanHoiColumns(sql);
    const select  = buildFeedbackSelect(columns);

    const req2 = new sql.Request();
    let where = 'WHERE 1=1';

    if (form_id) {
      req2.input('form_id', sql.Int, Number(form_id));
      where += ' AND ph.form_id = @form_id';
    }
    if (trang_thai) {
      req2.input('trang_thai', sql.NVarChar, trang_thai);
      where += ' AND ph.trang_thai = @trang_thai';
    }
    if (cam_xuc) {
      req2.input('cam_xuc', sql.NVarChar, cam_xuc);
      where += ' AND ph.cam_xuc = @cam_xuc';
    }

    const result = await req2.query(`
      SELECT ${select}
      FROM PhanHoi ph
      JOIN Form f ON f.id = ph.form_id
      ${where}
      ORDER BY ph.ngay_gui DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    err500(res, err, 'Lỗi server khi lấy danh sách phản hồi');
  }
});

// ── GET /api/feedback/:id ────────────────────────────────────────
router.get('/:id', authMiddleware, authorize('view_feedback'), async (req, res) => {
  const id = Number(req.params.id);
  if (!validId(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    const columns = await getPhanHoiColumns(sql);
    const select  = buildFeedbackSelect(columns);
    const result  = await sql.query`
      SELECT ${select}
      FROM PhanHoi ph
      JOIN Form f ON f.id = ph.form_id
      WHERE ph.id = ${id}
    `;
    if (!result.recordset[0]) return res.status(404).json({ message: 'Không tìm thấy phản hồi' });
    res.json(result.recordset[0]);
  } catch (err) {
    err500(res, err);
  }
});

// ── GET /api/feedback/:id/chitiet ───────────────────────────────
router.get('/:id/chitiet', authMiddleware, authorize('view_feedback'), async (req, res) => {
  const id = Number(req.params.id);
  if (!validId(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    const result = await sql.query`
      SELECT
        ct.id, ct.phan_hoi_id, ct.cau_hoi_id,
        ct.lua_chon_id, ct.diem_danh_gia, ct.noi_dung_tra_loi,
        ch.noi_dung AS ten_cau_hoi, ch.loai AS loai_cau_hoi,
        lc.noi_dung AS ten_lua_chon
      FROM ChiTietPhanHoi ct
      JOIN CauHoi ch ON ch.id = ct.cau_hoi_id
      LEFT JOIN LuaChon lc ON lc.id = ct.lua_chon_id
      WHERE ct.phan_hoi_id = ${id}
      ORDER BY ch.thu_tu ASC
    `;
    res.json(result.recordset);
  } catch (err) {
    err500(res, err);
  }
});

// ── PATCH /api/feedback/:id/archive ─────────────────────────────
router.patch('/:id/archive', authMiddleware, authorize('delete_feedback'), async (req, res) => {
  const id = Number(req.params.id);
  if (!validId(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    await sql.query`UPDATE PhanHoi SET trang_thai='archived' WHERE id=${id}`;
    res.json({ message: 'Đã lưu trữ phản hồi' });
  } catch (err) {
    err500(res, err);
  }
});

// ── PATCH /api/feedback/:id (trả lời phản hồi) ──────────────────
router.patch('/:id', authMiddleware, authorize('view_feedback'), async (req, res) => {
  const id = Number(req.params.id);
  if (!validId(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  const { tra_loi, trang_thai } = req.body;
  try {
    if (tra_loi !== undefined) {
      await sql.query`
        UPDATE PhanHoi SET
          tra_loi=${tra_loi||null},
          ngay_tra_loi=${tra_loi ? new Date() : null},
          trang_thai='replied'
        WHERE id=${id}
      `;
    } else if (trang_thai) {
      await sql.query`UPDATE PhanHoi SET trang_thai=${trang_thai} WHERE id=${id}`;
    }
    res.json({ message: 'Cập nhật phản hồi thành công' });
  } catch (err) {
    err500(res, err);
  }
});

// ── DELETE /api/feedback/:id ─────────────────────────────────────
router.delete('/:id', authMiddleware, authorize('delete_feedback'), async (req, res) => {
  const id = Number(req.params.id);
  if (!validId(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    await sql.query`DELETE FROM PhanHoi WHERE id=${id}`;
    res.json({ message: 'Đã xóa phản hồi' });
  } catch (err) {
    err500(res, err);
  }
});

module.exports = router;
