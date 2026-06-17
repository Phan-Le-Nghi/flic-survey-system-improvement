const express = require("express");
const router = express.Router();
const { sql } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const { err500 } = require('../utils/helpers');

async function getTableColumns(tableName) {
  const req = new sql.Request();
  req.input("tableName", sql.NVarChar, tableName);
  const result = await req.query(`
    SELECT c.name AS COLUMN_NAME
    FROM sys.columns c
    INNER JOIN sys.objects o ON o.object_id = c.object_id
    INNER JOIN sys.schemas s ON s.schema_id = o.schema_id
    WHERE o.type = 'U'
      AND o.name = @tableName
      AND s.name = 'dbo'
  `);
  return new Set(result.recordset.map(row => row.COLUMN_NAME));
}

async function getFormCategorySql(formColumns) {
  const hasLoaiKhaoSat = formColumns.has("loai_khao_sat_id");
  if (!hasLoaiKhaoSat) {
    return { select: "N'Khac'", join: "" };
  }

  const loaiColumns = await getTableColumns("LoaiKhaoSat");
  const categoryColumn = loaiColumns.has("danh_muc") ? "danh_muc" : "ten_loai";

  return {
    select: categoryColumn ? `lk.${categoryColumn}` : "N'Khac'",
    join: "LEFT JOIN LoaiKhaoSat lk ON lk.id = f.loai_khao_sat_id"
  };
}

async function getLoaiKhaoSatId(danhMuc, tenLoai) {
  const NGOAI_NGU = "Ngo\u1ea1i ng\u1eef";
  const TIN_HOC = "Tin h\u1ecdc";
  const normalized = String(danhMuc || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const category = normalized.includes("tin hoc") ? TIN_HOC : NGOAI_NGU;
  const surveyType = String(tenLoai || "").trim() || category;
  const columns = await getTableColumns("LoaiKhaoSat");

  const lookupReq = new sql.Request();
  lookupReq.input("category", sql.NVarChar, category);
  lookupReq.input("surveyType", sql.NVarChar, surveyType);
  const conditions = [];
  if (columns.has("danh_muc")) conditions.push("danh_muc = @category");
  if (columns.has("ten_loai")) conditions.push("ten_loai = @surveyType");
  let result = await lookupReq.query(`
    SELECT TOP 1 id
    FROM LoaiKhaoSat
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY id
  `);
  if (result.recordset[0]) return result.recordset[0].id;

  if (columns.has("ten_loai")) {
    const fallbackReq = new sql.Request();
    fallbackReq.input("surveyType", sql.NVarChar, surveyType);
    result = await fallbackReq.query(`
      SELECT TOP 1 id
      FROM LoaiKhaoSat
      WHERE ten_loai = @surveyType
      ORDER BY id
    `);
    if (result.recordset[0]) return result.recordset[0].id;
  }

  const fields = [];
  const values = [];
  const insertReq = new sql.Request();
  insertReq.input("category", sql.NVarChar, category);
  insertReq.input("surveyType", sql.NVarChar, surveyType);
  insertReq.input("mo_ta", sql.NVarChar, "Tạo tự động khi thêm biểu mẫu");
  insertReq.input("trang_thai", sql.NVarChar, "active");

  if (columns.has("danh_muc")) {
    fields.push("danh_muc");
    values.push("@category");
  }
  if (columns.has("ten_loai")) {
    fields.push("ten_loai");
    values.push("@surveyType");
  }
  if (columns.has("mo_ta")) {
    fields.push("mo_ta");
    values.push("@mo_ta");
  }
  if (columns.has("trang_thai")) {
    fields.push("trang_thai");
    values.push("@trang_thai");
  }

  result = await insertReq.query(`
    INSERT INTO LoaiKhaoSat (${fields.join(", ")})
    OUTPUT INSERTED.id
    VALUES (${values.join(", ")})
  `);
  return result.recordset[0].id;

  result = await sql.query`
    INSERT INTO LoaiKhaoSat (danh_muc, ten_loai, mo_ta, trang_thai)
    OUTPUT INSERTED.id
    VALUES (${category}, ${category}, N'Tạo tự động khi thêm biểu mẫu', 'active')
  `;
  return result.recordset[0].id;
}

function normalizeQuestionType(type) {
  const value = String(type || "choice");
  if (value === "text") return "short_text";
  if (value === "radio") return "choice";
  if (value === "grid") return "grid_radio";
  return value;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeStatus(status) {
  const value = String(status || "draft");
  if (value === "archived") return "closed";
  return value;
}

function normalizeFormTarget(value) {
  const target = String(value || "").trim();
  if (!target || target === "Tất cả") return "Tất cả";
  if (target === "Người đi làm") return "Người đi làm";
  if (target.includes("Sinh viên")) return "Sinh viên";
  return "Tất cả";
}

function normalizeCloseDate(value) {
  if (!value) return null;
  const closeDate = new Date(value);
  if (Number.isNaN(closeDate.getTime())) return null;
  closeDate.setHours(23, 59, 59, 999);
  return closeDate;
}

async function resolveNhanVienId(id) {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) return null;
  const req = new sql.Request();
  req.input("id", sql.Int, parsedId);
  const result = await req.query("SELECT TOP 1 id FROM NhanVien WHERE id = @id");
  return result.recordset[0] ? parsedId : null;
}

async function resolveCollaboratorNhanVienId(value) {
  const keyword = String(value || "").trim();
  if (!keyword) return null;

  const parsedId = Number(keyword);
  if (Number.isInteger(parsedId) && parsedId > 0) {
    const byId = await resolveNhanVienId(parsedId);
    if (byId) return byId;
  }

  const req = new sql.Request();
  req.input("keyword", sql.NVarChar, keyword);
  const result = await req.query(`
    SELECT TOP 1 id
    FROM NhanVien
    WHERE email = @keyword
       OR ten_dang_nhap = @keyword
       OR ho_ten = @keyword
    ORDER BY CASE WHEN email = @keyword THEN 0 WHEN ten_dang_nhap = @keyword THEN 1 ELSE 2 END, id
  `);
  return result.recordset[0]?.id || null;
}

async function saveFormCollaborators(formId, collaborators) {
  if (!Array.isArray(collaborators)) return;

  const tableColumns = await getTableColumns("Form_CongTac");
  if (!tableColumns.has("form_id") || !tableColumns.has("nhan_vien_id")) return;

  const seen = new Set();
  for (const item of collaborators) {
    const rawValue = typeof item === "string" ? item : (item?.value || item?.email || item?.ten_dang_nhap || item?.ho_ten);
    const nhanVienId = await resolveCollaboratorNhanVienId(rawValue);
    if (!nhanVienId || seen.has(nhanVienId)) continue;
    seen.add(nhanVienId);

    const role = String(item?.role || item?.quyen || "editor").toLowerCase() === "viewer" ? "viewer" : "editor";
    const req = new sql.Request();
    req.input("form_id", sql.Int, Number(formId));
    req.input("nhan_vien_id", sql.Int, Number(nhanVienId));
    req.input("quyen", sql.NVarChar, role);
    req.input("can_share", sql.Bit, role === "editor" ? 1 : 0);
    await req.query(`
      MERGE Form_CongTac AS target
      USING (SELECT @form_id AS form_id, @nhan_vien_id AS nhan_vien_id) AS source
        ON target.form_id = source.form_id AND target.nhan_vien_id = source.nhan_vien_id
      WHEN MATCHED THEN
        UPDATE SET quyen = @quyen, can_share = @can_share
      WHEN NOT MATCHED THEN
        INSERT (form_id, nhan_vien_id, quyen, can_share)
        VALUES (@form_id, @nhan_vien_id, @quyen, @can_share);
    `);
  }
}

function makeFormShortCode() {
  const timePart = Date.now().toString(36).toUpperCase().slice(-7);
  const randomPart = Math.random().toString(36).toUpperCase().slice(2, 7);
  return `FLIC${timePart}${randomPart}`.slice(0, 20);
}

async function generateUniqueFormShortCode() {
  for (let i = 0; i < 12; i++) {
    const code = makeFormShortCode();
    const req = new sql.Request();
    req.input("code", sql.VarChar, code);
    const result = await req.query("SELECT TOP 1 id FROM Form WHERE ma_rut_gon = @code");
    if (!result.recordset[0]) return code;
  }
  return `FLIC${Date.now().toString(36).toUpperCase()}`.slice(0, 20);
}

async function getFormStatus(formId) {
  const id = Number(formId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const req = new sql.Request();
  req.input("id", sql.Int, id);
  const result = await req.query("SELECT TOP 1 trang_thai FROM Form WHERE id = @id");
  return result.recordset[0]?.trang_thai || null;
}

function isSectionPayload(item) {
  return item?._isSection || normalizeQuestionType(item?.loai || item?.type) === "section";
}

async function insertQuestionOptions(questionId, options) {
  if (!Array.isArray(options)) return;
  for (let j = 0; j < options.length; j++) {
    const opt = typeof options[j] === "string" ? options[j] : options[j]?.noi_dung;
    if (!String(opt || "").trim()) continue;
    await sql.query`
      INSERT INTO LuaChon (cau_hoi_id, noi_dung, thu_tu)
      VALUES (${questionId}, ${opt}, ${j + 1})
    `;
  }
}

async function ensureQuestionMediaColumns() {
  const columns = await getTableColumns("CauHoi");
  if (!columns.has("hinh_anh_url")) {
    await sql.query`ALTER TABLE CauHoi ADD hinh_anh_url NVARCHAR(MAX) NULL`;
    columns.add("hinh_anh_url");
  }
  if (!columns.has("video_url")) {
    await sql.query`ALTER TABLE CauHoi ADD video_url NVARCHAR(MAX) NULL`;
    columns.add("video_url");
  }
  if (!columns.has("hang_grid")) {
    await sql.query`ALTER TABLE CauHoi ADD hang_grid NVARCHAR(MAX) NULL`;
    columns.add("hang_grid");
  }
  if (!columns.has("cot_grid")) {
    await sql.query`ALTER TABLE CauHoi ADD cot_grid NVARCHAR(MAX) NULL`;
    columns.add("cot_grid");
  }
  if (!columns.has("section_id")) {
    await sql.query`ALTER TABLE CauHoi ADD section_id INT NULL`;
    columns.add("section_id");
  }
  if (!columns.has("validation_json")) {
    await sql.query`ALTER TABLE CauHoi ADD validation_json NVARCHAR(MAX) NULL`;
    columns.add("validation_json");
  }
  return columns;
}

async function ensureFormSectionColumns() {
  const columns = await getTableColumns("FormSection");
  if (!columns.size) return columns;
  if (!columns.has("next_action")) {
    await sql.query`ALTER TABLE FormSection ADD next_action NVARCHAR(30) NOT NULL CONSTRAINT DF_FormSection_NextAction DEFAULT 'continue'`;
    columns.add("next_action");
  }
  if (!columns.has("next_section_id")) {
    await sql.query`ALTER TABLE FormSection ADD next_section_id INT NULL`;
    columns.add("next_section_id");
  }
  return columns;
}

async function ensureLibraryGridColumns() {
  const columns = await getTableColumns("ThuVienCauHoi");
  if (!columns.size) return columns;
  if (!columns.has("hang_grid")) {
    await sql.query`ALTER TABLE ThuVienCauHoi ADD hang_grid NVARCHAR(MAX) NULL`;
    columns.add("hang_grid");
  }
  if (!columns.has("cot_grid")) {
    await sql.query`ALTER TABLE ThuVienCauHoi ADD cot_grid NVARCHAR(MAX) NULL`;
    columns.add("cot_grid");
  }
  return columns;
}

async function saveFormItems(formId, items) {
  const questionColumns = await ensureQuestionMediaColumns();
  const sectionColumns = await ensureFormSectionColumns();
  await ensureLibraryGridColumns();
  let currentSectionId = null;
  let sectionOrder = 0;
  let questionOrder = 0;

  for (const item of items || []) {
    if (isSectionPayload(item)) {
      sectionOrder += 1;
      questionOrder = 0;
      const title = item.title || item.noi_dung || `Phần ${sectionOrder}`;
      const description = item.desc || item.description || item.mo_ta_cau_hoi || null;
      const fields = ["form_id", "thu_tu"];
      const values = ["@form_id", "@thu_tu"];
      const sectionReq = new sql.Request();
      sectionReq.input("form_id", sql.Int, formId);
      sectionReq.input("thu_tu", sql.Int, sectionOrder);

      if (sectionColumns.has("title")) {
        fields.push("title");
        values.push("@title");
        sectionReq.input("title", sql.NVarChar, title);
      } else if (sectionColumns.has("tieu_de")) {
        fields.push("tieu_de");
        values.push("@tieu_de");
        sectionReq.input("tieu_de", sql.NVarChar, title);
      }

      if (sectionColumns.has("description")) {
        fields.push("description");
        values.push("@description");
        sectionReq.input("description", sql.NVarChar, description);
      } else if (sectionColumns.has("mo_ta")) {
        fields.push("mo_ta");
        values.push("@mo_ta");
        sectionReq.input("mo_ta", sql.NVarChar, description);
      }

      if (sectionColumns.has("next_action")) {
        fields.push("next_action");
        values.push("@next_action");
        sectionReq.input("next_action", sql.NVarChar, item.next_action || "continue");
      }
      if (sectionColumns.has("next_section_id")) {
        fields.push("next_section_id");
        values.push("@next_section_id");
        sectionReq.input("next_section_id", sql.Int, item.next_section_id || null);
      }
      const sectionResult = await sectionReq.query(`
        INSERT INTO FormSection (${fields.join(", ")})
        OUTPUT INSERTED.id
        VALUES (${values.join(", ")})
      `);
      currentSectionId = sectionResult.recordset[0].id;
      continue;
    }

    questionOrder += 1;
    const imageUrl = item.hinh_anh_url || item.image_url || item.image || null;
    const videoUrl = item.video_url || item.video || null;
    const type = normalizeQuestionType(item.loai);
    let rows = Array.isArray(item.rows) ? item.rows : Array.isArray(item.hang) ? item.hang : [];
    let cols = Array.isArray(item.cols) ? item.cols : Array.isArray(item.cot) ? item.cot : [];
    if ((type === "grid_radio" || type === "grid_checkbox") && (!rows.length || !cols.length) && item.thu_vien_id) {
      const libReq = new sql.Request();
      libReq.input("thu_vien_id", sql.Int, Number(item.thu_vien_id));
      const libResult = await libReq.query(`
        SELECT TOP 1 hang_grid, cot_grid
        FROM ThuVienCauHoi
        WHERE id = @thu_vien_id
      `);
      const libQuestion = libResult.recordset[0];
      rows = rows.length ? rows : parseJsonArray(libQuestion?.hang_grid);
      cols = cols.length ? cols : parseJsonArray(libQuestion?.cot_grid);
    }
    const fields = ["form_id", "thu_vien_id", "noi_dung", "loai", "thu_tu", "bat_buoc"];
    const values = ["@form_id", "@thu_vien_id", "@noi_dung", "@loai", "@thu_tu", "@bat_buoc"];
    const insertReq = new sql.Request();
    insertReq.input("form_id", sql.Int, formId);
    insertReq.input("thu_vien_id", sql.Int, item.thu_vien_id || null);
    insertReq.input("noi_dung", sql.NVarChar, item.noi_dung);
    insertReq.input("loai", sql.NVarChar, type);
    insertReq.input("thu_tu", sql.Int, questionOrder);
    insertReq.input("bat_buoc", sql.Bit, item.bat_buoc ? 1 : 0);
    if (questionColumns.has("section_id")) {
      fields.push("section_id");
      values.push("@section_id");
      insertReq.input("section_id", sql.Int, currentSectionId);
    }
    if (questionColumns.has("hinh_anh_url")) {
      fields.push("hinh_anh_url");
      values.push("@hinh_anh_url");
      insertReq.input("hinh_anh_url", sql.NVarChar(sql.MAX), imageUrl);
    }
    if (questionColumns.has("video_url")) {
      fields.push("video_url");
      values.push("@video_url");
      insertReq.input("video_url", sql.NVarChar(sql.MAX), videoUrl);
    }
    if (questionColumns.has("hang_grid")) {
      fields.push("hang_grid");
      values.push("@hang_grid");
      insertReq.input("hang_grid", sql.NVarChar(sql.MAX), JSON.stringify(rows));
    }
    if (questionColumns.has("cot_grid")) {
      fields.push("cot_grid");
      values.push("@cot_grid");
      insertReq.input("cot_grid", sql.NVarChar(sql.MAX), JSON.stringify(cols));
    }
    if (questionColumns.has("validation_json")) {
      fields.push("validation_json");
      values.push("@validation_json");
      insertReq.input("validation_json", sql.NVarChar(sql.MAX), item.validation_json || null);
    }
    const insertQ = await insertReq.query(`
      INSERT INTO CauHoi (${fields.join(", ")})
      OUTPUT INSERTED.id
      VALUES (${values.join(", ")})
    `);
    await insertQuestionOptions(insertQ.recordset[0].id, item.lua_chon);
  }
}

async function getFormWithQuestions(formId, publicOnly = false) {
  const id = Number(formId);
  const reqForm = new sql.Request();
  reqForm.input("id", sql.Int, id);
  const formColumns = await getTableColumns("Form");
  const hasLoaiKhaoSat = formColumns.has("loai_khao_sat_id");
  const formCategorySelect = hasLoaiKhaoSat ? "lk.danh_muc" : (formColumns.has("danh_muc") ? "f.danh_muc" : "NULL");
  const formSurveyTypeSelect = hasLoaiKhaoSat ? "lk.ten_loai" : "NULL";

  const formResult = await reqForm.query(`
    SELECT f.*, ${formCategorySelect} AS danh_muc, ${formSurveyTypeSelect} AS loai_khao_sat, n.ho_ten AS nguoi_tao
    FROM Form f
    ${hasLoaiKhaoSat ? "LEFT JOIN LoaiKhaoSat lk ON lk.id = f.loai_khao_sat_id" : ""}
    LEFT JOIN NhanVien n ON n.id = f.nhan_vien_id
    WHERE f.id = @id ${publicOnly ? "AND f.trang_thai IN ('active','pending') AND (f.ngay_dong IS NULL OR f.ngay_dong >= CAST(GETDATE() AS date))" : ""}
  `);
  const formRow = formResult.recordset[0];
  if (!formRow) return null;

  const questionColumns = await getTableColumns("CauHoi");
  await ensureFormSectionColumns();
  await ensureLibraryGridColumns();
  const hasQuestionSectionId = questionColumns.has("section_id");
  const reqQuestions = new sql.Request();
  reqQuestions.input("id", sql.Int, id);
  const qResult = await reqQuestions.query(`
    SELECT q.*, ${hasQuestionSectionId ? "fs.thu_tu" : "NULL"} AS section_thu_tu,
           tv.hang_grid AS library_hang_grid,
           tv.cot_grid AS library_cot_grid
    FROM CauHoi q
    ${hasQuestionSectionId ? "LEFT JOIN FormSection fs ON fs.id = q.section_id" : ""}
    LEFT JOIN ThuVienCauHoi tv ON tv.id = q.thu_vien_id
    WHERE q.form_id = @id
    ORDER BY ${hasQuestionSectionId ? "ISNULL(fs.thu_tu, 0)," : ""} q.thu_tu
  `);

  const reqSections = new sql.Request();
  reqSections.input("id", sql.Int, id);
  const sectionResult = await reqSections.query(`
    SELECT * FROM FormSection WHERE form_id = @id ORDER BY thu_tu
  `);

  const reqOptions = new sql.Request();
  reqOptions.input("id", sql.Int, id);
  const opResult = await reqOptions.query(`
    SELECT * FROM LuaChon
    WHERE cau_hoi_id IN (SELECT id FROM CauHoi WHERE form_id = @id)
    ORDER BY thu_tu
  `);

  const questions = qResult.recordset.map(q => {
    const rows = parseJsonArray(q.hang_grid);
    const cols = parseJsonArray(q.cot_grid);
    const fallbackRows = rows.length ? rows : parseJsonArray(q.library_hang_grid);
    const fallbackCols = cols.length ? cols : parseJsonArray(q.library_cot_grid);
    return {
      ...q,
      rows: fallbackRows,
      cols: fallbackCols,
      hang: fallbackRows,
      cot: fallbackCols,
      lua_chon: opResult.recordset.filter(o => o.cau_hoi_id === q.id)
    };
  });
  const questionBySection = new Map();
  questions.forEach(q => {
    const key = q.section_id || 0;
    if (!questionBySection.has(key)) questionBySection.set(key, []);
    questionBySection.get(key).push(q);
  });
  const formItems = [
    ...(questionBySection.get(0) || []),
    ...sectionResult.recordset.flatMap(section => [
      {
        id: `section-${section.id}`,
        section_id: section.id,
        _isSection: true,
        loai: "section",
        title: Object.prototype.hasOwnProperty.call(section, "title") ? section.title : section.tieu_de,
        desc: Object.prototype.hasOwnProperty.call(section, "description") ? section.description : section.mo_ta,
        thu_tu: section.thu_tu,
      },
      ...(questionBySection.get(section.id) || [])
    ])
  ];

  let loi_ket = formRow.loi_ket || '';
  let mo_ta = formRow.mo_ta || '';
  if (!loi_ket && mo_ta.startsWith('__LOI_KET__')) {
    loi_ket = mo_ta.slice('__LOI_KET__'.length);
    mo_ta = '';
  }

  return { ...formRow, mo_ta, loi_ket, cau_hoi: questions, form_items: formItems };
}

// GET /api/forms - Lấy danh sách form
router.get("/", authMiddleware, authorize("view_form"), async (req, res) => {
  try {
    const { status, cat, search } = req.query;
    const formColumns = await getTableColumns("Form");
    const hasLoaiKhaoSat = formColumns.has("loai_khao_sat_id");
    const { select: categorySelect, join: categoryJoin } = await getFormCategorySql(formColumns);
    const surveyTypeSelect = hasLoaiKhaoSat ? "lk.ten_loai" : "NULL";
    const approvalColumns = await getTableColumns("PheDuyet");
    const approvalDeadlineSelect = approvalColumns.has("han_chot_duyet") ? "a.han_chot_duyet" : "NULL";
    let query = `
      SELECT f.id, f.ten_form, ${categorySelect} AS danh_muc, f.doi_tuong, f.trang_thai,
             ${surveyTypeSelect} AS loai_khao_sat,
             f.ngay_tao, f.ngay_cap_nhat, f.ngay_dong,
             ${formColumns.has("mo_ta") ? "f.mo_ta" : "NULL"} AS mo_ta,
             ${formColumns.has("anh_bia") ? "f.anh_bia" : "NULL"} AS anh_bia,
             ${formColumns.has("mau_nen") ? "f.mau_nen" : "NULL"} AS mau_nen,
             ${formColumns.has("font_family") ? "f.font_family" : "NULL"} AS font_family,
             n.ho_ten AS nguoi_tao, n.vai_tro,
             (SELECT COUNT(*) FROM PhanHoi p WHERE p.form_id = f.id) AS so_phan_hoi,
             (SELECT COUNT(*) FROM CauHoi q WHERE q.form_id = f.id) AS so_cau_hoi,
             (SELECT TOP 1 q.noi_dung FROM CauHoi q WHERE q.form_id = f.id ORDER BY q.thu_tu) AS cau_hoi_dau,
             f.luot_xem, f.loi_ket,
             pa.do_uu_tien AS approval_priority,
             pa.han_chot_duyet AS approval_deadline
      FROM Form f
      ${categoryJoin}
      LEFT JOIN NhanVien n ON n.id = f.nhan_vien_id
      OUTER APPLY (
        SELECT TOP 1 a.do_uu_tien, ${approvalDeadlineSelect} AS han_chot_duyet
        FROM PheDuyet a
        WHERE a.form_id = f.id AND a.trang_thai = 'pending'
        ORDER BY CASE WHEN a.do_uu_tien = 'urgent' THEN 0 ELSE 1 END, a.ngay_yeu_cau DESC
      ) pa
      WHERE f.trang_thai != 'deleted'
    `;
    const params = {};

    if (status) { query += ` AND f.trang_thai = @status`; params.status = status; }
    if (cat)    { query += ` AND ${categorySelect} = @cat`; params.cat = cat; }
    if (search) { query += ` AND f.ten_form LIKE @search`; params.search = `%${search}%`; }

    query += ` ORDER BY CASE WHEN f.trang_thai = 'pending' AND pa.do_uu_tien = 'urgent' THEN 0 ELSE 1 END, COALESCE(f.ngay_cap_nhat, f.ngay_tao) DESC, f.id DESC`;

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
    if (!form) return res.status(404).json({ message: "Không tìm thấy biểu mẫu" });

    await sql.query`UPDATE Form SET luot_xem = ISNULL(luot_xem, 0) + 1 WHERE id = ${formId}`;
    res.json(form);
  } catch (err) {
    err500(res, err);
  }
});

// GET /api/forms/trash/list - Lấy danh sách thùng rác
router.get("/trash/list", authMiddleware, authorize("delete_form"), async (req, res) => {
  try {
    const formColumns = await getTableColumns("Form");
    const { select: categorySelect, join: categoryJoin } = await getFormCategorySql(formColumns);
    const result = await new sql.Request().query(`
      SELECT f.id, f.ten_form, ${categorySelect} AS danh_muc, f.ngay_cap_nhat AS deleted_at,
             n.ho_ten AS nguoi_tao
      FROM Form f
      ${categoryJoin}
      LEFT JOIN NhanVien n ON n.id = f.nhan_vien_id
      WHERE f.trang_thai = 'deleted'
      ORDER BY f.ngay_cap_nhat DESC
    `);
    res.json(result.recordset);
  } catch (err) { err500(res, err); }
});

router.get("/:id", authMiddleware, authorize("view_form"), async (req, res) => {
  try {
    const form = await getFormWithQuestions(req.params.id, false);
    if (!form) return res.status(404).json({ message: "Không tìm thấy biểu mẫu" });
    res.json(form);
  } catch (err) {
    err500(res, err);
  }
});

// POST /api/forms - Tạo biểu mẫu mới
router.post("/", authMiddleware, authorize("add_form"), async (req, res) => {
  const { ten_form, danh_muc, loai_khao_sat, doi_tuong, trang_thai, nhan_vien_id, cau_hoi, loi_ket, mo_ta, ngay_dong, anh_bia, mau_nen, font_family, cong_tac } = req.body;
  if (!ten_form) return res.status(400).json({ message: "Tên biểu mẫu là bắt buộc" });

  try {
    const closeDate = normalizeCloseDate(ngay_dong);
    if (ngay_dong && !closeDate) {
      return res.status(400).json({ message: "Ngày đóng biểu mẫu không hợp lệ" });
    }
    if (closeDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (closeDate < today) {
        return res.status(400).json({ message: "Không được chọn ngày đóng trong quá khứ" });
      }
    }

    const formColumns = await getTableColumns("Form");
    const hasLoaiKhaoSat = formColumns.has("loai_khao_sat_id");
    const formReq = new sql.Request();
    const fields = ["ten_form"];
    const values = ["@ten_form"];

    formReq.input("ten_form", sql.NVarChar, ten_form);

    if (formColumns.has("danh_muc") && !hasLoaiKhaoSat) {
      fields.push("danh_muc");
      values.push("@danh_muc");
      formReq.input("danh_muc", sql.NVarChar, danh_muc || "Khác");
    }

    if (hasLoaiKhaoSat) {
      fields.push("loai_khao_sat_id");
      values.push("@loai_khao_sat_id");
      formReq.input("loai_khao_sat_id", sql.Int, await getLoaiKhaoSatId(danh_muc, loai_khao_sat));
    }

    if (formColumns.has("ma_rut_gon")) {
      fields.push("ma_rut_gon");
      values.push("@ma_rut_gon");
      formReq.input("ma_rut_gon", sql.VarChar, await generateUniqueFormShortCode());
    }

    if (formColumns.has("doi_tuong")) {
      fields.push("doi_tuong");
      values.push("@doi_tuong");
      formReq.input("doi_tuong", sql.NVarChar, normalizeFormTarget(doi_tuong));
    }

    if (formColumns.has("loi_ket")) {
      fields.push("loi_ket");
      values.push("@loi_ket");
      formReq.input("loi_ket", sql.NVarChar, loi_ket || null);
    } else if (formColumns.has("mo_ta")) {
      fields.push("mo_ta");
      values.push("@mo_ta");
      formReq.input("mo_ta", sql.NVarChar, loi_ket ? "__LOI_KET__" + loi_ket : null);
    }

    if (formColumns.has("mo_ta") && formColumns.has("loi_ket")) {
      fields.push("mo_ta");
      values.push("@mo_ta");
      formReq.input("mo_ta", sql.NVarChar, mo_ta || null);
    }

    if (formColumns.has("trang_thai")) {
      fields.push("trang_thai");
      values.push("@trang_thai");
      formReq.input("trang_thai", sql.NVarChar, normalizeStatus(trang_thai));
    }

    if (formColumns.has("nhan_vien_id")) {
      fields.push("nhan_vien_id");
      values.push("@nhan_vien_id");
      formReq.input("nhan_vien_id", sql.Int, await resolveNhanVienId(nhan_vien_id || req.user?.id));
    }

    if (formColumns.has("luot_xem")) {
      fields.push("luot_xem");
      values.push("@luot_xem");
      formReq.input("luot_xem", sql.Int, 0);
    }

    if (formColumns.has("ngay_dong")) {
      fields.push("ngay_dong");
      values.push("@ngay_dong");
      formReq.input("ngay_dong", sql.DateTime, closeDate);
    }

    if (formColumns.has("anh_bia")) {
      fields.push("anh_bia");
      values.push("@anh_bia");
      formReq.input("anh_bia", sql.NVarChar(sql.MAX), anh_bia || null);
    }

    if (formColumns.has("mau_nen")) {
      fields.push("mau_nen");
      values.push("@mau_nen");
      formReq.input("mau_nen", sql.NVarChar, mau_nen || "#F0F4F9");
    }

    if (formColumns.has("font_family")) {
      fields.push("font_family");
      values.push("@font_family");
      formReq.input("font_family", sql.NVarChar, font_family || "Roboto");
    }

    const insertForm = await formReq.query(`
      INSERT INTO Form (${fields.join(", ")})
      OUTPUT INSERTED.id
      VALUES (${values.join(", ")})
    `);
    const formId = insertForm.recordset[0].id;

    if (cau_hoi && Array.isArray(cau_hoi)) {
      await saveFormItems(formId, cau_hoi);
    }

    await saveFormCollaborators(formId, cong_tac);

    res.status(201).json({ message: "Tạo biểu mẫu thành công", id: formId });
  } catch (err) {
    err500(res, err);
  }
});

// PUT /api/forms/:id - Cập nhật biểu mẫu (bao gồm câu hỏi)
router.put("/:id", authMiddleware, authorize("edit_form"), async (req, res) => {
  const { ten_form, danh_muc, loai_khao_sat, doi_tuong, trang_thai, cau_hoi, mo_ta, ngay_dong, anh_bia, mau_nen, font_family, cong_tac } = req.body;
  const formId = req.params.id;
  try {
    const currentStatus = await getFormStatus(formId);
    if (!currentStatus) return res.status(404).json({ message: "Không tìm thấy biểu mẫu" });
    if (currentStatus === "active") {
      return res.status(400).json({ message: "Biểu mẫu đang hoạt động, không thể chỉnh sửa. Vui lòng đóng biểu mẫu trước." });
    }
    const closeDate = normalizeCloseDate(ngay_dong);
    if (ngay_dong && !closeDate) {
      return res.status(400).json({ message: "Ngày đóng biểu mẫu không hợp lệ" });
    }
    if (closeDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (closeDate < today) {
        return res.status(400).json({ message: "Không được chọn ngày đóng trong quá khứ" });
      }
    }
    const { loi_ket: loi_ket_update } = req.body;
    const formColumns = await getTableColumns("Form");
    const hasLoaiKhaoSat = formColumns.has("loai_khao_sat_id");
    const updateReq = new sql.Request();
    const updates = [];
    updateReq.input("id", sql.Int, Number(formId));

    if (formColumns.has("ten_form")) {
      updates.push("ten_form = @ten_form");
      updateReq.input("ten_form", sql.NVarChar, ten_form);
    }
    if (formColumns.has("danh_muc") && !hasLoaiKhaoSat) {
      updates.push("danh_muc = @danh_muc");
      updateReq.input("danh_muc", sql.NVarChar, danh_muc);
    }
    if (hasLoaiKhaoSat) {
      updates.push("loai_khao_sat_id = @loai_khao_sat_id");
      updateReq.input("loai_khao_sat_id", sql.Int, await getLoaiKhaoSatId(danh_muc, loai_khao_sat));
    }
    if (formColumns.has("doi_tuong")) {
      updates.push("doi_tuong = @doi_tuong");
      updateReq.input("doi_tuong", sql.NVarChar, normalizeFormTarget(doi_tuong));
    }
    if (formColumns.has("trang_thai")) {
      updates.push("trang_thai = @trang_thai");
      updateReq.input("trang_thai", sql.NVarChar, normalizeStatus(trang_thai));
    }
    if (formColumns.has("loi_ket")) {
      updates.push("loi_ket = @loi_ket");
      updateReq.input("loi_ket", sql.NVarChar, loi_ket_update || null);
    }
    if (formColumns.has("mo_ta")) {
      updates.push("mo_ta = @mo_ta");
      updateReq.input("mo_ta", sql.NVarChar, formColumns.has("loi_ket") ? (mo_ta || null) : (loi_ket_update ? "__LOI_KET__" + loi_ket_update : null));
    }
    if (formColumns.has("ngay_dong")) {
      updates.push("ngay_dong = @ngay_dong");
      updateReq.input("ngay_dong", sql.DateTime, closeDate);
    }
    if (formColumns.has("anh_bia") && Object.prototype.hasOwnProperty.call(req.body, "anh_bia")) {
      updates.push("anh_bia = @anh_bia");
      updateReq.input("anh_bia", sql.NVarChar(sql.MAX), anh_bia || null);
    }
    if (formColumns.has("mau_nen") && Object.prototype.hasOwnProperty.call(req.body, "mau_nen")) {
      updates.push("mau_nen = @mau_nen");
      updateReq.input("mau_nen", sql.NVarChar, mau_nen || "#F0F4F9");
    }
    if (formColumns.has("font_family") && Object.prototype.hasOwnProperty.call(req.body, "font_family")) {
      updates.push("font_family = @font_family");
      updateReq.input("font_family", sql.NVarChar, font_family || "Roboto");
    }
    if (formColumns.has("ngay_cap_nhat")) {
      updates.push("ngay_cap_nhat = GETDATE()");
    }

    await updateReq.query(`UPDATE Form SET ${updates.join(", ")} WHERE id = @id`);

    if (cau_hoi && Array.isArray(cau_hoi)) {
      await sql.query`DELETE FROM LuaChon WHERE cau_hoi_id IN (SELECT id FROM CauHoi WHERE form_id = ${formId})`;
      await sql.query`DELETE FROM CauHoi WHERE form_id = ${formId}`;
      await sql.query`DELETE FROM FormSection WHERE form_id = ${formId}`;
      await saveFormItems(Number(formId), cau_hoi);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "cong_tac")) {
      const collaboratorColumns = await getTableColumns("Form_CongTac");
      if (collaboratorColumns.has("form_id") && collaboratorColumns.has("nhan_vien_id")) {
        await sql.query`DELETE FROM Form_CongTac WHERE form_id = ${formId}`;
      }
      await saveFormCollaborators(Number(formId), cong_tac);
    }

    res.json({ message: "Cập nhật biểu mẫu thành công" });
  } catch (err) {
    if (err.message.includes('REFERENCE constraint')) {
      return res.status(400).json({ message: "Không thể lưu do biểu mẫu đã có phản hồi. Việc sửa câu hỏi sẽ làm hỏng dữ liệu đã thu thập. Vui lòng tạo bản sao (duplicate) để tiếp tục." });
    }
    err500(res, err);
  }
});

// PATCH /api/forms/:id/status - Đổi trạng thái
router.patch("/:id/status", authMiddleware, authorize("edit_form"), async (req, res) => {
  const { trang_thai } = req.body;
  const nextStatus = normalizeStatus(trang_thai);
  const allowed = ["active", "draft", "pending", "archived", "rejected", "closed"];
  if (!allowed.includes(trang_thai))
    return res.status(400).json({ message: "Trạng thái không hợp lệ" });
  try {
    const currentStatus = await getFormStatus(req.params.id);
    if (!currentStatus) return res.status(404).json({ message: "Không tìm thấy biểu mẫu" });
    if (currentStatus === "active" && nextStatus !== "closed") {
      return res.status(400).json({ message: "Biểu mẫu đang hoạt động chỉ có thể đóng biểu mẫu." });
    }
    if (nextStatus === "closed") {
      await sql.query`
        UPDATE Form SET trang_thai = ${nextStatus}, ngay_dong = GETDATE(), ngay_cap_nhat = GETDATE()
        WHERE id = ${req.params.id}
      `;
    } else {
      await sql.query`
        UPDATE Form SET trang_thai = ${nextStatus}, ngay_cap_nhat = GETDATE()
        WHERE id = ${req.params.id}
      `;
    }
    res.json({ message: "Đổi trạng thái thành công" });
  } catch (err) {
    err500(res, err);
  }
});

// DELETE /api/forms/:id - Soft delete (chuyển vào thùng rác)
router.delete("/:id", authMiddleware, authorize("delete_form"), async (req, res) => {
  try {
    const { ly_do_xoa } = req.body || {};
    const nhan_vien_id = req.user ? req.user.id : null;
    const formRes = await sql.query`SELECT id, ten_form, trang_thai FROM Form WHERE id = ${req.params.id} AND trang_thai != 'deleted'`;
    if (!formRes.recordset[0]) return res.status(404).json({ message: "Không tìm thấy biểu mẫu" });
    if (formRes.recordset[0].trang_thai === "active") {
      return res.status(400).json({ message: "Biểu mẫu đang hoạt động, không thể xóa. Vui lòng đóng biểu mẫu trước." });
    }
    
    await sql.query`
      UPDATE Form 
      SET trang_thai = 'deleted', 
          ngay_cap_nhat = GETDATE(),
          ly_do_xoa = ${ly_do_xoa || 'Không có lý do'}
      WHERE id = ${req.params.id}
    `;

    try {
      const logDetail = ly_do_xoa && ly_do_xoa !== 'Không có lý do' 
        ? `Xóa biểu mẫu (Lý do: ${ly_do_xoa})` 
        : 'Xóa biểu mẫu';
      await sql.query`
        INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
        VALUES (${nhan_vien_id}, N'Xóa biểu mẫu', 'form', ${req.params.id}, ${logDetail})
      `;
    } catch (e) { console.error('Lỗi khi lưu nhật ký:', e); }

    res.json({ message: "Đã chuyển biểu mẫu vào thùng rác" });
  } catch (err) { err500(res, err); }
});

// PATCH /api/forms/:id/restore - Khôi phục form từ thùng rác
router.patch("/:id/restore", authMiddleware, authorize("delete_form"), async (req, res) => {
  try {
    const { ly_do_xoa } = req.body || {};
    const nhan_vien_id = req.user ? req.user.id : null;
    const formRes = await sql.query`SELECT id FROM Form WHERE id = ${req.params.id} AND trang_thai = 'deleted'`;
    if (!formRes.recordset[0]) return res.status(404).json({ message: "Không tìm thấy biểu mẫu trong thùng rác" });
    
    await sql.query`
      UPDATE Form 
      SET trang_thai = 'draft', 
          ngay_cap_nhat = GETDATE(),
          ly_do_xoa = NULL
      WHERE id = ${req.params.id}
    `;

    try {
      const logDetail = ly_do_xoa && ly_do_xoa !== 'Không có lý do' 
        ? `Khôi phục biểu mẫu từ thùng rác (Lý do: ${ly_do_xoa})` 
        : 'Khôi phục biểu mẫu từ thùng rác';
      await sql.query`
        INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
        VALUES (${nhan_vien_id}, N'Khôi phục biểu mẫu', 'form', ${req.params.id}, ${logDetail})
      `;
    } catch (e) { console.error('Lỗi khi lưu nhật ký:', e); }

    res.json({ message: "Đã khôi phục biểu mẫu" });
  } catch (err) { err500(res, err); }
});

// DELETE /api/forms/:id/permanent - Xóa vĩnh viễn
router.delete("/:id/permanent", authMiddleware, authorize("delete_form"), async (req, res) => {
  try {
    const { ly_do_xoa } = req.body || {};
    const nhan_vien_id = req.user ? req.user.id : null;
    await sql.query`DELETE FROM Form WHERE id = ${req.params.id} AND trang_thai = 'deleted'`;
    
    try {
      const logDetail = ly_do_xoa && ly_do_xoa !== 'Không có lý do' 
        ? `Xóa vĩnh viễn biểu mẫu (Lý do: ${ly_do_xoa})` 
        : 'Xóa vĩnh viễn biểu mẫu';
      await sql.query`
        INSERT INTO NhatKyHoatDong (nhan_vien_id, hanh_dong, doi_tuong, doi_tuong_id, chi_tiet)
        VALUES (${nhan_vien_id}, N'Xóa vĩnh viễn biểu mẫu', 'form', ${req.params.id}, ${logDetail})
      `;
    } catch (e) { console.error('Lỗi khi lưu nhật ký:', e); }

    res.json({ message: "Đã xóa vĩnh viễn" });
  } catch (err) { err500(res, err); }
});

module.exports = router;
