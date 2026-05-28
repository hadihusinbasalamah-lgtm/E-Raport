/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase } from '../types';
import { User, Key, Save, AlertCircle } from 'lucide-react';

interface AdminProfileProps {
  db: SchemaDatabase;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function AdminProfile({ db, onUpdate }: AdminProfileProps) {
  const [username, setUsername] = useState(db.adminUsername);
  const [password, setPassword] = useState(db.adminPasswordKey);
  const [confirmPassword, setConfirmPassword] = useState(db.adminPasswordKey);
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
    if (password !== confirmPassword) {
      setError('Password baru dan konfirmasi password tidak cocok!');
      return;
    }

    onUpdate({
      ...db,
      adminUsername: username.trim(),
      adminPasswordKey: password
    });

    setMessage('Profil Administrator berhasil diperbarui!');
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-600" />
          Pengaturan Profil Admin
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Ubah username dan password login untuk Akun Utama Administrator.
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
            <label className="block text-xs font-bold text-slate-600 mb-1">Username Admin Baru</label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value.replace(/\s+/g, ''))}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
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
            Simpan Perubahan
          </button>
        </form>
      </div>

      <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-100 flex items-start gap-2.5 text-amber-900 leading-relaxed text-xs">
        <AlertCircle className="w-4.5 h-4.5 text-amber-600 mt-0.5" />
        <div>
          <strong>Catatan Keamanan:</strong> Harap catat dan ingat dengan baik kombinasi Username dan Password baru Anda agar proses penguncian sistem administrasi SMP Al Irsyad Surakarta tidak terhambat.
        </div>
      </div>
    </div>
  );
}
