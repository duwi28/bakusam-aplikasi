import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket && this.isConnected) {
      return;
    }

    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    const socketUrl = API_URL.replace('/api', '');

    this.socket = io(socketUrl, {
      auth: {
        token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('🔌 Socket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      toast.success('Terhubung ke server real-time');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      this.isConnected = false;
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        toast.error('Gagal terhubung ke server real-time');
      }
    });

    // Booking events
    this.socket.on('new-booking', (data) => {
      console.log('📦 New booking received:', data);
      this.emit('new-booking', data);
    });

    this.socket.on('booking-accepted', (data) => {
      console.log('✅ Booking accepted:', data);
      toast.success('Driver menerima booking Anda!');
      this.emit('booking-accepted', data);
    });

    this.socket.on('booking-status-updated', (data) => {
      console.log('🔄 Booking status updated:', data);
      this.emit('booking-status-updated', data);
    });

    this.socket.on('booking-cancelled', (data) => {
      console.log('❌ Booking cancelled:', data);
      toast.error('Booking dibatalkan');
      this.emit('booking-cancelled', data);
    });

    // Driver location events
    this.socket.on('driver-location-updated', (data) => {
      console.log('📍 Driver location updated:', data);
      this.emit('driver-location-updated', data);
    });

    this.socket.on('driver-status-changed', (data) => {
      console.log('🚗 Driver status changed:', data);
      this.emit('driver-status-changed', data);
    });

    // Chat events
    this.socket.on('new-message', (data) => {
      console.log('💬 New message received:', data);
      this.emit('new-message', data);
    });

    // Notification events
    this.socket.on('notification', (data) => {
      console.log('🔔 Notification received:', data);
      toast(data.message, {
        icon: data.type === 'success' ? '✅' : data.type === 'error' ? '❌' : 'ℹ️',
        duration: 4000
      });
      this.emit('notification', data);
    });

    this.socket.on('system-notification', (data) => {
      console.log('🔔 System notification:', data);
      toast(data.message, {
        icon: '🔔',
        duration: 3000
      });
      this.emit('system-notification', data);
    });

    // Error events
    this.socket.on('booking-error', (data) => {
      console.error('❌ Booking error:', data);
      toast.error(data.message || 'Terjadi kesalahan pada booking');
      this.emit('booking-error', data);
    });
  }

  // Driver methods
  updateLocation(latitude, longitude, isOnline = true) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('update-location', {
      latitude,
      longitude,
      isOnline
    });
  }

  toggleStatus(isOnline) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('toggle-status', { isOnline });
  }

  acceptBooking(bookingId) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('accept-booking', { bookingId });
  }

  updateBookingStatus(bookingId, status, location = null) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('update-booking-status', {
      bookingId,
      status,
      location
    });
  }

  // Customer methods
  createBooking(bookingData) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('create-booking', bookingData);
  }

  cancelBooking(bookingId) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('cancel-booking', { bookingId });
  }

  // Chat methods
  sendMessage(bookingId, message) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('send-message', {
      bookingId,
      message
    });
  }

  // Event listeners management
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} callback:`, error);
      }
    });
  }

  // Utility methods
  isConnected() {
    return this.isConnected;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  // Get socket instance for advanced usage
  getSocket() {
    return this.socket;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService; 