const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { sql } = require('../config/db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const { err500 } = require('../utils/helpers');

const SECRET = JWT_SECRET;

function getDefaultQuyen(vai_tro) {
  if (vai_tro === 'admin') {
    return {
      view_form: true,
      add_form: true,
      edit_form: true,
      delete_form: true,
      share_form: true,

      view_approval: true,
      approve: true,

      view_report: true,
      export_data: true,

      view_staff: true,
      manage_staff: true,

      view_notif: true,
      send_notif: true,

      view_library: true,
      add_library: true,
      edit_library: true,
      delete_library: true,

      view_feedback: true,
      delete_feedback: true,
    };
  }

  return {
    view_form: true,
    add_form: true,
    edit_form: true,
    delete_form: false,
    share_form: true,

    view_approval: true,
    approve: false,

    view_report: true,
    export_data: true,

    view_staff: false,
    manage_staff: false,

    view_notif: true,
    send_notif: false,

    view_library: true,
    add_library: true,
    edit_library: true,
    delete_library: false,

    view_feedback: true,
    delete_feedback: false,
  };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { ten_dang_nhap, mat_khau } = req.body;

  if (!ten_dang_nhap || !mat_khau) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
  }

  try {
    const result = await sql.query`
      SELECT 
        id, ho_ten, email, so_dien_thoai, ten_dang_nhap,
        mat_khau, vai_tro, phong_ban, trang_thai, ngay_tao, ngay_cap_nhat
      FROM NhanVien
      WHERE ten_dang_nhap = ${ten_dang_nhap}
        AND trang_thai = 'active'
    `;

    const user = result.recordset[0];

    if (!user) {
      return res.status(401).json({ message: 'Tài khoản không tồn tại hoặc đã bị khóa' });
    }

    const isMatch = await bcrypt.compare(mat_khau, user.mat_khau);

    if (!isMatch) {
      return res.status(401).json({ message: 'Mật khẩu không đúng' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        vai_tro: user.vai_tro,
        ten_dang_nhap: user.ten_dang_nhap,
      },
      SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user.id,
        ho_ten: user.ho_ten,
        email: user.email,
        ten_dang_nhap: user.ten_dang_nhap,
        vai_tro: user.vai_tro,
        phong_ban: user.phong_ban,
      },
      quyen: getDefaultQuyen(user.vai_tro),
    });
  } catch (err) {
    console.error('❌ Lỗi đăng nhập:', err);
    err500(res, err);
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        id, ho_ten, email, so_dien_thoai, ten_dang_nhap,
        vai_tro, phong_ban, trang_thai, ngay_tao, ngay_cap_nhat
      FROM NhanVien
      WHERE id = ${req.user.id}
    `;

    const user = result.recordset[0];

    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    res.json({
      ...user,
      quyen: getDefaultQuyen(user.vai_tro),
    });
  } catch (err) {
    console.error('❌ Lỗi lấy thông tin người dùng:', err);
    err500(res, err);
  }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req, res) => {
  const { ho_ten, email, so_dien_thoai } = req.body;

  if (!ho_ten || !email) {
    return res.status(400).json({ message: 'Họ tên và email là bắt buộc' });
  }

  try {
    const dup = await sql.query`
      SELECT TOP 1 id 
      FROM NhanVien 
      WHERE email = ${email} 
        AND id <> ${req.user.id}
    `;

    if (dup.recordset.length) {
      return res.status(409).json({ message: 'Email đã được dùng bởi tài khoản khác' });
    }

    await sql.query`
      UPDATE NhanVien 
      SET 
        ho_ten = ${ho_ten}, 
        email = ${email}, 
        so_dien_thoai = ${so_dien_thoai || null}, 
        ngay_cap_nhat = GETDATE()
      WHERE id = ${req.user.id}
    `;

    res.json({ message: 'Cập nhật thông tin thành công' });
  } catch (err) {
    console.error('❌ Lỗi cập nhật profile:', err);
    err500(res, err);
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  const { mat_khau_cu, mat_khau_moi } = req.body;

  if (!mat_khau_cu || !mat_khau_moi) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
  }

  try {
    const result = await sql.query`
      SELECT mat_khau 
      FROM NhanVien 
      WHERE id = ${req.user.id}
    `;

    if (!result.recordset[0]) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    const isMatch = await bcrypt.compare(mat_khau_cu, result.recordset[0].mat_khau);

    if (!isMatch) {
      return res.status(401).json({ message: 'Mật khẩu cũ không đúng' });
    }

    const hash = await bcrypt.hash(mat_khau_moi, 10);

    await sql.query`
      UPDATE NhanVien 
      SET mat_khau = ${hash}, ngay_cap_nhat = GETDATE() 
      WHERE id = ${req.user.id}
    `;

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error('❌ Lỗi đổi mật khẩu:', err);
    err500(res, err);
  }
});

module.exports = router;