const express = require("express");
const router = express.Router();
const { sql } = require("../config/db");
const multer = require("multer");
const XLSX   = require("xlsx");
const { err500, getPhanHoiColumns, optionalField } = require("../utils/helpers");
const { cleanExcel } = require("../utils/cleanExcel");
const authMiddleware = require("../middleware/auth").authMiddleware;
const authorize = require("../middleware/authorize");

async function getDefaultLoaiKhaoSatId() {
  let result = await sql.query`SELECT TOP 1 id FROM LoaiKhaoSat ORDER BY id`;
  if (result.recordset[0]) return result.recordset[0].id;

  result = await sql.query`
    INSERT INTO LoaiKhaoSat (danh_muc, ten_loai, mo_ta, trang_thai)
    OUTPUT INSERTED.id
    VALUES (N'Tin học', N'Import', N'Tạo tự động khi import Excel', 'active')
  `;
  return result.recordset[0].id;
}

const ALLOWED_EXCEL_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = (file.originalname || '').split('.').pop().toLowerCase();
    if (!['xlsx','xls'].includes(ext))
      return cb(Object.assign(new Error('Chỉ hỗ trợ .xlsx hoặc .xls'), { code: 'INVALID_EXT' }));
    if (!ALLOWED_EXCEL_MIMES.has(file.mimetype))
      return cb(Object.assign(new Error('MIME type không hợp lệ'), { code: 'INVALID_MIME' }));
    cb(null, true);
  }
});

// ── API đọc trực tiếp từ database ──────────────────────────────────────

router.get("/overview", authMiddleware, authorize("view_report"), async (req, res) => {
  try {
    const forms    = await sql.query`SELECT COUNT(*) AS tong_form, SUM(CASE WHEN trang_thai='active' THEN 1 ELSE 0 END) AS form_hoat_dong, SUM(luot_xem) AS tong_luot_xem FROM Form`;
    const feedback = await sql.query`SELECT COUNT(*) AS tong_phan_hoi, AVG(CAST(danh_gia AS FLOAT)) AS diem_tb FROM PhanHoi`;
    const staff    = await sql.query`SELECT COUNT(*) AS tong_nhan_vien FROM NhanVien WHERE trang_thai='active'`;
    const pending  = await sql.query`SELECT COUNT(*) AS cho_duyet FROM PheDuyet WHERE trang_thai='pending'`;
    const trends   = await sql.query`
      SELECT
        (SELECT COUNT(*) FROM Form
         WHERE trang_thai != 'deleted'
           AND ngay_tao >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)) AS form_thang_nay,
        (SELECT COUNT(*) FROM Form
         WHERE trang_thai != 'deleted'
           AND ngay_tao >= DATEADD(MONTH, -1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
           AND ngay_tao <  DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)) AS form_thang_truoc,
        (SELECT COUNT(*) FROM PhanHoi
         WHERE ngay_gui >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)) AS phan_hoi_thang_nay,
        (SELECT COUNT(*) FROM PhanHoi
         WHERE ngay_gui >= DATEADD(MONTH, -1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
           AND ngay_gui <  DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)) AS phan_hoi_thang_truoc
    `;
    res.json({
      tong_form:       forms.recordset[0].tong_form,
      form_hoat_dong:  forms.recordset[0].form_hoat_dong,
      tong_luot_xem:   forms.recordset[0].tong_luot_xem,
      tong_phan_hoi:   feedback.recordset[0].tong_phan_hoi,
      diem_trung_binh: feedback.recordset[0].diem_tb,
      tong_nhan_vien:  staff.recordset[0].tong_nhan_vien,
      cho_duyet:       pending.recordset[0].cho_duyet,
      ...trends.recordset[0],
    });
  } catch (err) { err500(res, err); }
});

router.get("/forms-by-week", authMiddleware, authorize("view_report"), async (req, res) => {
  try {
    const result = await sql.query`
      SELECT FORMAT(dates.ngay_tao,'dd/MM') AS ngay, DATENAME(WEEKDAY,dates.ngay_tao) AS ten_ngay,
             COUNT(DISTINCT f.id) AS so_form, COUNT(DISTINCT ph.id) AS so_phan_hoi
      FROM (SELECT DATEADD(DAY,-n,CAST(GETDATE() AS DATE)) AS ngay_tao FROM (VALUES(0),(1),(2),(3),(4),(5),(6)) AS d(n)) AS dates
      LEFT JOIN Form f ON CAST(f.ngay_tao AS DATE)=dates.ngay_tao AND f.trang_thai != 'deleted'
      LEFT JOIN PhanHoi ph ON CAST(ph.ngay_gui AS DATE)=dates.ngay_tao
      GROUP BY dates.ngay_tao ORDER BY dates.ngay_tao`;
    res.json(result.recordset);
  } catch (err) { err500(res, err); }
});

router.get("/top-forms", authMiddleware, authorize("view_report"), async (req, res) => {
  try {
    const result = await sql.query`
      SELECT TOP 5 f.id, f.ten_form, lk.danh_muc,
             COUNT(ph.id) AS so_phan_hoi, AVG(CAST(ph.danh_gia AS FLOAT)) AS diem_tb
      FROM Form f
      LEFT JOIN LoaiKhaoSat lk ON lk.id=f.loai_khao_sat_id
      LEFT JOIN PhanHoi ph ON ph.form_id=f.id
      WHERE f.trang_thai='active'
      GROUP BY f.id,f.ten_form,lk.danh_muc ORDER BY so_phan_hoi DESC`;
    res.json(result.recordset);
  } catch (err) { err500(res, err); }
});

router.get("/feedback-by-month", authMiddleware, authorize("view_report"), async (req, res) => {
  try {
    const result = await sql.query`
      SELECT FORMAT(ngay_gui,'MM/yyyy') AS thang, YEAR(ngay_gui) AS nam, MONTH(ngay_gui) AS so_thang,
             COUNT(*) AS so_luong, AVG(CAST(danh_gia AS FLOAT)) AS diem_tb
      FROM PhanHoi
      WHERE ngay_gui >= DATEADD(MONTH,-5,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))
      GROUP BY FORMAT(ngay_gui,'MM/yyyy'),YEAR(ngay_gui),MONTH(ngay_gui)
      ORDER BY YEAR(ngay_gui),MONTH(ngay_gui)`;
    res.json(result.recordset);
  } catch (err) { err500(res, err); }
});

router.get("/forms-by-category", authMiddleware, authorize("view_report"), async (req, res) => {
  try {
    const result = await sql.query`
      SELECT lk.danh_muc, COUNT(*) AS so_form, SUM(f.luot_xem) AS tong_luot_xem
      FROM Form f
      LEFT JOIN LoaiKhaoSat lk ON lk.id=f.loai_khao_sat_id
      GROUP BY lk.danh_muc
      ORDER BY so_form DESC
    `;
    res.json(result.recordset);
  } catch (err) { err500(res, err); }
});

router.get("/staff-by-department", authMiddleware, authorize("view_report"), async (req, res) => {
  try {
    const result = await sql.query`SELECT phong_ban,COUNT(*) AS so_nhan_vien,SUM(CASE WHEN trang_thai='active' THEN 1 ELSE 0 END) AS hoat_dong FROM NhanVien GROUP BY phong_ban ORDER BY so_nhan_vien DESC`;
    res.json(result.recordset);
  } catch (err) { err500(res, err); }
});

router.get("/approval-summary", authMiddleware, authorize("view_report"), async (req, res) => {
  try {
    const result = await sql.query`
      SELECT COUNT(*) AS tong,
        SUM(CASE WHEN trang_thai='pending'  THEN 1 ELSE 0 END) AS cho_duyet,
        SUM(CASE WHEN trang_thai='approved' THEN 1 ELSE 0 END) AS da_duyet,
        SUM(CASE WHEN trang_thai='rejected' THEN 1 ELSE 0 END) AS tu_choi,
        SUM(CASE WHEN do_uu_tien='high'     THEN 1 ELSE 0 END) AS uu_tien_cao
      FROM PheDuyet`;
    res.json(result.recordset[0]);
  } catch (err) { err500(res, err); }
});

// ── API MỚI: Lấy danh sách form có phản hồi (để chọn phân tích) ──
// GET /api/reports/forms-with-data
router.get("/forms-with-data", authMiddleware, authorize("view_report"), async (req, res) => {
  try {
    const phanHoiColumns = await getPhanHoiColumns(sql);
    const ratingExpr = phanHoiColumns.has("danh_gia") ? "ph.danh_gia" : "NULL";
    const result = await new sql.Request().query(`
      SELECT f.id, f.ten_form, lk.danh_muc, lk.ten_loai AS loai_khao_sat,
             f.doi_tuong, f.mo_ta, f.trang_thai, f.ngay_tao, f.ngay_dong,
             nv.ho_ten AS nguoi_tao,
             COUNT(ph.id)                        AS so_phan_hoi,
             AVG(CAST(${ratingExpr} AS FLOAT))   AS diem_tb,
             MAX(ph.ngay_gui)                    AS phan_hoi_moi_nhat,
             (SELECT COUNT(*) FROM CauHoi WHERE form_id = f.id) AS so_cau_hoi
      FROM Form f
      LEFT JOIN LoaiKhaoSat lk ON lk.id = f.loai_khao_sat_id
      LEFT JOIN NhanVien nv ON nv.id = f.nhan_vien_id
      INNER JOIN PhanHoi ph ON ph.form_id = f.id
      WHERE f.trang_thai != 'deleted'
      GROUP BY f.id, f.ten_form, lk.danh_muc, lk.ten_loai, f.doi_tuong, f.mo_ta,
               f.trang_thai, f.ngay_tao, f.ngay_dong, nv.ho_ten
      HAVING COUNT(ph.id) > 0
      ORDER BY so_phan_hoi DESC
    `);
    res.json(result.recordset);
  } catch (err) { err500(res, err); }
});

// ── API MỚI: Lấy toàn bộ dữ liệu phân tích của 1 form ──
// GET /api/reports/form-analysis/:form_id
router.get("/form-analysis/:form_id", authMiddleware, authorize("view_report"), async (req, res) => {
  const formId = parseInt(req.params.form_id);
  if (isNaN(formId)) return res.status(400).json({ message: "form_id không hợp lệ" });

  try {
    const phanHoiColumns = await getPhanHoiColumns(sql);
    const chiTietColumnsRes = await sql.query`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ChiTietPhanHoi'
    `;
    const chiTietColumns = new Set(chiTietColumnsRes.recordset.map(row => row.COLUMN_NAME));
    const ratingExpr = phanHoiColumns.has("danh_gia") ? "ph.danh_gia" : "NULL";
    const sentimentExpr = phanHoiColumns.has("cam_xuc") ? "ph.cam_xuc" : "NULL";
    const senderNameExpr = phanHoiColumns.has("ho_ten")
      ? "ph.ho_ten"
      : (phanHoiColumns.has("ho_ten_nguoi_gui") ? "ph.ho_ten_nguoi_gui" : "NULL");
    const senderEmailExpr = phanHoiColumns.has("email")
      ? "ph.email"
      : (phanHoiColumns.has("email_nguoi_gui") ? "ph.email_nguoi_gui" : "NULL");
    const contentExpr = phanHoiColumns.has("noi_dung") ? "ph.noi_dung" : "NULL";
    const statusExpr = phanHoiColumns.has("trang_thai") ? "ph.trang_thai" : "NULL";
    const answerExpr = chiTietColumns.has("noi_dung_tra_loi")
      ? "ctph.noi_dung_tra_loi"
      : (chiTietColumns.has("cau_tra_loi") ? "ctph.cau_tra_loi" : "NULL");
    // 1. Thông tin form
    const formRes = await new sql.Request()
      .input("formId", sql.Int, formId)
      .query(`
      SELECT f.id, f.ten_form, lk.danh_muc, lk.ten_loai AS loai_khao_sat,
             f.doi_tuong, f.mo_ta, f.trang_thai, f.luot_xem,
             f.ngay_tao, f.ngay_dong, nv.ho_ten AS nguoi_tao,
             COUNT(ph.id)                    AS so_phan_hoi,
             AVG(CAST(${ratingExpr} AS FLOAT)) AS diem_tb,
             MIN(ph.ngay_gui)                AS ngay_dau,
             MAX(ph.ngay_gui)                AS ngay_cuoi,
             SUM(CASE WHEN ${sentimentExpr}='positive' THEN 1 ELSE 0 END) AS tich_cuc,
             SUM(CASE WHEN ${sentimentExpr}='neutral'  THEN 1 ELSE 0 END) AS trung_tinh,
             SUM(CASE WHEN ${sentimentExpr}='negative' THEN 1 ELSE 0 END) AS tieu_cuc
      FROM Form f
      LEFT JOIN LoaiKhaoSat lk ON lk.id = f.loai_khao_sat_id
      LEFT JOIN NhanVien nv ON nv.id = f.nhan_vien_id
      LEFT JOIN PhanHoi ph ON ph.form_id = f.id
      WHERE f.id = @formId
      GROUP BY f.id,f.ten_form,lk.danh_muc,lk.ten_loai,f.doi_tuong,f.mo_ta,
               f.trang_thai,f.luot_xem,f.ngay_tao,f.ngay_dong,nv.ho_ten
    `);
    if (!formRes.recordset[0]) return res.status(404).json({ message: "Không tìm thấy biểu mẫu" });

    // 2. Phân bổ rating tổng (1-5 sao) — từ PhanHoi.danh_gia
    const ratingRes = phanHoiColumns.has("danh_gia")
      ? await sql.query`
          SELECT danh_gia AS sao, COUNT(*) AS so_luong
          FROM PhanHoi WHERE form_id = ${formId} AND danh_gia IS NOT NULL
          GROUP BY danh_gia ORDER BY danh_gia
        `
      : { recordset: [] };

    // 2b. Phân bổ rating per câu hỏi — từ ChiTietPhanHoi.diem_danh_gia
    const ratingDistByQRes = await sql.query`
      SELECT ctph.cau_hoi_id, ctph.diem_danh_gia AS sao, COUNT(*) AS so_luong
      FROM ChiTietPhanHoi ctph
      INNER JOIN CauHoi ch ON ch.id = ctph.cau_hoi_id
      WHERE ch.form_id = ${formId} AND ctph.diem_danh_gia IS NOT NULL
      GROUP BY ctph.cau_hoi_id, ctph.diem_danh_gia
      ORDER BY ctph.cau_hoi_id, ctph.diem_danh_gia
    `;

    // 3. Phản hồi theo ngày (timeline)
    const timelineRes = await sql.query`
      SELECT CAST(ngay_gui AS DATE) AS ngay, COUNT(*) AS so_luong
      FROM PhanHoi WHERE form_id = ${formId}
      GROUP BY CAST(ngay_gui AS DATE) ORDER BY ngay
    `;

    // 4. Câu hỏi + lựa chọn + thống kê câu trả lời
    const questionsRes = await sql.query`
      SELECT ch.id, ch.noi_dung, ch.loai, ch.thu_tu, ch.bat_buoc,
             ch.mo_ta_cau_hoi, ch.hang_grid, ch.cot_grid
      FROM CauHoi ch WHERE ch.form_id = ${formId} ORDER BY ch.thu_tu
    `;
    const questions = questionsRes.recordset;

    const optionsRes = await sql.query`
      SELECT lc.id, lc.cau_hoi_id, lc.noi_dung, lc.thu_tu
      FROM LuaChon lc
      INNER JOIN CauHoi ch ON ch.id = lc.cau_hoi_id
      WHERE ch.form_id = ${formId}
      ORDER BY lc.cau_hoi_id, lc.thu_tu
    `;
    const optionsByQuestion = {};
    for (const opt of optionsRes.recordset) {
      if (!optionsByQuestion[opt.cau_hoi_id]) optionsByQuestion[opt.cau_hoi_id] = [];
      optionsByQuestion[opt.cau_hoi_id].push(opt);
    }
    questions.forEach(q => { q.lua_chon = optionsByQuestion[q.id] || []; });

    // 5. Với mỗi câu hỏi choice: đếm từng lựa chọn
    const choiceStatsRes = await sql.query`
      SELECT ch.id AS cau_hoi_id, lc.noi_dung AS lua_chon,
             COUNT(ctph.id) AS so_chon
      FROM CauHoi ch
      INNER JOIN LuaChon lc ON lc.cau_hoi_id = ch.id
      LEFT JOIN ChiTietPhanHoi ctph ON ctph.lua_chon_id = lc.id
        AND ctph.cau_hoi_id = ch.id
      WHERE ch.form_id = ${formId}
      GROUP BY ch.id, lc.noi_dung, lc.thu_tu
      ORDER BY ch.id, lc.thu_tu
    `;

    // 6. Với câu hỏi rating: điểm TB
    const ratingStatsRes = await sql.query`
      SELECT ch.id AS cau_hoi_id,
             AVG(CAST(ctph.diem_danh_gia AS FLOAT)) AS diem_tb,
             COUNT(ctph.id) AS so_tra_loi,
             MIN(ctph.diem_danh_gia) AS min_diem,
             MAX(ctph.diem_danh_gia) AS max_diem
      FROM CauHoi ch
      LEFT JOIN ChiTietPhanHoi ctph ON ctph.cau_hoi_id = ch.id
      WHERE ch.form_id = ${formId} AND ch.loai IN ('rating', 'scale')
      GROUP BY ch.id
    `;

    // 7. Trạng thái phản hồi
    const statusRes = phanHoiColumns.has("trang_thai")
      ? await sql.query`
          SELECT trang_thai, COUNT(*) AS so_luong
          FROM PhanHoi WHERE form_id = ${formId}
          GROUP BY trang_thai
        `
      : { recordset: [{ trang_thai: "new", so_luong: formRes.recordset[0].so_phan_hoi || 0 }] };

    // 8. Câu trả lời dạng text + paragraph — kèm tên sinh viên
    const textStatsRes = answerExpr === "NULL"
      ? { recordset: [] }
      : await new sql.Request()
        .input("formId", sql.Int, formId)
        .query(`
        SELECT ch.id AS cau_hoi_id,
               ${answerExpr} AS noi_dung,
               ${senderNameExpr} AS ho_ten,
               ${optionalField(phanHoiColumns, "lop")},
               ${optionalField(phanHoiColumns, "khoa")},
               ${optionalField(phanHoiColumns, "giao_vien")},
               ${ratingExpr} AS danh_gia, ${sentimentExpr} AS cam_xuc
        FROM CauHoi ch
        INNER JOIN ChiTietPhanHoi ctph ON ctph.cau_hoi_id = ch.id
        INNER JOIN PhanHoi ph ON ph.id = ctph.phan_hoi_id
        WHERE ch.form_id = @formId AND ch.loai IN ('short_text', 'long_text', 'text', 'paragraph')
          AND ${answerExpr} IS NOT NULL
          AND LEN(${answerExpr}) > 2
        ORDER BY ch.id
      `);

    const phanHoiRes = await new sql.Request()
      .input("formId", sql.Int, formId)
      .query(`
        SELECT ph.id, ${senderNameExpr} AS ho_ten, ${senderEmailExpr} AS email, ph.ngay_gui,
               ${ratingExpr} AS danh_gia,
               ${contentExpr} AS noi_dung, ${sentimentExpr} AS cam_xuc, ${statusExpr} AS trang_thai,
               ${optionalField(phanHoiColumns, "doi_tuong_nop")},
               ${optionalField(phanHoiColumns, "lop")},
               ${optionalField(phanHoiColumns, "khoa")},
               ${optionalField(phanHoiColumns, "giao_vien")}
        FROM PhanHoi ph
        WHERE ph.form_id = @formId
        ORDER BY ph.ngay_gui
      `);

    const chitietRes = await new sql.Request()
      .input("formId", sql.Int, formId)
      .query(`
        SELECT ctph.phan_hoi_id, ctph.cau_hoi_id,
               ${answerExpr} AS noi_dung,
               ctph.diem_danh_gia,
               lc.noi_dung AS lua_chon_text
        FROM ChiTietPhanHoi ctph
        INNER JOIN CauHoi ch ON ch.id = ctph.cau_hoi_id
        LEFT JOIN LuaChon lc ON lc.id = ctph.lua_chon_id
        WHERE ch.form_id = @formId
        ORDER BY ctph.phan_hoi_id, ctph.cau_hoi_id
      `);

    const answerMap = {};
    for (const ct of chitietRes.recordset) {
      if (!answerMap[ct.phan_hoi_id]) answerMap[ct.phan_hoi_id] = {};
      const prev = answerMap[ct.phan_hoi_id][ct.cau_hoi_id];
      const val = ct.lua_chon_text || ct.noi_dung || (ct.diem_danh_gia != null ? String(ct.diem_danh_gia) : "");
      answerMap[ct.phan_hoi_id][ct.cau_hoi_id] = prev ? prev + "; " + val : val;
    }

    const responses = phanHoiRes.recordset.map(ph => {
      const base = {
        id: ph.id,
        ngay_gui: ph.ngay_gui,
        ho_ten: ph.ho_ten || "",
        email: ph.email || "",
        noi_dung: ph.noi_dung || "",
        cam_xuc: ph.cam_xuc || "",
        trang_thai: ph.trang_thai || "",
        doi_tuong_nop: ph.doi_tuong_nop || "",
        lop: ph.lop || "",
        khoa: ph.khoa || "",
        giao_vien: ph.giao_vien || "",
        danh_gia: ph.danh_gia || "",
      };
      for (const q of questions) {
        base["q_" + q.id] = (answerMap[ph.id] || {})[q.id] || "";
      }
      return base;
    });

    res.json({
      form:                  formRes.recordset[0],
      rating_dist:           ratingRes.recordset,
      rating_dist_by_q:     ratingDistByQRes.recordset,
      timeline:              timelineRes.recordset,
      questions,
      choice_stats:          choiceStatsRes.recordset,
      rating_stats:          ratingStatsRes.recordset,
      status_dist:           statusRes.recordset,
      text_stats:            textStatsRes.recordset,
      responses,
    });

  } catch (err) { err500(res, err); }
});


// GET /api/reports/rating-people/:form_id/:cau_hoi_id/:sao
router.get("/rating-people/:form_id/:cau_hoi_id/:sao", authMiddleware, authorize("view_report"), async (req, res) => {
  const formId   = parseInt(req.params.form_id);
  const cauHoiId = parseInt(req.params.cau_hoi_id);
  const sao      = parseInt(req.params.sao);
  if (isNaN(formId)||isNaN(cauHoiId)||isNaN(sao)) return res.status(400).json({message:'Tham số không hợp lệ'});
  try {
    const result = await sql.query`
      SELECT ph.ho_ten, ph.lop, ph.khoa, ph.giao_vien,
             ctph.diem_danh_gia AS sao,
             ph.danh_gia AS danh_gia_tong
      FROM ChiTietPhanHoi ctph
      INNER JOIN PhanHoi ph ON ph.id = ctph.phan_hoi_id
      INNER JOIN CauHoi ch ON ch.id = ctph.cau_hoi_id
      WHERE ch.form_id = ${formId}
        AND ctph.cau_hoi_id = ${cauHoiId}
        AND ctph.diem_danh_gia = ${sao}
      ORDER BY ph.ho_ten
    `;
    res.json(result.recordset);
  } catch(err) { err500(res, err); }
});
// ── API: Tìm kiếm theo giáo viên ──────────────────────────
// GET /api/reports/teachers-list  — lấy toàn bộ giáo viên có phản hồi
router.get("/teachers-list", authMiddleware, authorize("view_report"), async (req, res) => {
  try {
    const result = await sql.query`
      SELECT DISTINCT ph.giao_vien
      FROM PhanHoi ph
      WHERE ph.giao_vien IS NOT NULL AND ph.giao_vien <> ''
      ORDER BY ph.giao_vien
    `;
    res.json({ teachers: result.recordset.map(r => r.giao_vien) });
  } catch (err) {
    err500(res, err);
  }
});

// GET /api/reports/teacher-search?q=...
router.get("/teacher-search", authMiddleware, authorize("view_report"), async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ teachers: [] });

  try {
    // Danh sách giáo viên khớp tên
    const tvRes = await sql.query`
      SELECT
        ph.giao_vien,
        COUNT(DISTINCT ph.id)               AS so_phan_hoi,
        COUNT(DISTINCT ph.form_id)          AS so_form,
        COUNT(DISTINCT ph.lop)              AS so_lop,
        AVG(CAST(ph.danh_gia AS FLOAT))     AS diem_tb,
        SUM(CASE WHEN ph.cam_xuc='positive' THEN 1 ELSE 0 END) AS tich_cuc,
        SUM(CASE WHEN ph.cam_xuc='negative' THEN 1 ELSE 0 END) AS tieu_cuc,
        (
          SELECT DISTINCT RTRIM(ph2.lop) + ', '
          FROM PhanHoi ph2
          WHERE ph2.giao_vien = ph.giao_vien
            AND ph2.lop IS NOT NULL AND ph2.lop <> ''
          FOR XML PATH('')
        ) AS lop_list
      FROM PhanHoi ph
      WHERE ph.giao_vien IS NOT NULL
        AND ph.giao_vien LIKE ${'%' + q + '%'}
      GROUP BY ph.giao_vien
      ORDER BY so_phan_hoi DESC
    `;

    const teachers = [];
    for (const tv of tvRes.recordset) {
      // Lấy danh sách sinh viên của giáo viên này
      const svRes = await sql.query`
        SELECT TOP 50
          ph.ho_ten, ph.lop, ph.khoa, ph.danh_gia, ph.cam_xuc, ph.noi_dung
        FROM PhanHoi ph
        WHERE ph.giao_vien = ${tv.giao_vien}
        ORDER BY ph.danh_gia DESC, ph.ngay_gui DESC
      `;
      teachers.push({ ...tv, students: svRes.recordset });
    }

    res.json({ teachers });
  } catch (err) {
    err500(res, err);
  }
});


// ── POST /api/reports/import-excel ───────────────────────────────
function uploadExcel(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "File vượt quá 10 MB" : (err.message || "File không hợp lệ");
      return res.status(400).json({ message: msg });
    }
    next();
  });
}

router.post("/import-excel", uploadExcel, authMiddleware, authorize("export_data"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Chưa có file" });

    // Validate magic bytes
    const sig = req.file.buffer.slice(0, 4);
    const isPK   = sig[0]===0x50 && sig[1]===0x4B && sig[2]===0x03 && sig[3]===0x04;
    const isCFBF = sig[0]===0xD0 && sig[1]===0xCF && sig[2]===0x11 && sig[3]===0xE0;
    if (!isPK && !isCFBF)
      return res.status(400).json({ message: "File không phải Excel hợp lệ (.xlsx / .xls)" });

    const rawName = req.file.originalname || "import.xlsx";
    const tenFile = Buffer.from(rawName, "latin1").toString("utf8");
    const tenForm = tenFile.replace(/\.[^/.]+$/, "").trim() || "Form import";

    // Đọc Excel
    const wb   = XLSX.read(req.file.buffer, { type: "buffer" });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (!rows || rows.length < 2)
      return res.status(400).json({ message: "File cần ít nhất 1 dòng tiêu đề + 1 dòng dữ liệu" });

    // Dùng cleanExcel (backend utils) để làm sạch và phân loại cột
    const { headers, rows: dataRows, colTypes, skipped } = cleanExcel(rows);
    if (!headers.length || !dataRows.length)
      return res.status(400).json({ message: "Không đọc được dữ liệu từ file" });

    const nhanVienId = req.user?.id || null;

    // 1. Tạo Form
    const loaiKhaoSatId = await getDefaultLoaiKhaoSatId();
    const insertForm = await sql.query`
      INSERT INTO Form (ten_form, loai_khao_sat_id, trang_thai, nhan_vien_id, luot_xem, ngay_tao)
      OUTPUT INSERTED.id
      VALUES (${tenForm}, ${loaiKhaoSatId}, 'active', ${nhanVienId}, 0, GETDATE())`;
    const formId = insertForm.recordset[0].id;

    // 2. Phân loại cột từ cleanExcel → tạo CauHoi
    const colMeta = headers.map((h, i) => ({ index: i, header: h, loai: colTypes[i] === 'number' ? 'text' : colTypes[i] }));

    // 3. Tạo CauHoi + LuaChon (không insert PhanHoi — data xem trực tiếp từ file)
    for (let qi = 0; qi < colMeta.length; qi++) {
      const { index, header, loai } = colMeta[qi];
      const r = await sql.query`
        INSERT INTO CauHoi (form_id, noi_dung, loai, thu_tu, bat_buoc)
        OUTPUT INSERTED.id VALUES (${formId}, ${header}, ${loai}, ${qi + 1}, 0)`;
      const qId = r.recordset[0].id;

      if (loai === "choice") {
        const uniq = [...new Set(dataRows.map(row => String(row[index] ?? "").trim()).filter(Boolean))].slice(0, 20);
        if (uniq.length) {
          const lcReq = new sql.Request();
          const lcVals = uniq.map((v, j) => {
            lcReq.input(`lc_qid_${j}`, qId);
            lcReq.input(`lc_val_${j}`, v);
            lcReq.input(`lc_ord_${j}`, j + 1);
            return `(@lc_qid_${j},@lc_val_${j},@lc_ord_${j})`;
          });
          await lcReq.query(`INSERT INTO LuaChon (cau_hoi_id,noi_dung,thu_tu) VALUES ${lcVals.join(",")}`);
        }
      }
    }

    res.status(201).json({
      message: "Import thành công — biểu mẫu đã lưu vào Quản lý biểu mẫu",
      form_id: formId, ten_form: tenForm,
      so_cau_hoi: colMeta.length, so_hang: dataRows.length,
      skipped,
      // Data đã clean để frontend render chart ngay, không cần parse lại
      headers, rows: dataRows, colTypes,
    });
  } catch (err) {
    console.error("import-excel error:", err);
    err500(res, err, 'Lỗi server khi import');
  }
});

// ─────────────────────────────────────────────────────────────
//  AI ANALYZE — gọi Gemini, trả kết quả về frontend
// ─────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODELS = [
  'gemini-2.5-flash',
];
function tryParseGeminiJson(rawText) {
  if (!rawText) return null;
  const candidates = [];
  const trimmed = String(rawText).trim();
  candidates.push(trimmed);
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) candidates.push(fenced[1].trim());
  const jsonBlock = trimmed.match(/\{[\s\S]*\}/);
  if (jsonBlock && jsonBlock[0]) candidates.push(jsonBlock[0].trim());
  for (const sample of candidates) {
    try { return JSON.parse(sample); } catch (e) {}
  }
  for (const sample of candidates) {
    const normalized = sample
      .replace(/^\uFEFF/, '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(normalized); } catch (e) {}
  }
  return null;
}

async function generateGeminiText(prompt) {
  let rawText = '';
  let lastErr = '';
  let lastStatus = 500;

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.45,
          maxOutputTokens: 3200
        }
      })
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      lastStatus = geminiRes.status;
      lastErr = err?.error?.message || `HTTP ${geminiRes.status}`;
      console.warn(`Model ${model} failed: ${lastErr}`);
      continue;
    }

    const geminiData = await geminiRes.json();
    const parts = geminiData.candidates?.[0]?.content?.parts || [];
    rawText = parts.map(part => {
      if (typeof part?.text === 'string') return part.text;
      if (part && typeof part === 'object') return JSON.stringify(part);
      return '';
    }).join('').trim();
    console.log(`AI dùng model: ${model}`);
    break;
  }

  if (!rawText) {
    const isQuotaError =
      lastStatus === 429 ||
      /quota|exceeded|rate limit|resource_exhausted/i.test(lastErr || '');
    const error = new Error(
      isQuotaError
        ? `Gemini 2.5 Flash đã hết quota hoặc API key này chưa được cấp quota. ${lastErr}`
        : (lastErr || 'Tất cả model đều thất bại')
    );
    error.status = isQuotaError ? 429 : 502;
    throw error;
  }

  return rawText;
}

router.post("/ai-analyze", authMiddleware, authorize("view_report"), async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ message: 'Chưa cấu hình GEMINI_API_KEY trên server' });
  }

  const { context } = req.body;
  if (!context) return res.status(400).json({ message: 'Thiếu dữ liệu context' });

  const prompt = `Bạn là chuyên gia phân tích dữ liệu khảo sát giáo dục cho FLIC.

Hãy viết bản phân tích CHI TIẾT, ĐỦ Ý, CỤ THỂ cho người quản lý.
Không chào hỏi.
Không mở đầu vòng vo.
Không dùng markdown như ###, ** hoặc ---.
Chỉ dùng tiêu đề thường và gạch đầu dòng khi cần.
Không được dừng quá sớm sau 1-2 đoạn.

Yêu cầu bắt buộc:
1. TÓM TẮT TỔNG QUAN:
- Viết 1 đoạn 4-6 câu.
- Nêu quy mô dữ liệu, mức độ hài lòng chung, và mức độ tin cậy của kết luận.

2. ĐIỂM ĐÁNG CHÚ Ý:
- Viết ít nhất 6 ý.
- Mỗi ý phải gắn với số liệu, xu hướng, hoặc dấu hiệu cụ thể nếu dữ liệu có.
- Nếu dữ liệu ít, phải nói rõ vì sao điều đó ảnh hưởng đến kết luận.

3. VẤN ĐỀ CẦN CẢI THIỆN:
- Viết ít nhất 4 ý.
- Mỗi ý nêu rõ tác động thực tế đến vận hành, trải nghiệm học viên, hoặc chất lượng khảo sát.

4. ĐỀ XUẤT HÀNH ĐỘNG:
- Viết ít nhất 6 đề xuất cụ thể.
- Ưu tiên các đề xuất có thể làm ngay, đo được, và phù hợp với trung tâm đào tạo.

5. NHẬN ĐỊNH CUỐI:
- Viết 1 đoạn 3-5 câu.
- Chốt lại mức độ ưu tiên xử lý và hướng hành động tổng thể.

Ưu tiên tối đa việc bám sát số liệu trong dữ liệu đầu vào.
Nếu dữ liệu còn ít hoặc chưa đủ mạnh để kết luận chắc chắn, hãy nói rõ mức độ tin cậy nhưng vẫn đưa ra đánh giá hữu ích nhất có thể.
Độ dài mong muốn: khoảng 700 đến 1200 từ.

DỮ LIỆU:
${context}`;

  try {
    const analysis = await generateGeminiText(prompt);
    return res.json({ analysis });
  } catch (err) {
    console.error('ai-analyze error:', err);
    res.status(err.status || 500).json({ message: err.message || ('Lỗi server: ' + err.message) });
  }
});

router.post("/ai-chat", authMiddleware, authorize("view_report"), async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ message: 'Chưa cấu hình GEMINI_API_KEY trên server' });
  }

  const { context, question, history } = req.body || {};
  if (!context) return res.status(400).json({ message: 'Thiếu dữ liệu context' });
  if (!question || !String(question).trim()) return res.status(400).json({ message: 'Thiếu câu hỏi cho bot' });

  const historyText = Array.isArray(history)
    ? history.slice(-8).map(item => `${item.role === 'user' ? 'Người dùng' : 'Bot'}: ${item.text || ''}`).join('\n')
    : '';

  const prompt = `Bạn là trợ lý AI cho báo cáo khảo sát của FLIC.
Hãy trả lời bằng tiếng Việt, rõ ràng, cụ thể và hữu ích.
Trả lời trực tiếp câu hỏi, không chào hỏi dài dòng.
Ưu tiên bám vào dữ liệu báo cáo hiện có. Nếu dữ liệu không đủ để khẳng định, hãy nói rõ.

NGỮ CẢNH BÁO CÁO:
${context}

LỊCH SỬ TRAO ĐỔI:
${historyText || 'Chưa có'}

CÂU HỎI MỚI:
${String(question).trim()}`;

  try {
    const answer = await generateGeminiText(prompt);
    res.json({ answer });
  } catch (err) {
    console.error('ai-chat error:', err);
    res.status(err.status || 500).json({ message: err.message || ('Lỗi server: ' + err.message) });
  }
});


// GET /api/reports/export/:form_id — Xuất toàn bộ phản hồi + câu trả lời theo từng câu hỏi
router.get("/export/:form_id", authMiddleware, authorize("export_data"), async (req, res) => {
  const formId = parseInt(req.params.form_id);
  if (isNaN(formId)) return res.status(400).json({ message: "form_id không hợp lệ" });

  try {
    const phanHoiColumns = await getPhanHoiColumns(sql);
    const chiTietColumnsRes = await sql.query`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ChiTietPhanHoi'
    `;
    const chiTietColumns = new Set(chiTietColumnsRes.recordset.map(row => row.COLUMN_NAME));
    const senderNameExpr = phanHoiColumns.has("ho_ten")
      ? "ph.ho_ten"
      : (phanHoiColumns.has("ho_ten_nguoi_gui") ? "ph.ho_ten_nguoi_gui" : "NULL");
    const senderEmailExpr = phanHoiColumns.has("email")
      ? "ph.email"
      : (phanHoiColumns.has("email_nguoi_gui") ? "ph.email_nguoi_gui" : "NULL");
    const ratingExpr = phanHoiColumns.has("danh_gia") ? "ph.danh_gia" : "NULL";
    const contentExpr = phanHoiColumns.has("noi_dung") ? "ph.noi_dung" : "NULL";
    const sentimentExpr = phanHoiColumns.has("cam_xuc") ? "ph.cam_xuc" : "NULL";
    const statusExpr = phanHoiColumns.has("trang_thai") ? "ph.trang_thai" : "NULL";
    const answerExpr = chiTietColumns.has("noi_dung_tra_loi")
      ? "ctph.noi_dung_tra_loi"
      : (chiTietColumns.has("cau_tra_loi") ? "ctph.cau_tra_loi" : "NULL");

    // 1. Lấy danh sách câu hỏi
    const questionsRes = await sql.query`
      SELECT id, noi_dung, loai, thu_tu
      FROM CauHoi WHERE form_id = ${formId} ORDER BY thu_tu
    `;
    const questions = questionsRes.recordset;

    // 2. Lấy tất cả phản hồi
    const phanHoiRes = await new sql.Request()
      .input("formId", sql.Int, formId)
      .query(`
        SELECT ph.id, ${senderNameExpr} AS ho_ten, ${senderEmailExpr} AS email, ph.ngay_gui,
               ${ratingExpr} AS danh_gia,
               ${contentExpr} AS noi_dung, ${sentimentExpr} AS cam_xuc, ${statusExpr} AS trang_thai,
               ${optionalField(phanHoiColumns, "lop")},
               ${optionalField(phanHoiColumns, "khoa")},
               ${optionalField(phanHoiColumns, "giao_vien")}
        FROM PhanHoi ph
        WHERE ph.form_id = @formId
        ORDER BY ph.ngay_gui
      `);

    // 3. Lấy tất cả chi tiết phản hồi (câu trả lời từng câu hỏi)
    const chitietRes = await new sql.Request()
      .input("formId", sql.Int, formId)
      .query(`
        SELECT ctph.phan_hoi_id, ctph.cau_hoi_id,
               ${answerExpr} AS noi_dung,
               ctph.diem_danh_gia,
               lc.noi_dung AS lua_chon_text
        FROM ChiTietPhanHoi ctph
        INNER JOIN CauHoi ch ON ch.id = ctph.cau_hoi_id
        LEFT JOIN LuaChon lc ON lc.id = ctph.lua_chon_id
        WHERE ch.form_id = @formId
        ORDER BY ctph.phan_hoi_id, ctph.cau_hoi_id
      `);

    // 4. Gom câu trả lời theo phan_hoi_id → cau_hoi_id
    const answerMap = {}; // { phan_hoi_id: { cau_hoi_id: answer_text } }
    for (const ct of chitietRes.recordset) {
      if (!answerMap[ct.phan_hoi_id]) answerMap[ct.phan_hoi_id] = {};
      const prev = answerMap[ct.phan_hoi_id][ct.cau_hoi_id];
      const val  = ct.lua_chon_text || ct.noi_dung || (ct.diem_danh_gia != null ? String(ct.diem_danh_gia) : '');
      // Nhiều lựa chọn (checkbox) → nối bằng "; "
      answerMap[ct.phan_hoi_id][ct.cau_hoi_id] = prev ? prev + '; ' + val : val;
    }

    // 5. Build rows
    const rows = phanHoiRes.recordset.map(ph => {
      const base = {
        ngay_gui:   ph.ngay_gui,
        id:         ph.id,
        ho_ten:     ph.ho_ten     || '',
        email:      ph.email      || '',
        noi_dung:   ph.noi_dung   || '',
        cam_xuc:    ph.cam_xuc    || '',
        trang_thai: ph.trang_thai || '',
        lop:        ph.lop        || '',
        khoa:       ph.khoa       || '',
        giao_vien:  ph.giao_vien  || '',
        danh_gia:   ph.danh_gia   || '',
      };
      const answers = {};
      for (const q of questions) {
        answers['q_' + q.id] = (answerMap[ph.id] || {})[q.id] || '';
      }
      return { ...base, ...answers };
    });

    res.json({ questions, rows });
  } catch (err) { err500(res, err); }
});

module.exports = router;
