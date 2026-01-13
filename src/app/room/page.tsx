'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from "@/components/Header";
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import Image from 'next/image';

interface MatchedUser {
  _id: string;
  username: string;
  avatar?: string;
  age?: number;
  gender?: string;
}

interface Room {
  _id: string;
  participants: string[];
  status?: string;
  type?: string;
  createdAt?: string;
}

interface SenderInfo {
  _id: string;
  username?: string;
  avatar?: string;
  [key: string]: unknown;
}

interface Message {
  _id: string;
  senderId: string | SenderInfo;
  content: string;
  type?: string;
  createdAt: string;
}

interface QueueStatus {
  status: 'idle' | 'queued' | 'matched';
  matchedUser?: MatchedUser;
  room?: Room;
}

function RoomPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [matchedUser, setMatchedUser] = useState<MatchedUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const profileModalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      
      // Get current user ID from token or localStorage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setCurrentUserId(user.id || user._id);
        } catch (err) {
          console.error('Error parsing user data:', err);
        }
      }
    };

    checkAuth();
    loadRoomData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Socket.IO connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !room?._id) return;

    // Connect to Socket.IO server
    const socket = io(API_URL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server');
      // Join room when connected
      socket.emit('join_room', room._id);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from Socket.IO server');
    });

    socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
      setError(error.message || 'Socket.IO connection error');
    });

    socket.on('joined_room', (data) => {
      console.log('✅ Joined room:', data.roomId);
    });

    // Listen for new messages
    socket.on('new_message', (message) => {
      console.log('📨 New message received:', message);
      setMessages((prev) => {
        // Check if message already exists
        const exists = prev.some(msg => msg._id === message._id);
        if (exists) return prev;
        return [...prev, message];
      });
      
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    // Cleanup on unmount
    return () => {
      if (socket && room?._id) {
        socket.emit('leave_room', room._id);
      }
      socket.disconnect();
    };
  }, [room?._id, API_URL]);

  // Load room data from queue status or URL params
  const loadRoomData = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Try to get room ID from URL params first
      const roomIdFromUrl = searchParams?.get('roomId');
      
      // If no room ID in URL, try to get from queue status
      if (!roomIdFromUrl) {
        const queueStatus = await loadQueueStatus();
        if (queueStatus?.room?._id) {
          await loadRoomInfo(queueStatus.room._id);
          if (queueStatus.matchedUser) {
            setMatchedUser(queueStatus.matchedUser);
          }
        } else {
          setError('Không tìm thấy phòng chat. Vui lòng tìm match lại.');
          setTimeout(() => {
            router.push('/match');
          }, 2000);
          return;
        }
      } else {
        await loadRoomInfo(roomIdFromUrl);
      }
    } catch (err) {
      const error = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Có lỗi xảy ra';
      setError(errorMessage);
      console.error('Error loading room data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load queue status to get room info
  const loadQueueStatus = async (): Promise<QueueStatus | null> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;

      const res = await axios.get(`${API_URL}/api/queue/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = res.data;
      if (data.success && data.data) {
        const queueData = data.data;
        if (queueData.status === 'matched' && queueData.room) {
          return {
            status: 'matched',
            matchedUser: queueData.matchedUser,
            room: queueData.room,
          };
        }
      }
      return null;
    } catch (err) {
      console.error('Error loading queue status:', err);
      return null;
    }
  };

  // Load room information
  const loadRoomInfo = async (roomId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Get room info from API
      const res = await axios.get(`${API_URL}/api/rooms/${roomId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = res.data;
      if (data.success && data.data) {
        setRoom(data.data.room);
        // Set matched user from API response
        if (data.data.matchedUser) {
          setMatchedUser(data.data.matchedUser);
        }
        // Load messages
        await loadMessages(roomId);
      }
    } catch (err) {
      // If API doesn't exist or room not found, try to get from queue status
      console.log('Room API not available, using queue status:', err);
      const queueStatus = await loadQueueStatus();
      if (queueStatus?.room?._id === roomId) {
        setRoom(queueStatus.room);
        if (queueStatus.matchedUser) {
          setMatchedUser(queueStatus.matchedUser);
        }
      }
    }
  };

  // Load messages for the room
  const loadMessages = async (roomId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await axios.get(`${API_URL}/api/chat/rooms/${roomId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = res.data;
      if (data.success && data.data) {
        setMessages(data.data.messages || data.data || []);
      }
    } catch (err) {
      // If messages API doesn't exist, just set empty array
      console.log('Messages API not available:', err);
      setMessages([]);
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || !room?._id) return;

    const messageContent = message.trim();
    setMessage(''); // Clear input immediately for better UX

    try {
      setSending(true);
      setError('');

      // Try to send via Socket.IO first
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('send_message', {
          roomId: room._id,
          content: messageContent,
          type: 'text'
        });
        setSending(false);
        return;
      }

      // Fallback to REST API if Socket.IO is not connected
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await axios.post(
        `${API_URL}/api/chat/rooms/${room._id}/messages`,
        {
          content: messageContent,
          type: 'text',
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = res.data;
      if (data.success && data.data) {
        setMessages((prev) => [...prev, data.data]);
        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err) {
      const error = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Không thể gửi tin nhắn';
      setError(errorMessage);
      console.error('Error sending message:', err);
      // Restore message if failed
      setMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  // Auto scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  // Close profile modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileModalRef.current && !profileModalRef.current.contains(event.target as Node)) {
        setShowProfileModal(false);
      }
    };

    if (showProfileModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileModal]);

  // Format time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`;
    
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  // Handle report
  const handleReport = async () => {
    setShowMenu(false);
    // TODO: Implement report functionality
    alert('Tính năng báo cáo đang được phát triển');
  };

  // Handle block
  const handleBlock = async () => {
    setShowMenu(false);
    if (!matchedUser?._id) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // TODO: Implement block API call
      // await axios.post(`${API_URL}/api/users/block`, { userId: matchedUser._id }, {
      //   headers: { 'Authorization': `Bearer ${token}` }
      // });
      
      alert('Đã chặn người dùng này');
      router.push('/match');
    } catch (err) {
      console.error('Error blocking user:', err);
      alert('Không thể chặn người dùng');
    }
  };

  // Handle leave chat
  const handleLeaveChat = async () => {
    setShowMenu(false);
    if (!room?._id) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Leave queue first
      try {
        await axios.delete(`${API_URL}/api/queue/leave`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        console.log('✅ Đã rời khỏi queue');
      } catch (queueErr) {
        // Nếu không có trong queue hoặc lỗi, vẫn tiếp tục
        const error = queueErr as { response?: { data?: { message?: string } }; message?: string };
        console.log('Queue leave error (may not be in queue):', error.response?.data?.message || error.message);
      }

      // Leave room via Socket.IO if connected
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('leave_room', room._id);
        socketRef.current.disconnect();
      }

      // TODO: Implement leave room API call if needed
      // await axios.post(`${API_URL}/api/rooms/${room._id}/leave`, {}, {
      //   headers: { 'Authorization': `Bearer ${token}` }
      // });
      
      router.push('/match');
    } catch (err) {
      console.error('Error leaving room:', err);
      router.push('/match');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Đang tải phòng chat...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!room || !matchedUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-red-100 dark:bg-red-900 rounded-full mb-4">
                <svg
                  className="w-12 h-12 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Không tìm thấy phòng chat
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {error || 'Vui lòng tìm match lại để bắt đầu trò chuyện'}
              </p>
            </div>
            <button
              onClick={() => router.push('/match')}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              Tìm match lại
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Room Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {matchedUser.avatar ? (
                <Image
                  src={matchedUser.avatar}
                  alt={matchedUser.username}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full object-cover border-4 border-indigo-500"
                  unoptimized
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center text-white text-2xl font-bold">
                  {matchedUser.username?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div 
                onClick={() => setShowProfileModal(true)}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              >
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {matchedUser.username}
                </h2>
                
              </div>
            </div>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                aria-label="Menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </button>
              
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-10 overflow-hidden">
                  <button
                    onClick={handleReport}
                    className="w-full px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span>Báo cáo</span>
                  </button>
                  <button
                    onClick={handleBlock}
                    className="w-full px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                    <span>Chặn</span>
                  </button>
                  <button
                    onClick={handleLeaveChat}
                    className="w-full px-4 py-3 text-left text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    <span>Rời trò chuyện</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col" style={{ height: 'calc(100vh - 300px)', minHeight: '500px' }}>
          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 dark:bg-indigo-900 rounded-full mb-4">
                  <svg
                    className="w-10 h-10 text-indigo-600 dark:text-indigo-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Chưa có tin nhắn nào
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
                  Bắt đầu cuộc trò chuyện bằng cách gửi tin nhắn đầu tiên!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const senderIdStr = typeof msg.senderId === 'string' 
                  ? msg.senderId 
                  : (msg.senderId as SenderInfo)?._id;
                const isMyMessage = senderIdStr === currentUserId;
                
                return (
                  <div
                    key={msg._id}
                    className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        isMyMessage
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isMyMessage ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-6 mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex space-x-4">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Nhập tin nhắn..."
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transform hover:scale-105"
              >
                {sending ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Đang gửi...
                  </div>
                ) : (
                  'Gửi'
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Profile Modal */}
      {showProfileModal && matchedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            ref={profileModalRef}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Hồ sơ
              </h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Avatar */}
              <div className="flex justify-center mb-6">
                {matchedUser.avatar ? (
                  <Image
                    src={matchedUser.avatar}
                    alt={matchedUser.username}
                    width={128}
                    height={128}
                    className="w-32 h-32 rounded-full object-cover border-4 border-indigo-500"
                    unoptimized
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-indigo-500 flex items-center justify-center text-white text-4xl font-bold">
                    {matchedUser.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Tên người dùng
                  </label>
                  <p className="text-lg text-gray-900 dark:text-white mt-1">
                    {matchedUser.username}
                  </p>
                </div>

                {matchedUser.age && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Tuổi
                    </label>
                    <p className="text-lg text-gray-900 dark:text-white mt-1">
                      {matchedUser.age} tuổi
                    </p>
                  </div>
                )}

                {matchedUser.gender && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Giới tính
                    </label>
                    <p className="text-lg text-gray-900 dark:text-white mt-1">
                      {matchedUser.gender === 'male' ? 'Nam' : matchedUser.gender === 'female' ? 'Nữ' : matchedUser.gender}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Đang tải...</p>
          </div>
        </main>
      </div>
    }>
      <RoomPageContent />
    </Suspense>
  );
}
