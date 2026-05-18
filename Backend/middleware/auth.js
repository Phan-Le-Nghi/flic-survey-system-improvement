const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'flic_secret_key_2026';

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) return res.status(401).json({ message: 'Không có token xác thực' });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ message: 'Token không hợp lệ' });

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError')
      return res.status(401).json({ message: 'Token đã hết hạn' });
    if (error.name === 'JsonWebTokenError')
      return res.status(401).json({ message: 'Token không hợp lệ' });
    return res.status(500).json({ message: 'Lỗi xác thực người dùng', error: error.message });
  }
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user?.vai_tro) return res.status(401).json({ message: 'Chưa xác thực người dùng' });
    if (!allowedRoles.includes(req.user.vai_tro))
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này' });
    next();
  };
}

module.exports = {
  JWT_SECRET,
  authMiddleware,
  adminOnly: requireRole(['admin']),
  managerOrAdmin: requireRole(['admin', 'manager']),
  requireRole,
};
