import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Car, Clock, DollarSign, User, Phone } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import toast from 'react-hot-toast';
import socketService from '../../services/socketService';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const pickupIcon = new L.Icon({
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

const driverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Map component with location tracking
const LocationTracker = ({ onLocationFound }) => {
  const map = useMap();

  useEffect(() => {
    map.locate({ setView: true, maxZoom: 16 });
    
    map.on('locationfound', (e) => {
      onLocationFound([e.latlng.lat, e.latlng.lng]);
    });
    
    map.on('locationerror', () => {
      // Default to Jakarta if location not found
      onLocationFound([-6.2088, 106.8456]);
    });
  }, [map, onLocationFound]);

  return null;
};

const Booking = () => {
  const [currentLocation, setCurrentLocation] = useState([-6.2088, 106.8456]);
  const [pickupLocation, setPickupLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [estimatedFare, setEstimatedFare] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [vehicleType, setVehicleType] = useState('motor');
  const [isLoading, setIsLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);

  const mapRef = useRef();

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation([latitude, longitude]);
        },
        () => {
          // Default to Jakarta if location not available
          setCurrentLocation([-6.2088, 106.8456]);
        }
      );
    }
  }, []);

  const geocodeAddress = async (address) => {
    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: {
          q: address,
          format: 'json',
          limit: 1,
          countrycodes: 'id'
        }
      });
      
      if (response.data && response.data.length > 0) {
        const { lat, lon } = response.data[0];
        return [parseFloat(lat), parseFloat(lon)];
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  const calculateRoute = async () => {
    if (!pickupCoords || !destinationCoords) return;

    try {
      const response = await axios.get(`https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${destinationCoords[1]},${destinationCoords[0]}`, {
        params: {
          overview: 'full',
          geometries: 'geojson'
        }
      });

      if (response.data && response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        const distance = route.distance / 1000; // Convert to km
        const duration = route.duration / 60; // Convert to minutes
        
        // Calculate fare based on distance and vehicle type
        const baseFare = vehicleType === 'motor' ? 5000 : 10000;
        const perKmFare = vehicleType === 'motor' ? 2000 : 4000;
        const fare = baseFare + (distance * perKmFare);
        
        setEstimatedFare(Math.round(fare));
        setEstimatedTime(Math.round(duration));
      }
    } catch (error) {
      console.error('Route calculation error:', error);
    }
  };

  const handlePickupChange = async (value) => {
    setPickupLocation(value);
    if (value) {
      const coords = await geocodeAddress(value);
      setPickupCoords(coords);
    }
  };

  const handleDestinationChange = async (value) => {
    setDestination(value);
    if (value) {
      const coords = await geocodeAddress(value);
      setDestinationCoords(coords);
    }
  };

  useEffect(() => {
    if (pickupCoords && destinationCoords) {
      calculateRoute();
    }
  }, [pickupCoords, destinationCoords, vehicleType]);

  const handleBookRide = async () => {
    if (!pickupLocation || !destination) {
      toast.error('Mohon isi lokasi pickup dan tujuan');
      return;
    }

    setIsBooking(true);
    try {
      // Create booking via Socket.io
      const bookingData = {
        pickup_location: {
          address: pickupLocation,
          latitude: pickupCoords[0],
          longitude: pickupCoords[1]
        },
        destination: {
          address: destination,
          latitude: destinationCoords[0],
          longitude: destinationCoords[1]
        },
        vehicle_type: vehicleType,
        estimated_fare: estimatedFare,
        estimated_time: estimatedTime
      };

      // Send via Socket.io
      socketService.createBooking(bookingData);

      // Listen for booking creation response
      socketService.on('booking-created', (data) => {
        setCurrentBooking(data.booking);
        toast.success('Booking berhasil dibuat! Mencari driver...');
      });

      // Listen for booking acceptance
      socketService.on('booking-accepted', (data) => {
        setDriverLocation([pickupCoords[0] + 0.001, pickupCoords[1] + 0.001]);
        toast.success('Driver ditemukan!');
      });

      // Listen for booking errors
      socketService.on('booking-error', (data) => {
        toast.error(data.message || 'Gagal membuat booking');
        setIsBooking(false);
      });

    } catch (error) {
      toast.error('Gagal membuat booking');
      setIsBooking(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Map Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Peta</h2>
              <div className="h-96 rounded-lg overflow-hidden">
                <MapContainer
                  ref={mapRef}
                  center={currentLocation}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  
                  <LocationTracker onLocationFound={setCurrentLocation} />
                  
                  {/* Pickup Marker */}
                  {pickupCoords && (
                    <Marker position={pickupCoords} icon={pickupIcon}>
                      <Popup>
                        <div>
                          <strong>Lokasi Pickup</strong><br />
                          {pickupLocation}
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  
                  {/* Destination Marker */}
                  {destinationCoords && (
                    <Marker position={destinationCoords} icon={destinationIcon}>
                      <Popup>
                        <div>
                          <strong>Tujuan</strong><br />
                          {destination}
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  
                  {/* Driver Marker */}
                  {driverLocation && (
                    <Marker position={driverLocation} icon={driverIcon}>
                      <Popup>
                        <div>
                          <strong>Driver</strong><br />
                          Sedang menuju ke lokasi Anda
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>
            </div>
          </div>

          {/* Booking Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Pesan Ojek</h2>
              
              <div className="space-y-6">
                {/* Pickup Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    Lokasi Pickup
                  </label>
                  <input
                    type="text"
                    value={pickupLocation}
                    onChange={(e) => handlePickupChange(e.target.value)}
                    placeholder="Masukkan lokasi pickup"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Destination */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    Tujuan
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => handleDestinationChange(e.target.value)}
                    placeholder="Masukkan tujuan"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Vehicle Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Car className="inline h-4 w-4 mr-1" />
                    Jenis Kendaraan
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="motor">Motor</option>
                    <option value="mobil">Mobil</option>
                  </select>
                </div>

                {/* Estimated Info */}
                {(estimatedFare > 0 || estimatedTime > 0) && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Estimasi Perjalanan</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 text-gray-400 mr-2" />
                        <div>
                          <p className="text-sm text-gray-500">Waktu</p>
                          <p className="text-sm font-medium text-gray-900">{estimatedTime} menit</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <DollarSign className="h-5 w-5 text-gray-400 mr-2" />
                        <div>
                          <p className="text-sm text-gray-500">Biaya</p>
                          <p className="text-sm font-medium text-gray-900">{formatCurrency(estimatedFare)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Book Button */}
                <button
                  onClick={handleBookRide}
                  disabled={isBooking || !pickupLocation || !destination}
                  className="w-full bg-primary-600 text-white py-3 px-4 rounded-md font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isBooking ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Mencari Driver...
                    </div>
                  ) : (
                    'Pesan Ojek'
                  )}
                </button>

                {/* Current Booking Status */}
                {currentBooking && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-green-900 mb-2">Booking Aktif</h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">ID:</span> {currentBooking.id}</p>
                      <p><span className="font-medium">Status:</span> {currentBooking.status}</p>
                      <p><span className="font-medium">Biaya:</span> {formatCurrency(currentBooking.total_fare)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booking; 