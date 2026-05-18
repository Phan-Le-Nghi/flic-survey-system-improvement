const { sql } = require('../config/db');

const ALLOWED_PERMISSIONS = new Set([
  'view_form', 'add_form', 'edit_form', 'delete_form',
  'view_approval', 'approve', 'share_form',
  'view_report', 'export_data',
  'view_staff', 'manage_staff',
  'view_notif', 'send_notif',
  'view_library', 'add_library', 'edit_library', 'delete_library',
  'view_feedback', 'delete_feedback',
]);

function authorize(permissionKey) {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) return res.status(401).json({ message: 'Chua xac thuc nguoi dung' });

      // Chỉ admin mới có toàn quyền, manager và staff đều kiểm tra quyền
      if (req.user.vai_tro === 'admin') return next();

      if (!ALLOWED_PERMISSIONS.has(permissionKey))
        return res.status(400).json({ message: 'Permission khong hop le: ' + permissionKey });

      const req2 = new sql.Request();
      req2.input('uid', sql.Int, req.user.id);
      const result = await req2.query(
        `SELECT [${permissionKey}] AS allowed FROM Quyen WHERE nhan_vien_id = @uid`
      );

      if (!result.recordset.length || !result.recordset[0].allowed)
        return res.status(403).json({ message: 'Ban khong co quyen thuc hien chuc nang nay' });

      next();
    } catch (err) {
      return res.status(500).json({ message: 'Loi kiem tra quyen', error: err.message });
    }
  };
}

module.exports = authorize;