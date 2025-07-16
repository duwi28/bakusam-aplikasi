const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nama wajib diisi'],
    trim: true,
    maxlength: [50, 'Nama tidak boleh lebih dari 50 karakter']
  },
  email: {
    type: String,
    required: [true, 'Email wajib diisi'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email tidak valid']
  },
  phone: {
    type: String,
    required: [true, 'Nomor telepon wajib diisi'],
    unique: true,
    match: [/^(\+62|62|0)8[1-9][0-9]{6,9}$/, 'Nomor telepon tidak valid']
  },
  password: {
    type: String,
    required: [true, 'Password wajib diisi'],
    minlength: [6, 'Password minimal 6 karakter']
  },
  role: {
    type: String,
    enum: ['customer', 'driver', 'admin'],
    default: 'customer'
  },
  avatar: {
    type: String,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Data khusus driver
  driverData: {
    vehicleType: {
      type: String,
      enum: ['motor', 'mobil'],
      default: 'motor'
    },
    vehicleNumber: String,
    vehicleBrand: String,
    vehicleModel: String,
    licensePlate: String,
    isOnline: {
      type: Boolean,
      default: false
    },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: [0, 0]
      }
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalTrips: {
      type: Number,
      default: 0
    },
    totalEarnings: {
      type: Number,
      default: 0
    }
  },
  // Data khusus customer
  customerData: {
    homeAddress: String,
    workAddress: String,
    favoriteDrivers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  // Data umum
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  preferences: {
    language: {
      type: String,
      default: 'id'
    },
    notifications: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Index untuk geospatial queries
userSchema.index({ 'driverData.currentLocation': '2dsphere' });

// Hash password sebelum save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method untuk compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method untuk mendapatkan data public (tanpa password)
userSchema.methods.toPublicJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Method untuk update lokasi driver
userSchema.methods.updateLocation = function(latitude, longitude) {
  if (this.role === 'driver') {
    this.driverData.currentLocation.coordinates = [longitude, latitude];
    return this.save();
  }
  throw new Error('Hanya driver yang bisa update lokasi');
};

// Method untuk update rating driver
userSchema.methods.updateRating = function(newRating) {
  if (this.role === 'driver') {
    const currentRating = this.driverData.rating;
    const totalTrips = this.driverData.totalTrips;
    
    // Hitung rating rata-rata
    const newAverageRating = ((currentRating * totalTrips) + newRating) / (totalTrips + 1);
    
    this.driverData.rating = Math.round(newAverageRating * 10) / 10; // Round to 1 decimal
    this.driverData.totalTrips += 1;
    
    return this.save();
  }
  throw new Error('Hanya driver yang bisa update rating');
};

module.exports = mongoose.model('User', userSchema); 