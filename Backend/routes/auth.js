const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { sql } = require('../config/db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const { err500 } = require('../utils/helpers');

const SECRET = JWT_SECRET;

const QUYEN_FIELDS = `
  q.view_form, q.add_form, q.edit_form, q.delete_form, q.share_form,
  q.view_approval, q.approve, q.view_report, q.export_data,
  q.view_staff, q.manage_staff, q.view_notif, q.send_notif,
  q.view_library, q.add_library, q.edit_library, q.delete_library,
  q.view_feedback, q.delete_feedback
`;

function mapQuyen(u) {
  return {
    view_form: !!u.view_form, add_form: !!u.add_form,
    edit_form: !!u.edit_form, delete_form: !!u.delete_form, share_form: !!u.share_form,
    view_approval: !!u.view_approval, approve: !!u.approve,
    view_report: !!u.view_report, export_data: !!u.export_data,
    view_staff: !!u.view_staff, manage_staff: !!u.manage_staff,
    view_notif: !!u.view_notif, send_notif: !!u.send_notif,
    view_library: !!u.view_library, add_library: !!u.add_library,
    edit_library: !!u.edit_library, delete_library: !!u.delete_library,
    view_feedback: !!u.view_feedback, delete_feedback: !!u.delete_feedback,
  };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { ten_dang_nhap, mat_khau } = req.body;
  if (!ten_dang_nhap || !mat_khau)
    return res.status(400).json({ message: 'Vui long nhap day du thong tin' });

  try {
    const result = await sql.query`
      SELECT n.id, n.ho_ten, n.email, n.so_dien_thoai, n.ten_dang_nhap,
             n.mat_khau, n.vai_tro, n.phong_ban, n.trang_thai, n.ngay_tao, n.ngay_cap_nhat,
             q.view_form, q.add_form, q.edit_form, q.delete_form, q.share_form,
             q.view_approval, q.approve, q.view_report, q.export_data,
             q.view_staff, q.manage_staff, q.view_notif, q.send_notif,
             q.view_library, q.add_library, q.edit_library, q.delete_library,
             q.view_feedback, q.delete_feedback
      FROM NhanVien n LEFT JOIN Quyen q ON q.nhan_vien_id = n.id
      WHERE n.ten_dang_nhap = ${ten_dang_nhap} AND n.trang_thai = 'active'
    `;
    const user = result.recordset[0];

    if (!user) return res.status(401).json({ message: 'Tai khoan khong ton tai hoac da bi khoa' });

    if (!await bcrypt.compare(mat_khau, user.mat_khau))
      return res.status(401).json({ message: 'Mat khau khong dung' });

    const token = jwt.sign({ id: user.id, vai_tro: user.vai_tro }, SECRET, { expiresIn: '8h' });
    res.json({
      message: 'Dang nhap thanh cong', token,
      user: { id: user.id, ho_ten: user.ho_ten, email: user.email, vai_tro: user.vai_tro, phong_ban: user.phong_ban },
      quyen: mapQuyen(user),
    });
  } catch (err) {
    err500(res, err);
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await sql.query`
      SELECT n.id, n.ho_ten, n.email, n.so_dien_thoai, n.ten_dang_nhap,
             n.vai_tro, n.phong_ban, n.trang_thai, n.ngay_tao,
             q.view_form, q.add_form, q.edit_form, q.delete_form, q.share_form,
             q.view_approval, q.approve, q.view_report, q.export_data,
             q.view_staff, q.manage_staff, q.view_notif, q.send_notif,
             q.view_library, q.add_library, q.edit_library, q.delete_library,
             q.view_feedback, q.delete_feedback
      FROM NhanVien n LEFT JOIN Quyen q ON q.nhan_vien_id = n.id
      WHERE n.id = ${req.user.id}
    `;
    if (!result.recordset[0]) return res.status(404).json({ message: 'Nguoi dung khong ton tai' });
    res.json(result.recordset[0]);
  } catch (err) {
    err500(res, err);
  }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req, res) => {
  const { ho_ten, email, so_dien_thoai } = req.body;
  if (!ho_ten || !email) return res.status(400).json({ message: 'Ho ten va email la bat buoc' });
  try {
    const dup = await sql.query`SELECT TOP 1 id FROM NhanVien WHERE email = ${email} AND id <> ${req.user.id}`;
    if (dup.recordset.length) return res.status(409).json({ message: 'Email da duoc dung boi tai khoan khac' });

    await sql.query`
      UPDATE NhanVien SET ho_ten=${ho_ten}, email=${email}, so_dien_thoai=${so_dien_thoai||null}, ngay_cap_nhat=GETDATE()
      WHERE id = ${req.user.id}
    `;
    res.json({ message: 'Cap nhat thong tin thanh cong' });
  } catch (err) {
    err500(res, err);
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  const { mat_khau_cu, mat_khau_moi } = req.body;
  if (!mat_khau_cu || !mat_khau_moi)
    return res.status(400).json({ message: 'Vui long nhap day du thong tin' });
  try {
    const result = await sql.query`SELECT mat_khau FROM NhanVien WHERE id = ${req.user.id}`;
    if (!result.recordset[0]) return res.status(404).json({ message: 'Nguoi dung khong ton tai' });
    if (!await bcrypt.compare(mat_khau_cu, result.recordset[0].mat_khau))
      return res.status(401).json({ message: 'Mat khau cu khong dung' });

    const hash = await bcrypt.hash(mat_khau_moi, 10);
    await sql.query`UPDATE NhanVien SET mat_khau=${hash}, ngay_cap_nhat=GETDATE() WHERE id=${req.user.id}`;
    res.json({ message: 'Doi mat khau thanh cong' });
  } catch (err) {
    err500(res, err);
  }
});

module.exports = router;
