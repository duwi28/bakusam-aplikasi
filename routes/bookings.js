const express = require('express');
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { authenticateToken, authorizeCustomer, authorizeDriver } = require('../middleware/auth');

const router = express.Router();

// Helper function untuk menghitung jarak
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius bumi dalam km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Helper function untuk menghitung ongkos
const calculateFare = (distance, duration, vehicleType) => {
  const baseFare = vehicleType === 'motor' ? 5000 : 10000;
  const distanceFare = distance * (vehicleType === 'motor' ? 2000 : 3000);
  const timeFare = duration * (vehicleType === 'motor' ? 100 : 150);
  
  return {
    baseFare,
    distanceFare: Math.round(distanceFare),
    timeFare: Math.round(timeFare),
    totalFare: Math.round(baseFare + distanceFare + timeFare)
  };
};

// Create booking (Customer)
router.post('/', [
  authenticateToken,
  authorizeCustomer,
  body('pickupLocation.address').notEmpty().withMessage('Alamat pickup wajib diisi'),
  body('pickupLocation.coordinates').isArray().withMessage('Koordinat pickup tidak valid'),
  body('destinationLocation.address').notEmpty().withMessage('Alamat tujuan wajib diisi'),
  body('destinationLocation.coordinates').isArray().withMessage('Koordinat tujuan tidak valid'),
  body('vehicleType').isIn(['motor', 'mobil']).withMessage('Tipe kendaraan tidak valid'),
  body('paymentMethod').optional().isIn(['cash', 'e-wallet', 'credit_card']).withMessage('Metode pembayaran tidak valid'),
  body('notes').optional().isLength({ max: 200 }).withMessage('Catatan maksimal 200 karakter')
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

    const {
      pickupLocation,
      destinationLocation,
      vehicleType,
      paymentMethod = 'cash',
      notes
    } = req.body;

    // Hitung jarak dan durasi
    const distance = calculateDistance(
      pickupLocation.coordinates[1], // lat
      pickupLocation.coordinates[0], // lon
      destinationLocation.coordinates[1], // lat
      destinationLocation.coordinates[0] // lon
    );

    const duration = Math.ceil(distance * 3); // Estimasi 3 menit per km

    // Hitung ongkos
    const fare = calculateFare(distance, duration, vehicleType);

    // Cari driver terdekat yang online
    const nearbyDrivers = await User.find({
      role: 'driver',
      'driverData.isOnline': true,
      'driverData.vehicleType': vehicleType,
      isActive: true,
      'driverData.currentLocation': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: pickupLocation.coordinates
          },
          $maxDistance: 5000 // 5km
        }
      }
    }).limit(5);

    if (nearbyDrivers.length === 0) {
      return res.status(404).json({
        error: 'Driver tidak tersedia',
        message: 'Tidak ada driver yang tersedia di area Anda'
      });
    }

    // Pilih driver pertama (terdekat)
    const selectedDriver = nearbyDrivers[0];

    // Buat booking
    const booking = new Booking({
      customer: req.user._id,
      driver: selectedDriver._id,
      pickupLocation,
      destinationLocation,
      vehicleType,
      distance,
      duration,
      fare,
      paymentMethod,
      notes
    });

    await booking.save();

    // Populate data customer dan driver
    await booking.populate('customer', 'name phone');
    await booking.populate('driver', 'name phone driverData.vehicleType driverData.licensePlate');

    res.status(201).json({
      success: true,
      message: 'Booking berhasil dibuat',
      data: {
        booking,
        estimatedArrival: Math.ceil(duration * 0.8) // Estimasi 80% dari durasi total
      }
    });

  } catch (error) {
    console.error('Error create booking:', error);
    res.status(500).json({
      error: 'Error create booking',
      message: 'Terjadi kesalahan saat membuat booking'
    });
  }
});

// Get booking by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name phone')
      .populate('driver', 'name phone driverData.vehicleType driverData.licensePlate driverData.rating');

    if (!booking) {
      return res.status(404).json({
        error: 'Booking tidak ditemukan',
        message: 'Data booking tidak ditemukan'
      });
    }

    // Cek apakah user berhak melihat booking ini
    if (req.user.role !== 'admin' && 
        booking.customer.toString() !== req.user._id.toString() && 
        booking.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Akses ditolak',
        message: 'Anda tidak memiliki izin untuk melihat booking ini'
      });
    }

    res.json({
      success: true,
      data: { booking }
    });

  } catch (error) {
    console.error('Error get booking:', error);
    res.status(500).json({
      error: 'Error get booking',
      message: 'Terjadi kesalahan saat mengambil data booking'
    });
  }
});

// Get user's bookings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (req.user.role === 'customer') {
      query.customer = req.user._id;
    } else if (req.user.role === 'driver') {
      query.driver = req.user._id;
    }

    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('customer', 'name phone')
      .populate('driver', 'name phone driverData.vehicleType driverData.licensePlate driverData.rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error get bookings:', error);
    res.status(500).json({
      error: 'Error get bookings',
      message: 'Terjadi kesalahan saat mengambil data bookings'
    });
  }
});

// Update booking status (Driver)
router.patch('/:id/status', [
  authenticateToken,
  authorizeDriver,
  body('status').isIn(['accepted', 'picked_up', 'in_progress', 'completed', 'cancelled']).withMessage('Status tidak valid'),
  body('note').optional().isLength({ max: 200 }).withMessage('Catatan maksimal 200 karakter')
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

    const { status, note = '' } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        error: 'Booking tidak ditemukan',
        message: 'Data booking tidak ditemukan'
      });
    }

    // Cek apakah booking milik driver ini
    if (booking.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Akses ditolak',
        message: 'Anda tidak memiliki izin untuk mengubah status booking ini'
      });
    }

    // Update status
    await booking.updateStatus(status, note);

    // Populate data untuk response
    await booking.populate('customer', 'name phone');
    await booking.populate('driver', 'name phone driverData.vehicleType driverData.licensePlate');

    res.json({
      success: true,
      message: 'Status booking berhasil diperbarui',
      data: { booking }
    });

  } catch (error) {
    console.error('Error update booking status:', error);
    res.status(500).json({
      error: 'Error update booking status',
      message: 'Terjadi kesalahan saat memperbarui status booking'
    });
  }
});

// Cancel booking (Customer)
router.patch('/:id/cancel', [
  authenticateToken,
  authorizeCustomer,
  body('reason').notEmpty().withMessage('Alasan pembatalan wajib diisi')
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

    const { reason } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        error: 'Booking tidak ditemukan',
        message: 'Data booking tidak ditemukan'
      });
    }

    // Cek apakah booking milik customer ini
    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Akses ditolak',
        message: 'Anda tidak memiliki izin untuk membatalkan booking ini'
      });
    }

    // Cek apakah booking bisa dibatalkan
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        error: 'Booking tidak bisa dibatalkan',
        message: 'Status booking tidak memungkinkan untuk dibatalkan'
      });
    }

    // Cancel booking
    await booking.cancelBooking(reason, 'customer');

    // Populate data untuk response
    await booking.populate('customer', 'name phone');
    await booking.populate('driver', 'name phone driverData.vehicleType driverData.licensePlate');

    res.json({
      success: true,
      message: 'Booking berhasil dibatalkan',
      data: { booking }
    });

  } catch (error) {
    console.error('Error cancel booking:', error);
    res.status(500).json({
      error: 'Error cancel booking',
      message: 'Terjadi kesalahan saat membatalkan booking'
    });
  }
});

// Rate booking (Customer)
router.post('/:id/rate', [
  authenticateToken,
  authorizeCustomer,
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating harus 1-5'),
  body('review').optional().isLength({ max: 500 }).withMessage('Review maksimal 500 karakter')
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

    const { rating, review = '' } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        error: 'Booking tidak ditemukan',
        message: 'Data booking tidak ditemukan'
      });
    }

    // Cek apakah booking milik customer ini
    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Akses ditolak',
        message: 'Anda tidak memiliki izin untuk memberikan rating'
      });
    }

    // Cek apakah booking sudah selesai
    if (booking.status !== 'completed') {
      return res.status(400).json({
        error: 'Booking belum selesai',
        message: 'Hanya booking yang sudah selesai yang bisa diberi rating'
      });
    }

    // Cek apakah sudah diberi rating
    if (booking.rating.customerRating) {
      return res.status(400).json({
        error: 'Sudah diberi rating',
        message: 'Booking ini sudah diberi rating'
      });
    }

    // Update rating
    booking.rating.customerRating = rating;
    booking.rating.customerReview = review;
    await booking.save();

    // Update rating driver
    const driver = await User.findById(booking.driver);
    if (driver) {
      await driver.updateRating(rating);
    }

    res.json({
      success: true,
      message: 'Rating berhasil diberikan',
      data: { booking }
    });

  } catch (error) {
    console.error('Error rate booking:', error);
    res.status(500).json({
      error: 'Error rate booking',
      message: 'Terjadi kesalahan saat memberikan rating'
    });
  }
});

module.exports = router; 