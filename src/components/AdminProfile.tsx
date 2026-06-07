/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase } from '../types';
import { User, Key, Save, AlertCircle, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { resetFirestoreToZero } from '../lib/firebase';

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

  // States for Reset DB
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [confirmationWord, setConfirmationWord] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

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

  const handleResetDatabase = async () => {
    if (confirmationWord !== 'HAPUS') return;
    setIsResetting(true);
    setError('');
    setMessage('');
    setResetSuccess(false);

    try {
      await resetFirestoreToZero();
      setResetSuccess(true);
      setShowConfirmReset(false);
      setConfirmationWord('');
    } catch (err) {
      setError('Gagal mereset database. Periksa koneksi internet Anda.');
    } finally {
      setIsResetting(false);
    }
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
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl animate-fadeIn">
              {message}
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold rounded-xl animate-fadeIn">
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
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan Perubahan
          </button>
        </form>
      </div>

      {/* CARD: Hapus & Reset Penyimpanan ke 0 */}
      <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-rose-800">
          <Trash2 className="w-5 h-5 text-rose-600" />
          <h3 className="text-sm font-bold">Reset Semua Penyimpanan (Mulai dari 0)</h3>
        </div>
        <p className="text-xs text-slate-500 leading-normal">
          Tindakan ini akan menghapus permanen seluruh data siswa, guru, kelas, mata pelajaran, nilai, absensi, dan rilis akademik yang tersimpan di cloud. Username dan password profil Admin Anda saat ini akan tetap dipertahankan.
        </p>

        {!showConfirmReset ? (
          <button
            type="button"
            onClick={() => {
              setShowConfirmReset(true);
              setConfirmationWord('');
              setResetSuccess(false);
            }}
            className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 hover:border-rose-300 text-rose-700 hover:text-rose-850 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            Bersihkan Semua & Mulai dari 0
          </button>
        ) : (
          <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-200 space-y-3 animate-fadeIn">
            <span className="text-[10px] font-bold text-rose-900 uppercase tracking-widest block">⚠️ Konfirmasi Keamanan Penghapusan</span>
            <p className="text-[11px] text-rose-800 font-medium leading-relaxed">
              Ketik kata <strong className="text-rose-950 px-1 py-0.5 bg-white border border-rose-200 rounded">HAPUS</strong> di bawah ini untuk mengonfirmasi pembersihan total:
            </p>
            <input
              type="text"
              placeholder="Ketik HAPUS"
              value={confirmationWord}
              onChange={(e) => setConfirmationWord(e.target.value)}
              className="w-full p-2.5 bg-white border border-rose-300 rounded-lg text-xs font-bold text-center placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-rose-500 uppercase"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetDatabase}
                disabled={confirmationWord !== 'HAPUS' || isResetting}
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-350 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  'Ya, Hapus Semua'
                )}
              </button>
            </div>
          </div>
        )}

        {resetSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-xs font-semibold animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Penyimpanan berhasil dibersihkan! Database kembali bersih (0 rekor).</span>
          </div>
        )}
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
