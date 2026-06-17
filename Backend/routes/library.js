const express = require('express');
const router = express.Router();
const { sql } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { err500 } = require('../utils/helpers');

console.log('[library] route loaded: ThuVienCauHoi uses lua_chon_mau');

function parseJsonArray(value) {
  try {
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

const IMAGE_COLUMNS = ['hinh_anh_url', 'image_url', 'image', 'anh_url', 'hinh_anh'];
const VIDEO_COLUMNS = ['video_url', 'video'];

function firstValue(row, columns) {
  for (const column of columns) {
    if (row[column] !== undefined && row[column] !== null) return row[column];
  }
  return null;
}

function pickExistingColumn(columns, candidates) {
  const set = new Set(columns.map(column => String(column).toLowerCase()));
  return candidates.find(column => set.has(column.toLowerCase())) || null;
}

function sqlColumn(name) {
  return `[${String(name).replace(/]/g, ']]')}]`;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function getBodyValue(body, keys) {
  for (const key of keys) {
    if (hasOwn(body, key)) return body[key];
  }
  return undefined;
}

function normalizeTarget(value) {
  const text = String(value || 'Tất cả').trim();
  return ['Tất cả', 'Sinh viên', 'Người đi làm'].includes(text) ? text : 'Tất cả';
}

function normalizeSurveyType(value) {
  return String(value || '').trim();
}

async function getLibraryColumns() {
  const result = await sql.query`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ThuVienCauHoi'`;
  return result.recordset.map(row => row.COLUMN_NAME);
}

async function ensureLibraryMediaColumns() {
  const columns = await getLibraryColumns();
  if (!pickExistingColumn(columns, IMAGE_COLUMNS)) {
    await sql.query`ALTER TABLE ThuVienCauHoi ADD hinh_anh_url NVARCHAR(MAX) NULL`;
    columns.push('hinh_anh_url');
  }
  if (!pickExistingColumn(columns, VIDEO_COLUMNS)) {
    await sql.query`ALTER TABLE ThuVienCauHoi ADD video_url NVARCHAR(MAX) NULL`;
    columns.push('video_url');
  }
  return columns;
}

async function ensureLibraryContentColumns() {
  const columns = await ensureLibraryMediaColumns();
  const set = new Set(columns.map(column => String(column).toLowerCase()));
  const addColumn = async (name, definition) => {
    if (set.has(name.toLowerCase())) return;
    await sql.query(`ALTER TABLE ThuVienCauHoi ADD ${sqlColumn(name)} ${definition}`);
    columns.push(name);
    set.add(name.toLowerCase());
  };

  await addColumn('lua_chon_mau', 'NVARCHAR(MAX) NULL');
  await addColumn('hang_grid', 'NVARCHAR(MAX) NULL');
  await addColumn('cot_grid', 'NVARCHAR(MAX) NULL');
  return columns;
}

function mapRow(row) {
  const image = firstValue(row, IMAGE_COLUMNS);
  const video = firstValue(row, VIDEO_COLUMNS);
  return {
    id: row.id,
    bo_mon: row.danh_muc || row.bo_mon,
    category: row.danh_muc || row.bo_mon,
    loai_khao_sat: row.ten_loai || row.loai_khao_sat || '',
    survey_type: row.ten_loai || row.loai_khao_sat || '',
    doi_tuong: row.doi_tuong || 'Tất cả',
    target: row.doi_tuong || 'Tất cả',
    text: row.noi_dung,
    type: row.loai,
    required: !!row.bat_buoc,
    bat_buoc: !!row.bat_buoc,
    opts: parseJsonArray(row.lua_chon_mau),
    rows: parseJsonArray(row.hang_grid),
    cols: parseJsonArray(row.cot_grid),
    image,
    image_url: image,
    hinh_anh_url: image,
    video,
    video_url: video,
    thu_tu: row.thu_tu,
  };
}

async function getSurveyTypeId(boMon, surveyType) {
  const request = new sql.Request();
  request.input('bo_mon', sql.NVarChar, boMon);

  if (surveyType) {
    request.input('survey_type', sql.NVarChar, surveyType);
    const exactType = await request.query(`
      SELECT TOP 1 id
      FROM LoaiKhaoSat
      WHERE danh_muc = @bo_mon
        AND ten_loai = @survey_type
      ORDER BY id ASC
    `);
    if (exactType.recordset[0]?.id) return exactType.recordset[0].id;
  }

  const exact = await request.query(`
    SELECT TOP 1 id
    FROM LoaiKhaoSat
    WHERE danh_muc = @bo_mon
    ORDER BY id ASC
  `);
  if (exact.recordset[0]?.id) return exact.recordset[0].id;

  const fallback = await request.query(`
    SELECT TOP 1 id
    FROM LoaiKhaoSat
    ORDER BY
      CASE
        WHEN @bo_mon = N'Ngoại ngữ' AND id IN (1, 2) THEN 0
        WHEN @bo_mon = N'Tin học' AND id >= 3 THEN 0
        ELSE 1
      END,
      id ASC
  `);
  return fallback.recordset[0]?.id || null;
}

async function hasLibraryOptionColumn() {
  const columns = await ensureLibraryContentColumns();
  return !!pickExistingColumn(columns, ['lua_chon_mau']);
}

async function ensureLibraryRequiredColumn() {
  const result = await sql.query`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ThuVienCauHoi'
      AND COLUMN_NAME = 'bat_buoc'`;
  if (!result.recordset.length) {
    await sql.query`ALTER TABLE ThuVienCauHoi ADD bat_buoc BIT NOT NULL CONSTRAINT DF_ThuVienCauHoi_bat_buoc DEFAULT 0`;
  }
}

async function ensureLibraryTargetConstraint() {
  const result = await sql.query`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ThuVienCauHoi'
      AND COLUMN_NAME = 'doi_tuong'`;
  if (!result.recordset.length) return;

  await sql.query`
    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = 'CHK_ThuVien_DoiTuong'
    )
    BEGIN
      ALTER TABLE ThuVienCauHoi DROP CONSTRAINT CHK_ThuVien_DoiTuong;
    END

    UPDATE ThuVienCauHoi
    SET doi_tuong = N'Sinh viên'
    WHERE doi_tuong IN (
      N'Sinh viên trong ĐH Kinh tế',
      N'Sinh viên ngoài Trường ĐH Kinh tế',
      N'Sinh viên trong DH Kinh te',
      N'Sinh viên ngoài Truong DH Kinh te'
    );

    UPDATE ThuVienCauHoi
    SET doi_tuong = N'Tất cả'
    WHERE doi_tuong IS NULL
       OR doi_tuong NOT IN (N'Tất cả', N'Sinh viên', N'Người đi làm');

    ALTER TABLE ThuVienCauHoi
    ALTER COLUMN doi_tuong NVARCHAR(50) NOT NULL;

    ALTER TABLE ThuVienCauHoi
    ADD CONSTRAINT CHK_ThuVien_DoiTuong
    CHECK (doi_tuong IN (N'Tất cả', N'Sinh viên', N'Người đi làm'));
  `;
}

router.get('/', authMiddleware, authorize('view_library'), async (req, res) => {
  try {
    await ensureLibraryRequiredColumn();
    await ensureLibraryTargetConstraint();
    const columns = await ensureLibraryContentColumns();
    const boMonColumn = pickExistingColumn(columns, ['bo_mon']);
    const targetColumn = pickExistingColumn(columns, ['doi_tuong']);
    const categoryExpr = boMonColumn ? `COALESCE(lk.danh_muc, tv.${sqlColumn(boMonColumn)})` : 'lk.danh_muc';
    const targetExpr = targetColumn ? `tv.${sqlColumn(targetColumn)}` : "N'Tất cả'";
    const boMon = req.query.bo_mon;
    const surveyType = req.query.loai_khao_sat || req.query.survey_type;
    const doiTuong = req.query.doi_tuong || req.query.target;
    const request = new sql.Request();
    let query = `
      SELECT tv.*, lk.danh_muc, lk.ten_loai
      FROM ThuVienCauHoi tv
      LEFT JOIN LoaiKhaoSat lk ON lk.id = tv.loai_khao_sat_id
      WHERE 1 = 1
    `;
    if (boMon) {
      request.input('boMon', sql.NVarChar, boMon);
      query += ` AND ${categoryExpr} = @boMon`;
    }
    if (surveyType && surveyType !== 'Tất cả') {
      request.input('surveyType', sql.NVarChar, surveyType);
      query += ` AND lk.ten_loai = @surveyType`;
    }
    if (targetColumn && doiTuong && doiTuong !== 'Tất cả') {
      request.input('doiTuong', sql.NVarChar, doiTuong);
      query += ` AND ${targetExpr} = @doiTuong`;
    }
    query += ` ORDER BY ${categoryExpr}, lk.ten_loai, ${targetExpr}, tv.thu_tu ASC, tv.id ASC`;
    const result = await request.query(query);
    res.json(result.recordset.map(mapRow));
  } catch (err) {
    err500(res, err);
  }
});

router.get('/_debug', async (req, res) => {
  try {
    const result = await sql.query`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ThuVienCauHoi'
      ORDER BY ORDINAL_POSITION`;
    res.json({
      route: 'library',
      version: 'uses-lua_chon_mau-and-bat_buoc-2026-06-04',
      optionColumn: 'lua_chon_mau',
      columns: result.recordset.map(row => row.COLUMN_NAME),
    });
  } catch (err) {
    err500(res, err);
  }
});

router.post('/', authMiddleware, authorize('add_library'), async (req, res) => {
  const { bo_mon, text, type, opts, rows, cols, required, bat_buoc, loai_khao_sat, survey_type, doi_tuong, target } = req.body;
  if (!text?.trim()) return res.status(400).json({ message: 'Nội dung câu hỏi là bắt buộc' });
  if (!['Ngoại ngữ', 'Tin học'].includes(bo_mon)) {
    return res.status(400).json({ message: 'Bộ môn không hợp lệ' });
  }
  const surveyType = normalizeSurveyType(loai_khao_sat || survey_type);
  const doiTuong = normalizeTarget(doi_tuong || target);

  try {
    await ensureLibraryRequiredColumn();
    await ensureLibraryTargetConstraint();
    if (!await hasLibraryOptionColumn()) {
      return res.status(500).json({ message: 'Bảng ThuVienCauHoi thiếu cột lua_chon_mau' });
    }

    const loaiKhaoSatId = await getSurveyTypeId(bo_mon, surveyType);
    if (!loaiKhaoSatId) {
      return res.status(400).json({ message: 'Chưa có loại khảo sát cho bộ môn này' });
    }

    const columns = await ensureLibraryContentColumns();
    const boMonColumn = pickExistingColumn(columns, ['bo_mon']);
    const imageColumn = pickExistingColumn(columns, IMAGE_COLUMNS);
    const videoColumn = pickExistingColumn(columns, VIDEO_COLUMNS);
    const targetColumn = pickExistingColumn(columns, ['doi_tuong']);
    const imageValue = getBodyValue(req.body, ['image', 'image_url', 'hinh_anh_url']);
    const videoValue = getBodyValue(req.body, ['video', 'video_url']);
    const maxRequest = new sql.Request();
    let maxQuery = 'SELECT ISNULL(MAX(thu_tu), 0) AS m FROM ThuVienCauHoi WHERE loai_khao_sat_id = @loai_khao_sat_id';
    maxRequest.input('loai_khao_sat_id', sql.Int, loaiKhaoSatId);
    if (boMonColumn) {
      maxRequest.input('bo_mon', sql.NVarChar, bo_mon);
      maxQuery = `SELECT ISNULL(MAX(thu_tu), 0) AS m FROM ThuVienCauHoi WHERE ${sqlColumn(boMonColumn)} = @bo_mon`;
    }
    const maxR = await maxRequest.query(maxQuery);
    const thuTu = maxR.recordset[0].m + 1;

    const request = new sql.Request();
    request.input('loai_khao_sat_id', sql.Int, loaiKhaoSatId);
    request.input('text', sql.NVarChar, text.trim());
    request.input('type', sql.NVarChar, type || 'choice');
    request.input('opts', sql.NVarChar(sql.MAX), JSON.stringify(opts || []));
    request.input('rows', sql.NVarChar(sql.MAX), JSON.stringify(rows || []));
    request.input('cols', sql.NVarChar(sql.MAX), JSON.stringify(cols || []));
    request.input('bat_buoc', sql.Bit, required || bat_buoc ? 1 : 0);
    request.input('thu_tu', sql.Int, thuTu);

    const insertColumns = ['loai_khao_sat_id', 'noi_dung', 'loai', 'lua_chon_mau', 'hang_grid', 'cot_grid', 'bat_buoc', 'thu_tu'];
    const insertValues = ['@loai_khao_sat_id', '@text', '@type', '@opts', '@rows', '@cols', '@bat_buoc', '@thu_tu'];
    if (boMonColumn) {
      request.input('bo_mon', sql.NVarChar, bo_mon);
      insertColumns.push(boMonColumn);
      insertValues.push('@bo_mon');
    }
    if (targetColumn) {
      request.input('doi_tuong', sql.NVarChar, doiTuong);
      insertColumns.push(targetColumn);
      insertValues.push('@doi_tuong');
    }
    if (imageColumn) {
      request.input('image_value', sql.NVarChar(sql.MAX), imageValue || null);
      insertColumns.push(imageColumn);
      insertValues.push('@image_value');
    }
    if (videoColumn) {
      request.input('video_value', sql.NVarChar(sql.MAX), videoValue || null);
      insertColumns.push(videoColumn);
      insertValues.push('@video_value');
    }

    const result = await request.query(`
      INSERT INTO ThuVienCauHoi (${insertColumns.map(sqlColumn).join(', ')})
      OUTPUT INSERTED.*
      VALUES (${insertValues.join(', ')})
    `);

    res.status(201).json({ message: 'Đã thêm câu hỏi', data: mapRow(result.recordset[0]) });
  } catch (err) {
    err500(res, err);
  }
});

router.put('/:id', authMiddleware, authorize('edit_library'), async (req, res) => {
  const id = Number(req.params.id);
  const { bo_mon, text, type, opts, rows, cols, required, bat_buoc, loai_khao_sat, survey_type, doi_tuong, target } = req.body;
  if (!text?.trim()) return res.status(400).json({ message: 'Nội dung câu hỏi là bắt buộc' });
  if (!['Ngoại ngữ', 'Tin học'].includes(bo_mon)) {
    return res.status(400).json({ message: 'Bộ môn không hợp lệ' });
  }
  const surveyType = normalizeSurveyType(loai_khao_sat || survey_type);
  const doiTuong = normalizeTarget(doi_tuong || target);

  try {
    await ensureLibraryRequiredColumn();
    await ensureLibraryTargetConstraint();
    if (!await hasLibraryOptionColumn()) {
      return res.status(500).json({ message: 'Bảng ThuVienCauHoi thiếu cột lua_chon_mau' });
    }

    const loaiKhaoSatId = await getSurveyTypeId(bo_mon, surveyType);
    if (!loaiKhaoSatId) {
      return res.status(400).json({ message: 'Chưa có loại khảo sát cho bộ môn này' });
    }

    const columns = await ensureLibraryContentColumns();
    const boMonColumn = pickExistingColumn(columns, ['bo_mon']);
    const imageColumn = pickExistingColumn(columns, IMAGE_COLUMNS);
    const videoColumn = pickExistingColumn(columns, VIDEO_COLUMNS);
    const targetColumn = pickExistingColumn(columns, ['doi_tuong']);
    const hasImagePayload = ['image', 'image_url', 'hinh_anh_url'].some(key => hasOwn(req.body, key));
    const hasVideoPayload = ['video', 'video_url'].some(key => hasOwn(req.body, key));
    const imageValue = getBodyValue(req.body, ['image', 'image_url', 'hinh_anh_url']);
    const videoValue = getBodyValue(req.body, ['video', 'video_url']);

    const request = new sql.Request();
    request.input('id', sql.Int, id);
    request.input('loai_khao_sat_id', sql.Int, loaiKhaoSatId);
    request.input('text', sql.NVarChar, text.trim());
    request.input('type', sql.NVarChar, type || 'choice');
    request.input('opts', sql.NVarChar(sql.MAX), JSON.stringify(opts || []));
    request.input('rows', sql.NVarChar(sql.MAX), JSON.stringify(rows || []));
    request.input('cols', sql.NVarChar(sql.MAX), JSON.stringify(cols || []));
    request.input('bat_buoc', sql.Bit, required || bat_buoc ? 1 : 0);
    if (targetColumn) request.input('doi_tuong', sql.NVarChar, doiTuong);

    const updates = [
      'loai_khao_sat_id = @loai_khao_sat_id',
      'noi_dung = @text',
      'loai = @type',
      'lua_chon_mau = @opts',
      'hang_grid = @rows',
      'cot_grid = @cols',
      'bat_buoc = @bat_buoc',
      'ngay_cap_nhat = GETDATE()',
    ];
    if (boMonColumn) {
      request.input('bo_mon', sql.NVarChar, bo_mon);
      updates.splice(3, 0, `${sqlColumn(boMonColumn)} = @bo_mon`);
    }
    if (targetColumn) {
      updates.splice(updates.length - 1, 0, `${sqlColumn(targetColumn)} = @doi_tuong`);
    }
    if (imageColumn && hasImagePayload) {
      request.input('image_value', sql.NVarChar(sql.MAX), imageValue || null);
      updates.splice(updates.length - 1, 0, `${sqlColumn(imageColumn)} = @image_value`);
    }
    if (videoColumn && hasVideoPayload) {
      request.input('video_value', sql.NVarChar(sql.MAX), videoValue || null);
      updates.splice(updates.length - 1, 0, `${sqlColumn(videoColumn)} = @video_value`);
    }

    const result = await request.query(`
      UPDATE ThuVienCauHoi
      SET ${updates.join(',\n          ')}
      OUTPUT INSERTED.*
      WHERE id = @id
    `);

    if (!result.recordset.length) return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
    res.json({ message: 'Đã cập nhật', data: mapRow(result.recordset[0]) });
  } catch (err) {
    err500(res, err);
  }
});

router.delete('/:id', authMiddleware, authorize('delete_library'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const check = await sql.query`SELECT id FROM ThuVienCauHoi WHERE id = ${id}`;
    if (!check.recordset.length) return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
    await sql.query`DELETE FROM ThuVienCauHoi WHERE id = ${id}`;
    res.json({ message: 'Đã xóa câu hỏi' });
  } catch (err) {
    err500(res, err);
  }
});

module.exports = router;
