import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Clock, Car } from 'lucide-react';
import socketService from '../../services/socketService';

// Custom marker icons
const driverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const customerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Map component that follows driver location
const MapUpdater = ({ driverLocation, customerLocation, destinationLocation }) => {
  const map = useMap();

  useEffect(() => {
    if (driverLocation) {
      map.setView([driverLocation.latitude, driverLocation.longitude], 15);
    }
  }, [driverLocation, map]);

  return null;
};

const LiveTracking = ({ booking, isDriver = false }) => {
  const [driverLocation, setDriverLocation] = useState(null);
  const [customerLocation, setCustomerLocation] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [estimatedDistance, setEstimatedDistance] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const mapRef = useRef();

  useEffect(() => {
    if (!booking) return;

    // Start tracking
    setIsTracking(true);

    // Listen for driver location updates
    const handleDriverLocationUpdate = (data) => {
      if (data.driverId === booking.driver_id) {
        setDriverLocation(data.location);
        updateRoute(data.location);
      }
    };

    // Listen for booking status updates
    const handleBookingStatusUpdate = (data) => {
      if (data.bookingId === booking.id) {
        // Update booking status
        console.log('Booking status updated:', data.status);
      }
    };

    // Listen for new messages
    const handleNewMessage = (data) => {
      if (data.bookingId === booking.id) {
        console.log('New message:', data.message);
      }
    };

    // Subscribe to socket events
    socketService.on('driver-location-updated', handleDriverLocationUpdate);
    socketService.on('booking-status-updated', handleBookingStatusUpdate);
    socketService.on('new-message', handleNewMessage);

    // Get initial driver location if available
    if (booking.driver_id) {
      // In real app, fetch driver location from API
      setDriverLocation({
        latitude: booking.pickup_location.latitude + 0.001,
        longitude: booking.pickup_location.longitude + 0.001
      });
    }

    // Get customer location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCustomerLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        () => {
          // Use pickup location as fallback
          setCustomerLocation(booking.pickup_location);
        }
      );
    }

    // Cleanup
    return () => {
      socketService.off('driver-location-updated', handleDriverLocationUpdate);
      socketService.off('booking-status-updated', handleBookingStatusUpdate);
      socketService.off('new-message', handleNewMessage);
    };
  }, [booking]);

  const updateRoute = async (driverLoc) => {
    if (!driverLoc || !booking.destination) return;

    try {
      // Calculate route using OSRM
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${driverLoc.longitude},${driverLoc.latitude};${booking.destination.longitude},${booking.destination.latitude}?overview=full&geometries=geojson`
      );
      
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        setRoutePath(route.geometry.coordinates.map(coord => [coord[1], coord[0]]));
        setEstimatedTime(Math.round(route.duration / 60));
        setEstimatedDistance(Math.round(route.distance / 1000 * 10) / 10);
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    }
  };

  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes} menit`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} jam ${mins} menit`;
  };

  const formatDistance = (km) => {
    return `${km} km`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted':
        return 'text-blue-600';
      case 'active':
        return 'text-green-600';
      case 'completed':
        return 'text-gray-600';
      default:
        return 'text-yellow-600';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Menunggu Driver';
      case 'accepted':
        return 'Driver Menuju Lokasi';
      case 'active':
        return 'Dalam Perjalanan';
      case 'completed':
        return 'Selesai';
      default:
        return status;
    }
  };

  if (!booking) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Car className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Tidak ada booking aktif</p>
        </div>
      </div>
    );
  }

  const center = driverLocation || booking.pickup_location;

  return (
    <div className="space-y-4">
      {/* Booking Status */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Booking #{booking.id.slice(0, 8)}
            </h3>
            <p className={`text-sm font-medium ${getStatusColor(booking.status)}`}>
              {getStatusText(booking.status)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Estimasi</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatTime(estimatedTime)}
            </p>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="h-96">
          <MapContainer
            ref={mapRef}
            center={[center.latitude, center.longitude]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            <MapUpdater 
              driverLocation={driverLocation}
              customerLocation={customerLocation}
              destinationLocation={booking.destination}
            />

            {/* Driver Marker */}
            {driverLocation && (
              <Marker 
                position={[driverLocation.latitude, driverLocation.longitude]} 
                icon={driverIcon}
              >
                <Popup>
                  <div>
                    <strong>Driver</strong><br />
                    {isDriver ? 'Lokasi Anda' : 'Lokasi Driver'}
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Customer Marker */}
            {customerLocation && !isDriver && (
              <Marker 
                position={[customerLocation.latitude, customerLocation.longitude]} 
                icon={customerIcon}
              >
                <Popup>
                  <div>
                    <strong>Lokasi Anda</strong><br />
                    Titik pickup
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Destination Marker */}
            {booking.destination && (
              <Marker 
                position={[booking.destination.latitude, booking.destination.longitude]} 
                icon={destinationIcon}
              >
                <Popup>
                  <div>
                    <strong>Tujuan</strong><br />
                    {booking.destination.address}
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Route Path */}
            {routePath.length > 0 && (
              <Polyline
                positions={routePath}
                color="#3B82F6"
                weight={4}
                opacity={0.7}
              />
            )}
          </MapContainer>
        </div>
      </div>

      {/* Tracking Info */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Clock className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Waktu Estimasi</p>
              <p className="text-sm font-medium text-gray-900">
                {formatTime(estimatedTime)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Navigation className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Jarak</p>
              <p className="text-sm font-medium text-gray-900">
                {formatDistance(estimatedDistance)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <MapPin className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className={`text-sm font-medium ${getStatusColor(booking.status)}`}>
                {getStatusText(booking.status)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Actions (if isDriver) */}
      {isDriver && booking.status === 'accepted' && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Driver Actions</h4>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                socketService.updateBookingStatus(booking.id, 'active');
              }}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Mulai Perjalanan
            </button>
            <button
              onClick={() => {
                socketService.updateBookingStatus(booking.id, 'completed');
              }}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Selesai
            </button>
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className={`text-center text-sm ${socketService.isConnected() ? 'text-green-600' : 'text-red-600'}`}>
        {socketService.isConnected() ? '🟢 Terhubung real-time' : '🔴 Terputus dari server'}
      </div>
    </div>
  );
};

export default LiveTracking; 