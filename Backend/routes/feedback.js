const express = require('express');
const router = express.Router();
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
      SELECT TOP 1 id, trang_thai, ngay_dong, nhan_vien_id, ten_form
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

    let mappedCamXuc = 'Không rõ';
    if (cam_xuc === 'positive' || cam_xuc === 'Tích cực') mappedCamXuc = 'Tích cực';
    else if (cam_xuc === 'negative' || cam_xuc === 'Tiêu cực') mappedCamXuc = 'Tiêu cực';
    else if (cam_xuc === 'neutral' || cam_xuc === 'Trung lập') mappedCamXuc = 'Trung lập';
    else if (cam_xuc) mappedCamXuc = cam_xuc; // In case it's something else, let SQL Server reject if invalid

    addField('cam_xuc', 'cam_xuc', sql.NVarChar(20), mappedCamXuc);
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
      request.input('phan_hoi_id', sql.Int, phan_hoi_id);
      request.input('cau_hoi_id', sql.Int, Number(row.cau_hoi_id));
      request.input('lua_chon_id', sql.Int, row.lua_chon_id ? Number(row.lua_chon_id) : null);
      request.input('diem_danh_gia', sql.Int, hasRating ? Number(row.diem_danh_gia) : null);
      request.input('noi_dung', sql.NVarChar(1000), row.noi_dung || null);
      await request.query(`
        INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, lua_chon_id, diem_danh_gia, cau_tra_loi)
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
    const select = buildFeedbackSelect(columns);

    const req2 = new sql.Request();
    let where = "WHERE ph.trang_thai != 'deleted'";

    if (trang_thai) {
      where = "WHERE ph.trang_thai = @trang_thai";
      req2.input('trang_thai', sql.NVarChar, trang_thai);
    }

    if (form_id) {
      req2.input('form_id', sql.Int, Number(form_id));
      where += ' AND ph.form_id = @form_id';
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
    const select = buildFeedbackSelect(columns);
    const result = await sql.query`
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
        ct.lua_chon_id, ct.diem_danh_gia, ct.cau_tra_loi AS noi_dung_tra_loi,
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
  const nhan_vien_id = req.user ? req.user.id : null;
  if (!validId(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    await sql.query`UPDATE PhanHoi SET trang_thai='archived' WHERE id=${id}`;

    try {
      await sql.query`
        INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
        VALUES (${nhan_vien_id}, N'Lưu trữ phản hồi', 'feedback', ${id}, N'Lưu trữ phản hồi')
      `;
    } catch (e) { console.error('Lỗi khi lưu nhật ký:', e); }

    res.json({ message: 'Đã lưu trữ phản hồi' });
  } catch (err) {
    err500(res, err);
  }
});

// ── PATCH /api/feedback/:id (trả lời phản hồi) ──────────────────
router.patch('/:id', authMiddleware, authorize('view_feedback'), async (req, res) => {
  const id = Number(req.params.id);
  const nhan_vien_id = req.user ? req.user.id : null;
  if (!validId(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  const { tra_loi, trang_thai } = req.body;
  try {
    if (tra_loi !== undefined) {
      await sql.query`
        UPDATE PhanHoi SET
          tra_loi=${tra_loi || null},
          ngay_tra_loi=${tra_loi ? new Date() : null},
          trang_thai='replied'
        WHERE id=${id}
      `;
      try {
        await sql.query`
          INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
          VALUES (${nhan_vien_id}, N'Trả lời phản hồi', 'feedback', ${id}, N'Ghi chú hoặc trả lời phản hồi')
        `;
      } catch (e) { console.error('Lỗi khi lưu nhật ký:', e); }
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
  const nhan_vien_id = req.user ? req.user.id : null;
  const { ly_do_xoa } = req.body || {};
  if (!validId(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    // Đổi thành xóa mềm (vào thùng rác)
    await sql.query`
      UPDATE PhanHoi 
      SET trang_thai='deleted', 
          ngay_xoa=GETDATE(), 
          nguoi_xoa_id=${nhan_vien_id}, 
          ly_do_xoa=${ly_do_xoa || 'Không có lý do'} 
      WHERE id=${id}
    `;

    try {
      await sql.query`
        INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
        VALUES (${nhan_vien_id}, 'delete', 'feedback', ${id}, N'Đưa phản hồi vào thùng rác')
      `;
    } catch (e) { console.error('Lỗi khi lưu nhật ký:', e); }

    res.json({ message: 'Đã xóa phản hồi (đưa vào thùng rác)' });
  } catch (err) {
    err500(res, err);
  }
});

// ── GET /api/feedback/trash/list ─────────────────────────────────
router.get('/trash/list', authMiddleware, authorize('view_feedback'), async (req, res) => {
  try {
    const result = await sql.query`
      SELECT f.id AS form_id, 
             f.ten_form, 
             lks.danh_muc,
             COUNT(ph.id) AS so_phan_hoi_xoa,
             MAX(ph.ngay_xoa) AS ngay_xoa_gannhat,
             MAX(nx.ho_ten) AS nguoi_xoa_ten,
             CONVERT(varchar(16), ph.ngay_xoa, 120) AS dateKey
      FROM PhanHoi ph
      JOIN Form f ON f.id = ph.form_id
      LEFT JOIN LoaiKhaoSat lks ON f.loai_khao_sat_id = lks.id
      LEFT JOIN NhanVien nx ON ph.nguoi_xoa_id = nx.id
      WHERE ph.trang_thai = 'deleted'
      GROUP BY f.id, f.ten_form, lks.danh_muc, CONVERT(varchar(16), ph.ngay_xoa, 120)
      ORDER BY MAX(ph.ngay_xoa) DESC
    `;
    res.json(result.recordset);
  } catch (err) {
    err500(res, err);
  }
});

// ── PATCH /api/feedback/:id/restore ─────────────────────────────
router.patch('/:id/restore', authMiddleware, authorize('delete_feedback'), async (req, res) => {
  const id = Number(req.params.id);
  const nhan_vien_id = req.user ? req.user.id : null;
  if (!validId(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    await sql.query`
      UPDATE PhanHoi 
      SET trang_thai='active', ngay_xoa=NULL, nguoi_xoa_id=NULL, ly_do_xoa=NULL 
      WHERE id=${id} AND trang_thai='deleted'
    `;
    try {
      await sql.query`
        INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
        VALUES (${nhan_vien_id}, 'restore', 'feedback', ${id}, N'Khôi phục phản hồi từ thùng rác')
      `;
    } catch (e) { console.error('Lỗi khi lưu nhật ký:', e); }
    res.json({ message: 'Đã khôi phục phản hồi' });
  } catch (err) {
    err500(res, err);
  }
});

// ── DELETE /api/feedback/:id/permanent ──────────────────────────
router.delete('/:id/permanent', authMiddleware, authorize('delete_feedback'), async (req, res) => {
  const id = Number(req.params.id);
  const nhan_vien_id = req.user ? req.user.id : null;
  if (!validId(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    await sql.query`DELETE FROM PhanHoi WHERE id=${id} AND trang_thai='deleted'`;
    try {
      await sql.query`
        INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
        VALUES (${nhan_vien_id}, 'hard_delete', 'feedback', ${id}, N'Xóa vĩnh viễn phản hồi khỏi hệ thống')
      `;
    } catch (e) { console.error('Lỗi khi lưu nhật ký:', e); }
    res.json({ message: 'Đã xóa vĩnh viễn phản hồi' });
  } catch (err) {
    err500(res, err);
  }
});

// ── PATCH /api/feedback/form/:form_id/restore ─────────────────────────────
router.patch('/form/:form_id/restore', authMiddleware, authorize('delete_feedback'), async (req, res) => {
  const form_id = Number(req.params.form_id);
  const nhan_vien_id = req.user ? req.user.id : null;
  const { dateKey } = req.body || {};
  if (!validId(form_id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    const request = new sql.Request();
    request.input('form_id', sql.Int, form_id);
    let whereSql = `form_id = @form_id AND trang_thai = 'deleted'`;
    if (dateKey) {
      request.input('dateKey', sql.VarChar, dateKey);
      whereSql += ` AND CONVERT(varchar(16), ngay_xoa, 120) = @dateKey`;
    }

    const result = await request.query(`
      UPDATE PhanHoi 
      SET trang_thai='active', ngay_xoa=NULL, nguoi_xoa_id=NULL, ly_do_xoa=NULL 
      WHERE ${whereSql}
    `);
    const count = result.rowsAffected[0] || 0;
    try {
      if (count > 0) {
        await sql.query`
          INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
          VALUES (${nhan_vien_id}, 'restore', 'feedback', ${form_id}, N'Khôi phục ' + CAST(${count} AS VARCHAR) + N' phản hồi của biểu mẫu')
        `;
      }
    } catch (e) { console.error('Lỗi khi lưu nhật ký:', e); }
    res.json({ message: 'Đã khôi phục phản hồi' });
  } catch (err) {
    err500(res, err);
  }
});

// ── DELETE /api/feedback/form/:form_id/permanent ──────────────────────────
router.delete('/form/:form_id/permanent', authMiddleware, authorize('delete_feedback'), async (req, res) => {
  const form_id = Number(req.params.form_id);
  const nhan_vien_id = req.user ? req.user.id : null;
  const { dateKey } = req.body || {};
  if (!validId(form_id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    const request = new sql.Request();
    request.input('form_id', sql.Int, form_id);
    let whereSql = `form_id = @form_id AND trang_thai = 'deleted'`;
    if (dateKey) {
      request.input('dateKey', sql.VarChar, dateKey);
      whereSql += ` AND CONVERT(varchar(16), ngay_xoa, 120) = @dateKey`;
    }

    const result = await request.query(`DELETE FROM PhanHoi WHERE ${whereSql}`);
    const count = result.rowsAffected[0] || 0;
    try {
      if (count > 0) {
        await sql.query`
          INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
          VALUES (${nhan_vien_id}, 'hard_delete', 'feedback', ${form_id}, N'Xóa vĩnh viễn ' + CAST(${count} AS VARCHAR) + N' phản hồi của biểu mẫu khỏi hệ thống')
        `;
      }
    } catch (e) { console.error('Lỗi khi lưu nhật ký:', e); }
    res.json({ message: 'Đã xóa vĩnh viễn phản hồi' });
  } catch (err) {
    err500(res, err);
  }
});

module.exports = router;