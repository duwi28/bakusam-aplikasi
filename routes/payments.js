const express = require('express');
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const { authenticateToken, authorizeCustomer } = require('../middleware/auth');

const router = express.Router();

// Process payment
router.post('/process', [
  authenticateToken,
  authorizeCustomer,
  body('bookingId').notEmpty().withMessage('ID booking wajib diisi'),
  body('paymentMethod').isIn(['cash', 'e-wallet', 'credit_card']).withMessage('Metode pembayaran tidak valid'),
  body('amount').isFloat({ min: 0 }).withMessage('Jumlah pembayaran tidak valid')
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

    const { bookingId, paymentMethod, amount } = req.body;

    // Cari booking
    const booking = await Booking.findById(bookingId);
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
        message: 'Anda tidak memiliki izin untuk melakukan pembayaran'
      });
    }

    // Cek apakah booking sudah selesai
    if (booking.status !== 'completed') {
      return res.status(400).json({
        error: 'Booking belum selesai',
        message: 'Pembayaran hanya bisa dilakukan setelah trip selesai'
      });
    }

    // Cek apakah sudah dibayar
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({
        error: 'Sudah dibayar',
        message: 'Booking ini sudah dibayar'
      });
    }

    // Simulasi proses pembayaran
    // Dalam implementasi nyata, ini akan terintegrasi dengan payment gateway
    let paymentResult;
    
    if (paymentMethod === 'cash') {
      // Cash payment - langsung berhasil
      paymentResult = {
        success: true,
        transactionId: `CASH_${Date.now()}`,
        amount: amount,
        method: 'cash'
      };
    } else {
      // Digital payment - simulasi proses
      paymentResult = await processDigitalPayment(amount, paymentMethod);
    }

    if (!paymentResult.success) {
      return res.status(400).json({
        error: 'Pembayaran gagal',
        message: paymentResult.message || 'Terjadi kesalahan saat memproses pembayaran'
      });
    }

    // Update booking payment status
    booking.paymentStatus = 'paid';
    booking.paymentMethod = paymentMethod;
    await booking.save();

    res.json({
      success: true,
      message: 'Pembayaran berhasil diproses',
      data: {
        booking,
        payment: paymentResult
      }
    });

  } catch (error) {
    console.error('Error process payment:', error);
    res.status(500).json({
      error: 'Error process payment',
      message: 'Terjadi kesalahan saat memproses pembayaran'
    });
  }
});

// Simulasi proses pembayaran digital
async function processDigitalPayment(amount, method) {
  // Simulasi delay proses pembayaran
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Simulasi 90% success rate
  const isSuccess = Math.random() > 0.1;

  if (isSuccess) {
    return {
      success: true,
      transactionId: `${method.toUpperCase()}_${Date.now()}`,
      amount: amount,
      method: method,
      timestamp: new Date().toISOString()
    };
  } else {
    return {
      success: false,
      message: 'Pembayaran ditolak oleh sistem'
    };
  }
}

// Get payment history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (req.user.role === 'customer') {
      query.customer = req.user._id;
    } else if (req.user.role === 'driver') {
      query.driver = req.user._id;
    }

    if (status) {
      query.paymentStatus = status;
    }

    const bookings = await Booking.find(query)
      .populate('customer', 'name phone')
      .populate('driver', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    // Calculate payment statistics
    const paidBookings = bookings.filter(b => b.paymentStatus === 'paid');
    const totalPaid = paidBookings.reduce((sum, booking) => {
      return sum + (booking.fare.actualFare || booking.fare.totalFare);
    }, 0);

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        statistics: {
          totalPaid,
          totalPaidBookings: paidBookings.length,
          averagePayment: paidBookings.length > 0 ? Math.round(totalPaid / paidBookings.length) : 0
        }
      }
    });

  } catch (error) {
    console.error('Error get payment history:', error);
    res.status(500).json({
      error: 'Error get payment history',
      message: 'Terjadi kesalahan saat mengambil riwayat pembayaran'
    });
  }
});

// Get payment details
router.get('/:bookingId', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate('customer', 'name phone')
      .populate('driver', 'name phone');

    if (!booking) {
      return res.status(404).json({
        error: 'Booking tidak ditemukan',
        message: 'Data booking tidak ditemukan'
      });
    }

    // Cek apakah user berhak melihat payment ini
    if (req.user.role !== 'admin' && 
        booking.customer.toString() !== req.user._id.toString() && 
        booking.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Akses ditolak',
        message: 'Anda tidak memiliki izin untuk melihat detail pembayaran'
      });
    }

    res.json({
      success: true,
      data: {
        booking,
        paymentDetails: {
          amount: booking.fare.actualFare || booking.fare.totalFare,
          method: booking.paymentMethod,
          status: booking.paymentStatus,
          currency: booking.fare.currency
        }
      }
    });

  } catch (error) {
    console.error('Error get payment details:', error);
    res.status(500).json({
      error: 'Error get payment details',
      message: 'Terjadi kesalahan saat mengambil detail pembayaran'
    });
  }
});

// Request refund
router.post('/refund/:bookingId', [
  authenticateToken,
  authorizeCustomer,
  body('reason').notEmpty().withMessage('Alasan refund wajib diisi')
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

    const booking = await Booking.findById(req.params.bookingId);
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
        message: 'Anda tidak memiliki izin untuk meminta refund'
      });
    }

    // Cek apakah sudah dibayar
    if (booking.paymentStatus !== 'paid') {
      return res.status(400).json({
        error: 'Belum dibayar',
        message: 'Hanya booking yang sudah dibayar yang bisa direfund'
      });
    }

    // Cek apakah booking sudah selesai dalam 24 jam terakhir
    const bookingEndTime = booking.tracking.endTime || booking.updatedAt;
    const hoursSinceCompletion = (Date.now() - bookingEndTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceCompletion > 24) {
      return res.status(400).json({
        error: 'Refund terlambat',
        message: 'Refund hanya bisa diminta dalam 24 jam setelah trip selesai'
      });
    }

    // Simulasi proses refund
    const refundResult = await processRefund(booking.fare.actualFare || booking.fare.totalFare, booking.paymentMethod);

    res.json({
      success: true,
      message: 'Permintaan refund berhasil diajukan',
      data: {
        booking,
        refund: refundResult
      }
    });

  } catch (error) {
    console.error('Error request refund:', error);
    res.status(500).json({
      error: 'Error request refund',
      message: 'Terjadi kesalahan saat memproses refund'
    });
  }
});

// Simulasi proses refund
async function processRefund(amount, method) {
  // Simulasi delay proses refund
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Simulasi 95% success rate untuk refund
  const isSuccess = Math.random() > 0.05;

  if (isSuccess) {
    return {
      success: true,
      refundId: `REFUND_${Date.now()}`,
      amount: amount,
      method: method,
      status: 'processing',
      estimatedTime: '3-5 hari kerja',
      timestamp: new Date().toISOString()
    };
  } else {
    return {
      success: false,
      message: 'Refund ditolak oleh sistem'
    };
  }
}

// Get payment methods
router.get('/methods', authenticateToken, async (req, res) => {
  try {
    // Daftar metode pembayaran yang tersedia
    const paymentMethods = [
      {
        id: 'cash',
        name: 'Tunai',
        description: 'Bayar dengan uang tunai kepada driver',
        icon: '💵',
        available: true
      },
      {
        id: 'e-wallet',
        name: 'E-Wallet',
        description: 'Bayar dengan GoPay, OVO, DANA, atau LinkAja',
        icon: '📱',
        available: true
      },
      {
        id: 'credit_card',
        name: 'Kartu Kredit/Debit',
        description: 'Bayar dengan kartu kredit atau debit',
        icon: '💳',
        available: true
      }
    ];

    res.json({
      success: true,
      data: {
        paymentMethods
      }
    });

  } catch (error) {
    console.error('Error get payment methods:', error);
    res.status(500).json({
      error: 'Error get payment methods',
      message: 'Terjadi kesalahan saat mengambil metode pembayaran'
    });
  }
});

module.exports = router; 