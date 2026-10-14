/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase } from '../types';
import { User, Key, Save, ShieldCheck, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';

interface GuruProfileProps {
  db: SchemaDatabase;
  guruId: string;
  onUpdate: (updatedDb: SchemaDatabase) => void | Promise<any>;
}

export function GuruProfile({ db, guruId, onUpdate }: GuruProfileProps) {
  const teacher = db.guru.find(g => g.id === guruId);

  const [username, setUsername] = useState(teacher?.username || '');
  const [password, setPassword] = useState(teacher?.passwordKey || '');
  const [confirmPassword, setConfirmPassword] = useState(teacher?.passwordKey || '');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!teacher) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
        Error: Profil guru tidak ditemukan! Silakan login kembali.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername) {
      setError('Username tidak boleh kosong!');
      return;
    }

    if (!cleanPassword) {
      setError('Password baru tidak boleh kosong!');
      return;
    }

    if (cleanPassword.length < 4) {
      setError('Password minimal harus terdiri dari 4 karakter demi keamanan!');
      return;
    }

    // Check username duplicates across other teachers
    if (db.guru.some(g => g.username.toLowerCase() === cleanUsername && g.id !== guruId)) {
      setError('Username ini sudah dipakai oleh guru lain! Pilih username unik.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password baru dan konfirmasi password tidak cocok! Silakan cek kembali.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Update list guru master
      const updatedGuru = db.guru.map(g => {
        if (g.id === guruId) {
          return {
            ...g,
            username: cleanUsername,
            passwordKey: cleanPassword
          };
        }
        return g;
      });

      // 2. Also sync to active period snapshot if present
      let updatedPeriodList = db.periodList;
      if (db.activePeriodId) {
        updatedPeriodList = db.periodList.map(p => {
          if (p.id === db.activePeriodId) {
            return {
              ...p,
              snapshotGuru: p.snapshotGuru.map(sg => {
                if (sg.id === guruId) {
                  return {
                    ...sg,
                    username: cleanUsername,
                    passwordKey: cleanPassword
                  };
                }
                return sg;
              })
            };
          }
          return p;
        });
      }

      const updatedDb: SchemaDatabase = {
        ...db,
        guru: updatedGuru,
        periodList: updatedPeriodList
      };

      // Call onUpdate which handles state, localStorage, and Supabase cloud sync
      await Promise.resolve(onUpdate(updatedDb));

      setMessage('Password dan username login akun Anda berhasil diperbarui dan tersimpan aman!');
    } catch (err: any) {
      console.error('Gagal memperbarui profil guru:', err);
      setError('Terjadi kendala saat menyimpan. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-600" />
          Pengaturan Akun Guru
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Lakukan konfigurasi keamanan kata sandi dan username login mandiri Anda.
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {message && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold rounded-xl animate-fadeIn">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Nama Pengajar</label>
            <input
              type="text"
              disabled
              value={teacher.nama}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Username Login</label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value.replace(/\s+/g, ''))}
                placeholder="Masukkan username login"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-600">Password Baru</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                {showPassword ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Sembunyikan</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Karakter</span>
                  </>
                )}
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Masukkan password baru"
                className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
              />
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-600">Konfirmasi Password Baru</label>
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                {showConfirmPassword ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Sembunyikan</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Karakter</span>
                  </>
                )}
              </button>
            </div>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
              />
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menyimpan Perubahan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Simpan Perubahan Akun
              </>
            )}
          </button>
        </form>
      </div>

      <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-200/60 flex items-start gap-2.5 text-emerald-950 text-xs shadow-3xs">
        <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
        <div className="leading-relaxed">
          <strong>Perlindungan Data:</strong> Username dan password baru langsung aktif seketika dan disinkronkan ke server cloud. Pastikan Anda mengingat atau mencatat kata sandi baru Anda demi kelancaran pengisian nilai raport siswa SMP Al Irsyad Surakarta.
        </div>
      </div>
    </div>
  );
}
