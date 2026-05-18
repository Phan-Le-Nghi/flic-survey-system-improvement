const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcrypt');
const { sql }  = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { err500, validId } = require('../utils/helpers');

// Khớp đúng với bảng Quyen trong DB
const PERM_KEYS = [
  'view_form','add_form','edit_form','delete_form',
  'view_approval','approve','share_form',
  'view_report','export_data',
  'view_staff','manage_staff',
  'view_notif','send_notif',
  'view_library','add_library','edit_library','delete_library',
  'view_feedback','delete_feedback',
];

function normalizePermissions(q = {}) {
  return Object.fromEntries(PERM_KEYS.map(k => [k, !!q[k]]));
}

async function getStaffById(id) {
  const r = await sql.query`SELECT id,ho_ten,email,so_dien_thoai,ten_dang_nhap,vai_tro,phong_ban,trang_thai,ngay_tao,ngay_cap_nhat FROM NhanVien WHERE id=${id}`;
  return r.recordset[0] || null;
}

async function checkDuplicateStaff({ email, ten_dang_nhap, excludeId = null }) {
  if (excludeId) {
    const r = await sql.query`SELECT TOP 1 id,email,ten_dang_nhap FROM NhanVien WHERE (email=${email} OR ten_dang_nhap=${ten_dang_nhap}) AND id<>${excludeId}`;
    return r.recordset[0] || null;
  }
  const r = await sql.query`SELECT TOP 1 id,email,ten_dang_nhap FROM NhanVien WHERE email=${email} OR ten_dang_nhap=${ten_dang_nhap}`;
  return r.recordset[0] || null;
}

async function upsertPermission(nhanVienId, quyen) {
  const p = normalizePermissions(quyen);
  const exists = await sql.query`SELECT TOP 1 nhan_vien_id FROM Quyen WHERE nhan_vien_id=${nhanVienId}`;

  if (exists.recordset.length) {
    await sql.query`
      UPDATE Quyen SET
        view_form=${p.view_form?1:0}, add_form=${p.add_form?1:0}, edit_form=${p.edit_form?1:0}, delete_form=${p.delete_form?1:0},
        view_approval=${p.view_approval?1:0}, approve=${p.approve?1:0}, share_form=${p.share_form?1:0},
        view_report=${p.view_report?1:0}, export_data=${p.export_data?1:0},
        view_staff=${p.view_staff?1:0}, manage_staff=${p.manage_staff?1:0},
        view_notif=${p.view_notif?1:0}, send_notif=${p.send_notif?1:0},
        view_library=${p.view_library?1:0}, add_library=${p.add_library?1:0}, edit_library=${p.edit_library?1:0}, delete_library=${p.delete_library?1:0},
        view_feedback=${p.view_feedback?1:0}, delete_feedback=${p.delete_feedback?1:0}
      WHERE nhan_vien_id=${nhanVienId}
    `;
  } else {
    await sql.query`
      INSERT INTO Quyen (
        nhan_vien_id,
        view_form, add_form, edit_form, delete_form,
        view_approval, approve, share_form,
        view_report, export_data,
        view_staff, manage_staff,
        view_notif, send_notif,
        view_library, add_library, edit_library, delete_library,
        view_feedback, delete_feedback
      ) VALUES (
        ${nhanVienId},
        ${p.view_form?1:0}, ${p.add_form?1:0}, ${p.edit_form?1:0}, ${p.delete_form?1:0},
        ${p.view_approval?1:0}, ${p.approve?1:0}, ${p.share_form?1:0},
        ${p.view_report?1:0}, ${p.export_data?1:0},
        ${p.view_staff?1:0}, ${p.manage_staff?1:0},
        ${p.view_notif?1:0}, ${p.send_notif?1:0},
        ${p.view_library?1:0}, ${p.add_library?1:0}, ${p.edit_library?1:0}, ${p.delete_library?1:0},
        ${p.view_feedback?1:0}, ${p.delete_feedback?1:0}
      )
    `;
  }
}


// GET /api/staff
router.get('/', authMiddleware, authorize('view_staff'), async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : null;
    let result;
    if (search) {
      const req2 = new sql.Request();
      req2.input('s', sql.NVarChar, `%${search}%`);
      result = await req2.query(`
        SELECT n.id,n.ho_ten,n.email,n.so_dien_thoai,n.ten_dang_nhap,n.vai_tro,n.phong_ban,n.trang_thai,n.ngay_tao,q.view_staff,q.manage_staff
        FROM NhanVien n LEFT JOIN Quyen q ON q.nhan_vien_id=n.id
        WHERE n.trang_thai='active' AND (n.ho_ten LIKE @s OR n.email LIKE @s OR n.ten_dang_nhap LIKE @s)
        ORDER BY n.ho_ten ASC
      `);
    } else {
      result = await sql.query`
        SELECT n.id,n.ho_ten,n.email,n.so_dien_thoai,n.ten_dang_nhap,n.vai_tro,n.phong_ban,n.trang_thai,n.ngay_tao,q.view_staff,q.manage_staff
        FROM NhanVien n LEFT JOIN Quyen q ON q.nhan_vien_id=n.id ORDER BY n.ngay_tao DESC
      `;
    }
    res.json(result.recordset);
  } catch (err) {
    err500(res, err, 'Lỗi server khi lấy danh sách nhân viên');
  }
});

// GET /api/staff/:id
router.get('/:id', authMiddleware, authorize('view_staff'), async (req, res) => {
  const staffId = Number(req.params.id);
  if (!validId(staffId)) return res.status(400).json({ message: 'ID nhân viên không hợp lệ' });
  try {
    const result = await sql.query`
      SELECT
        n.id, n.ho_ten, n.email, n.so_dien_thoai, n.ten_dang_nhap,
        n.vai_tro, n.phong_ban, n.trang_thai, n.ngay_tao, n.ngay_cap_nhat,
        q.view_form, q.add_form, q.edit_form, q.delete_form,
        q.view_approval, q.approve, q.share_form,
        q.view_report, q.export_data,
        q.view_staff, q.manage_staff,
        q.view_notif, q.send_notif,
        q.view_library, q.add_library, q.edit_library, q.delete_library,
        q.view_feedback, q.delete_feedback
      FROM NhanVien n LEFT JOIN Quyen q ON q.nhan_vien_id=n.id
      WHERE n.id=${staffId}
    `;
    if (!result.recordset[0]) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    res.json(result.recordset[0]);
  } catch (err) {
    err500(res, err);
  }
});

// POST /api/staff
router.post('/', authMiddleware, authorize('manage_staff'), async (req, res) => {
  const { ho_ten, email, so_dien_thoai, ten_dang_nhap, mat_khau, vai_tro, phong_ban, trang_thai, quyen } = req.body;
  if (!ho_ten || !email || !ten_dang_nhap || !mat_khau)
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin bắt buộc' });

  try {
    const cleanEmail = String(email).trim();
    const cleanUser  = String(ten_dang_nhap).trim();
    const cleanName  = String(ho_ten).trim();

    if (await checkDuplicateStaff({ email: cleanEmail, ten_dang_nhap: cleanUser }))
      return res.status(400).json({ message: 'Email hoặc tên đăng nhập đã tồn tại' });

    const hash = await bcrypt.hash(String(mat_khau), 10);
    const insertResult = await sql.query`
      INSERT INTO NhanVien (ho_ten,email,so_dien_thoai,ten_dang_nhap,mat_khau,vai_tro,phong_ban,trang_thai)
      OUTPUT INSERTED.id
      VALUES (${cleanName},${cleanEmail},${so_dien_thoai||null},${cleanUser},${hash},${vai_tro||'staff'},${phong_ban||null},${trang_thai||'active'})
    `;
    const newId = insertResult.recordset[0].id;
    await upsertPermission(newId, quyen || {});
    res.status(201).json({ message: 'Thêm nhân viên thành công', id: newId });
  } catch (err) {
    err500(res, err);
  }
});

// PUT /api/staff/:id
router.put('/:id', authMiddleware, authorize('manage_staff'), async (req, res) => {
  const staffId = Number(req.params.id);
  const { ho_ten, email, so_dien_thoai, vai_tro, phong_ban, trang_thai, mat_khau, quyen } = req.body;

  if (!validId(staffId)) return res.status(400).json({ message: 'ID nhân viên không hợp lệ' });
  if (!ho_ten || !email) return res.status(400).json({ message: 'Họ tên và email là bắt buộc' });

  try {
    const existing = await getStaffById(staffId);
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });

    const cleanEmail = String(email).trim();
    const cleanName  = String(ho_ten).trim();
    const dup = await checkDuplicateStaff({ email: cleanEmail, ten_dang_nhap: existing.ten_dang_nhap, excludeId: staffId });
    if (dup?.email === cleanEmail) return res.status(400).json({ message: 'Email đã tồn tại' });

    if (quyen && Number(req.user?.id) === staffId && !normalizePermissions(quyen).manage_staff)
      return res.status(400).json({ message: 'Không thể tự gỡ quyền quản lý nhân viên của chính mình' });

    if (mat_khau && String(mat_khau).trim()) {
      const hash = await bcrypt.hash(String(mat_khau).trim(), 10);
      await sql.query`
        UPDATE NhanVien SET ho_ten=${cleanName},email=${cleanEmail},so_dien_thoai=${so_dien_thoai||null},
          vai_tro=${vai_tro||'staff'},phong_ban=${phong_ban||null},trang_thai=${trang_thai||'active'},
          mat_khau=${hash},ngay_cap_nhat=GETDATE()
        WHERE id=${staffId}
      `;
    } else {
      await sql.query`
        UPDATE NhanVien SET ho_ten=${cleanName},email=${cleanEmail},so_dien_thoai=${so_dien_thoai||null},
          vai_tro=${vai_tro||'staff'},phong_ban=${phong_ban||null},trang_thai=${trang_thai||'active'},ngay_cap_nhat=GETDATE()
        WHERE id=${staffId}
      `;
    }

    if (quyen) await upsertPermission(staffId, quyen);
    res.json({ message: 'Cập nhật nhân viên thành công' });
  } catch (err) {
    err500(res, err);
  }
});

// PATCH /api/staff/:id/status
router.patch('/:id/status', authMiddleware, authorize('manage_staff'), async (req, res) => {
  const staffId = Number(req.params.id);
  if (!validId(staffId)) return res.status(400).json({ message: 'ID nhân viên không hợp lệ' });
  const { trang_thai } = req.body;
  if (!['active', 'inactive'].includes(trang_thai))
    return res.status(400).json({ message: 'Trạng thái không hợp lệ (active hoặc inactive)' });
  if (Number(req.user?.id) === staffId)
    return res.status(400).json({ message: 'Không thể vô hiệu hóa tài khoản đang đăng nhập' });
  try {
    const existing = await getStaffById(staffId);
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    await sql.query`UPDATE NhanVien SET trang_thai=${trang_thai}, ngay_cap_nhat=GETDATE() WHERE id=${staffId}`;
    const label = trang_thai === 'inactive' ? 'Vô hiệu hóa' : 'Kích hoạt lại';
    res.json({ message: `${label} nhân viên thành công` });
  } catch (err) {
    err500(res, err);
  }
});

// DELETE /api/staff/:id
router.delete('/:id', authMiddleware, authorize('manage_staff'), async (req, res) => {
  const staffId = Number(req.params.id);
  if (!validId(staffId)) return res.status(400).json({ message: 'ID nhân viên không hợp lệ' });
  try {
    if (!await getStaffById(staffId)) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    if (Number(req.user?.id) === staffId) return res.status(400).json({ message: 'Không thể tự xóa tài khoản đang đăng nhập' });
    await sql.query`DELETE FROM NhanVien WHERE id=${staffId}`;
    res.json({ message: 'Xóa nhân viên thành công' });
  } catch (err) {
    err500(res, err);
  }
});

module.exports = router;