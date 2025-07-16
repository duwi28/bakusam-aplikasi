import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import socketService from '../services/socketService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,
      error: null,

      // Login
      login: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const response = await axios.post(`${API_URL}/auth/login`, {
            email,
            password,
          });
          
          const { user, token } = response.data;
          
          // Set axios default header
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Connect to Socket.io
          socketService.connect(token);
          
          set({ 
            user, 
            token, 
            loading: false,
            error: null 
          });
          
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.message || 'Login gagal';
          set({ 
            loading: false, 
            error: message,
            user: null,
            token: null 
          });
          return { success: false, error: message };
        }
      },

      // Register
      register: async (userData) => {
        set({ loading: true, error: null });
        try {
          const response = await axios.post(`${API_URL}/auth/register`, userData);
          
          const { user, token } = response.data;
          
          // Set axios default header
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Connect to Socket.io
          socketService.connect(token);
          
          set({ 
            user, 
            token, 
            loading: false,
            error: null 
          });
          
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.message || 'Registrasi gagal';
          set({ 
            loading: false, 
            error: message,
            user: null,
            token: null 
          });
          return { success: false, error: message };
        }
      },

      // Logout
      logout: () => {
        // Remove axios default header
        delete axios.defaults.headers.common['Authorization'];
        
        // Disconnect Socket.io
        socketService.disconnect();
        
        set({ 
          user: null, 
          token: null, 
          error: null,
          loading: false 
        });
      },

      // Update user profile
      updateProfile: async (userData) => {
        set({ loading: true, error: null });
        try {
          const response = await axios.put(`${API_URL}/users/profile`, userData);
          
          set({ 
            user: response.data.user,
            loading: false,
            error: null 
          });
          
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.message || 'Update profil gagal';
          set({ 
            loading: false, 
            error: message 
          });
          return { success: false, error: message };
        }
      },

      // Check auth status
      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ loading: false });
          return;
        }

        set({ loading: true });
        try {
          // Set axios default header
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          const response = await axios.get(`${API_URL}/auth/me`);
          
          // Connect to Socket.io if user is authenticated
          socketService.connect(token);
          
          set({ 
            user: response.data.user,
            loading: false,
            error: null 
          });
        } catch (error) {
          // Token invalid, logout
          delete axios.defaults.headers.common['Authorization'];
          socketService.disconnect();
          set({ 
            user: null, 
            token: null, 
            loading: false,
            error: null 
          });
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Set loading
      setLoading: (loading) => {
        set({ loading });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token 
      }),
    }
  )
);

export default useAuthStore; 