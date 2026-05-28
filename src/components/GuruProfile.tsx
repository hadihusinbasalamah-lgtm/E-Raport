/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase, Guru } from '../types';
import { User, Key, Save, ShieldCheck } from 'lucide-react';

interface GuruProfileProps {
  db: SchemaDatabase;
  guruId: string;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function GuruProfile({ db, guruId, onUpdate }: GuruProfileProps) {
  const teacher = db.guru.find(g => g.id === guruId);

  if (!teacher) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
        Error: Profil guru tidak ditemukan! Silakan login kembali.
      </div>
    );
  }

  const [username, setUsername] = useState(teacher.username);
  const [password, setPassword] = useState(teacher.passwordKey);
  const [confirmPassword, setConfirmPassword] = useState(teacher.passwordKey);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!username.trim()) {
      setError('Username tidak boleh kosong!');
      return;
    }

    // Check username duplicates across other teachers
    if (db.guru.some(g => g.username.toLowerCase() === username.trim().toLowerCase() && g.id !== guruId)) {
      setError('Username ini sudah dipakai oleh guru lain! Pilih username unik.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password baru dan konfirmasi tidak cocok!');
      return;
    }

    const updatedGuru = db.guru.map(g => {
      if (g.id === guruId) {
        return {
          ...g,
          username: username.trim().toLowerCase(),
          passwordKey: password
        };
      }
      return g;
    });

    onUpdate({
      ...db,
      guru: updatedGuru
    });

    setMessage('Profil Akun Guru berhasil diperbarui!');
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
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl">
              {message}
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold rounded-xl">
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
            <label className="block text-xs font-bold text-slate-600 mb-1">Username Login Baru</label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value.replace(/\s+/g, ''))}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Password Baru</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Konfirmasi Password Baru</label>
            <div className="relative">
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Save className="w-4 h-4" />
            Simpan Konfigurasi Akun
          </button>
        </form>
      </div>

      <div className="p-4 bg-emerald-50/30 rounded-xl border border-emerald-100 flex items-start gap-2 text-emerald-950 text-xs">
        <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
        <div className="leading-relaxed">
          <strong>Perlindungan Data:</strong> Username dan password bersifat rahasia. Pastikan Anda tidak berbagi kata sandi login Anda dengan pihak lain demi keamanan entri buku raport siswa SMP Al Irsyad Surakarta.
        </div>
      </div>
    </div>
  );
}
