# 🔌 Socket.io Integration - Bakusam

Dokumentasi implementasi Socket.io untuk real-time communication di aplikasi ojek online Bakusam.

## 📋 Overview

Socket.io digunakan untuk fitur real-time:
- ✅ Driver location tracking
- ✅ Live booking status updates
- ✅ Real-time chat antara driver dan customer
- ✅ Push notifications
- ✅ Online/offline status

## 🏗️ Architecture

### Backend (Node.js + Socket.io)
```
services/socketService.js - Main Socket.io service
server.js - Socket.io server initialization
```

### Frontend (React + Socket.io-client)
```
services/socketService.js - Client Socket.io service
components/tracking/LiveTracking.js - Real-time tracking
components/chat/Chat.js - Real-time chat
```

## 🔧 Setup

### Backend Setup

1. **Install Socket.io**
```bash
npm install socket.io
```

2. **Initialize Socket.io Server**
```javascript
// server.js
const SocketService = require('./services/socketService');
const socketService = new SocketService(server);
```

3. **Authentication Middleware**
```javascript
// JWT token validation for Socket.io connections
this.io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  socket.userId = decoded.userId;
  socket.userRole = decoded.role;
  next();
});
```

### Frontend Setup

1. **Install Socket.io-client**
```bash
cd frontend
npm install socket.io-client
```

2. **Initialize Socket Service**
```javascript
// services/socketService.js
import { io } from 'socket.io-client';

const socketService = new SocketService();
socketService.connect(token);
```

## 📡 Socket Events

### Connection Events
```javascript
// Backend
socket.on('connection', (socket) => {
  console.log('User connected:', socket.userId);
});

// Frontend
socket.on('connect', () => {
  console.log('Connected to server');
});
```

### Driver Events

#### Update Location
```javascript
// Frontend (Driver)
socketService.updateLocation(latitude, longitude, isOnline);

// Backend
socket.on('update-location', async (data) => {
  const { latitude, longitude, isOnline } = data;
  // Update driver location in database
  // Broadcast to nearby customers
});
```

#### Toggle Status
```javascript
// Frontend (Driver)
socketService.toggleStatus(isOnline);

// Backend
socket.on('toggle-status', async (data) => {
  const { isOnline } = data;
  // Update driver status in database
  // Broadcast status change
});
```

#### Accept Booking
```javascript
// Frontend (Driver)
socketService.acceptBooking(bookingId);

// Backend
socket.on('accept-booking', async (data) => {
  const { bookingId } = data;
  // Update booking status
  // Notify customer
});
```

### Customer Events

#### Create Booking
```javascript
// Frontend (Customer)
socketService.createBooking(bookingData);

// Backend
socket.on('create-booking', async (data) => {
  // Create booking in database
  // Broadcast to nearby drivers
});
```

#### Cancel Booking
```javascript
// Frontend (Customer)
socketService.cancelBooking(bookingId);

// Backend
socket.on('cancel-booking', async (data) => {
  // Update booking status
  // Notify driver
});
```

### Chat Events

#### Send Message
```javascript
// Frontend
socketService.sendMessage(bookingId, message);

// Backend
socket.on('send-message', async (data) => {
  const { bookingId, message } = data;
  // Save message to database
  // Send to recipient
});
```

## 🗺️ Real-time Tracking

### Driver Location Updates
```javascript
// Backend - Broadcast driver location
this.broadcastDriverLocation(driverId, location);

// Frontend - Listen for location updates
socketService.on('driver-location-updated', (data) => {
  // Update map marker
  // Calculate ETA
});
```

### Booking Status Updates
```javascript
// Backend - Update booking status
socketService.updateBookingStatus(bookingId, status, location);

// Frontend - Listen for status changes
socketService.on('booking-status-updated', (data) => {
  // Update UI
  // Show notifications
});
```

## 💬 Chat System

### Message Flow
1. **Customer sends message**
   ```javascript
   socketService.sendMessage(bookingId, "Halo driver");
   ```

2. **Backend processes message**
   ```javascript
   // Save to database
   await supabase.from('messages').insert({
     booking_id: bookingId,
     sender_id: customerId,
     sender_role: 'customer',
     message: message
   });
   ```

3. **Send to driver**
   ```javascript
   // Get driver socket
   const driverSocket = this.driverSockets.get(booking.driver_id);
   driverSocket.emit('new-message', messageData);
   ```

### Chat UI Features
- ✅ Real-time message delivery
- ✅ Message timestamps
- ✅ Read receipts
- ✅ Typing indicators
- ✅ Message history

## 🔔 Notifications

### Push Notifications
```javascript
// Backend - Send notification
socketService.sendNotification(userId, {
  title: 'Booking Accepted',
  message: 'Driver telah menerima booking Anda',
  type: 'success'
});

// Frontend - Listen for notifications
socketService.on('notification', (data) => {
  toast(data.message, { icon: '✅' });
});
```

### System Notifications
```javascript
// Backend - Broadcast system message
socketService.broadcastNotification({
  title: 'System Maintenance',
  message: 'Server akan maintenance dalam 10 menit',
  type: 'warning'
}, 'customers');
```

## 🛡️ Security

### Authentication
- JWT token validation for all connections
- Role-based access control
- User session management

### Rate Limiting
```javascript
// Backend - Rate limiting for socket events
const rateLimit = require('express-rate-limit');
const socketLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
```

### Input Validation
```javascript
// Backend - Validate socket data
const { body, validationResult } = require('express-validator');

socket.on('send-message', async (data) => {
  // Validate message
  if (!data.message || data.message.length > 500) {
    return socket.emit('error', 'Invalid message');
  }
});
```

## 📊 Performance

### Connection Management
```javascript
// Backend - Track connections
this.driverSockets = new Map(); // driverId -> socket
this.customerSockets = new Map(); // customerId -> socket
```

### Memory Optimization
```javascript
// Cleanup on disconnect
socket.on('disconnect', () => {
  this.driverSockets.delete(socket.userId);
  this.customerSockets.delete(socket.userId);
});
```

### Scalability
- Horizontal scaling with Redis adapter
- Load balancing support
- Connection pooling

## 🧪 Testing

### Unit Tests
```javascript
// Backend tests
describe('Socket Service', () => {
  test('should handle driver connection', () => {
    // Test driver connection
  });
  
  test('should broadcast location updates', () => {
    // Test location broadcasting
  });
});
```

### Integration Tests
```javascript
// Frontend tests
describe('Socket Service', () => {
  test('should connect to server', () => {
    // Test connection
  });
  
  test('should send messages', () => {
    // Test message sending
  });
});
```

## 🚀 Deployment

### Production Setup
```javascript
// server.js
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});
```

### Environment Variables
```env
# Backend
SOCKET_CORS_ORIGIN=http://localhost:3000
SOCKET_MAX_CONNECTIONS=1000

# Frontend
REACT_APP_SOCKET_URL=http://localhost:3001
```

## 📱 Mobile Integration

### React Native
```javascript
// Mobile app
import io from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: { token },
  transports: ['websocket']
});
```

### GPS Tracking
```javascript
// Real-time location updates
navigator.geolocation.watchPosition(
  (position) => {
    socketService.updateLocation(
      position.coords.latitude,
      position.coords.longitude
    );
  },
  (error) => console.error(error),
  { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
);
```

## 🔧 Troubleshooting

### Common Issues

1. **Connection Failed**
   ```javascript
   // Check CORS settings
   // Verify token authentication
   // Check network connectivity
   ```

2. **Messages Not Delivered**
   ```javascript
   // Verify socket connection
   // Check event listeners
   // Validate message format
   ```

3. **Location Not Updating**
   ```javascript
   // Check GPS permissions
   // Verify location accuracy
   // Check network connectivity
   ```

### Debug Tools
```javascript
// Enable debug mode
localStorage.debug = '*';

// Log socket events
socket.onAny((eventName, ...args) => {
  console.log('Socket event:', eventName, args);
});
```

## 📈 Monitoring

### Metrics to Track
- Connection count
- Message delivery rate
- Location update frequency
- Error rates
- Response times

### Logging
```javascript
// Backend logging
console.log(`User connected: ${socket.userId} (${socket.userRole})`);
console.log(`Driver location updated: ${driverId}`);
console.log(`Booking status changed: ${bookingId} -> ${status}`);
```

## 🎯 Best Practices

### Code Organization
- Separate socket logic from business logic
- Use event-driven architecture
- Implement proper error handling
- Add comprehensive logging

### Performance
- Limit message frequency
- Implement message queuing
- Use efficient data structures
- Optimize database queries

### Security
- Validate all inputs
- Implement rate limiting
- Use secure connections
- Monitor for abuse

## 📚 Resources

- [Socket.io Documentation](https://socket.io/docs/)
- [React Socket.io Tutorial](https://socket.io/docs/v4/client-api/)
- [Real-time Chat Tutorial](https://socket.io/get-started/chat)
- [GPS Tracking Guide](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)

---

**Socket.io Integration selesai! 🎉**

Aplikasi sekarang memiliki real-time features yang lengkap untuk ojek online. 