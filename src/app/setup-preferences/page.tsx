'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

interface Province {
  name: string;
  code: number;
  division_type: string;
  codename: string;
  phone_code: number;
  districts: any[];
}

export default function UpdatePreferencesPage() {
  const [loading, setLoading] = useState(false);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const [preferences, setPreferences] = useState<MatchPreferences>({
    genders: 'male',
    ageRange: {
      min: 18,
      max: 50,
    },
    locales: [],
    interests: [],
  });

  const [showOtherLocale, setShowOtherLocale] = useState(false);
  const [otherLocaleValue, setOtherLocaleValue] = useState('');
  const [showOtherInterest, setShowOtherInterest] = useState(false);
  const [otherInterestValue, setOtherInterestValue] = useState('');
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [searchProvince, setSearchProvince] = useState('');
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);

  // Danh sách provinces (sẽ load từ API)
  const availableLocales = provinces.map(p => p.name);

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

  // Kiểm tra authentication và load preferences
  useEffect(() => {
    const checkAuthAndLoadPreferences = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Load existing preferences
        const res = await axios.get(`${API_URL}/api/users/preferences`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const data = res.data;
        if (data.success && data.data) {
          setPreferences({
            genders: data.data.genders || 'male',
            ageRange: data.data.ageRange || { min: 18, max: 50 },
            locales: data.data.locales || [],
            interests: data.data.interests || [],
          });
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
      } finally {
        setLoadingPreferences(false);
      }
    };

    checkAuthAndLoadPreferences();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Validate
      if (!preferences.genders) {
        throw new Error('Vui lòng chọn giới tính bạn muốn match');
      }

      if (preferences.ageRange) {
        if (preferences.ageRange.min < 13 || preferences.ageRange.min > 100) {
          throw new Error('Độ tuổi tối thiểu phải từ 13 đến 100');
        }
        if (preferences.ageRange.max < 13 || preferences.ageRange.max > 100) {
          throw new Error('Độ tuổi tối đa phải từ 13 đến 100');
        }
        if (preferences.ageRange.min > preferences.ageRange.max) {
          throw new Error('Độ tuổi tối thiểu phải nhỏ hơn hoặc bằng độ tuổi tối đa');
        }
      }

      const res = await axios.post(
        `${API_URL}/api/users/update-preferences`,
        { preferences },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = res.data;

      setSuccess(true);
      
      // Redirect to home after 1 second
      setTimeout(() => {
        router.push('/home');
      }, 1000);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Có lỗi xảy ra khi cập nhật preferences';
      setError(errorMessage);
      console.error('Update preferences error:', err);
    } finally {
      setLoading(false);
    }
  };

  const removeLocale = (locale: string) => {
    setPreferences({
      ...preferences,
      locales: preferences.locales?.filter((l) => l !== locale) || [],
    });
  };

  const addProvince = (provinceName: string) => {
    const currentLocales = preferences.locales || [];
    if (!currentLocales.includes(provinceName)) {
      setPreferences({
        ...preferences,
        locales: [...currentLocales, provinceName],
      });
    }
    setSearchProvince('');
    setShowProvinceDropdown(false);
  };

  const filteredProvinces = provinces.filter((province) =>
    province.name.toLowerCase().includes(searchProvince.toLowerCase())
  );

 
  const toggleInterest = (interest: string) => {
    const currentInterests = preferences.interests || [];
    if (currentInterests.includes(interest)) {
      // Remove interest
      setPreferences({
        ...preferences,
        interests: currentInterests.filter((i) => i !== interest),
      });
    } else {
      // Add interest
      setPreferences({
        ...preferences,
        interests: [...currentInterests, interest],
      });
    }
  };

  const toggleOtherInterest = () => {
    if (showOtherInterest) {
      // Uncheck - xóa interest tùy chỉnh nếu có
      const customInterest = preferences.interests?.find(interest => !availableInterests.includes(interest));
      if (customInterest) {
        setPreferences({
          ...preferences,
          interests: preferences.interests?.filter((i) => i !== customInterest) || [],
        });
      }
      setOtherInterestValue('');
    }
    setShowOtherInterest(!showOtherInterest);
  };

  const handleOtherInterestSubmit = () => {
    if (otherInterestValue.trim()) {
      const currentInterests = preferences.interests || [];
      const trimmedValue = otherInterestValue.trim();
      
      // Xóa interest tùy chỉnh cũ nếu có (chỉ giữ lại các interests có sẵn)
      const standardInterests = currentInterests.filter(interest => availableInterests.includes(interest));
      
      // Thêm interest mới nếu chưa có
      if (!currentInterests.includes(trimmedValue)) {
        setPreferences({
          ...preferences,
          interests: [...standardInterests, trimmedValue],
        });
        setOtherInterestValue(''); // Clear input after adding
      }
    }
  };

  if (loadingPreferences) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
              Thiết lập Preferences
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Hãy cho chúng tôi biết bạn muốn match với ai
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-100 dark:bg-green-900 border border-green-400 text-green-700 dark:text-green-300 rounded-lg">
              Cập nhật thành công! Đang chuyển hướng...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Gender Preference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Giới tính bạn muốn match <span className="text-red-500">*</span>
              </label>
              <select
                value={preferences.genders}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    genders: e.target.value as 'male' | 'female' | 'other',
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>

            {/* Age Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Độ tuổi
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Từ
                  </label>
                  <input
                    type="number"
                    min="13"
                    max="100"
                    value={preferences.ageRange?.min || 18}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        ageRange: {
                          min: parseInt(e.target.value) || 18,
                          max: preferences.ageRange?.max || 50,
                        },
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Đến
                  </label>
                  <input
                    type="number"
                    min="13"
                    max="100"
                    value={preferences.ageRange?.max || 50}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        ageRange: {
                          min: preferences.ageRange?.min || 18,
                          max: parseInt(e.target.value) || 50,
                        },
                      })
                    }   
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Locales - Tỉnh/Thành phố */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Tỉnh / Thành phố
              </label>
              
              {loadingProvinces ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Đang tải danh sách tỉnh/thành phố...</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={searchProvince}
                      onChange={(e) => {
                        setSearchProvince(e.target.value);
                        setShowProvinceDropdown(true);
                      }}
                      onFocus={() => setShowProvinceDropdown(true)}
                      placeholder="Tìm kiếm tỉnh/thành phố..."
                      className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                    <svg
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  {/* Dropdown List */}
                  {showProvinceDropdown && searchProvince && (
                    <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredProvinces.length > 0 ? (
                        filteredProvinces.map((province) => {
                          const isSelected = preferences.locales?.includes(province.name) || false;
                          return (
                            <button
                              key={province.code}
                              type="button"
                              onClick={() => addProvince(province.name)}
                              disabled={isSelected}
                              className={`w-full text-left px-4 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors ${
                                isSelected
                                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 cursor-not-allowed'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{province.name}</span>
                                {isSelected && (
                                  <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">
                          Không tìm thấy tỉnh/thành phố nào
                        </div>
                      )}
                    </div>
                  )}

                  {/* Click outside to close dropdown */}
                  {showProvinceDropdown && (
                    <div
                      className="fixed inset-0 z-0"
                      onClick={() => setShowProvinceDropdown(false)}
                    ></div>
                  )}
                </div>
              )}

              {/* Hiển thị các tỉnh/thành phố đã chọn */}
              {preferences.locales && preferences.locales.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Đã chọn {preferences.locales.length} tỉnh/thành phố:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {preferences.locales.map((locale, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full text-sm"
                      >
                        {locale}
                        <button
                          type="button"
                          onClick={() => removeLocale(locale)}
                          className="ml-2 text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-100"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Interests */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Sở thích
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-3">
                {availableInterests.map((interest) => {
                  const isChecked = preferences.interests?.includes(interest) || false;
                  return (
                    <label
                      key={interest}
                      className={`flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        isChecked
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-500'
                          : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-600 bg-white dark:bg-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleInterest(interest)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                        {interest}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Checkbox "Khác" với input */}
              <div className="mb-3">
                <label className="flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all hover:border-indigo-400 dark:hover:border-indigo-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                  <input
                    type="checkbox"
                    checked={showOtherInterest}
                    onChange={toggleOtherInterest}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Khác
                  </span>
                </label>
                
                {showOtherInterest && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={otherInterestValue}
                      onChange={(e) => setOtherInterestValue(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleOtherInterestSubmit();
                        }
                      }}
                      placeholder="Nhập sở thích khác (vd: swimming, painting)"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleOtherInterestSubmit}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Thêm
                    </button>
                  </div>
                )}
              </div>

              {preferences.interests && preferences.interests.length > 0 && (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  Đã chọn {preferences.interests.length} sở thích
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Đang lưu...' : 'Lưu Preferences'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/home')}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Bỏ qua
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
