'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: () => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ;
  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const handleGoogleLogin = async (response: any) => {
    try {
      setLoading(true);
      setError('');

      const idToken = response.credential;

      const res = await axios.post(`${API_URL}/api/auth/google`, {
        idToken,
      });

      const data = res.data;

      // Store token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Kiểm tra preferences - nếu chưa có thì redirect đến setup-preferences
      const user = data.user;
      const hasPreferences = user?.settings?.matchPreferences?.genders;
      
      if (!hasPreferences) {
        // User login lần đầu hoặc chưa có preferences
        router.push('/setup-preferences');
      } else {
        // User đã có preferences, redirect to home
        router.push('/home');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Đăng nhập thất bại';
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if Google script is already loaded
    if (typeof window !== 'undefined' && window.google) {
      setScriptLoaded(true);
    }

    // Load Google Sign-In script if not already loaded
    if (typeof window !== 'undefined' && !window.google && !scriptLoaded) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setScriptLoaded(true);
      };
      document.head.appendChild(script);
    }
  });

  // Separate effect for rendering button
  useEffect(() => {
    // Clear button container first
    if (buttonRef.current) {
      buttonRef.current.innerHTML = '';
    }

    // Initialize and render button when script is loaded
    if (scriptLoaded && window.google && buttonRef.current && GOOGLE_CLIENT_ID) {
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleLogin,
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'signin_with',
          locale: 'vi',
        });
      } catch (error) {
        console.error('Error rendering Google button:', error);
      }
    }
  }, [scriptLoaded, GOOGLE_CLIENT_ID]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Đăng nhập
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Chào mừng bạn trở lại
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 rounded">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {!GOOGLE_CLIENT_ID ? (
            <div className="p-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 text-yellow-700 dark:text-yellow-300 rounded">
              Vui lòng cấu hình NEXT_PUBLIC_GOOGLE_CLIENT_ID trong file .env
            </div>
          ) : (
            <div ref={buttonRef} className="w-full flex justify-center"></div>
          )}

          {loading && (
            <div className="text-center text-gray-600 dark:text-gray-400">
              Đang xử lý...
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Bằng cách đăng nhập, bạn đồng ý với điều khoản sử dụng của chúng tôi</p>
        </div>
      </div>
    </div>
  );
}
