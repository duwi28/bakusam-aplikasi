const jwt = require('jsonwebtoken');
const userService = require('../services/userService');

// Middleware untuk verifikasi token JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Token tidak ditemukan',
        message: 'Silakan login terlebih dahulu' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userService.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ 
        error: 'Token tidak valid',
        message: 'User tidak ditemukan' 
      });
    }

    if (!user.is_active) {
      return res.status(401).json({ 
        error: 'Akun dinonaktifkan',
        message: 'Akun Anda telah dinonaktifkan' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Token tidak valid',
        message: 'Token yang diberikan tidak valid' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Token telah kadaluarsa, silakan login ulang' 
      });
    }
    return res.status(500).json({ 
      error: 'Error autentikasi',
      message: 'Terjadi kesalahan pada server' 
    });
  }
};

// Middleware untuk memeriksa role
const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Tidak terautentikasi',
        message: 'Silakan login terlebih dahulu' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Akses ditolak',
        message: 'Anda tidak memiliki izin untuk mengakses resource ini' 
      });
    }

    next();
  };
};

// Middleware khusus untuk driver
const authorizeDriver = (req, res, next) => {
  return authorizeRole('driver')(req, res, next);
};

// Middleware khusus untuk customer
const authorizeCustomer = (req, res, next) => {
  return authorizeRole('customer')(req, res, next);
};

// Middleware khusus untuk admin
const authorizeAdmin = (req, res, next) => {
  return authorizeRole('admin')(req, res, next);
};

// Middleware untuk memeriksa kepemilikan resource
const authorizeOwner = (resourceModel, resourceIdField = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdField];
      const resource = await resourceModel.findById(resourceId);

      if (!resource) {
        return res.status(404).json({ 
          error: 'Resource tidak ditemukan',
          message: 'Data yang dicari tidak ditemukan' 
        });
      }

      // Admin bisa akses semua resource
      if (req.user.role === 'admin') {
        req.resource = resource;
        return next();
      }

      // Cek kepemilikan resource
      const ownerField = resource.customer_id ? 'customer_id' : 'driver_id';
      if (resource[ownerField].toString() !== req.user.id.toString()) {
        return res.status(403).json({ 
          error: 'Akses ditolak',
          message: 'Anda tidak memiliki izin untuk mengakses resource ini' 
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      return res.status(500).json({ 
        error: 'Error otorisasi',
        message: 'Terjadi kesalahan pada server' 
      });
    }
  };
};

module.exports = {
  authenticateToken,
  authorizeRole,
  authorizeDriver,
  authorizeCustomer,
  authorizeAdmin,
  authorizeOwner
}; 