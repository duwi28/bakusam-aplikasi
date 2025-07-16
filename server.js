const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
require('dotenv').config();

const { supabase } = require('./config/supabase');
const SocketService = require('./services/socketService');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const bookingRoutes = require('./routes/bookings');
const driverRoutes = require('./routes/drivers');
const paymentRoutes = require('./routes/payments');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io service
const socketService = new SocketService(server);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 100 // limit setiap IP ke 100 request per windowMs
});
app.use(limiter);

// Test Supabase connection
async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Error koneksi Supabase:', error);
    } else {
      console.log('✅ Terhubung ke Supabase');
    }
  } catch (error) {
    console.error('❌ Error koneksi Supabase:', error);
  }
}

testSupabaseConnection();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/payments', paymentRoutes);

// Socket.io service sudah diinisialisasi di atas
// Real-time features handled by SocketService

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Maxim Clone API berjalan dengan baik',
    database: 'Supabase',
    maps: 'OpenStreetMap',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Terjadi kesalahan pada server',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
  console.log(`📱 API tersedia di http://localhost:${PORT}`);
  console.log(`🗺️  Maps: OpenStreetMap`);
  console.log(`💾 Database: Supabase`);
});

module.exports = { app, socketService }; 