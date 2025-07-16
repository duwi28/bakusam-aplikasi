const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Error get user profile:', error);
    res.status(500).json({
      error: 'Error get user profile',
      message: 'Terjadi kesalahan saat mengambil data profile'
    });
  }
});

// Update user profile
router.put('/profile', [
  authenticateToken,
  body('name').optional().isLength({ min: 2, max: 50 }).withMessage('Nama harus 2-50 karakter'),
  body('phone').optional().matches(/^(\+62|62|0)8[1-9][0-9]{6,9}$/).withMessage('Nomor telepon tidak valid'),
  body('customerData.homeAddress').optional().isLength({ max: 200 }).withMessage('Alamat rumah maksimal 200 karakter'),
  body('customerData.workAddress').optional().isLength({ max: 200 }).withMessage('Alamat kerja maksimal 200 karakter'),
  body('emergencyContact.name').optional().isLength({ max: 50 }).withMessage('Nama kontak darurat maksimal 50 karakter'),
  body('emergencyContact.phone').optional().matches(/^(\+62|62|0)8[1-9][0-9]{6,9}$/).withMessage('Nomor telepon kontak darurat tidak valid'),
  body('emergencyContact.relationship').optional().isLength({ max: 20 }).withMessage('Hubungan maksimal 20 karakter'),
  body('preferences.language').optional().isIn(['id', 'en']).withMessage('Bahasa tidak valid'),
  body('preferences.notifications').optional().isBoolean().withMessage('Preferensi notifikasi harus boolean')
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

    const updateData = req.body;

    // Update data yang diizinkan
    if (updateData.name) req.user.name = updateData.name;
    if (updateData.phone) req.user.phone = updateData.phone;
    
    if (updateData.customerData) {
      if (updateData.customerData.homeAddress) req.user.customerData.homeAddress = updateData.customerData.homeAddress;
      if (updateData.customerData.workAddress) req.user.customerData.workAddress = updateData.customerData.workAddress;
    }
    
    if (updateData.emergencyContact) {
      if (updateData.emergencyContact.name) req.user.emergencyContact.name = updateData.emergencyContact.name;
      if (updateData.emergencyContact.phone) req.user.emergencyContact.phone = updateData.emergencyContact.phone;
      if (updateData.emergencyContact.relationship) req.user.emergencyContact.relationship = updateData.emergencyContact.relationship;
    }
    
    if (updateData.preferences) {
      if (updateData.preferences.language) req.user.preferences.language = updateData.preferences.language;
      if (updateData.preferences.notifications !== undefined) req.user.preferences.notifications = updateData.preferences.notifications;
    }

    await req.user.save();

    res.json({
      success: true,
      message: 'Profile berhasil diperbarui',
      data: {
        user: req.user
      }
    });

  } catch (error) {
    console.error('Error update user profile:', error);
    res.status(500).json({
      error: 'Error update user profile',
      message: 'Terjadi kesalahan saat memperbarui profile'
    });
  }
});

// Change password
router.put('/change-password', [
  authenticateToken,
  body('currentPassword').notEmpty().withMessage('Password saat ini wajib diisi'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password baru minimal 6 karakter')
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

    const { currentPassword, newPassword } = req.body;

    // Verifikasi password saat ini
    const isCurrentPasswordValid = await req.user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: 'Password salah',
        message: 'Password saat ini tidak benar'
      });
    }

    // Update password baru
    req.user.password = newPassword;
    await req.user.save();

    res.json({
      success: true,
      message: 'Password berhasil diubah'
    });

  } catch (error) {
    console.error('Error change password:', error);
    res.status(500).json({
      error: 'Error change password',
      message: 'Terjadi kesalahan saat mengubah password'
    });
  }
});

// Upload avatar
router.post('/avatar', authenticateToken, async (req, res) => {
  try {
    // Dalam implementasi nyata, ini akan menggunakan multer untuk upload file
    // Untuk contoh ini, kita asumsikan URL avatar sudah dikirim dari client
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({
        error: 'URL avatar diperlukan',
        message: 'URL avatar wajib diisi'
      });
    }

    req.user.avatar = avatarUrl;
    await req.user.save();

    res.json({
      success: true,
      message: 'Avatar berhasil diperbarui',
      data: {
        avatar: req.user.avatar
      }
    });

  } catch (error) {
    console.error('Error upload avatar:', error);
    res.status(500).json({
      error: 'Error upload avatar',
      message: 'Terjadi kesalahan saat upload avatar'
    });
  }
});

// Get all users (Admin only)
router.get('/', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { role, page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error get users:', error);
    res.status(500).json({
      error: 'Error get users',
      message: 'Terjadi kesalahan saat mengambil data users'
    });
  }
});

// Get user by ID (Admin only)
router.get('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        error: 'User tidak ditemukan',
        message: 'Data user tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Error get user by ID:', error);
    res.status(500).json({
      error: 'Error get user by ID',
      message: 'Terjadi kesalahan saat mengambil data user'
    });
  }
});

// Update user status (Admin only)
router.patch('/:id/status', [
  authenticateToken,
  authorizeAdmin,
  body('isActive').isBoolean().withMessage('Status aktif harus boolean')
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

    const { isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: 'User tidak ditemukan',
        message: 'Data user tidak ditemukan'
      });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: `Status user berhasil diubah menjadi ${isActive ? 'aktif' : 'nonaktif'}`,
      data: {
        user: user.toPublicJSON()
      }
    });

  } catch (error) {
    console.error('Error update user status:', error);
    res.status(500).json({
      error: 'Error update user status',
      message: 'Terjadi kesalahan saat memperbarui status user'
    });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: 'User tidak ditemukan',
        message: 'Data user tidak ditemukan'
      });
    }

    // Soft delete - set isActive to false instead of actually deleting
    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: 'User berhasil dinonaktifkan'
    });

  } catch (error) {
    console.error('Error delete user:', error);
    res.status(500).json({
      error: 'Error delete user',
      message: 'Terjadi kesalahan saat menghapus user'
    });
  }
});

// Search drivers (for customer to see available drivers)
router.get('/drivers/search', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, vehicleType, maxDistance = 5000 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Lokasi diperlukan',
        message: 'Latitude dan longitude diperlukan'
      });
    }

    let query = {
      role: 'driver',
      'driverData.isOnline': true,
      isActive: true
    };

    if (vehicleType) {
      query['driverData.vehicleType'] = vehicleType;
    }

    const drivers = await User.find({
      ...query,
      'driverData.currentLocation': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      }
    })
    .select('name phone driverData.vehicleType driverData.licensePlate driverData.rating driverData.totalTrips')
    .limit(10);

    res.json({
      success: true,
      data: {
        drivers
      }
    });

  } catch (error) {
    console.error('Error search drivers:', error);
    res.status(500).json({
      error: 'Error search drivers',
      message: 'Terjadi kesalahan saat mencari driver'
    });
  }
});

module.exports = router; 