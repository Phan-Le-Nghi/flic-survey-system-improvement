const express = require("express");
const router = express.Router();
const { sql } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const { err500 } = require('../utils/helpers');

async function getFormWithQuestions(formId, publicOnly = false) {
  const id = Number(formId);
  const reqForm = new sql.Request();
  reqForm.input("id", sql.Int, id);

  const formResult = await reqForm.query(`
    SELECT f.*, n.ho_ten AS nguoi_tao
    FROM Form f
    LEFT JOIN NhanVien n ON n.id = f.nhan_vien_id
    WHERE f.id = @id ${publicOnly ? "AND f.trang_thai <> 'deleted'" : ""}
  `);
  const formRow = formResult.recordset[0];
  if (!formRow) return null;

  const reqQuestions = new sql.Request();
  reqQuestions.input("id", sql.Int, id);
  const qResult = await reqQuestions.query(`
    SELECT * FROM CauHoi WHERE form_id = @id ORDER BY thu_tu
  `);

  const reqOptions = new sql.Request();
  reqOptions.input("id", sql.Int, id);
  const opResult = await reqOptions.query(`
    SELECT * FROM LuaChon
    WHERE cau_hoi_id IN (SELECT id FROM CauHoi WHERE form_id = @id)
    ORDER BY thu_tu
  `);

  const questions = qResult.recordset.map(q => ({
    ...q,
    lua_chon: opResult.recordset.filter(o => o.cau_hoi_id === q.id)
  }));

  let loi_ket = formRow.loi_ket || '';
  let mo_ta = formRow.mo_ta || '';
  if (!loi_ket && mo_ta.startsWith('__LOI_KET__')) {
    loi_ket = mo_ta.slice('__LOI_KET__'.length);
    mo_ta = '';
  }

  return { ...formRow, mo_ta, loi_ket, cau_hoi: questions };
}

// GET /api/forms - Lấy danh sách form
router.get("/", authMiddleware, authorize("view_form"), async (req, res) => {
  try {
    const { status, cat, search } = req.query;
    let query = `
      SELECT f.id, f.ten_form, f.danh_muc, f.trang_thai,
             f.ngay_tao, f.ngay_cap_nhat,
             n.ho_ten AS nguoi_tao, n.vai_tro,
             COUNT(DISTINCT p.id) AS so_phan_hoi,
             f.luot_xem, f.loi_ket
      FROM Form f
      LEFT JOIN NhanVien n ON n.id = f.nhan_vien_id
      LEFT JOIN PhanHoi p ON p.form_id = f.id
      WHERE f.trang_thai != 'deleted'
    `;
    const params = {};

    if (status) { query += ` AND f.trang_thai = @status`; params.status = status; }
    if (cat)    { query += ` AND f.danh_muc = @cat`; params.cat = cat; }
    if (search) { query += ` AND f.ten_form LIKE @search`; params.search = `%${search}%`; }

    query += ` GROUP BY f.id, f.ten_form, f.danh_muc, f.trang_thai, f.ngay_tao, f.ngay_cap_nhat, n.ho_ten, n.vai_tro, f.luot_xem, f.loi_ket ORDER BY f.ngay_tao DESC`;

    const req2 = new sql.Request();
    if (params.status) req2.input("status", sql.NVarChar, params.status);
    if (params.cat)    req2.input("cat",    sql.NVarChar, params.cat);
    if (params.search) req2.input("search", sql.NVarChar, params.search);

    const result = await req2.query(query);
    res.json(result.recordset);
  } catch (err) {
    err500(res, err);
  }
});

// GET /api/forms/stats - Thống kê nhanh
router.get("/stats", authMiddleware, authorize("view_form"), async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        COUNT(*) AS tong_form,
        SUM(CASE WHEN trang_thai='active'   THEN 1 ELSE 0 END) AS hoat_dong,
        SUM(CASE WHEN trang_thai='draft'    THEN 1 ELSE 0 END) AS nhap,
        SUM(CASE WHEN trang_thai='archived' THEN 1 ELSE 0 END) AS luu_tru,
        SUM(luot_xem) AS tong_luot_xem
      FROM Form
    `;
    const ph = await sql.query`SELECT COUNT(*) AS tong_phan_hoi FROM PhanHoi`;
    res.json({ ...result.recordset[0], tong_phan_hoi: ph.recordset[0].tong_phan_hoi });
  } catch (err) {
    err500(res, err);
  }
});

// GET /api/forms/:id - Lấy 1 form kèm câu hỏi
// GET /api/forms/public/:id - mo form cong khai/preview, khong can dang nhap
router.get("/public/:id", async (req, res) => {
  const formId = Number(req.params.id);
  if (!Number.isInteger(formId) || formId <= 0) {
    return res.status(400).json({ message: "form_id không hợp lệ" });
  }

  try {
    const form = await getFormWithQuestions(formId, true);
    if (!form) return res.status(404).json({ message: "Không tìm thấy form" });

    await sql.query`UPDATE Form SET luot_xem = ISNULL(luot_xem, 0) + 1 WHERE id = ${formId}`;
    res.json(form);
  } catch (err) {
    err500(res, err);
  }
});

router.get("/:id", authMiddleware, authorize("view_form"), async (req, res) => {
  try {
    const formResult = await sql.query`
      SELECT f.*, n.ho_ten AS nguoi_tao
      FROM Form f
      LEFT JOIN NhanVien n ON n.id = f.nhan_vien_id
      WHERE f.id = ${req.params.id}
    `;
    if (!formResult.recordset[0])
      return res.status(404).json({ message: "Không tìm thấy form" });

    const qResult = await sql.query`
      SELECT * FROM CauHoi WHERE form_id = ${req.params.id} ORDER BY thu_tu
    `;
    const opResult = await sql.query`
      SELECT * FROM LuaChon
      WHERE cau_hoi_id IN (SELECT id FROM CauHoi WHERE form_id = ${req.params.id})
      ORDER BY thu_tu
    `;

    const questions = qResult.recordset.map(q => ({
      ...q,
      lua_chon: opResult.recordset.filter(o => o.cau_hoi_id === q.id)
    }));

    const formRow = formResult.recordset[0];
    // Đọc loi_ket từ cột riêng (sau khi ALTER TABLE thêm cột)
    // Fallback: nếu cột chưa có, parse từ mo_ta cũ (backward compat)
    let loi_ket = formRow.loi_ket || '';
    let mo_ta = formRow.mo_ta || '';
    if (!loi_ket && mo_ta.startsWith('__LOI_KET__')) {
      loi_ket = mo_ta.slice('__LOI_KET__'.length);
      mo_ta = '';
    }

    res.json({ ...formRow, mo_ta, loi_ket, cau_hoi: questions });
  } catch (err) {
    err500(res, err);
  }
});

// POST /api/forms - Tạo form mới
router.post("/", authMiddleware, authorize("add_form"), async (req, res) => {
  const { ten_form, danh_muc, trang_thai, nhan_vien_id, cau_hoi, loi_ket } = req.body;
  if (!ten_form) return res.status(400).json({ message: "Tên form là bắt buộc" });

  try {
    const insertForm = await sql.query`
      INSERT INTO Form (ten_form, danh_muc, loi_ket, trang_thai, nhan_vien_id, luot_xem)
      OUTPUT INSERTED.id
      VALUES (${ten_form}, ${danh_muc || 'Khác'}, ${loi_ket || null}, ${trang_thai || 'draft'}, ${nhan_vien_id || null}, 0)
    `;
    const formId = insertForm.recordset[0].id;

    if (cau_hoi && Array.isArray(cau_hoi)) {
      for (let i = 0; i < cau_hoi.length; i++) {
        const q = cau_hoi[i];
        const insertQ = await sql.query`
          INSERT INTO CauHoi (form_id, thu_vien_id, noi_dung, loai, thu_tu, bat_buoc)
          OUTPUT INSERTED.id
          VALUES (${formId}, ${q.thu_vien_id || null}, ${q.noi_dung}, ${q.loai || 'choice'}, ${i + 1}, ${q.bat_buoc ? 1 : 0})
        `;
        const qId = insertQ.recordset[0].id;
        if (q.lua_chon && Array.isArray(q.lua_chon)) {
          for (let j = 0; j < q.lua_chon.length; j++) {
            await sql.query`
              INSERT INTO LuaChon (cau_hoi_id, noi_dung, thu_tu)
              VALUES (${qId}, ${q.lua_chon[j]}, ${j + 1})
            `;
          }
        }
      }
    }

    res.status(201).json({ message: "Tạo form thành công", id: formId });
  } catch (err) {
    err500(res, err);
  }
});

// PUT /api/forms/:id - Cập nhật form (bao gồm câu hỏi)
router.put("/:id", authMiddleware, authorize("edit_form"), async (req, res) => {
  const { ten_form, danh_muc, trang_thai, cau_hoi } = req.body;
  const formId = req.params.id;
  try {
    const { loi_ket: loi_ket_update } = req.body;
    await sql.query`
      UPDATE Form SET
        ten_form = ${ten_form}, danh_muc = ${danh_muc},
        trang_thai = ${trang_thai},
        loi_ket = ${loi_ket_update || null},
        ngay_cap_nhat = GETDATE()
      WHERE id = ${formId}
    `;

    // Nếu có cập nhật câu hỏi
    if (cau_hoi && Array.isArray(cau_hoi)) {
      // Lấy danh sách câu hỏi hiện tại
      const existingQ = await sql.query`SELECT id FROM CauHoi WHERE form_id = ${formId}`;
      const existingIds = existingQ.recordset.map(q => q.id);
      const incomingIds = cau_hoi.filter(q => q.id && !String(q.id).startsWith('new_')).map(q => q.id);

      // Xóa câu hỏi bị bỏ ra
      for (const oldId of existingIds) {
        if (!incomingIds.includes(oldId)) {
          await sql.query`DELETE FROM LuaChon WHERE cau_hoi_id = ${oldId}`;
          await sql.query`DELETE FROM CauHoi WHERE id = ${oldId}`;
        }
      }

      for (let i = 0; i < cau_hoi.length; i++) {
        const q = cau_hoi[i];
        if (q.id && !String(q.id).startsWith('new_') && existingIds.includes(q.id)) {
          // Cập nhật câu hỏi đã tồn tại
          await sql.query`
            UPDATE CauHoi SET
              noi_dung = ${q.noi_dung}, loai = ${q.loai || 'choice'},
              thu_tu = ${i + 1}, bat_buoc = ${q.bat_buoc ? 1 : 0}
            WHERE id = ${q.id}
          `;
          // Cập nhật lựa chọn: xóa cũ, insert mới
          await sql.query`DELETE FROM LuaChon WHERE cau_hoi_id = ${q.id}`;
          if (q.lua_chon && Array.isArray(q.lua_chon)) {
            for (let j = 0; j < q.lua_chon.length; j++) {
              const opt = typeof q.lua_chon[j] === 'string' ? q.lua_chon[j] : q.lua_chon[j].noi_dung;
              await sql.query`INSERT INTO LuaChon (cau_hoi_id, noi_dung, thu_tu) VALUES (${q.id}, ${opt}, ${j + 1})`;
            }
          }
        } else {
          // Thêm câu hỏi mới
          const insertQ = await sql.query`
            INSERT INTO CauHoi (form_id, thu_vien_id, noi_dung, loai, thu_tu, bat_buoc)
            OUTPUT INSERTED.id
            VALUES (${formId}, ${q.thu_vien_id || null}, ${q.noi_dung}, ${q.loai || 'choice'}, ${i + 1}, ${q.bat_buoc ? 1 : 0})
          `;
          const newQId = insertQ.recordset[0].id;
          if (q.lua_chon && Array.isArray(q.lua_chon)) {
            for (let j = 0; j < q.lua_chon.length; j++) {
              const opt = typeof q.lua_chon[j] === 'string' ? q.lua_chon[j] : q.lua_chon[j].noi_dung;
              await sql.query`INSERT INTO LuaChon (cau_hoi_id, noi_dung, thu_tu) VALUES (${newQId}, ${opt}, ${j + 1})`;
            }
          }
        }
      }
    }

    res.json({ message: "Cập nhật form thành công" });
  } catch (err) {
    err500(res, err);
  }
});

// PATCH /api/forms/:id/status - Đổi trạng thái
router.patch("/:id/status", authMiddleware, authorize("edit_form"), async (req, res) => {
  const { trang_thai } = req.body;
  const allowed = ["active", "draft", "pending", "archived", "rejected"];
  if (!allowed.includes(trang_thai))
    return res.status(400).json({ message: "Trạng thái không hợp lệ" });
  try {
    await sql.query`
      UPDATE Form SET trang_thai = ${trang_thai}, ngay_cap_nhat = GETDATE()
      WHERE id = ${req.params.id}
    `;
    res.json({ message: "Đổi trạng thái thành công" });
  } catch (err) {
    err500(res, err);
  }
});

// DELETE /api/forms/:id - Soft delete (chuyển vào thùng rác)
router.delete("/:id", authMiddleware, authorize("delete_form"), async (req, res) => {
  try {
    const formRes = await sql.query`SELECT id FROM Form WHERE id = ${req.params.id} AND trang_thai != 'deleted'`;
    if (!formRes.recordset[0]) return res.status(404).json({ message: "Không tìm thấy form" });
    await sql.query`UPDATE Form SET trang_thai = 'deleted', ngay_cap_nhat = GETDATE() WHERE id = ${req.params.id}`;
    res.json({ message: "Đã chuyển form vào thùng rác" });
  } catch (err) { err500(res, err); }
});

// GET /api/forms/trash/list - Lấy danh sách thùng rác
router.get("/trash/list", authMiddleware, authorize("delete_form"), async (req, res) => {
  try {
    const result = await sql.query`
      SELECT f.id, f.ten_form, f.danh_muc, f.ngay_cap_nhat AS deleted_at,
             n.ho_ten AS nguoi_tao
      FROM Form f
      LEFT JOIN NhanVien n ON n.id = f.nhan_vien_id
      WHERE f.trang_thai = 'deleted'
      ORDER BY f.ngay_cap_nhat DESC
    `;
    res.json(result.recordset);
  } catch (err) { err500(res, err); }
});

// PATCH /api/forms/:id/restore - Khôi phục form từ thùng rác
router.patch("/:id/restore", authMiddleware, authorize("delete_form"), async (req, res) => {
  try {
    const formRes = await sql.query`SELECT id FROM Form WHERE id = ${req.params.id} AND trang_thai = 'deleted'`;
    if (!formRes.recordset[0]) return res.status(404).json({ message: "Không tìm thấy form trong thùng rác" });
    await sql.query`UPDATE Form SET trang_thai = 'draft', ngay_cap_nhat = GETDATE() WHERE id = ${req.params.id}`;
    res.json({ message: "Đã khôi phục form" });
  } catch (err) { err500(res, err); }
});

// DELETE /api/forms/:id/permanent - Xóa vĩnh viễn
router.delete("/:id/permanent", authMiddleware, authorize("delete_form"), async (req, res) => {
  try {
    await sql.query`DELETE FROM Form WHERE id = ${req.params.id} AND trang_thai = 'deleted'`;
    res.json({ message: "Đã xóa vĩnh viễn" });
  } catch (err) { err500(res, err); }
});

module.exports = router;
