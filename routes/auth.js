const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const userService = require('../services/userService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Register
router.post('/register', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nama harus 2-50 karakter'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email tidak valid'),
  body('phone')
    .matches(/^(\+62|62|0)8[1-9][0-9]{6,9}$/)
    .withMessage('Nomor telepon tidak valid'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password minimal 6 karakter'),
  body('role')
    .optional()
    .isIn(['customer', 'driver'])
    .withMessage('Role harus customer atau driver')
], async (req, res) => {
  try {
    // Validasi input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Data tidak valid',
        message: 'Mohon periksa data yang dimasukkan',
        details: errors.array()
      });
    }

    const { name, email, phone, password, role = 'customer' } = req.body;

    // Cek apakah email sudah terdaftar
    const existingEmail = await userService.findByEmail(email);
    if (existingEmail) {
      return res.status(400).json({
        error: 'Email sudah terdaftar',
        message: 'Email ini sudah digunakan'
      });
    }

    // Cek apakah nomor telepon sudah terdaftar
    const existingPhone = await userService.findByPhone(phone);
    if (existingPhone) {
      return res.status(400).json({
        error: 'Nomor telepon sudah terdaftar',
        message: 'Nomor telepon ini sudah digunakan'
      });
    }

    // Buat user baru
    const user = await userService.createUser({
      name,
      email,
      phone,
      password,
      role
    });

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: {
        user,
        token
      }
    });

  } catch (error) {
    console.error('Error register:', error);
    res.status(500).json({
      error: 'Error registrasi',
      message: 'Terjadi kesalahan saat registrasi'
    });
  }
});

// Login
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email tidak valid'),
  body('password')
    .notEmpty()
    .withMessage('Password wajib diisi')
], async (req, res) => {
  try {
    // Validasi input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Data tidak valid',
        message: 'Mohon periksa data yang dimasukkan',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Cari user berdasarkan email
    const user = await userService.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Login gagal',
        message: 'Email atau password salah'
      });
    }

    // Cek apakah user aktif
    if (!user.is_active) {
      return res.status(401).json({
        error: 'Akun dinonaktifkan',
        message: 'Akun Anda telah dinonaktifkan'
      });
    }

    // Verifikasi password
    const isPasswordValid = await userService.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Login gagal',
        message: 'Email atau password salah'
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        user: userWithoutPassword,
        token
      }
    });

  } catch (error) {
    console.error('Error login:', error);
    res.status(500).json({
      error: 'Error login',
      message: 'Terjadi kesalahan saat login'
    });
  }
});

// Login dengan nomor telepon (untuk driver)
router.post('/login-phone', [
  body('phone')
    .matches(/^(\+62|62|0)8[1-9][0-9]{6,9}$/)
    .withMessage('Nomor telepon tidak valid'),
  body('password')
    .notEmpty()
    .withMessage('Password wajib diisi')
], async (req, res) => {
  try {
    // Validasi input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Data tidak valid',
        message: 'Mohon periksa data yang dimasukkan',
        details: errors.array()
      });
    }

    const { phone, password } = req.body;

    // Cari user berdasarkan nomor telepon
    const user = await userService.findByPhone(phone);
    if (!user) {
      return res.status(401).json({
        error: 'Login gagal',
        message: 'Nomor telepon atau password salah'
      });
    }

    // Cek apakah user aktif
    if (!user.is_active) {
      return res.status(401).json({
        error: 'Akun dinonaktifkan',
        message: 'Akun Anda telah dinonaktifkan'
      });
    }

    // Verifikasi password
    const isPasswordValid = await userService.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Login gagal',
        message: 'Nomor telepon atau password salah'
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        user: userWithoutPassword,
        token
      }
    });

  } catch (error) {
    console.error('Error login:', error);
    res.status(500).json({
      error: 'Error login',
      message: 'Terjadi kesalahan saat login'
    });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await userService.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: 'User tidak ditemukan',
        message: 'Data user tidak ditemukan'
      });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        user: userWithoutPassword
      }
    });
  } catch (error) {
    console.error('Error get current user:', error);
    res.status(500).json({
      error: 'Error get current user',
      message: 'Terjadi kesalahan saat mengambil data user'
    });
  }
});

// Logout (client-side token removal)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Dalam implementasi JWT, logout dilakukan di client dengan menghapus token
    // Server tidak perlu melakukan apa-apa karena JWT stateless
    res.json({
      success: true,
      message: 'Logout berhasil'
    });
  } catch (error) {
    console.error('Error logout:', error);
    res.status(500).json({
      error: 'Error logout',
      message: 'Terjadi kesalahan saat logout'
    });
  }
});

// Refresh token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // Generate token baru
    const token = generateToken(req.user.id);

    res.json({
      success: true,
      message: 'Token berhasil diperbarui',
      data: {
        token
      }
    });
  } catch (error) {
    console.error('Error refresh token:', error);
    res.status(500).json({
      error: 'Error refresh token',
      message: 'Terjadi kesalahan saat memperbarui token'
    });
  }
});

module.exports = router; 