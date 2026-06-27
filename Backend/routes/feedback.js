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
      SELECT TOP 1 id, trang_thai, ngay_dong, nhan_vien_id, ten_form, limit_one_response
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
// PUT /api/feedback/:id/public - cap nhat phan hoi cong khai khi form cho phep chinh sua
router.put('/:id/public', async (req, res) => {
  const feedbackId = Number(req.params.id);
  if (!validId(feedbackId)) return res.status(400).json({ message: 'ID khong hop le' });

  const { form_id, ho_ten, email, danh_gia, cam_xuc, noi_dung, lop, khoa, giao_vien, chi_tiet } = req.body;
  if (!form_id) return res.status(400).json({ message: 'Thieu form_id' });
  if (!noi_dung) return res.status(400).json({ message: 'Thieu noi_dung' });

  try {
    const formId = Number(form_id);
    if (!Number.isInteger(formId) || formId <= 0) {
      return res.status(400).json({ message: 'form_id khong hop le' });
    }

    const checkReq = new sql.Request();
    checkReq.input('id', sql.Int, feedbackId);
    checkReq.input('form_id', sql.Int, formId);
    const checkResult = await checkReq.query(`
      SELECT TOP 1 ph.id, f.allow_edit_after_submit, f.trang_thai, f.ngay_dong
      FROM PhanHoi ph
      JOIN Form f ON f.id = ph.form_id
      WHERE ph.id = @id AND ph.form_id = @form_id
    `);
    const current = checkResult.recordset[0];
    if (!current) return res.status(404).json({ message: 'Khong tim thay phan hoi' });
    if (!current.allow_edit_after_submit) return res.status(403).json({ message: 'Bieu mau khong cho phep chinh sua sau khi gui' });

    const closeDate = current.ngay_dong ? new Date(current.ngay_dong) : null;
    if (current.trang_thai !== 'active' || (closeDate && closeDate < new Date())) {
      return res.status(400).json({ message: 'Bieu mau da dong, khong the chinh sua phan hoi' });
    }

    const columns = await getPhanHoiColumns(sql);
    if (form.limit_one_response && !email) {
      return res.status(400).json({ message: 'Email la bat buoc voi bieu mau gioi han 1 lan tra loi' });
    }
    if (form.limit_one_response && email) {
      const duplicateReq = new sql.Request();
      duplicateReq.input('form_id', sql.Int, formId);
      duplicateReq.input('email', sql.NVarChar(150), email);
      const emailChecks = [];
      if (columns.has('email')) emailChecks.push('LOWER(email) = LOWER(@email)');
      if (columns.has('email_nguoi_gui')) emailChecks.push('LOWER(email_nguoi_gui) = LOWER(@email)');
      if (emailChecks.length) {
        const duplicateResult = await duplicateReq.query(`
          SELECT TOP 1 id
          FROM PhanHoi
          WHERE form_id = @form_id
            AND trang_thai != 'deleted'
            AND (${emailChecks.join(' OR ')})
        `);
        if (duplicateResult.recordset[0]) {
          return res.status(409).json({ message: 'Email nay da gui phan hoi cho bieu mau nay' });
        }
      }
    }
    const updateReq = new sql.Request();
    updateReq.input('id', sql.Int, feedbackId);
    const updates = [];
    const addUpdate = (column, param, type, value) => {
      if (!columns.has(column)) return;
      updates.push(`${column} = @${param}`);
      updateReq.input(param, type, value);
    };

    let mappedCamXuc = 'KhÃ´ng rÃµ';
    if (cam_xuc === 'positive' || cam_xuc === 'Tich cuc' || cam_xuc === 'TÃ­ch cá»±c') mappedCamXuc = 'TÃ­ch cá»±c';
    else if (cam_xuc === 'negative' || cam_xuc === 'Tieu cuc' || cam_xuc === 'TiÃªu cá»±c') mappedCamXuc = 'TiÃªu cá»±c';
    else if (cam_xuc === 'neutral' || cam_xuc === 'Trung lap' || cam_xuc === 'Trung láº­p') mappedCamXuc = 'Trung láº­p';
    else if (cam_xuc) mappedCamXuc = cam_xuc;

    addUpdate('ho_ten', 'ho_ten', sql.NVarChar(100), ho_ten || null);
    addUpdate('ho_ten_nguoi_gui', 'ho_ten_nguoi_gui', sql.NVarChar(100), ho_ten || null);
    addUpdate('email', 'email', sql.NVarChar(150), email || null);
    addUpdate('email_nguoi_gui', 'email_nguoi_gui', sql.NVarChar(150), email || null);
    addUpdate('danh_gia', 'danh_gia', sql.Int, danh_gia || null);
    addUpdate('cam_xuc', 'cam_xuc', sql.NVarChar(20), mappedCamXuc);
    addUpdate('noi_dung', 'noi_dung', sql.NVarChar(1000), noi_dung);
    addUpdate('lop', 'lop', sql.NVarChar(50), lop || null);
    addUpdate('khoa', 'khoa', sql.NVarChar(100), khoa || null);
    addUpdate('giao_vien', 'giao_vien', sql.NVarChar(100), giao_vien || null);
    if (columns.has('ngay_cap_nhat')) updates.push('ngay_cap_nhat = GETDATE()');

    if (updates.length) {
      await updateReq.query(`UPDATE PhanHoi SET ${updates.join(', ')} WHERE id = @id`);
    }

    if (Array.isArray(chi_tiet)) {
      await sql.query`DELETE FROM ChiTietPhanHoi WHERE phan_hoi_id = ${feedbackId}`;
      await ensureFeedbackRatingConstraint();
      for (const detail of chi_tiet) {
        const hasRating = detail.diem_danh_gia !== undefined && detail.diem_danh_gia !== null && detail.diem_danh_gia !== '';
        const detailReq = new sql.Request();
        detailReq.input('phan_hoi_id', sql.Int, feedbackId);
        detailReq.input('cau_hoi_id', sql.Int, Number(detail.cau_hoi_id));
        detailReq.input('lua_chon_id', sql.Int, detail.lua_chon_id ? Number(detail.lua_chon_id) : null);
        detailReq.input('diem_danh_gia', sql.Int, hasRating ? Number(detail.diem_danh_gia) : null);
        detailReq.input('noi_dung', sql.NVarChar(1000), detail.noi_dung || null);
        await detailReq.query(`
          INSERT INTO ChiTietPhanHoi (phan_hoi_id, cau_hoi_id, lua_chon_id, diem_danh_gia, cau_tra_loi)
          VALUES (@phan_hoi_id, @cau_hoi_id, @lua_chon_id, @diem_danh_gia, @noi_dung)
        `);
      }
    }

    res.json({ id: feedbackId, message: 'Da cap nhat phan hoi' });
  } catch (err) {
    err500(res, err, 'Loi khi cap nhat phan hoi');
  }
});

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
  console.log('DELETE FEEDBACK PARAMS:', req.params, 'BODY:', req.body);
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
      const logDetail = ly_do_xoa && ly_do_xoa !== 'Không có lý do'
        ? `Đưa phản hồi vào thùng rác (Lý do: ${ly_do_xoa})`
        : 'Đưa phản hồi vào thùng rác';
      await sql.query`
        INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
        VALUES (${nhan_vien_id}, 'delete', 'feedback', ${id}, ${logDetail})
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
             MAX(ph.ly_do_xoa) AS ly_do_xoa,
             CONVERT(varchar(10), ph.ngay_xoa, 120) AS dateKey
      FROM PhanHoi ph
      JOIN Form f ON f.id = ph.form_id
      LEFT JOIN LoaiKhaoSat lks ON f.loai_khao_sat_id = lks.id
      LEFT JOIN NhanVien nx ON ph.nguoi_xoa_id = nx.id
      WHERE ph.trang_thai = 'deleted'
      GROUP BY f.id, f.ten_form, lks.danh_muc, CONVERT(varchar(10), ph.ngay_xoa, 120)
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
  const { ly_do_xoa } = req.body || {};
  if (!validId(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    await sql.query`
      UPDATE PhanHoi 
      SET trang_thai='active', ngay_xoa=NULL, nguoi_xoa_id=NULL, ly_do_xoa=NULL 
      WHERE id=${id} AND trang_thai='deleted'
    `;
    try {
      const logDetail = ly_do_xoa && ly_do_xoa !== 'Không có lý do'
        ? `Khôi phục phản hồi từ thùng rác (Lý do: ${ly_do_xoa})`
        : 'Khôi phục phản hồi từ thùng rác';
      await sql.query`
        INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
        VALUES (${nhan_vien_id}, 'restore', 'feedback', ${id}, ${logDetail})
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
  const { ly_do_xoa } = req.body || {};
  if (!validId(id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    const fbRes = await sql.query`SELECT form_id FROM PhanHoi WHERE id=${id}`;
    const form_id = fbRes.recordset[0] ? fbRes.recordset[0].form_id : null;

    await sql.query`DELETE FROM PhanHoi WHERE id=${id} AND trang_thai='deleted'`;
    try {
      const logDetail = ly_do_xoa && ly_do_xoa !== 'Không có lý do'
        ? `Xóa vĩnh viễn phản hồi khỏi hệ thống (Lý do: ${ly_do_xoa})`
        : 'Xóa vĩnh viễn phản hồi khỏi hệ thống';
      await sql.query`
        INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
        VALUES (${nhan_vien_id}, 'hard_delete', 'form', ${form_id}, ${logDetail})
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
  const { dateKey, ly_do_xoa } = req.body || {};
  if (!validId(form_id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    const request = new sql.Request();
    request.input('form_id', sql.Int, form_id);
    let whereSql = `form_id = @form_id AND trang_thai = 'deleted'`;
    if (dateKey) {
      request.input('dateKey', sql.VarChar, dateKey);
      whereSql +=  ` AND CONVERT(varchar(10), ngay_xoa, 120) = @dateKey`;
    }

    const result = await request.query(`
      UPDATE PhanHoi 
      SET trang_thai='active', ngay_xoa=NULL, nguoi_xoa_id=NULL, ly_do_xoa=NULL 
      WHERE ${whereSql}
    `);
    const count = result.rowsAffected[0] || 0;
    try {
      if (count > 0) {
        const logDetail = ly_do_xoa && ly_do_xoa !== 'Không có lý do'
          ? `Khôi phục ${count} phản hồi của biểu mẫu (Lý do: ${ly_do_xoa})`
          : `Khôi phục ${count} phản hồi của biểu mẫu`;
        await sql.query`
          INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
          VALUES (${nhan_vien_id}, 'restore', 'form', ${form_id}, ${logDetail})
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
  const { dateKey, ly_do_xoa } = req.body || {};
  if (!validId(form_id)) return res.status(400).json({ message: 'ID không hợp lệ' });
  try {
    const request = new sql.Request();
    request.input('form_id', sql.Int, form_id);
    let whereSql = `form_id = @form_id AND trang_thai = 'deleted'`;
    if (dateKey) {
      request.input('dateKey', sql.VarChar, dateKey);
      whereSql +=  ` AND CONVERT(varchar(10), ngay_xoa, 120) = @dateKey`;
    }

    const result = await request.query(`DELETE FROM PhanHoi WHERE ${whereSql}`);
    const count = result.rowsAffected[0] || 0;
    try {
      if (count > 0) {
        const logDetail = ly_do_xoa && ly_do_xoa !== 'Không có lý do'
          ? `Xóa vĩnh viễn ${count} phản hồi của biểu mẫu khỏi hệ thống (Lý do: ${ly_do_xoa})`
          : `Xóa vĩnh viễn ${count} phản hồi của biểu mẫu khỏi hệ thống`;
        await sql.query`
          INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
          VALUES (${nhan_vien_id}, 'hard_delete', 'form', ${form_id}, ${logDetail})
        `;
      }
    } catch (e) { console.error('Lỗi khi lưu nhật ký:', e); }
    res.json({ message: 'Đã xóa vĩnh viễn phản hồi' });
  } catch (err) {
    err500(res, err);
  }
});

module.exports = router;
