const { supabase, supabaseAdmin } = require('../config/supabase');
const mapsService = require('./maps');

class BookingService {
  // Create new booking
  async createBooking(bookingData) {
    try {
      const {
        customer_id,
        driver_id,
        pickup_location,
        destination_location,
        vehicle_type,
        payment_method = 'cash',
        notes
      } = bookingData;

      // Calculate route using OpenStreetMap
      const route = await mapsService.calculateRoute(
        pickup_location.coordinates,
        destination_location.coordinates
      );

      // Calculate fare
      const fare = this.calculateFare(route.distance, route.duration, vehicle_type);

      const booking = {
        customer_id,
        driver_id,
        status: 'pending',
        pickup_location,
        destination_location,
        vehicle_type,
        distance: route.distance,
        duration: route.duration,
        fare,
        payment_method,
        payment_status: 'pending',
        notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status_history: [{
          status: 'pending',
          timestamp: new Date().toISOString(),
          note: 'Booking dibuat'
        }]
      };

      const { data, error } = await supabaseAdmin
        .from('bookings')
        .insert([booking])
        .select(`
          *,
          customer:users!bookings_customer_id_fkey(id, name, phone),
          driver:users!bookings_driver_id_fkey(id, name, phone, driver_data)
        `)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  }

  // Get booking by ID
  async getBookingById(id) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!bookings_customer_id_fkey(id, name, phone),
          driver:users!bookings_driver_id_fkey(id, name, phone, driver_data)
        `)
        .eq('id', id)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting booking by ID:', error);
      return null;
    }
  }

  // Get user's bookings
  async getUserBookings(userId, userRole, filters = {}, page = 1, limit = 10) {
    try {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          customer:users!bookings_customer_id_fkey(id, name, phone),
          driver:users!bookings_driver_id_fkey(id, name, phone, driver_data)
        `, { count: 'exact' });

      // Filter by user role
      if (userRole === 'customer') {
        query = query.eq('customer_id', userId);
      } else if (userRole === 'driver') {
        query = query.eq('driver_id', userId);
      }

      // Apply additional filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const offset = (page - 1) * limit;
      const { data, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return {
        bookings: data,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      console.error('Error getting user bookings:', error);
      throw error;
    }
  }

  // Update booking status
  async updateBookingStatus(id, newStatus, note = '') {
    try {
      const booking = await this.getBookingById(id);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const statusHistory = booking.status_history || [];
      statusHistory.push({
        status: newStatus,
        timestamp: new Date().toISOString(),
        note: note
      });

      const { data, error } = await supabaseAdmin
        .from('bookings')
        .update({
          status: newStatus,
          status_history: statusHistory,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          customer:users!bookings_customer_id_fkey(id, name, phone),
          driver:users!bookings_driver_id_fkey(id, name, phone, driver_data)
        `)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error updating booking status:', error);
      throw error;
    }
  }

  // Cancel booking
  async cancelBooking(id, reason, cancelledBy) {
    try {
      const booking = await this.getBookingById(id);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const statusHistory = booking.status_history || [];
      statusHistory.push({
        status: 'cancelled',
        timestamp: new Date().toISOString(),
        note: `Dibatalkan oleh ${cancelledBy}: ${reason}`
      });

      const { data, error } = await supabaseAdmin
        .from('bookings')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          cancelled_by: cancelledBy,
          status_history: statusHistory,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          customer:users!bookings_customer_id_fkey(id, name, phone),
          driver:users!bookings_driver_id_fkey(id, name, phone, driver_data)
        `)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error cancelling booking:', error);
      throw error;
    }
  }

  // Complete trip
  async completeTrip(id, actualDistance, actualDuration) {
    try {
      const booking = await this.getBookingById(id);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Recalculate fare based on actual distance and duration
      const actualFare = this.calculateFare(actualDistance, actualDuration, booking.vehicle_type);

      const statusHistory = booking.status_history || [];
      statusHistory.push({
        status: 'completed',
        timestamp: new Date().toISOString(),
        note: 'Trip selesai'
      });

      const { data, error } = await supabaseAdmin
        .from('bookings')
        .update({
          status: 'completed',
          tracking: {
            ...booking.tracking,
            end_time: new Date().toISOString(),
            actual_distance: actualDistance,
            actual_duration: actualDuration,
            actual_fare: actualFare.totalFare
          },
          status_history: statusHistory,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          customer:users!bookings_customer_id_fkey(id, name, phone),
          driver:users!bookings_driver_id_fkey(id, name, phone, driver_data)
        `)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error completing trip:', error);
      throw error;
    }
  }

  // Rate booking
  async rateBooking(id, rating, review = '', ratedBy) {
    try {
      const booking = await this.getBookingById(id);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'completed') {
        throw new Error('Only completed bookings can be rated');
      }

      const ratingData = booking.rating || {};
      
      if (ratedBy === 'customer') {
        if (ratingData.customer_rating) {
          throw new Error('Customer has already rated this booking');
        }
        ratingData.customer_rating = rating;
        ratingData.customer_review = review;
      } else if (ratedBy === 'driver') {
        if (ratingData.driver_rating) {
          throw new Error('Driver has already rated this booking');
        }
        ratingData.driver_rating = rating;
        ratingData.driver_review = review;
      }

      const { data, error } = await supabaseAdmin
        .from('bookings')
        .update({
          rating: ratingData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          customer:users!bookings_customer_id_fkey(id, name, phone),
          driver:users!bookings_driver_id_fkey(id, name, phone, driver_data)
        `)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error rating booking:', error);
      throw error;
    }
  }

  // Calculate fare
  calculateFare(distance, duration, vehicleType) {
    const baseFare = vehicleType === 'motor' ? 5000 : 10000;
    const distanceFare = distance * (vehicleType === 'motor' ? 2000 : 3000);
    const timeFare = duration * (vehicleType === 'motor' ? 100 : 150);
    
    return {
      baseFare,
      distanceFare: Math.round(distanceFare),
      timeFare: Math.round(timeFare),
      totalFare: Math.round(baseFare + distanceFare + timeFare),
      currency: 'IDR'
    };
  }

  // Get booking statistics
  async getBookingStatistics(userId, userRole, period = 'week') {
    try {
      let startDate = new Date();
      if (period === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else if (period === 'year') {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }

      let query = supabase
        .from('bookings')
        .select('*', { count: 'exact' });

      // Filter by user role
      if (userRole === 'customer') {
        query = query.eq('customer_id', userId);
      } else if (userRole === 'driver') {
        query = query.eq('driver_id', userId);
      }

      // Filter by date
      query = query.gte('created_at', startDate.toISOString());

      const { data, error, count } = await query;

      if (error) {
        throw new Error(error.message);
      }

      const totalBookings = count;
      const completedBookings = data.filter(b => b.status === 'completed').length;
      const cancelledBookings = data.filter(b => b.status === 'cancelled').length;
      const totalEarnings = data
        .filter(b => b.status === 'completed')
        .reduce((sum, b) => sum + (b.fare?.actualFare || b.fare?.totalFare || 0), 0);

      return {
        period,
        totalBookings,
        completedBookings,
        cancelledBookings,
        completionRate: totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0,
        totalEarnings,
        averageEarnings: completedBookings > 0 ? Math.round(totalEarnings / completedBookings) : 0
      };
    } catch (error) {
      console.error('Error getting booking statistics:', error);
      throw error;
    }
  }
}

module.exports = new BookingService(); 