"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/useAuthStore';
import { Presentation, Shield, User as UserIcon, Lock, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export default function LoginPage() {
  const router = useRouter();
  const { login, initialize, token, user } = useAuthStore();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [role, setRole] = useState<'presenter' | 'student'>('student');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Hydrate Zustand state on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Redirect if already logged in
  useEffect(() => {
    if (token && user) {
      router.push('/dashboard');
    }
  }, [token, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegistering ? { username, password, role } : { username, password };

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '요청이 실패했습니다.');
      }

      if (isRegistering) {
        setSuccessMsg('회원가입이 완료되었습니다. 로그인해 주세요.');
        setIsRegistering(false);
        setPassword('');
      } else {
        login(data.user, data.token);
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || '서버와의 통신에 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative gradient glowing backgrounds */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl relative z-10">
        
        {/* Logo and Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)] mb-4">
            <Presentation className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            LUNA Presenter PRO
          </h1>
          <p className="text-slate-400 text-xs mt-1.5">
            강사 저작 모드 & 일반 사용자 뷰어 연동
          </p>
        </div>

        {/* Tab Selector: Login vs Register */}
        <div className="grid grid-cols-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => { setIsRegistering(false); setError(''); }}
            className={`py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${!isRegistering ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => { setIsRegistering(true); setError(''); }}
            className={`py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${isRegistering ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            회원가입
          </button>
        </div>

        {/* Info alerts */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Username Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">아이디</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <UserIcon className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none transition"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">비밀번호</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none transition"
              />
            </div>
          </div>

          {/* Role Selection (Only when Registering) */}
          {isRegistering && (
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">역할 선택</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold gap-2 transition ${
                    role === 'student'
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <UserIcon className="w-5 h-5" />
                  일반 사용자(보기 전용)
                </button>
                <button
                  type="button"
                  onClick={() => setRole('presenter')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold gap-2 transition ${
                    role === 'presenter'
                      ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Shield className="w-5 h-5" />
                  강사(작성/편집 권한)
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                처리 중...
              </>
            ) : (
              isRegistering ? '회원가입 완료' : '로그인'
            )}
          </button>

        </form>

        {!isRegistering && (
          <div className="mt-6 p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-center text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">🔑 테스트 강사(관리자) 계정</p>
            <p>아이디: <code className="text-indigo-400">admin</code> | 비밀번호: <code className="text-indigo-400">admin123</code></p>
          </div>
        )}
      </div>
    </div>
  );
}
