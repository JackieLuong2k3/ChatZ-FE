'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from "@/components/Header";
import axios from 'axios';

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
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Có lỗi xảy ra khi kiểm tra preferences';
        console.error('Error checking preferences:', errorMessage);
        router.push('/login');
      }
    };
    checkPreferences();
  }, [router]);

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