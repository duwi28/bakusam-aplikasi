import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, MapPin, Car, CreditCard, Settings, Bell } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import UserDashboard from './UserDashboard';
import DriverDashboard from './DriverDashboard';

const Dashboard = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Check auth status on mount
    const checkAuth = async () => {
      // This will be handled by the auth store
    };
    checkAuth();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      name: 'Dashboard',
      icon: MapPin,
      href: '/dashboard',
      current: true
    },
    {
      name: 'Booking',
      icon: Car,
      href: '/booking',
      current: false
    },
    {
      name: 'Pembayaran',
      icon: CreditCard,
      href: '/payments',
      current: false
    },
    {
      name: 'Profil',
      icon: User,
      href: '/profile',
      current: false
    },
    {
      name: 'Notifikasi',
      icon: Bell,
      href: '/notifications',
      current: false
    },
    {
      name: 'Pengaturan',
      icon: Settings,
      href: '/settings',
      current: false
    }
  ];

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-primary-600">Bakusam</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.role === 'driver' ? 'Driver' : 'Penumpang'}</p>
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden md:block text-sm">Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      item.current
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {user.role === 'driver' ? (
              <DriverDashboard />
            ) : (
              <UserDashboard />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 