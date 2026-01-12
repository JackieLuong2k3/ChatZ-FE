'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from "@/components/Header";
import axios from 'axios';
import ReactModal from 'react-modal';

interface UserProfile {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  gender?: string;
  age?: number;
  interests?: string[];
  bio?: string;
  locale?: string;
  lastActiveAt?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  // Edit form data
  const [editFormData, setEditFormData] = useState({
    username: '',
    avatar: '',
    gender: '',
    age: '',
    interests: [] as string[],
    bio: '',
    locale: '',
  });

  const [provinces, setProvinces] = useState<any[]>([]);
  const [searchProvince, setSearchProvince] = useState('');
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const provinceDropdownRef = useRef<HTMLDivElement>(null);

  // Danh sách interests có sẵn
  const availableInterests = [
    'sport', 'music', 'love', 'math', 'english', 'football', '18+',
    'reading', 'gaming', 'travel', 'cooking', 'photography', 'art',
    'dancing', 'movies', 'technology', 'science', 'history', 'fashion', 'fitness',
  ];

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError('');

        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Lấy userId từ localStorage (từ token/user data)
        let userId: string | null = null;
        const userStr = localStorage.getItem('user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            userId = user.id || user._id;
          } catch (err) {
            console.error('Error parsing user data:', err);
          }
        }

        // Nếu không có userId từ localStorage, thử lấy từ URL params (fallback)
        if (!userId) {
          userId = searchParams?.get('userId') || null;
        }

        if (!userId) {
          setError('Không tìm thấy userId. Vui lòng đăng nhập lại.');
          setLoading(false);
          return;
        }

        // Call API để lấy profile
        const res = await axios.get(`${API_URL}/api/users/profile/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = res.data;
        if (data.success && data.data) {
          setProfile(data.data);
        } else {
          setError(data.message || 'Không thể tải profile');
        }
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Có lỗi xảy ra';
        setError(errorMessage);
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };

        loadProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

  // Load provinces khi mở modal edit
  useEffect(() => {
    if (showEditModal) {
      const loadProvinces = async () => {
        try {
          const res = await axios.get('https://provinces.open-api.vn/api/v1/');
          setProvinces(res.data);
        } catch (err) {
          console.error('Error loading provinces:', err);
        }
      };
      loadProvinces();
    }
  }, [showEditModal]);

  // Close province dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (provinceDropdownRef.current && !provinceDropdownRef.current.contains(event.target as Node)) {
        setShowProvinceDropdown(false);
      }
    };

    if (showProvinceDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProvinceDropdown]);

  // Set app element for react-modal (accessibility)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ReactModal.setAppElement(document.body);
    }
  }, []);

  // Format time
  const formatLastActive = (dateString?: string): string => {
    if (!dateString) return 'Chưa có thông tin';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Đang hoạt động';
    if (minutes < 60) return `Hoạt động ${minutes} phút trước`;
    if (minutes < 1440) return `Hoạt động ${Math.floor(minutes / 60)} giờ trước`;
    
    return `Hoạt động ${Math.floor(minutes / 1440)} ngày trước`;
  };

  // Format gender
  const formatGender = (gender?: string): string => {
    if (!gender) return 'Chưa cập nhật';
    if (gender === 'male') return 'Nam';
    if (gender === 'female') return 'Nữ';
    if (gender === 'other') return 'Khác';
    if (gender === '') return 'Chưa cập nhật';
    return gender;
  };

  // Open edit modal
  const handleOpenEdit = () => {
    if (profile) {
      setEditFormData({
        username: profile.username || '',
        avatar: profile.avatar || '',
        gender: profile.gender || '',
        age: profile.age?.toString() || '',
        interests: profile.interests || [],
        bio: profile.bio || '',
        locale: profile.locale || '',
      });
      setEditError('');
      setShowEditModal(true);
    }
  };

  // Handle edit form submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!editFormData.username.trim()) {
      setEditError('Vui lòng nhập tên người dùng');
      return;
    }

    if (!editFormData.gender) {
      setEditError('Vui lòng chọn giới tính');
      return;
    }

    if (!editFormData.age || parseInt(editFormData.age) < 13 || parseInt(editFormData.age) > 100) {
      setEditError('Vui lòng nhập tuổi hợp lệ (13-100)');
      return;
    }

    try {
      setSaving(true);
      setEditError('');

      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const payload = {
        username: editFormData.username.trim(),
        gender: editFormData.gender,
        age: parseInt(editFormData.age),
        interests: editFormData.interests,
        bio: editFormData.bio.trim() || undefined,
        locale: editFormData.locale || undefined,
        avatar: editFormData.avatar.trim() || undefined,
      };

      const res = await axios.put(`${API_URL}/api/users/profile`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = res.data;
      if (data.success) {
        // Cập nhật profile hiện tại
        setProfile(data.data);
        
        // Cập nhật user trong localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            const updatedUser = { ...user, ...data.data };
            localStorage.setItem('user', JSON.stringify(updatedUser));
          } catch (err) {
            console.error('Error updating user in localStorage:', err);
          }
        }

        setShowEditModal(false);
      } else {
        setEditError(data.message || 'Không thể cập nhật profile');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Có lỗi xảy ra';
      setEditError(errorMessage);
      console.error('Error updating profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleInterest = (interest: string) => {
    const currentInterests = editFormData.interests;
    if (currentInterests.includes(interest)) {
      setEditFormData({
        ...editFormData,
        interests: currentInterests.filter((i) => i !== interest),
      });
    } else {
      setEditFormData({
        ...editFormData,
        interests: [...currentInterests, interest],
      });
    }
  };

  const handleProvinceSelect = (provinceName: string) => {
    setEditFormData({
      ...editFormData,
      locale: provinceName,
    });
    setSearchProvince(provinceName);
    setShowProvinceDropdown(false);
  };

  const filteredProvinces = provinces.filter((province: any) =>
    province.name.toLowerCase().includes(searchProvince.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Đang tải profile...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error && !profile) {
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
                Không thể tải profile
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {error}
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              Quay lại
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8">
            <div className="flex items-center justify-between">
              <button
                onClick={() => router.back()}
                className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors"
              >
                <svg
                  className="w-6 h-6 text-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>
              <button
                onClick={handleOpenEdit}
                className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors flex items-center space-x-2 text-white font-medium"
              >
                <svg
                  className="w-5 h-5 text-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                <span>Chỉnh sửa</span>
              </button>
            </div>
          </div>

          {/* Profile Content */}
          <div className="p-8">
            {/* Avatar and Basic Info */}
            <div className="flex flex-col items-center mb-8 -mt-16">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.username}
                  className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-indigo-500 flex items-center justify-center text-white text-4xl font-bold border-4 border-white dark:border-gray-800 shadow-lg">
                  {profile.username?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-4 mb-2">
                {profile.username}
              </h1>
              {profile.lastActiveAt && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {formatLastActive(profile.lastActiveAt)}
                </p>
              )}
            </div>

            {/* Profile Details */}
            <div className="space-y-6">
              {/* Bio */}
              {profile.bio && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    Giới thiệu
                  </h3>
                  <p className="text-gray-900 dark:text-white">
                    {profile.bio}
                  </p>
                </div>
              )}

              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Age */}
                {profile.age && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                        <svg
                          className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Tuổi
                        </p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-white">
                          {profile.age} tuổi
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Gender */}
                {profile.gender && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                        <svg
                          className="w-6 h-6 text-purple-600 dark:text-purple-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Giới tính
                        </p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-white">
                          {formatGender(profile.gender)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Locale */}
                {profile.locale && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                        <svg
                          className="w-6 h-6 text-green-600 dark:text-green-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Khu vực
                        </p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-white">
                          {profile.locale}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Interests */}
              {profile.interests && profile.interests.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">
                    Sở thích
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.map((interest, index) => (
                      <span
                        key={index}
                        className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Edit Profile Modal */}
      <ReactModal
        isOpen={showEditModal}
        onRequestClose={() => setShowEditModal(false)}
        contentLabel="Chỉnh sửa Profile"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8 mx-auto outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
        shouldCloseOnOverlayClick={true}
        shouldCloseOnEsc={true}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Chỉnh sửa Profile
          </h2>
          <button
            onClick={() => setShowEditModal(false)}
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
            <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
              {editError && (
                <div className="p-4 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 rounded-lg">
                  {editError}
                </div>
              )}

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tên người dùng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.username}
                  onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Nhập tên người dùng"
                  required
                />
              </div>

              {/* Avatar URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Avatar (URL)
                </label>
                <input
                  type="url"
                  value={editFormData.avatar}
                  onChange={(e) => setEditFormData({ ...editFormData, avatar: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="https://example.com/avatar.jpg"
                />
                {editFormData.avatar && (
                  <div className="mt-2">
                    <img
                      src={editFormData.avatar}
                      alt="Avatar preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Giới tính <span className="text-red-500">*</span>
                </label>
                <select
                  value={editFormData.gender}
                  onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">Chọn giới tính</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              {/* Age */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tuổi <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="13"
                  max="100"
                  value={editFormData.age}
                  onChange={(e) => setEditFormData({ ...editFormData, age: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Nhập tuổi của bạn"
                  required
                />
              </div>

              {/* Locale */}
              <div className="relative" ref={provinceDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Khu vực
                </label>
                <input
                  type="text"
                  value={editFormData.locale || searchProvince}
                  onChange={(e) => {
                    setSearchProvince(e.target.value);
                    setEditFormData({ ...editFormData, locale: '' });
                    setShowProvinceDropdown(true);
                  }}
                  onFocus={() => {
                    if (editFormData.locale) {
                      setSearchProvince(editFormData.locale);
                    }
                    setShowProvinceDropdown(true);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Tìm kiếm tỉnh/thành phố"
                />
                {showProvinceDropdown && searchProvince && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredProvinces.length > 0 ? (
                      filteredProvinces.slice(0, 10).map((province: any) => (
                        <button
                          key={province.code}
                          type="button"
                          onClick={() => handleProvinceSelect(province.name)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                        >
                          {province.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-gray-500 dark:text-gray-400">
                        Không tìm thấy
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Giới thiệu về bản thân
                </label>
                <textarea
                  value={editFormData.bio}
                  onChange={(e) => setEditFormData({ ...editFormData, bio: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Viết một chút về bản thân bạn..."
                  maxLength={500}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {editFormData.bio.length}/500 ký tự
                </p>
              </div>

              {/* Interests */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sở thích
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableInterests.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        editFormData.interests.includes(interest)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Đang lưu...
                    </div>
                  ) : (
                    'Lưu thay đổi'
                  )}
                </button>
              </div>
            </form>
      </ReactModal>
    </div>
  );
}
