const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

class SocketService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.driverSockets = new Map(); // driverId -> socket
    this.customerSockets = new Map(); // customerId -> socket
    this.driverLocations = new Map(); // driverId -> location
    this.activeBookings = new Map(); // bookingId -> booking data

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.userId} (${socket.userRole})`);

      // Join user to their room
      socket.join(socket.userId);

      if (socket.userRole === 'driver') {
        this.handleDriverConnection(socket);
      } else {
        this.handleCustomerConnection(socket);
      }

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });
    });
  }

  handleDriverConnection(socket) {
    const driverId = socket.userId;
    this.driverSockets.set(driverId, socket);

    // Join driver to driver room
    socket.join('drivers');

    // Handle driver location updates
    socket.on('update-location', async (data) => {
      try {
        const { latitude, longitude, isOnline } = data;
        
        // Update driver location in memory
        this.driverLocations.set(driverId, {
          latitude,
          longitude,
          isOnline,
          timestamp: new Date()
        });

        // Update driver status in database
        await supabase
          .from('users')
          .update({
            driver_data: {
              ...this.driverLocations.get(driverId),
              last_location_update: new Date().toISOString()
            }
          })
          .eq('id', driverId);

        // Broadcast to nearby customers
        this.broadcastDriverLocation(driverId, { latitude, longitude, isOnline });
      } catch (error) {
        console.error('Error updating driver location:', error);
      }
    });

    // Handle driver status changes
    socket.on('toggle-status', async (data) => {
      try {
        const { isOnline } = data;
        
        // Update driver status in database
        await supabase
          .from('users')
          .update({
            driver_data: {
              is_online: isOnline,
              last_status_update: new Date().toISOString()
            }
          })
          .eq('id', driverId);

        // Broadcast status change
        socket.broadcast.to('customers').emit('driver-status-changed', {
          driverId,
          isOnline
        });
      } catch (error) {
        console.error('Error updating driver status:', error);
      }
    });

    // Handle booking acceptance
    socket.on('accept-booking', async (data) => {
      try {
        const { bookingId } = data;
        
        // Update booking status
        const { data: booking, error } = await supabase
          .from('bookings')
          .update({
            status: 'accepted',
            driver_id: driverId,
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId)
          .select()
          .single();

        if (error) throw error;

        // Store active booking
        this.activeBookings.set(bookingId, booking);

        // Notify customer
        const customerSocket = this.customerSockets.get(booking.customer_id);
        if (customerSocket) {
          customerSocket.emit('booking-accepted', {
            bookingId,
            driverId,
            driverLocation: this.driverLocations.get(driverId)
          });
        }

        // Send driver booking details
        socket.emit('booking-details', booking);
      } catch (error) {
        console.error('Error accepting booking:', error);
      }
    });

    // Handle booking status updates
    socket.on('update-booking-status', async (data) => {
      try {
        const { bookingId, status, location } = data;
        
        // Update booking status
        await supabase
          .from('bookings')
          .update({
            status,
            tracking: {
              current_location: location,
              status_history: [
                {
                  status,
                  timestamp: new Date().toISOString(),
                  location
                }
              ]
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId);

        // Get booking details
        const { data: booking } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .single();

        // Notify customer
        const customerSocket = this.customerSockets.get(booking.customer_id);
        if (customerSocket) {
          customerSocket.emit('booking-status-updated', {
            bookingId,
            status,
            location,
            driverLocation: this.driverLocations.get(driverId)
          });
        }

        // If booking completed, remove from active bookings
        if (status === 'completed') {
          this.activeBookings.delete(bookingId);
        }
      } catch (error) {
        console.error('Error updating booking status:', error);
      }
    });

    // Handle driver chat messages
    socket.on('send-message', async (data) => {
      try {
        const { bookingId, message } = data;
        
        // Save message to database
        await supabase
          .from('messages')
          .insert({
            booking_id: bookingId,
            sender_id: driverId,
            sender_role: 'driver',
            message,
            created_at: new Date().toISOString()
          });

        // Get booking details
        const { data: booking } = await supabase
          .from('bookings')
          .select('customer_id')
          .eq('id', bookingId)
          .single();

        // Send message to customer
        const customerSocket = this.customerSockets.get(booking.customer_id);
        if (customerSocket) {
          customerSocket.emit('new-message', {
            bookingId,
            message,
            senderId: driverId,
            senderRole: 'driver',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    });
  }

  handleCustomerConnection(socket) {
    const customerId = socket.userId;
    this.customerSockets.set(customerId, socket);

    // Join customer to customer room
    socket.join('customers');

    // Handle booking creation
    socket.on('create-booking', async (data) => {
      try {
        const { pickup_location, destination, vehicle_type, estimated_fare } = data;
        
        // Create booking in database
        const { data: booking, error } = await supabase
          .from('bookings')
          .insert({
            customer_id: customerId,
            pickup_location,
            destination,
            vehicle_type,
            estimated_fare,
            status: 'pending',
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        // Broadcast to nearby drivers
        this.broadcastBookingToDrivers(booking);
      } catch (error) {
        console.error('Error creating booking:', error);
        socket.emit('booking-error', { message: 'Failed to create booking' });
      }
    });

    // Handle customer chat messages
    socket.on('send-message', async (data) => {
      try {
        const { bookingId, message } = data;
        
        // Save message to database
        await supabase
          .from('messages')
          .insert({
            booking_id: bookingId,
            sender_id: customerId,
            sender_role: 'customer',
            message,
            created_at: new Date().toISOString()
          });

        // Get booking details
        const { data: booking } = await supabase
          .from('bookings')
          .select('driver_id')
          .eq('id', bookingId)
          .single();

        // Send message to driver
        const driverSocket = this.driverSockets.get(booking.driver_id);
        if (driverSocket) {
          driverSocket.emit('new-message', {
            bookingId,
            message,
            senderId: customerId,
            senderRole: 'customer',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    });

    // Handle booking cancellation
    socket.on('cancel-booking', async (data) => {
      try {
        const { bookingId } = data;
        
        // Update booking status
        await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            cancelled_by: 'customer',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId);

        // Notify driver if assigned
        const booking = this.activeBookings.get(bookingId);
        if (booking && booking.driver_id) {
          const driverSocket = this.driverSockets.get(booking.driver_id);
          if (driverSocket) {
            driverSocket.emit('booking-cancelled', { bookingId });
          }
        }

        // Remove from active bookings
        this.activeBookings.delete(bookingId);
      } catch (error) {
        console.error('Error cancelling booking:', error);
      }
    });
  }

  handleDisconnection(socket) {
    const userId = socket.userId;
    const userRole = socket.userRole;

    console.log(`User disconnected: ${userId} (${userRole})`);

    if (userRole === 'driver') {
      this.driverSockets.delete(userId);
      this.driverLocations.delete(userId);
      
      // Update driver status to offline
      supabase
        .from('users')
        .update({
          driver_data: {
            is_online: false,
            last_status_update: new Date().toISOString()
          }
        })
        .eq('id', userId);
    } else {
      this.customerSockets.delete(userId);
    }
  }

  broadcastDriverLocation(driverId, location) {
    // Broadcast to nearby customers (within 5km radius)
    this.io.to('customers').emit('driver-location-updated', {
      driverId,
      location
    });
  }

  broadcastBookingToDrivers(booking) {
    // Broadcast to online drivers
    this.io.to('drivers').emit('new-booking', {
      booking,
      timestamp: new Date().toISOString()
    });
  }

  // Public methods for external use
  getDriverLocation(driverId) {
    return this.driverLocations.get(driverId);
  }

  getOnlineDrivers() {
    return Array.from(this.driverSockets.keys());
  }

  getActiveBookings() {
    return Array.from(this.activeBookings.values());
  }

  // Send notification to specific user
  sendNotification(userId, notification) {
    const userSocket = this.customerSockets.get(userId) || this.driverSockets.get(userId);
    if (userSocket) {
      userSocket.emit('notification', notification);
    }
  }

  // Broadcast system notification
  broadcastNotification(notification, room = null) {
    if (room) {
      this.io.to(room).emit('system-notification', notification);
    } else {
      this.io.emit('system-notification', notification);
    }
  }
}

module.exports = SocketService; 