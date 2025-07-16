const fetch = require('node-fetch');

class MapsService {
  constructor() {
    this.nominatimBaseUrl = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
    this.osrmBaseUrl = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
  }

  // Geocoding: Convert address to coordinates
  async geocodeAddress(address) {
    try {
      const response = await fetch(
        `${this.nominatimBaseUrl}/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=id`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
          displayName: data[0].display_name,
          address: data[0]
        };
      }
      
      throw new Error('Address not found');
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error('Gagal menemukan lokasi');
    }
  }

  // Reverse geocoding: Convert coordinates to address
  async reverseGeocode(latitude, longitude) {
    try {
      const response = await fetch(
        `${this.nominatimBaseUrl}/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=18`
      );
      
      if (!response.ok) {
        throw new Error('Reverse geocoding request failed');
      }

      const data = await response.json();
      
      return {
        address: data.display_name,
        details: data.address,
        coordinates: {
          latitude: parseFloat(data.lat),
          longitude: parseFloat(data.lon)
        }
      };
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw new Error('Gagal mendapatkan alamat');
    }
  }

  // Calculate route between two points
  async calculateRoute(origin, destination) {
    try {
      const { latitude: lat1, longitude: lon1 } = origin;
      const { latitude: lat2, longitude: lon2 } = destination;
      
      const response = await fetch(
        `${this.osrmBaseUrl}/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`
      );
      
      if (!response.ok) {
        throw new Error('Routing request failed');
      }

      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        return {
          distance: route.distance / 1000, // Convert to km
          duration: route.duration / 60, // Convert to minutes
          geometry: route.geometry,
          steps: route.legs[0].steps
        };
      }
      
      throw new Error('Route not found');
    } catch (error) {
      console.error('Routing error:', error);
      throw new Error('Gagal menghitung rute');
    }
  }

  // Calculate distance between two points (Haversine formula)
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

  // Search nearby places
  async searchNearbyPlaces(latitude, longitude, query, radius = 5000) {
    try {
      const response = await fetch(
        `${this.nominatimBaseUrl}/search?q=${encodeURIComponent(query)}&format=json&limit=10&viewbox=${longitude-0.01},${latitude-0.01},${longitude+0.01},${latitude+0.01}&bounded=1`
      );
      
      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const data = await response.json();
      
      return data.map(place => ({
        name: place.display_name,
        latitude: parseFloat(place.lat),
        longitude: parseFloat(place.lon),
        type: place.type,
        distance: this.calculateDistance(
          latitude, 
          longitude, 
          parseFloat(place.lat), 
          parseFloat(place.lon)
        )
      })).sort((a, b) => a.distance - b.distance);
    } catch (error) {
      console.error('Search nearby places error:', error);
      throw new Error('Gagal mencari tempat terdekat');
    }
  }

  // Get place suggestions for autocomplete
  async getPlaceSuggestions(query, limit = 5) {
    try {
      const response = await fetch(
        `${this.nominatimBaseUrl}/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&countrycodes=id&addressdetails=1`
      );
      
      if (!response.ok) {
        throw new Error('Autocomplete request failed');
      }

      const data = await response.json();
      
      return data.map(place => ({
        id: place.place_id,
        name: place.display_name,
        latitude: parseFloat(place.lat),
        longitude: parseFloat(place.lon),
        type: place.type,
        address: place.address
      }));
    } catch (error) {
      console.error('Autocomplete error:', error);
      throw new Error('Gagal mendapatkan saran tempat');
    }
  }
}

module.exports = new MapsService(); 