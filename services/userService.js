const { supabase, supabaseAdmin } = require('../config/supabase');
const bcrypt = require('bcryptjs');

class UserService {
  // Create new user
  async createUser(userData) {
    try {
      const { name, email, phone, password, role = 'customer' } = userData;

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Prepare user data
      const user = {
        name,
        email,
        phone,
        password: hashedPassword,
        role,
        is_verified: false,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add driver data if role is driver
      if (role === 'driver') {
        user.driver_data = {
          vehicle_type: 'motor',
          is_online: false,
          current_location: {
            type: 'Point',
            coordinates: [0, 0]
          },
          rating: 0,
          total_trips: 0,
          total_earnings: 0
        };
      }

      // Add customer data if role is customer
      if (role === 'customer') {
        user.customer_data = {
          home_address: null,
          work_address: null,
          favorite_drivers: []
        };
      }

      const { data, error } = await supabaseAdmin
        .from('users')
        .insert([user])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = data;
      return userWithoutPassword;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Find user by email
  async findByEmail(email) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  // Find user by phone
  async findByPhone(phone) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error finding user by phone:', error);
      return null;
    }
  }

  // Find user by ID
  async findById(id) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }

  // Update user
  async updateUser(id, updateData) {
    try {
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = data;
      return userWithoutPassword;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Update driver location
  async updateDriverLocation(id, latitude, longitude) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({
          driver_data: {
            current_location: {
              type: 'Point',
              coordinates: [longitude, latitude]
            }
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('role', 'driver')
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error updating driver location:', error);
      throw error;
    }
  }

  // Update driver rating
  async updateDriverRating(id, newRating) {
    try {
      const user = await this.findById(id);
      if (!user || user.role !== 'driver') {
        throw new Error('User not found or not a driver');
      }

      const currentRating = user.driver_data.rating || 0;
      const totalTrips = user.driver_data.total_trips || 0;
      
      // Calculate new average rating
      const newAverageRating = ((currentRating * totalTrips) + newRating) / (totalTrips + 1);
      
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({
          driver_data: {
            ...user.driver_data,
            rating: Math.round(newAverageRating * 10) / 10,
            total_trips: totalTrips + 1
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error updating driver rating:', error);
      throw error;
    }
  }

  // Find nearby drivers
  async findNearbyDrivers(latitude, longitude, vehicleType = null, maxDistance = 5000) {
    try {
      let query = supabase
        .from('users')
        .select('id, name, phone, driver_data')
        .eq('role', 'driver')
        .eq('is_active', true)
        .eq('driver_data->is_online', true);

      if (vehicleType) {
        query = query.eq('driver_data->vehicle_type', vehicleType);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      // Filter by distance (since Supabase doesn't support geospatial queries in free tier)
      const nearbyDrivers = data.filter(driver => {
        if (!driver.driver_data?.current_location?.coordinates) return false;
        
        const [driverLon, driverLat] = driver.driver_data.current_location.coordinates;
        const distance = this.calculateDistance(latitude, longitude, driverLat, driverLon);
        return distance <= maxDistance / 1000; // Convert to km
      });

      // Sort by distance
      nearbyDrivers.sort((a, b) => {
        const [aLon, aLat] = a.driver_data.current_location.coordinates;
        const [bLon, bLat] = b.driver_data.current_location.coordinates;
        const distanceA = this.calculateDistance(latitude, longitude, aLat, aLon);
        const distanceB = this.calculateDistance(latitude, longitude, bLat, bLon);
        return distanceA - distanceB;
      });

      return nearbyDrivers.slice(0, 10); // Return top 10 nearest drivers
    } catch (error) {
      console.error('Error finding nearby drivers:', error);
      throw error;
    }
  }

  // Get all users (for admin)
  async getAllUsers(filters = {}, page = 1, limit = 10) {
    try {
      let query = supabase
        .from('users')
        .select('id, name, email, phone, role, is_active, created_at', { count: 'exact' });

      // Apply filters
      if (filters.role) {
        query = query.eq('role', filters.role);
      }
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
      }

      const offset = (page - 1) * limit;
      const { data, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return {
        users: data,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  // Calculate distance between two points
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius bumi dalam km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Compare password
  async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }
}

module.exports = new UserService(); 