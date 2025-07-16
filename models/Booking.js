const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'picked_up', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  pickupLocation: {
    address: {
      type: String,
      required: true
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true
      }
    }
  },
  destinationLocation: {
    address: {
      type: String,
      required: true
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true
      }
    }
  },
  vehicleType: {
    type: String,
    enum: ['motor', 'mobil'],
    required: true
  },
  distance: {
    type: Number, // dalam kilometer
    required: true
  },
  duration: {
    type: Number, // dalam menit
    required: true
  },
  fare: {
    baseFare: {
      type: Number,
      required: true
    },
    distanceFare: {
      type: Number,
      required: true
    },
    timeFare: {
      type: Number,
      required: true
    },
    totalFare: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'IDR'
    }
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'e-wallet', 'credit_card'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  // Tracking data
  tracking: {
    pickupTime: Date,
    startTime: Date,
    endTime: Date,
    actualDistance: Number,
    actualDuration: Number,
    actualFare: Number
  },
  // Rating dan review
  rating: {
    customerRating: {
      type: Number,
      min: 1,
      max: 5
    },
    customerReview: String,
    driverRating: {
      type: Number,
      min: 1,
      max: 5
    },
    driverReview: String
  },
  // Additional data
  notes: String,
  cancellationReason: String,
  cancelledBy: {
    type: String,
    enum: ['customer', 'driver', 'system']
  },
  // Timestamps untuk tracking
  statusHistory: [{
    status: {
      type: String,
      enum: ['pending', 'accepted', 'picked_up', 'in_progress', 'completed', 'cancelled']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String
  }]
}, {
  timestamps: true
});

// Index untuk geospatial queries
bookingSchema.index({ 'pickupLocation.coordinates': '2dsphere' });
bookingSchema.index({ 'destinationLocation.coordinates': '2dsphere' });

// Method untuk update status booking
bookingSchema.methods.updateStatus = function(newStatus, note = '') {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note: note
  });
  return this.save();
};

// Method untuk menghitung total fare
bookingSchema.methods.calculateFare = function() {
  const baseFare = this.fare.baseFare;
  const distanceFare = this.fare.distanceFare;
  const timeFare = this.fare.timeFare;
  
  this.fare.totalFare = baseFare + distanceFare + timeFare;
  return this.fare.totalFare;
};

// Method untuk complete trip
bookingSchema.methods.completeTrip = function(actualDistance, actualDuration) {
  this.status = 'completed';
  this.tracking.endTime = new Date();
  this.tracking.actualDistance = actualDistance;
  this.tracking.actualDuration = actualDuration;
  
  // Recalculate fare based on actual distance and duration
  const baseFare = this.fare.baseFare;
  const distanceFare = actualDistance * 2000; // Rp 2000 per km
  const timeFare = actualDuration * 100; // Rp 100 per menit
  
  this.fare.actualFare = baseFare + distanceFare + timeFare;
  
  this.statusHistory.push({
    status: 'completed',
    timestamp: new Date(),
    note: 'Trip selesai'
  });
  
  return this.save();
};

// Method untuk cancel booking
bookingSchema.methods.cancelBooking = function(reason, cancelledBy) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;
  
  this.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    note: `Dibatalkan oleh ${cancelledBy}: ${reason}`
  });
  
  return this.save();
};

// Static method untuk mencari driver terdekat
bookingSchema.statics.findNearbyDrivers = function(location, maxDistance = 5000) {
  return this.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'driver',
        foreignField: '_id',
        as: 'driverInfo'
      }
    },
    {
      $unwind: '$driverInfo'
    },
    {
      $match: {
        'driverInfo.role': 'driver',
        'driverInfo.driverData.isOnline': true,
        'driverInfo.isActive': true
      }
    },
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: location
        },
        distanceField: 'distance',
        maxDistance: maxDistance,
        spherical: true
      }
    },
    {
      $sort: { distance: 1 }
    }
  ]);
};

module.exports = mongoose.model('Booking', bookingSchema); 