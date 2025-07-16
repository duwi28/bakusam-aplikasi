# 🚗 Bakusam - Aplikasi Ojek Online

Aplikasi ojek online lengkap seperti Maxim dengan fitur booking, tracking real-time, pembayaran, dan rating system menggunakan **Supabase** sebagai database dan **OpenStreetMap** untuk maps.

## 📋 Fitur Utama

### 👤 Customer
- ✅ Registrasi dan login
- ✅ Booking ojek dengan pilihan motor/mobil
- ✅ Tracking lokasi driver real-time
- ✅ Sistem rating dan review
- ✅ Pembayaran (tunai/e-wallet/kartu)
- ✅ Riwayat perjalanan
- ✅ Profile management

### 🚗 Driver
- ✅ Registrasi sebagai driver
- ✅ Online/offline toggle
- ✅ Update lokasi real-time
- ✅ Terima/tolak booking
- ✅ Update status perjalanan
- ✅ Dashboard earnings
- ✅ Profile dan kendaraan management

### 👨‍💼 Admin
- ✅ Dashboard admin
- ✅ Manajemen user (customer/driver)
- ✅ Monitoring booking
- ✅ Laporan pendapatan
- ✅ Sistem rating dan review

## 🛠 Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Supabase** - Database & Authentication
- **Socket.io** - Real-time communication
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation

### Maps & Geocoding
- **OpenStreetMap** - Free maps data
- **Nominatim** - Geocoding service
- **OSRM** - Routing service

### Frontend
- **React.js** - Web application dengan modern UI
- **Tailwind CSS** - Styling framework
- **Zustand** - State management
- **Socket.io-client** - Real-time communication

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm atau yarn
- Supabase account

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/bakusam-app.git
cd bakusam-app
```

### 2. Setup Supabase
1. Buat project di [supabase.com](https://supabase.com)
2. Jalankan SQL script dari `database/schema.sql`
3. Copy API keys ke environment variables

### 3. Backend Setup
```bash
# Install dependencies
npm install

# Setup environment
cp env.example .env
# Edit .env dengan Supabase credentials

# Run backend
npm run dev
```

Backend akan berjalan di `http://localhost:5000`

### 4. Frontend Setup
```bash
# Navigate ke folder frontend
cd frontend

# Install dependencies
npm install

# Setup environment
cp env.example .env
# Edit .env dengan API URL

# Run frontend
npm start
```

Frontend akan berjalan di `http://localhost:3000`

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication
Semua endpoint yang memerlukan autentikasi menggunakan header:
```
Authorization: Bearer <token>
```

### Endpoints

#### 🔐 Authentication
```
POST /auth/register          # Registrasi user
POST /auth/login            # Login dengan email
POST /auth/login-phone      # Login dengan nomor telepon
GET  /auth/me               # Get current user
POST /auth/logout           # Logout
POST /auth/refresh          # Refresh token
```

#### 👤 User Management
```
GET    /users/profile                    # Get user profile
PUT    /users/profile                    # Update user profile
PUT    /users/change-password            # Change password
POST   /users/avatar                     # Upload avatar
GET    /users/drivers/search             # Search nearby drivers
GET    /users                           # Get all users (Admin)
GET    /users/:id                       # Get user by ID (Admin)
PATCH  /users/:id/status                # Update user status (Admin)
DELETE /users/:id                       # Delete user (Admin)
```

#### 📅 Booking
```
POST   /bookings                        # Create booking (Customer)
GET    /bookings                        # Get user's bookings
GET    /bookings/:id                    # Get booking by ID
PATCH  /bookings/:id/status             # Update booking status (Driver)
PATCH  /bookings/:id/cancel             # Cancel booking (Customer)
POST   /bookings/:id/rate               # Rate booking (Customer)
```

#### 🚗 Driver Management
```
POST   /drivers/location                # Update driver location
POST   /drivers/toggle-status           # Toggle online/offline
GET    /drivers/profile                 # Get driver profile
PUT    /drivers/profile                 # Update driver profile
GET    /drivers/earnings                # Get driver earnings
GET    /drivers/nearby-customers        # Get nearby customers
POST   /drivers/accept-booking/:id      # Accept booking
GET    /drivers/statistics              # Get driver statistics
```

#### 💳 Payment
```
POST   /payments/process                # Process payment
GET    /payments/history                # Get payment history
GET    /payments/:bookingId             # Get payment details
POST   /payments/refund/:bookingId      # Request refund
GET    /payments/methods                # Get payment methods
```

## 🗺️ Maps Integration

### OpenStreetMap Services
- **Nominatim**: Geocoding (alamat → koordinat)
- **OSRM**: Routing (menghitung rute dan jarak)
- **Leaflet**: Maps library untuk web

### Example Usage
```javascript
// Geocoding
const address = await mapsService.geocodeAddress('Jakarta, Indonesia');

// Routing
const route = await mapsService.calculateRoute(
  { latitude: -6.2088, longitude: 106.8456 },
  { latitude: -6.1751, longitude: 106.8650 }
);

// Distance calculation
const distance = mapsService.calculateDistance(lat1, lon1, lat2, lon2);
```

## 🔧 Real-time Features

### Socket.io Events

#### Driver Events
```javascript
// Join driver room
socket.emit('join-driver', driverId);

// Update location
socket.emit('update-location', {
  driverId: driverId,
  customerId: customerId,
  location: { latitude, longitude }
});

// Update booking status
socket.emit('booking-status-updated', {
  bookingId: bookingId,
  status: newStatus,
  driverId: driverId,
  customerId: customerId
});
```

#### Customer Events
```javascript
// Join customer room
socket.emit('join-customer', customerId);

// Listen for driver location updates
socket.on('driver-location-updated', (data) => {
  // Update map with driver location
});

// Listen for booking status changes
socket.on('booking-status-changed', (data) => {
  // Update UI with new status
});
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 🌐 Web Application

React.js web app dengan fitur modern:
- ✅ Login/Register dengan validasi
- ✅ Dashboard berbeda untuk user dan driver
- ✅ Booking dengan peta OpenStreetMap
- ✅ Real-time tracking driver
- ✅ Profile management
- ✅ Responsive design
- ✅ Modern UI dengan Tailwind CSS

## 🔒 Security Features

- ✅ JWT Authentication
- ✅ Password hashing dengan bcrypt
- ✅ Input validation
- ✅ Rate limiting
- ✅ CORS protection
- ✅ Helmet security headers
- ✅ Role-based access control
- ✅ Row Level Security (RLS) di Supabase

## 📈 Performance Features

- ✅ Supabase real-time subscriptions
- ✅ Socket.io untuk real-time updates
- ✅ Pagination untuk large datasets
- ✅ Efficient database queries
- ✅ Error handling & logging
- ✅ OpenStreetMap caching

## 🚀 Deployment

### Vercel
```bash
npm i -g vercel
vercel
```

### Heroku
```bash
heroku create
heroku config:set SUPABASE_URL=your-supabase-url
heroku config:set SUPABASE_ANON_KEY=your-supabase-key
git push heroku main
```

### Railway
1. Connect GitHub repository
2. Set environment variables
3. Deploy otomatis

## 💰 Cost Comparison

### Database
- **MongoDB Atlas**: $9-57/bulan
- **Supabase**: Gratis (500MB), $25/bulan (8GB)

### Maps
- **Google Maps**: $200-2000/bulan
- **OpenStreetMap**: Gratis! 🎉

### Total Savings
- **Database**: $108-684/tahun
- **Maps**: $2400-24000/tahun
- **Total**: $2508-24684/tahun

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Supabase](https://supabase.com/) - Database & Authentication
- [OpenStreetMap](https://www.openstreetmap.org/) - Free maps data
- [Express.js](https://expressjs.com/) - Web framework
- [Socket.io](https://socket.io/) - Real-time communication
- [React](https://reactjs.org/) - Frontend framework

## 📞 Support

Jika ada pertanyaan atau masalah, silakan buat issue di repository ini atau hubungi tim development.

---

**Made with ❤️ for Indonesia's transportation needs**

**Database: Supabase | Maps: OpenStreetMap | Cost: Minimal! 💰** 