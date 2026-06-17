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

const DEFAULT_ROLE_PERMISSIONS = {
  admin: Object.fromEntries([...ALLOWED_PERMISSIONS].map(key => [key, true])),
  manager: {
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
  },
  staff: {
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
  },
};

function defaultAllows(role, permissionKey) {
  return !!DEFAULT_ROLE_PERMISSIONS[String(role || '').toLowerCase()]?.[permissionKey];
}

async function hasPermissionSchema(permissionKey) {
  const req = new sql.Request();
  req.input('permissionKey', sql.NVarChar, permissionKey);
  const result = await req.query(`
    SELECT CASE WHEN
      EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Quyen' AND COLUMN_NAME = 'nhan_vien_id'
      )
      AND EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Quyen' AND COLUMN_NAME = @permissionKey
      )
    THEN 1 ELSE 0 END AS ready
  `);
  return !!result.recordset[0]?.ready;
}

function authorize(permissionKey) {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) return res.status(401).json({ message: 'Chưa xác thực người dùng' });

      const role = String(req.user.vai_tro || '').toLowerCase();

      // Admin và manager có toàn quyền, khớp với cách frontend đang mở menu quản lý.
      if (role === 'admin' || role === 'manager') return next();

      if (!ALLOWED_PERMISSIONS.has(permissionKey))
        return res.status(400).json({ message: 'Quyền không hợp lệ: ' + permissionKey });

      if (!await hasPermissionSchema(permissionKey)) {
        if (defaultAllows(role, permissionKey)) return next();
        return res.status(403).json({ message: 'Bạn không có quyền thực hiện chức năng này' });
      }

      const req2 = new sql.Request();
      req2.input('uid', sql.Int, req.user.id);
      const result = await req2.query(
        `SELECT [${permissionKey}] AS allowed FROM Quyen WHERE nhan_vien_id = @uid`
      );

      if (!result.recordset.length) {
        if (defaultAllows(role, permissionKey)) return next();
        return res.status(403).json({ message: 'Bạn không có quyền thực hiện chức năng này' });
      }

      if (!result.recordset[0].allowed)
        return res.status(403).json({ message: 'Bạn không có quyền thực hiện chức năng này' });

      next();
    } catch (err) {
      if (defaultAllows(req.user?.vai_tro, permissionKey)) {
        console.warn('Permission DB check failed, using role defaults:', err.message);
        return next();
      }

      if (/Invalid object name|Invalid column name|Quyen/i.test(err.message || '')) {
        return res.status(403).json({ message: 'Bạn không có quyền thực hiện chức năng này' });
      }
      return res.status(500).json({ message: 'Lỗi kiểm tra quyền', error: err.message });
    }
  };
}

module.exports = authorize;
