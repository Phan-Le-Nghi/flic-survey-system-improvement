const express = require("express");
const router = express.Router();
const { sql } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const { err500 } = require('../utils/helpers');

// GET /api/notifications - Lấy danh sách thông báo
router.get("/", authMiddleware, authorize("view_notif"), async (req, res) => {
  try {
    const { status, type, search } = req.query;
    const req2 = new sql.Request();
    let where = "WHERE 1=1";

    if (status) { where += " AND trang_thai = @status"; req2.input("status", sql.NVarChar, status); }
    if (type) { where += " AND loai = @type"; req2.input("type", sql.NVarChar, type); }
    if (search) { where += " AND (tieu_de LIKE @search OR noi_dung LIKE @search)"; req2.input("search", sql.NVarChar, `%${search}%`); }

    const result = await req2.query(`
      SELECT tb.id, tb.tieu_de, tb.noi_dung, tb.loai, tb.trang_thai,
             tb.nguoi_nhan, tb.ngay_tao, tb.ngay_gui,
             tb.luot_da_doc, tb.tong_nguoi_nhan,
             n.ho_ten AS nguoi_gui
      FROM ThongBao tb
      LEFT JOIN NhanVien n ON n.id = tb.nhan_vien_id
      ${where}
      ORDER BY tb.ngay_tao DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    err500(res, err);
  }
});

// GET /api/notifications/stats
router.get("/stats", authMiddleware, authorize("view_notif"), async (req, res) => {
  try {
    const result = await sql.query`
      SELECT
        COUNT(*) AS tong,
        SUM(CASE WHEN trang_thai='sent'      THEN 1 ELSE 0 END) AS da_gui,
        SUM(CASE WHEN trang_thai='scheduled' THEN 1 ELSE 0 END) AS len_lich,
        SUM(CASE WHEN trang_thai='draft'     THEN 1 ELSE 0 END) AS nhap,
        SUM(luot_da_doc) AS tong_luot_doc
      FROM ThongBao
    `;
    res.json(result.recordset[0]);
  } catch (err) {
    err500(res, err);
  }
});

// GET /api/notifications/unread - Thông báo chưa đọc (dùng cho badge)
router.get("/unread", async (req, res) => {
  try {
    const result = await sql.query`
      SELECT TOP 4 id, tieu_de, loai, ngay_tao
      FROM ThongBao
      WHERE trang_thai = 'sent'
      ORDER BY ngay_tao DESC
    `;
    const count = await sql.query`
      SELECT COUNT(*) AS so_chua_doc FROM ThongBao WHERE trang_thai='sent'
    `;
    res.json({ so_chua_doc: count.recordset[0].so_chua_doc, danh_sach: result.recordset });
  } catch (err) {
    err500(res, err);
  }
});

// GET /api/notifications/:id
router.get("/:id", authMiddleware, authorize("view_notif"), async (req, res) => {
  try {
    const result = await sql.query`
      SELECT tb.*, n.ho_ten AS nguoi_gui
      FROM ThongBao tb
      LEFT JOIN NhanVien n ON n.id = tb.nhan_vien_id
      WHERE tb.id = ${req.params.id}
    `;
    if (!result.recordset[0])
      return res.status(404).json({ message: "Không tìm thấy thông báo" });
    res.json(result.recordset[0]);
  } catch (err) {
    err500(res, err);
  }
});

// POST /api/notifications/:id/read - Đánh dấu thông báo đã đọc
router.post("/:id/read", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const nhan_vien_id = req.user.id;
  try {
    const notifRes = await sql.query`SELECT trang_thai, ngay_gui FROM ThongBao WHERE id = ${id}`;
    if (!notifRes.recordset[0]) {
      return res.status(404).json({ message: "Không tìm thấy thông báo" });
    }
    const t = notifRes.recordset[0];
    if (t.trang_thai === 'draft' || (t.trang_thai === 'scheduled' && new Date(t.ngay_gui) > new Date())) {
      return res.status(400).json({ message: "Thông báo chưa được gửi" });
    }

    const result = await sql.query`
      IF NOT EXISTS (SELECT 1 FROM ThongBao_DaDoc WHERE thong_bao_id = ${id} AND nhan_vien_id = ${nhan_vien_id})
      BEGIN
        INSERT INTO ThongBao_DaDoc (thong_bao_id, nhan_vien_id) VALUES (${id}, ${nhan_vien_id});
        UPDATE ThongBao SET luot_da_doc = luot_da_doc + 1 WHERE id = ${id};
      END
    `;
    res.json({ message: "Đã đánh dấu đọc" });
  } catch (err) {
    err500(res, err);
  }
});

// POST /api/notifications - Tạo thông báo
router.post("/", authMiddleware, authorize("send_notif"), async (req, res) => {
  const { tieu_de, noi_dung, loai, nguoi_nhan, trang_thai, ngay_gui, tong_nguoi_nhan, nhan_vien_id } = req.body;
  if (!tieu_de || !noi_dung)
    return res.status(400).json({ message: "Tiêu đề và nội dung là bắt buộc" });

  const finalStatus = trang_thai || "draft";
  const sendDate = finalStatus === "sent" ? new Date() : (ngay_gui ? new Date(ngay_gui) : null);

  try {
    const result = await sql.query`
      INSERT INTO ThongBao (tieu_de, noi_dung, loai, nguoi_nhan, trang_thai, ngay_gui, tong_nguoi_nhan, luot_da_doc, nhan_vien_id)
      OUTPUT INSERTED.id
      VALUES (${tieu_de}, ${noi_dung}, ${loai || 'info'}, ${nguoi_nhan || 'Tất cả'},
              ${finalStatus}, ${sendDate}, ${tong_nguoi_nhan || 0}, 0, ${nhan_vien_id || null})
    `;
    res.status(201).json({ message: "Tạo thông báo thành công", id: result.recordset[0].id });
  } catch (err) {
    err500(res, err);
  }
});

// PATCH /api/notifications/:id/send - Gửi thông báo nháp
router.patch("/:id/send", authMiddleware, authorize("send_notif"), async (req, res) => {
  try {
    await sql.query`
      UPDATE ThongBao SET trang_thai = 'sent', ngay_gui = GETDATE()
      WHERE id = ${req.params.id}
    `;
    res.json({ message: "Đã gửi thông báo" });
  } catch (err) {
    err500(res, err);
  }
});

// PUT /api/notifications/:id - Cập nhật thông báo (chỉ khi còn là draft)
router.put("/:id", authMiddleware, authorize("send_notif"), async (req, res) => {
  const { tieu_de, noi_dung, loai, nguoi_nhan, trang_thai, ngay_gui, tong_nguoi_nhan } = req.body;
  try {
    await sql.query`
      UPDATE ThongBao SET
        tieu_de = ${tieu_de}, noi_dung = ${noi_dung}, loai = ${loai},
        nguoi_nhan = ${nguoi_nhan}, trang_thai = ${trang_thai},
        ngay_gui = ${ngay_gui ? new Date(ngay_gui) : null},
        tong_nguoi_nhan = ${tong_nguoi_nhan || 0}
      WHERE id = ${req.params.id} AND trang_thai = 'draft'
    `;
    res.json({ message: "Cập nhật thành công" });
  } catch (err) {
    err500(res, err);
  }
});

// DELETE /api/notifications/:id
router.delete("/:id", authMiddleware, authorize("send_notif"), async (req, res) => {
  try {
    await sql.query`DELETE FROM ThongBao WHERE id = ${req.params.id}`;
    res.json({ message: "Đã xóa thông báo" });
  } catch (err) {
    err500(res, err);
  }
});

module.exports = router;