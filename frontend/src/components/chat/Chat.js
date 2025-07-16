import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, User, Car } from 'lucide-react';
import socketService from '../../services/socketService';
import useAuthStore from '../../stores/authStore';

const Chat = ({ bookingId, isDriver = false }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!bookingId) return;

    // Load existing messages
    loadMessages();

    // Listen for new messages
    const handleNewMessage = (data) => {
      if (data.bookingId === bookingId) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          message: data.message,
          senderId: data.senderId,
          senderRole: data.senderRole,
          timestamp: data.timestamp,
          isOwn: data.senderId === user.id
        }]);
      }
    };

    socketService.on('new-message', handleNewMessage);

    return () => {
      socketService.off('new-message', handleNewMessage);
    };
  }, [bookingId, user.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      // In real app, fetch messages from API
      // For now, we'll use mock data
      const mockMessages = [
        {
          id: 1,
          message: 'Halo, saya sudah sampai di lokasi pickup',
          senderId: 'driver-1',
          senderRole: 'driver',
          timestamp: new Date().toISOString(),
          isOwn: false
        },
        {
          id: 2,
          message: 'Baik, saya sedang menunggu di depan',
          senderId: user.id,
          senderRole: 'customer',
          timestamp: new Date().toISOString(),
          isOwn: true
        }
      ];
      setMessages(mockMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !bookingId) return;

    try {
      const messageData = {
        bookingId,
        message: newMessage.trim()
      };

      // Send via Socket.io
      socketService.sendMessage(bookingId, newMessage.trim());

      // Add to local state immediately for optimistic update
      setMessages(prev => [...prev, {
        id: Date.now(),
        message: newMessage.trim(),
        senderId: user.id,
        senderRole: user.role,
        timestamp: new Date().toISOString(),
        isOwn: true
      }]);

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSenderName = (senderRole) => {
    return senderRole === 'driver' ? 'Driver' : 'Anda';
  };

  const getSenderIcon = (senderRole) => {
    return senderRole === 'driver' ? <Car className="h-4 w-4" /> : <User className="h-4 w-4" />;
  };

  if (!bookingId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Pilih booking untuk mulai chat</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border h-96 flex flex-col">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <MessageCircle className="h-5 w-5 text-primary-600" />
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              Chat Booking #{bookingId.slice(0, 8)}
            </h3>
            <p className="text-xs text-gray-500">
              {isDriver ? 'Customer' : 'Driver'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Belum ada pesan</p>
              <p className="text-xs text-gray-400">Mulai percakapan sekarang</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                  message.isOwn
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  {getSenderIcon(message.senderRole)}
                  <span className="text-xs font-medium">
                    {getSenderName(message.senderRole)}
                  </span>
                  <span className="text-xs opacity-75">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <p className="text-sm">{message.message}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={sendMessage} className="flex space-x-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ketik pesan..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
            disabled={!socketService.isConnected()}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !socketService.isConnected()}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Connection Status */}
      <div className="px-4 py-2 border-t border-gray-200">
        <div className={`text-xs ${socketService.isConnected() ? 'text-green-600' : 'text-red-600'}`}>
          {socketService.isConnected() ? '🟢 Terhubung' : '🔴 Terputus'}
        </div>
      </div>
    </div>
  );
};

export default Chat; 