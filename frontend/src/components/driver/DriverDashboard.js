import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Car, DollarSign, TrendingUp, User, Wifi, WifiOff } from 'lucide-react';
import axios from 'axios';

const DriverDashboard = () => {
  const [isOnline, setIsOnline] = useState(false);
  const [stats, setStats] = useState({
    totalTrips: 0,
    completedTrips: 0,
    totalEarnings: 0,
    averageRating: 0
  });
  const [currentOrder, setCurrentOrder] = useState(null);
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch driver stats
      const statsResponse = await axios.get('/api/drivers/stats');
      setStats(statsResponse.data);
      
      // Fetch current order
      const currentOrderResponse = await axios.get('/api/drivers/current-order');
      setCurrentOrder(currentOrderResponse.data.order);
      
      // Fetch recent trips
      const tripsResponse = await axios.get('/api/drivers/recent-trips');
      setRecentTrips(tripsResponse.data.trips || []);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;
      await axios.post('/api/drivers/toggle-status', { isOnline: newStatus });
      setIsOnline(newStatus);
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const acceptOrder = async (orderId) => {
    try {
      await axios.post(`/api/drivers/orders/${orderId}/accept`);
      fetchDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error accepting order:', error);
    }
  };

  const completeOrder = async (orderId) => {
    try {
      await axios.post(`/api/drivers/orders/${orderId}/complete`);
      fetchDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error completing order:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Selesai';
      case 'active':
        return 'Aktif';
      case 'cancelled':
        return 'Dibatalkan';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Online Status */}
      <div className={`rounded-lg p-6 ${isOnline ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isOnline ? (
              <Wifi className="h-6 w-6 text-green-600" />
            ) : (
              <WifiOff className="h-6 w-6 text-gray-600" />
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Status: {isOnline ? 'Online' : 'Offline'}
              </h3>
              <p className="text-sm text-gray-600">
                {isOnline ? 'Anda sedang menerima order' : 'Anda sedang offline'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleOnlineStatus}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              isOnline
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isOnline ? 'Go Offline' : 'Go Online'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Car className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Perjalanan</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTrips}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Selesai</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completedTrips}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Pendapatan</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalEarnings)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Rating Rata-rata</p>
              <p className="text-2xl font-bold text-gray-900">{stats.averageRating.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Order */}
      {currentOrder && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Order Saat Ini</h3>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {currentOrder.pickup_location} → {currentOrder.destination}
                </p>
                <p className="text-sm text-gray-500">
                  {formatCurrency(currentOrder.total_fare)}
                </p>
              </div>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(currentOrder.status)}`}>
                {getStatusText(currentOrder.status)}
              </span>
            </div>
            
            <div className="flex space-x-3">
              {currentOrder.status === 'pending' && (
                <button
                  onClick={() => acceptOrder(currentOrder.id)}
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-md font-medium hover:bg-primary-700 transition-colors"
                >
                  Terima Order
                </button>
              )}
              {currentOrder.status === 'active' && (
                <button
                  onClick={() => completeOrder(currentOrder.id)}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 transition-colors"
                >
                  Selesai
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Trips */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Perjalanan Terbaru</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {recentTrips.length > 0 ? (
            recentTrips.map((trip) => (
              <div key={trip.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <Car className="h-5 w-5 text-primary-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {trip.pickup_location} → {trip.destination}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(trip.created_at).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(trip.status)}`}>
                      {getStatusText(trip.status)}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(trip.total_fare)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center">
              <Car className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Belum ada perjalanan. Mulai online untuk menerima order!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard; 