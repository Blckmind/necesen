import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { AlertCircle } from 'lucide-react';
import { KhamiLogo } from './KhamiLogo';

interface AuthScreenProps {
  onSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setError('Zəhmət olmasa bütün xanaları doldurun.');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Parol və parolun təkrarı uyğun gəlmir.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isLogin ? '/api/login' : '/api/register';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          password
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Əməliyyat uğursuz oldu');
      }

      // Successful login or registration
      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Xəta baş verdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      id="auth-screen"
      className="min-h-screen w-full bg-[#050507] text-[#e4e4e7] flex flex-col items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-[440px]">
        {/* Brand Header with Logo & necəsən under the logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4">
            <KhamiLogo 
              className="w-16 h-16 sm:w-20 sm:h-20 drop-shadow-[0_0_16px_rgba(255,255,255,0.15)]" 
              strokeWidth={5} 
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-montserrat tracking-[0.2em] text-white uppercase pl-[0.2em]">
            necəsən
          </h1>
          <p className="text-xs text-zinc-400 font-mono-tech mt-2 tracking-wider">
            Mesaj Platforması
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-mono-tech flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </motion.div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username Field */}
          <div className="space-y-2">
            <label 
              htmlFor="auth-username-input"
              className="block text-sm font-mono-tech text-zinc-300 tracking-wide"
            >
              İstifadəçi adı
            </label>
            <input
              id="auth-username-input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder=""
              className="w-full h-12 px-4 rounded-md bg-[#0e0e12] border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono-tech text-sm transition-all"
              required
            />
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label 
              htmlFor="auth-password-input"
              className="block text-sm font-mono-tech text-zinc-300 tracking-wide"
            >
              Parol
            </label>
            <input
              id="auth-password-input"
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=""
              className="w-full h-12 px-4 rounded-md bg-[#0e0e12] border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono-tech text-sm transition-all"
              required
            />
          </div>

          {/* Confirm Password Field (Only for Register) */}
          <AnimatePresence>
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <label 
                  htmlFor="auth-confirm-password-input"
                  className="block text-sm font-mono-tech text-zinc-300 tracking-wide"
                >
                  Parolun təkrarı
                </label>
                <input
                  id="auth-confirm-password-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder=""
                  className="w-full h-12 px-4 rounded-md bg-[#0e0e12] border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono-tech text-sm transition-all"
                  required={!isLogin}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Neon Green Button */}
          <div className="pt-2">
            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-md neon-btn-green font-bold text-sm tracking-widest font-mono-tech uppercase cursor-pointer flex items-center justify-center transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : isLogin ? (
                'DAXİL OL'
              ) : (
                'QEYDİYYATDAN KEÇ'
              )}
            </button>
          </div>

          {/* Bottom Switch Links */}
          <div className="pt-4 text-center">
            {isLogin ? (
              <p className="text-xs font-mono-tech text-zinc-400">
                Hesabınız yoxdur?{' '}
                <button
                  id="auth-switch-to-register-btn"
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setError('');
                  }}
                  className="text-[#00ff66] hover:underline font-medium cursor-pointer ml-1"
                >
                  Qeydiyyatdan keç
                </button>
              </p>
            ) : (
              <p className="text-xs font-mono-tech text-zinc-400">
                Artıq hesabınız var?{' '}
                <button
                  id="auth-switch-to-login-btn"
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setError('');
                  }}
                  className="text-[#00ff66] hover:underline font-medium cursor-pointer ml-1"
                >
                  Daxil olun
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
