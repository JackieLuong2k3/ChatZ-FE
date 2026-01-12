'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from "@/components/Header";
import axios from 'axios';

interface MatchPreferences {
  ageRange?: {
    min: number;
    max: number;
  };
  genders: 'male' | 'female' | 'other';
  locales?: string[];
  interests?: string[];
}

interface QueueStatus {
  status: 'idle' | 'queued' | 'matched';
  queue?: {
    userId: string;
    status: string;
    createdAt?: string;
    expiresAt?: string;
  };
  matchedUser?: {
    _id: string;
    username: string;
    avatar?: string;
    age?: number;
    gender?: string;
  };
  room?: {
    _id: string;
    participants: string[];
  };
}

export default function MatchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [waitingTime, setWaitingTime] = useState(0); // Thời gian đã đợi (giây)
  const [remainingTime, setRemainingTime] = useState<number | null>(null); // Thời gian còn lại (giây)
  const [preferences, setPreferences] = useState<MatchPreferences | null>(null); // User preferences
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
    };

    checkAuth();
    loadPreferences();
    loadQueueStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Chỉ chạy một lần khi mount

  // Load user preferences từ API
  const loadPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await axios.get(`${API_URL}/api/users/preferences`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = res.data;
      if (data.success && data.data) {
        setPreferences(data.data);
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
      // Nếu không có preferences, set về null
      setPreferences(null);
    }
  };
 

  // Tính toán thời gian đợi
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (queueStatus?.status === 'queued' && queueStatus.queue?.createdAt) {
      const updateTime = () => {
        const createdAt = new Date(queueStatus.queue!.createdAt!);
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
        setWaitingTime(elapsed);

        // Tính thời gian còn lại
        if (queueStatus.queue?.expiresAt) {
          const expiresAt = new Date(queueStatus.queue.expiresAt);
          const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
          setRemainingTime(remaining);
        }
      };

      updateTime(); // Update ngay lập tức
      intervalId = setInterval(updateTime, 1000); // Update mỗi giây
    } else {
      setWaitingTime(0);
      setRemainingTime(null);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [queueStatus?.status, queueStatus?.queue?.createdAt, queueStatus?.queue?.expiresAt, queueStatus?.queue]);

  // Poll queue status khi đang tìm match
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    // Chỉ polling khi đang searching và status là 'queued'
    if (isSearching && queueStatus?.status === 'queued') {
      intervalId = setInterval(() => {
        loadQueueStatus();
        // Chỉ gọi tryMatch nếu vẫn còn trong queue
        if (queueStatus?.status === 'queued') {
          tryMatch();
        }
      }, 5000); // Check mỗi 5 giây (giảm từ 3 giây)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearching, queueStatus?.status]); // Thêm queueStatus?.status vào dependencies

  // Tự động chuyển đến room khi đã match
  useEffect(() => {
    if (queueStatus?.status === 'matched' && queueStatus.room?._id) {
      const roomId = queueStatus.room._id;
      const timer = setTimeout(() => {
        router.push(`/room?roomId=${roomId}`);
      }, 2000); // Delay 2 giây để user thấy thông báo match thành công
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueStatus?.status, queueStatus?.room?._id]);

  const loadQueueStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await axios.get(`${API_URL}/api/queue/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = res.data;
      if (data.success && data.data) {
        const queueData = data.data;
        const newStatus = queueData.status || 'idle';
        
        // Xử lý userId - có thể là string hoặc object
        let userId: string;
        if (typeof queueData.userId === 'string') {
          userId = queueData.userId;
        } else if (queueData.userId?._id) {
          userId = queueData.userId._id;
        } else {
          userId = queueData._id || '';
        }
        
        setQueueStatus({
          status: newStatus,
          queue: {
            userId: userId,
            status: newStatus,
            createdAt: queueData.createdAt,
            expiresAt: queueData.expiresAt,
          },
          matchedUser: queueData.matchedUser,
          room: queueData.room,
        });

        // Nếu đã match, dừng polling
        // useEffect sẽ tự động chuyển đến room
        if (newStatus === 'matched') {
          setIsSearching(false);
        } else if (newStatus === 'queued' && !isSearching) {
          // Chỉ set isSearching nếu chưa đang searching để tránh trigger lại effect
          setIsSearching(true);
        }
      } else if (data.success && !data.data) {
        // Không có trong queue - có thể đã match thành công hoặc hết hạn
        // Kiểm tra xem có room nào không (có thể đã match trước đó)
        console.log('ℹ️  Không có trong queue, kiểm tra rooms...');
        setQueueStatus({ status: 'idle' });
        setIsSearching(false);
      }
    } catch (err) {
      const error = err as { response?: { status?: number }; message?: string };
      // Không hiển thị lỗi nếu chỉ là không có trong queue
      if (error.response?.status !== 404 && error.response?.status !== 200) {
        console.error('Error loading queue status:', err);
      } else if (error.response?.status === 200) {
        // Response 200 nhưng không có data = không có trong queue
        console.log('ℹ️  Queue không tồn tại (có thể đã match hoặc hết hạn)');
        setQueueStatus({ status: 'idle' });
        setIsSearching(false);
      }
    }
  };

  const handleJoinQueue = async () => {
    try {
      setLoading(true);
      setError('');

      // Kiểm tra preferences
      if (!preferences) {
        setError('Bạn cần thiết lập preferences trước khi tìm match');
        setTimeout(() => {
          router.push('/setup-preferences');
        }, 2000);
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Gọi API join queue với preferences
      const res = await axios.post(
        `${API_URL}/api/queue/join`,
        {
          preferences: preferences, // Gửi preferences từ user settings
          expiresInMinutes: 30, // Queue expires sau 30 phút
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
        const queueData = data.data;
        
        // Xử lý userId từ response
        let userId: string;
        if (typeof queueData.userId === 'string') {
          userId = queueData.userId;
        } else if (queueData.userId?._id) {
          userId = queueData.userId._id;
        } else {
          userId = queueData._id || '';
        }
        
        setQueueStatus({
          status: 'queued',
          queue: {
            userId: userId,
            status: queueData.status || 'queued',
            createdAt: queueData.createdAt,
            expiresAt: queueData.expiresAt,
          },
        });
        setIsSearching(true);
        // Bắt đầu thử match ngay
        setTimeout(() => {
          tryMatch();
        }, 500); // Delay nhỏ để đảm bảo state đã update
      } else {
        setError(data.message || 'Không thể tham gia hàng đợi');
        setIsSearching(false);
      }
    } catch (err) {
      const error = err as { response?: { data?: { message?: string; error?: string }; status?: number }; message?: string };
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Có lỗi xảy ra';
      setError(errorMessage);
      setIsSearching(false);
      console.error('Error joining queue:', err);
      
      // Nếu lỗi là thiếu preferences, redirect đến setup
      if (error.response?.status === 400 && errorMessage.includes('preferences')) {
        setTimeout(() => {
          router.push('/setup-preferences');
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const tryMatch = async () => {
    try {
      // Kiểm tra status trước khi gọi API
      if (queueStatus?.status !== 'queued') {
        return; // Không gọi API nếu không còn trong queue
      }

      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await axios.post(
        `${API_URL}/api/queue/match`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = res.data;
      if (data.success) {
        if (data.data?.success) {
          // Đã match!
          setQueueStatus({
            status: 'matched',
            matchedUser: data.data.matchedUser,
            room: data.data.room,
          });
          setIsSearching(false);
          // useEffect sẽ tự động chuyển đến room
        }
        // Nếu chưa match (data.data.success = false), không làm gì cả, để polling tiếp tục
      }
    } catch (err) {
      const error = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      // Xử lý lỗi 404 một cách graceful (queue đã bị xóa sau khi match)
      if (error.response?.status === 404) {
        const errorMessage = error.response?.data?.message || '';
        if (errorMessage.includes('Not in queue') || errorMessage.includes('không có trong hàng đợi')) {
          // Queue đã bị xóa (có thể đã match thành công hoặc hết hạn)
          // Kiểm tra lại status để xem có room không
          console.log('ℹ️  Queue không còn tồn tại, kiểm tra lại status...');
          setIsSearching(false); // Dừng polling ngay lập tức
          await loadQueueStatus();
          return; // Không hiển thị lỗi
        }
      }
      // Các lỗi khác chỉ log, không hiển thị
      console.error('Error trying match:', err);
    }
  };

  const handleLeaveQueue = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      await axios.delete(`${API_URL}/api/queue/leave`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      setQueueStatus({
        status: 'idle',
      });
      setIsSearching(false);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Có lỗi xảy ra';
      setError(errorMessage);
      console.error('Error leaving queue:', err);
    } finally {
      setLoading(false);
    }
  };


  // Format thời gian đợi
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} giây`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes} phút ${secs > 0 ? `${secs} giây` : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} giờ ${minutes > 0 ? `${minutes} phút` : ''}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Find Your Match
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Tìm người bạn phù hợp để bắt đầu cuộc trò chuyện
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          

          {/* Status: Idle - Chưa join queue */}
          { (!queueStatus || queueStatus.status === 'idle') && (
            <div className="text-center">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-indigo-100 dark:bg-indigo-900 rounded-full mb-4">
                  <svg
                    className="w-12 h-12 text-indigo-600 dark:text-indigo-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  Sẵn sàng tìm match?
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Nhấn nút bên dưới để bắt đầu tìm người bạn phù hợp
                </p>
                {!preferences && (
                  <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 text-yellow-700 dark:text-yellow-300 rounded-lg text-sm">
                    Bạn cần thiết lập preferences trước khi tìm match
                  </div>
                )}
              </div>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleJoinQueue}
                  disabled={loading || !preferences}
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? 'Đang xử lý...' : 'Bắt đầu tìm match'}
                </button>
                {!preferences && (
                  <button
                    onClick={() => router.push('/setup-preferences')}
                    className="px-6 py-4 bg-yellow-500 hover:bg-yellow-600 text-white text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    Thiết lập Preferences
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Status: Queued - Đang tìm match */}
          {queueStatus?.status === 'queued' && (
            <div className="text-center">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-yellow-100 dark:bg-yellow-900 rounded-full mb-4 animate-pulse">
                  <svg
                    className="w-12 h-12 text-yellow-600 dark:text-yellow-400 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  Đang tìm match...
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Hệ thống đang tìm kiếm người bạn phù hợp với bạn
                </p>
                
                {/* Thông tin queue và thời gian đợi */}
                <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-4 mb-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-center space-x-2">
                      <svg
                        className="w-5 h-5 text-indigo-600 dark:text-indigo-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                        Thời gian đã đợi:
                      </span>
                      <span className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                        {formatTime(waitingTime)}
                      </span>
                    </div>
                    {remainingTime !== null && remainingTime > 0 && (
                      <div className="flex items-center justify-center space-x-2">
                        <svg
                          className="w-5 h-5 text-gray-600 dark:text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Còn lại: {formatTime(remainingTime)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
              <button
                onClick={handleLeaveQueue}
                disabled={loading}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Đang xử lý...' : 'Hủy tìm kiếm'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
