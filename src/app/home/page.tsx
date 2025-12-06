'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from "@/components/Header";

const HomePage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const checkPreferences = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Kiểm tra preferences
        const res = await fetch(`${API_URL}/api/users/preferences`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (res.ok) {
          const data = await res.json();
          // Nếu chưa có preferences hoặc preferences null
          if (!data.success || !data.data || !data.data.genders) {
            router.push('/update-preferences');
            return;
          }
        } else {
          // Nếu không lấy được preferences, có thể chưa có
          router.push('/update-preferences');
          return;
        }
      } catch (error) {
        console.error('Error checking preferences:', error);
        // Nếu có lỗi, vẫn cho vào home (có thể preferences đã có)
      } finally {
        setLoading(false);
      }
    };

    checkPreferences();
  }, [router]);

  if (loading) {
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
    <div>
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Start Chatting
          </h1>
        </div>
      </main>
    </div>
  );
};

export default HomePage;