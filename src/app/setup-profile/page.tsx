'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface Province {
  name: string;
  code: number;
  division_type: string;
  codename: string;
  phone_code: number;
  districts: any[];
}

export default function SetupProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState('');
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const [formData, setFormData] = useState({
    username: '',
    avatar: '',
    gender: '',
    age: '',
    interests: [] as string[],
    bio: '',
    locale: '',
  });

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [searchProvince, setSearchProvince] = useState('');
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const provinceDropdownRef = useRef<HTMLDivElement>(null);

  // Danh sách interests có sẵn
  const availableInterests = [
    'sport',
    'music',
    'love',
    'math',
    'english',
    'football',
    '18+',
    'reading',
    'gaming',
    'travel',
    'cooking',
    'photography',
    'art',
    'dancing',
    'movies',
    'technology',
    'science',
    'history',
    'fashion',
    'fitness',
  ];

  // Load provinces từ API
  useEffect(() => {
    const loadProvinces = async () => {
      try {
        const res = await axios.get<Province[]>('https://provinces.open-api.vn/api/v1/');
        setProvinces(res.data);
      } catch (err) {
        console.error('Error loading provinces:', err);
      } finally {
        setLoadingProvinces(false);
      }
    };

    loadProvinces();
  }, []);

  // Kiểm tra authentication và load profile hiện tại
  useEffect(() => {
    const checkAuthAndLoadProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Lấy userId từ localStorage
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

        if (userId) {
          // Load profile hiện tại nếu có
          try {
            const res = await axios.get(`${API_URL}/api/users/profile/${userId}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });

            const data = res.data;
            if (data.success && data.data) {
              const profile = data.data;
              setFormData({
                username: profile.username || '',
                avatar: profile.avatar || '',
                gender: profile.gender || '',
                age: profile.age || '',
                interests: profile.interests || [],
                bio: profile.bio || '',
                locale: profile.locale || '',
              });
            }
          } catch (err) {
            // Nếu không load được profile, tiếp tục với form trống
            console.log('Profile not found or error loading:', err);
          }
        }
      } catch (err) {
        console.error('Error checking auth:', err);
        router.push('/login');
      } finally {
        setLoadingProfile(false);
      }
    };

    checkAuthAndLoadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.username.trim()) {
      setError('Vui lòng nhập tên người dùng');
      return;
    }

    if (!formData.gender) {
      setError('Vui lòng chọn giới tính');
      return;
    }

    if (!formData.age || parseInt(formData.age) < 13 || parseInt(formData.age) > 100) {
      setError('Vui lòng nhập tuổi hợp lệ (13-100)');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const payload = {
        username: formData.username.trim(),
        gender: formData.gender,
        age: parseInt(formData.age),
        interests: formData.interests,
        bio: formData.bio.trim() || undefined,
        locale: formData.locale || undefined,
        avatar: formData.avatar.trim() || undefined,
      };

      const res = await axios.put(`${API_URL}/api/users/profile`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = res.data;
      if (data.success) {
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

        // Redirect đến setup-preferences
        router.push('/setup-preferences');
      } else {
        setError(data.message || 'Không thể cập nhật profile');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Có lỗi xảy ra';
      setError(errorMessage);
      console.error('Error updating profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (interest: string) => {
    const currentInterests = formData.interests;
    if (currentInterests.includes(interest)) {
      setFormData({
        ...formData,
        interests: currentInterests.filter((i) => i !== interest),
      });
    } else {
      setFormData({
        ...formData,
        interests: [...currentInterests, interest],
      });
    }
  };

  const handleProvinceSelect = (provinceName: string) => {
    setFormData({
      ...formData,
      locale: provinceName,
    });
    setSearchProvince(provinceName);
    setShowProvinceDropdown(false);
  };

  const filteredProvinces = provinces.filter((province) =>
    province.name.toLowerCase().includes(searchProvince.toLowerCase())
  );

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Thiết lập Profile
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Hãy cho chúng tôi biết một chút về bạn
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tên người dùng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
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
                value={formData.avatar}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="https://example.com/avatar.jpg"
              />
              {formData.avatar && (
                <div className="mt-2">
                  <img
                    src={formData.avatar}
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
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
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
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
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
                value={formData.locale || searchProvince}
                onChange={(e) => {
                  setSearchProvince(e.target.value);
                  setFormData({ ...formData, locale: '' }); // Clear locale when typing
                  setShowProvinceDropdown(true);
                }}
                onFocus={() => {
                  if (formData.locale) {
                    setSearchProvince(formData.locale);
                  }
                  setShowProvinceDropdown(true);
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Tìm kiếm tỉnh/thành phố"
                disabled={loadingProvinces}
              />
              {showProvinceDropdown && searchProvince && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredProvinces.length > 0 ? (
                    filteredProvinces.slice(0, 10).map((province) => (
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
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Viết một chút về bản thân bạn..."
                maxLength={500}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formData.bio.length}/500 ký tự
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
                      formData.interests.includes(interest)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Đang lưu...
                  </div>
                ) : (
                  'Lưu và tiếp tục'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
