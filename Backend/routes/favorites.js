const express = require("express");
const router = express.Router();
const { sql } = require("../config/db");
const { err500 } = require('../utils/helpers');

// GET /api/favorites/:nhan_vien_id - Lấy danh sách yêu thích của nhân viên
router.get("/:nhan_vien_id", async (req, res) => {
  try {
    const result = await sql.query`
      SELECT yc.id, yc.form_id, yc.ngay_tao AS ngay_them,
             f.ten_form, lk.danh_muc, f.trang_thai, f.luot_xem,
             n.ho_ten AS nguoi_tao,
             COUNT(ph.id) AS so_phan_hoi
      FROM YeuThich yc
      JOIN Form f ON f.id = yc.form_id
      LEFT JOIN LoaiKhaoSat lk ON lk.id = f.loai_khao_sat_id
      LEFT JOIN NhanVien n ON n.id = f.nhan_vien_id
      LEFT JOIN PhanHoi ph ON ph.form_id = f.id
      WHERE yc.nhan_vien_id = ${req.params.nhan_vien_id}
      GROUP BY yc.id, yc.form_id, yc.ngay_tao, f.ten_form, lk.danh_muc, f.trang_thai, f.luot_xem, n.ho_ten
      ORDER BY yc.ngay_tao DESC
    `;
    res.json(result.recordset);
  } catch (err) {
    err500(res, err);
  }
});

// POST /api/favorites - Thêm vào yêu thích
router.post("/", async (req, res) => {
  const { nhan_vien_id, form_id } = req.body;
  if (!nhan_vien_id || !form_id)
    return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
  try {
    // Kiểm tra đã tồn tại chưa
    const check = await sql.query`
      SELECT id FROM YeuThich WHERE nhan_vien_id = ${nhan_vien_id} AND form_id = ${form_id}
    `;
    if (check.recordset.length > 0)
      return res.status(409).json({ message: "Biểu mẫu đã được yêu thích" });

    await sql.query`
      INSERT INTO YeuThich (nhan_vien_id, form_id) VALUES (${nhan_vien_id}, ${form_id})
    `;
    res.status(201).json({ message: "Đã thêm vào yêu thích" });
  } catch (err) {
    err500(res, err);
  }
});

// DELETE /api/favorites/:nhan_vien_id/:form_id - Bỏ yêu thích
router.delete("/:nhan_vien_id/:form_id", async (req, res) => {
  try {
    await sql.query`
      DELETE FROM YeuThich
      WHERE nhan_vien_id = ${req.params.nhan_vien_id} AND form_id = ${req.params.form_id}
    `;
    res.json({ message: "Đã bỏ yêu thích" });
  } catch (err) {
    err500(res, err);
  }
});

module.exports = router;
