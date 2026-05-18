const express  = require('express');
const router   = express.Router();
const { sql }  = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { err500 } = require('../utils/helpers');

function mapRow(r) {
  const parse = v => { try { return v ? JSON.parse(v) : []; } catch { return []; } };
  return { id: r.id, bo_mon: r.bo_mon, text: r.noi_dung, type: r.loai, opts: parse(r.lua_chon), rows: parse(r.hang_grid), cols: parse(r.cot_grid), thu_tu: r.thu_tu };
}

router.get('/', authMiddleware, authorize('view_library'), async (req, res) => {
  try {
    const bo_mon = req.query.bo_mon;
    let result;
    if (bo_mon) {
      result = await sql.query`SELECT * FROM ThuVienCauHoi WHERE bo_mon = ${bo_mon} ORDER BY thu_tu ASC, id ASC`;
    } else {
      result = await sql.query`SELECT * FROM ThuVienCauHoi ORDER BY bo_mon, thu_tu ASC, id ASC`;
    }
    res.json(result.recordset.map(mapRow));
  } catch (err) { err500(res, err); }
});

router.post('/', authMiddleware, authorize('add_library'), async (req, res) => {
  const { bo_mon, text, type, opts, rows, cols } = req.body;
  if (!text?.trim()) return res.status(400).json({ message: 'Noi dung cau hoi la bat buoc' });
  if (!['Ngoại ngữ','Tin học'].includes(bo_mon))
    return res.status(400).json({ message: 'Bo mon khong hop le' });
  try {
    const maxR = await sql.query`SELECT ISNULL(MAX(thu_tu), 0) AS m FROM ThuVienCauHoi WHERE bo_mon = ${bo_mon}`;
    const thu_tu = maxR.recordset[0].m + 1;
    const result = await sql.query`
      INSERT INTO ThuVienCauHoi (bo_mon, noi_dung, loai, lua_chon, hang_grid, cot_grid, thu_tu)
      OUTPUT INSERTED.*
      VALUES (${bo_mon}, ${text.trim()}, ${type || 'choice'}, ${JSON.stringify(opts||[])}, ${JSON.stringify(rows||[])}, ${JSON.stringify(cols||[])}, ${thu_tu})`;
    res.status(201).json({ message: 'Da them cau hoi', data: mapRow(result.recordset[0]) });
  } catch (err) { err500(res, err); }
});

router.put('/:id', authMiddleware, authorize('edit_library'), async (req, res) => {
  const id = Number(req.params.id);
  const { bo_mon, text, type, opts, rows, cols } = req.body;
  if (!text?.trim()) return res.status(400).json({ message: 'Noi dung cau hoi la bat buoc' });
  try {
    const result = await sql.query`
      UPDATE ThuVienCauHoi
      SET noi_dung=${text.trim()}, loai=${type||'choice'}, bo_mon=${bo_mon},
          lua_chon=${JSON.stringify(opts||[])}, hang_grid=${JSON.stringify(rows||[])},
          cot_grid=${JSON.stringify(cols||[])}, ngay_cap_nhat=GETDATE()
      OUTPUT INSERTED.* WHERE id=${id}`;
    if (!result.recordset.length) return res.status(404).json({ message: 'Khong tim thay cau hoi' });
    res.json({ message: 'Da cap nhat', data: mapRow(result.recordset[0]) });
  } catch (err) { err500(res, err); }
});

router.delete('/:id', authMiddleware, authorize('delete_library'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const check = await sql.query`SELECT id FROM ThuVienCauHoi WHERE id = ${id}`;
    if (!check.recordset.length) return res.status(404).json({ message: 'Khong tim thay cau hoi' });
    await sql.query`DELETE FROM ThuVienCauHoi WHERE id = ${id}`;
    res.json({ message: 'Da xoa cau hoi' });
  } catch (err) { err500(res, err); }
});

module.exports = router;