/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase, LoginRole, SessionState } from '../types';
import { BookOpen, Key, User, ShieldCheck, GraduationCap, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginScreenProps {
  db: SchemaDatabase;
  onLoginSuccess: (session: SessionState) => void;
}

export function LoginScreen({ db, onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'guru'>('admin');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (role === 'admin') {
      if (username.trim() === db.adminUsername && password === db.adminPasswordKey) {
        onLoginSuccess({
          role: 'admin',
          userId: 'admin',
          name: 'Administrator'
        });
      } else {
        setError('Username atau Password Admin salah!');
      }
    } else {
      // Find teacher
      const teacher = db.guru.find(
        (g) => g.username.toLowerCase() === username.trim().toLowerCase() && g.passwordKey === password
      );
      if (teacher) {
        onLoginSuccess({
          role: 'guru',
          userId: teacher.id,
          name: teacher.nama
        });
      } else {
        setError('Username atau Password Guru salah!');
      }
    }
  };

  const handleQuickLogin = (quickRole: 'admin' | 'guru', customUser?: string, customPass?: string) => {
    setError('');
    if (quickRole === 'admin') {
      setUsername(db.adminUsername);
      setPassword(db.adminPasswordKey);
      setRole('admin');
      
      onLoginSuccess({
        role: 'admin',
        userId: 'admin',
        name: 'Administrator'
      });
    } else if (customUser && customPass) {
      setUsername(customUser);
      setPassword(customPass);
      setRole('guru');
      
      const teacher = db.guru.find(
        (g) => g.username.toLowerCase() === customUser.toLowerCase()
      );
      if (teacher) {
        onLoginSuccess({
          role: 'guru',
          userId: teacher.id,
          name: teacher.nama
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-800">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        
        {/* Logo and Titles */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-emerald-900 rounded-2xl shadow-lg text-emerald-300 mb-4 border border-emerald-800">
            <BookOpen className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl font-sans uppercase">
            E-RAPORT DIGITAL
          </h1>
          <p className="text-emerald-700 tracking-widest font-bold text-xs font-sans mt-1.5 uppercase">
            SMP AL IRSYAD SURAKARTA
          </p>
          <div className="w-16 h-1 bg-gradient-to-r from-emerald-650 to-emerald-850 mx-auto mt-3 rounded-full" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
        >
          {/* Tabs header */}
          <div className="flex border-b border-slate-100 bg-slate-50">
            <button
              onClick={() => { setRole('admin'); setError(''); }}
              className={`flex-1 py-4 flex items-center justify-center gap-2 font-medium text-sm transition-all border-b-2 ${
                role === 'admin'
                  ? 'border-emerald-600 text-emerald-700 bg-white font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Role Admin
            </button>
            <button
              onClick={() => { setRole('guru'); setError(''); }}
              className={`flex-1 py-4 flex items-center justify-center gap-2 font-medium text-sm transition-all border-b-2 ${
                role === 'guru'
                  ? 'border-emerald-600 text-emerald-700 bg-white font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Role Guru
            </button>
          </div>

          <div className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={role === 'admin' ? 'Contoh: admin' : 'Contoh: ahmadfauzi'}
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Key className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={role === 'admin' ? 'Default: alirsyadsolo' : 'Default: guru123'}
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-sans"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all"
              >
                Log In
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick login bypass for easier access/evaluation */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase text-center mb-3">
                AKSES CEPAT DEMO (PILIH UNTUK INSTANT LOGIN)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleQuickLogin('admin')}
                  className="p-2 border border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 rounded-xl text-left text-xs transition-colors"
                >
                  <div className="font-semibold text-emerald-800 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    Administrator
                  </div>
                  <div className="text-slate-400 text-[10px] mt-0.5">user: admin / pass: alirsyadsolo</div>
                </button>

                <button
                  onClick={() => handleQuickLogin('guru', 'ahmadfauzi', 'guru123')}
                  className="p-2 border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/50 rounded-xl text-left text-xs transition-colors"
                >
                  <div className="font-semibold text-slate-700 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    Ust. Ahmad (Guru/Wali VII A)
                  </div>
                  <div className="text-slate-400 text-[10px] mt-0.5">user: ahmadfauzi / pass: guru123</div>
                </button>

                <button
                  onClick={() => handleQuickLogin('guru', 'fatimah', 'guru123')}
                  className="p-2 border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/50 rounded-xl text-left text-xs transition-colors text-ellipsis overflow-hidden"
                >
                  <div className="font-semibold text-slate-700 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    Usth. Fatimah (Wali VII B)
                  </div>
                  <div className="text-slate-400 text-[10px] mt-0.5">user: fatimah / pass: guru123</div>
                </button>

                <button
                  onClick={() => handleQuickLogin('guru', 'sarah', 'guru123')}
                  className="p-2 border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/50 rounded-xl text-left text-xs transition-colors"
                >
                  <div className="font-semibold text-slate-700 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    Usth. Sarah (Wali VIII A)
                  </div>
                  <div className="text-slate-400 text-[10px] mt-0.5">user: sarah / pass: guru123</div>
                </button>
              </div>
            </div>

          </div>
        </motion.div>
      </div>

      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-100 bg-slate-50/50 font-mono">
        &copy; 2026 SMP AL IRSYAD SURAKARTA • Kurikulum Merdeka E-Raport
      </footer>
    </div>
  );
}
