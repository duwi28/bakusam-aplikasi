const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { authenticateToken, authorizeDriver } = require('../middleware/auth');

const router = express.Router();

// Update driver location
router.post('/location', [
  authenticateToken,
  authorizeDriver,
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude tidak valid'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude tidak valid')
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

    const { latitude, longitude } = req.body;

    // Update lokasi driver
    await req.user.updateLocation(latitude, longitude);

    res.json({
      success: true,
      message: 'Lokasi berhasil diperbarui',
      data: {
        location: {
          latitude,
          longitude
        }
      }
    });

  } catch (error) {
    console.error('Error update location:', error);
    res.status(500).json({
      error: 'Error update location',
      message: 'Terjadi kesalahan saat memperbarui lokasi'
    });
  }
});

// Toggle online/offline status
router.post('/toggle-status', authenticateToken, authorizeDriver, async (req, res) => {
  try {
    const currentStatus = req.user.driverData.isOnline;
    req.user.driverData.isOnline = !currentStatus;
    await req.user.save();

    res.json({
      success: true,
      message: `Status berhasil diubah menjadi ${!currentStatus ? 'online' : 'offline'}`,
      data: {
        isOnline: req.user.driverData.isOnline
      }
    });

  } catch (error) {
    console.error('Error toggle status:', error);
    res.status(500).json({
      error: 'Error toggle status',
      message: 'Terjadi kesalahan saat mengubah status'
    });
  }
});

// Get driver profile
router.get('/profile', authenticateToken, authorizeDriver, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        driver: req.user
      }
    });
  } catch (error) {
    console.error('Error get driver profile:', error);
    res.status(500).json({
      error: 'Error get driver profile',
      message: 'Terjadi kesalahan saat mengambil data profile'
    });
  }
});

// Update driver profile
router.put('/profile', [
  authenticateToken,
  authorizeDriver,
  body('name').optional().isLength({ min: 2, max: 50 }).withMessage('Nama harus 2-50 karakter'),
  body('phone').optional().matches(/^(\+62|62|0)8[1-9][0-9]{6,9}$/).withMessage('Nomor telepon tidak valid'),
  body('driverData.vehicleType').optional().isIn(['motor', 'mobil']).withMessage('Tipe kendaraan tidak valid'),
  body('driverData.vehicleNumber').optional().isLength({ max: 20 }).withMessage('Nomor kendaraan maksimal 20 karakter'),
  body('driverData.vehicleBrand').optional().isLength({ max: 30 }).withMessage('Merek kendaraan maksimal 30 karakter'),
  body('driverData.vehicleModel').optional().isLength({ max: 30 }).withMessage('Model kendaraan maksimal 30 karakter'),
  body('driverData.licensePlate').optional().isLength({ max: 15 }).withMessage('Nomor polisi maksimal 15 karakter'),
  body('emergencyContact.name').optional().isLength({ max: 50 }).withMessage('Nama kontak darurat maksimal 50 karakter'),
  body('emergencyContact.phone').optional().matches(/^(\+62|62|0)8[1-9][0-9]{6,9}$/).withMessage('Nomor telepon kontak darurat tidak valid'),
  body('emergencyContact.relationship').optional().isLength({ max: 20 }).withMessage('Hubungan maksimal 20 karakter')
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
    if (updateData.driverData) {
      if (updateData.driverData.vehicleType) req.user.driverData.vehicleType = updateData.driverData.vehicleType;
      if (updateData.driverData.vehicleNumber) req.user.driverData.vehicleNumber = updateData.driverData.vehicleNumber;
      if (updateData.driverData.vehicleBrand) req.user.driverData.vehicleBrand = updateData.driverData.vehicleBrand;
      if (updateData.driverData.vehicleModel) req.user.driverData.vehicleModel = updateData.driverData.vehicleModel;
      if (updateData.driverData.licensePlate) req.user.driverData.licensePlate = updateData.driverData.licensePlate;
    }
    if (updateData.emergencyContact) {
      if (updateData.emergencyContact.name) req.user.emergencyContact.name = updateData.emergencyContact.name;
      if (updateData.emergencyContact.phone) req.user.emergencyContact.phone = updateData.emergencyContact.phone;
      if (updateData.emergencyContact.relationship) req.user.emergencyContact.relationship = updateData.emergencyContact.relationship;
    }

    await req.user.save();

    res.json({
      success: true,
      message: 'Profile berhasil diperbarui',
      data: {
        driver: req.user
      }
    });

  } catch (error) {
    console.error('Error update driver profile:', error);
    res.status(500).json({
      error: 'Error update driver profile',
      message: 'Terjadi kesalahan saat memperbarui profile'
    });
  }
});

// Get driver earnings
router.get('/earnings', authenticateToken, authorizeDriver, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = {};

    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    // Get completed bookings
    const completedBookings = await Booking.find({
      driver: req.user._id,
      status: 'completed',
      ...dateFilter
    }).sort({ createdAt: -1 });

    // Calculate earnings
    const totalEarnings = completedBookings.reduce((sum, booking) => {
      return sum + (booking.fare.actualFare || booking.fare.totalFare);
    }, 0);

    const totalTrips = completedBookings.length;

    // Calculate daily earnings for the last 7 days
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const dayBookings = completedBookings.filter(booking => 
        booking.createdAt >= startOfDay && booking.createdAt <= endOfDay
      );

      const dayEarnings = dayBookings.reduce((sum, booking) => {
        return sum + (booking.fare.actualFare || booking.fare.totalFare);
      }, 0);

      last7Days.push({
        date: startOfDay.toISOString().split('T')[0],
        earnings: dayEarnings,
        trips: dayBookings.length
      });
    }

    res.json({
      success: true,
      data: {
        totalEarnings,
        totalTrips,
        averageEarnings: totalTrips > 0 ? Math.round(totalEarnings / totalTrips) : 0,
        last7Days,
        completedBookings: completedBookings.slice(0, 10) // Last 10 trips
      }
    });

  } catch (error) {
    console.error('Error get driver earnings:', error);
    res.status(500).json({
      error: 'Error get driver earnings',
      message: 'Terjadi kesalahan saat mengambil data earnings'
    });
  }
});

// Get nearby customers (for driver to see potential customers)
router.get('/nearby-customers', [
  authenticateToken,
  authorizeDriver
], async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 5000 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Lokasi diperlukan',
        message: 'Latitude dan longitude diperlukan'
      });
    }

    // Cari customer yang sedang mencari driver
    const nearbyCustomers = await Booking.find({
      status: 'pending',
      'pickupLocation.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      }
    })
    .populate('customer', 'name phone')
    .limit(10);

    res.json({
      success: true,
      data: {
        nearbyCustomers
      }
    });

  } catch (error) {
    console.error('Error get nearby customers:', error);
    res.status(500).json({
      error: 'Error get nearby customers',
      message: 'Terjadi kesalahan saat mengambil data customer terdekat'
    });
  }
});

// Accept booking (Driver)
router.post('/accept-booking/:bookingId', authenticateToken, authorizeDriver, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    
    if (!booking) {
      return res.status(404).json({
        error: 'Booking tidak ditemukan',
        message: 'Data booking tidak ditemukan'
      });
    }

    // Cek apakah booking masih pending
    if (booking.status !== 'pending') {
      return res.status(400).json({
        error: 'Booking tidak bisa diterima',
        message: 'Booking sudah tidak dalam status pending'
      });
    }

    // Cek apakah driver sudah online
    if (!req.user.driverData.isOnline) {
      return res.status(400).json({
        error: 'Driver offline',
        message: 'Anda harus online untuk menerima booking'
      });
    }

    // Update booking status
    await booking.updateStatus('accepted', 'Driver menerima booking');

    // Populate data untuk response
    await booking.populate('customer', 'name phone');
    await booking.populate('driver', 'name phone driverData.vehicleType driverData.licensePlate');

    res.json({
      success: true,
      message: 'Booking berhasil diterima',
      data: { booking }
    });

  } catch (error) {
    console.error('Error accept booking:', error);
    res.status(500).json({
      error: 'Error accept booking',
      message: 'Terjadi kesalahan saat menerima booking'
    });
  }
});

// Get driver statistics
router.get('/statistics', authenticateToken, authorizeDriver, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    let startDate = new Date();
    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }

    // Get booking statistics
    const totalBookings = await Booking.countDocuments({
      driver: req.user._id,
      createdAt: { $gte: startDate }
    });

    const completedBookings = await Booking.countDocuments({
      driver: req.user._id,
      status: 'completed',
      createdAt: { $gte: startDate }
    });

    const cancelledBookings = await Booking.countDocuments({
      driver: req.user._id,
      status: 'cancelled',
      createdAt: { $gte: startDate }
    });

    // Get earnings
    const earnings = await Booking.aggregate([
      {
        $match: {
          driver: req.user._id,
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: { $ifNull: ['$fare.actualFare', '$fare.totalFare'] } }
        }
      }
    ]);

    const totalEarnings = earnings.length > 0 ? earnings[0].totalEarnings : 0;

    // Get average rating
    const ratingStats = await Booking.aggregate([
      {
        $match: {
          driver: req.user._id,
          status: 'completed',
          'rating.customerRating': { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating.customerRating' },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    const averageRating = ratingStats.length > 0 ? Math.round(ratingStats[0].averageRating * 10) / 10 : 0;
    const totalRatings = ratingStats.length > 0 ? ratingStats[0].totalRatings : 0;

    res.json({
      success: true,
      data: {
        period,
        totalBookings,
        completedBookings,
        cancelledBookings,
        completionRate: totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0,
        totalEarnings,
        averageEarnings: completedBookings > 0 ? Math.round(totalEarnings / completedBookings) : 0,
        averageRating,
        totalRatings
      }
    });

  } catch (error) {
    console.error('Error get driver statistics:', error);
    res.status(500).json({
      error: 'Error get driver statistics',
      message: 'Terjadi kesalahan saat mengambil data statistik'
    });
  }
});

module.exports = router; 