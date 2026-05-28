/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase, Siswa } from '../types';
import { UserCheck, Plus, Edit2, Trash2, Check, Search, Filter } from 'lucide-react';

interface AdminSiswaProps {
  db: SchemaDatabase;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function AdminSiswa({ db, onUpdate }: AdminSiswaProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // States for search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKelasId, setFilterKelasId] = useState('all');

  // Input states
  const [inputNama, setInputNama] = useState('');
  const [inputNISN, setInputNISN] = useState('');
  const [inputNIS, setInputNIS] = useState('');
  const [inputJK, setInputJK] = useState<'L' | 'P'>('L');
  const [inputKelasId, setInputKelasId] = useState('');

  const handleStartAdd = () => {
    setInputNama('');
    setInputNISN('');
    setInputNIS('');
    setInputJK('L');
    setInputKelasId(db.kelas[0]?.id || '');
    setIsAdding(true);
    setIsSubmitting(false);
  };

  const handleStartEdit = (s: Siswa) => {
    setEditingId(s.id);
    setInputNama(s.nama);
    setInputNISN(s.nisn);
    setInputNIS(s.nis);
    setInputJK(s.jenisKelamin);
    setInputKelasId(s.kelasId);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!inputNama.trim()) {
      alert("Error: Nama lengkap siswa tidak boleh kosong!");
      return;
    }
    if (!inputNISN.trim()) {
      alert("Error: NISN tidak boleh kosong!");
      return;
    }
    if (!inputNIS.trim()) {
      alert("Error: NIS tidak boleh kosong!");
      return;
    }
    if (!inputKelasId) {
      alert("Error: Silakan pilih kelas siswa!");
      return;
    }

    // Check unique Nis / Nisn
    if (db.siswa.some(s => s.nisn === inputNISN.trim())) {
      alert("Error: NISN sudah pernah terdaftar!");
      return;
    }

    if (db.siswa.some(s => s.nis === inputNIS.trim())) {
      alert("Error: NIS sudah pernah terdaftar!");
      return;
    }

    setIsSubmitting(true);

    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const newSiswa: Siswa = {
      id: 's_' + Date.now() + '_' + randomSuffix,
      nama: inputNama.trim(),
      nisn: inputNISN.trim(),
      nis: inputNIS.trim(),
      jenisKelamin: inputJK,
      kelasId: inputKelasId
    };

    onUpdate({
      ...db,
      siswa: [...db.siswa, newSiswa]
    });

    setIsAdding(false);
    setIsSubmitting(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!editingId) return;

    if (!inputNama.trim()) {
      alert("Error: Nama siswa tidak boleh kosong!");
      return;
    }
    if (!inputNISN.trim()) {
      alert("Error: NISN tidak boleh kosong!");
      return;
    }
    if (!inputNIS.trim()) {
      alert("Error: NIS tidak boleh kosong!");
      return;
    }
    if (!inputKelasId) {
      alert("Error: Silakan pilih kelas!");
      return;
    }

    // Check unique Nis / Nisn for other student
    if (db.siswa.some(s => s.nisn === inputNISN.trim() && s.id !== editingId)) {
      alert("Error: NISN sudah pernah terdaftar pada siswa lain!");
      return;
    }

    if (db.siswa.some(s => s.nis === inputNIS.trim() && s.id !== editingId)) {
      alert("Error: NIS sudah pernah terdaftar pada siswa lain!");
      return;
    }

    setIsSubmitting(true);

    const updated = db.siswa.map(s => {
      if (s.id === editingId) {
        return {
          ...s,
          nama: inputNama.trim(),
          nisn: inputNISN.trim(),
          nis: inputNIS.trim(),
          jenisKelamin: inputJK,
          kelasId: inputKelasId
        };
      }
      return s;
    });

    onUpdate({
      ...db,
      siswa: updated
    });

    setEditingId(null);
    setIsSubmitting(false);
  };

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    const updatedSiswa = db.siswa.filter(s => s.id !== id);
    // Clean grades as well to avoid inconsistency
    const updatedNilai = db.nilaiSiswa.filter(n => n.siswaId !== id);
    const updatedAbsen = db.absensiDanCatatan.filter(a => a.siswaId !== id);

    onUpdate({
      ...db,
      siswa: updatedSiswa,
      nilaiSiswa: updatedNilai,
      absensiDanCatatan: updatedAbsen
    });
    setDeleteTargetId(null);
  };

  // Filter students
  const filteredSiswa = db.siswa.filter(s => {
    const matchesSearch = s.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.nis.includes(searchQuery) ||
                          s.nisn.includes(searchQuery);
    const matchesKelas = filterKelasId === 'all' || s.kelasId === filterKelasId;
    return matchesSearch && matchesKelas;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            Data Siswa
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola data biodata, NISN, NIS, jenis kelamin dan pemisahan kelas siswa SMP Al Irsyad Surakarta.
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={handleStartAdd}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Tambah Siswa
          </button>
        )}
      </div>

      {/* Add Form */}
      {isAdding && (
        <form onSubmit={handleSaveAdd} className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl space-y-4">
          <div className="text-sm font-semibold text-emerald-800">Tambah Identitas Siswa Baru</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap Siswa</label>
              <input
                type="text"
                required
                value={inputNama}
                onChange={e => setInputNama(e.target.value)}
                placeholder="Contoh: Muhammad Ali"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">NISN (10 Digit)</label>
              <input
                type="text"
                required
                maxLength={10}
                value={inputNISN}
                onChange={e => setInputNISN(e.target.value.replace(/\D/g, ''))}
                placeholder="Contoh: 0101234567"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">NIS (Lokal)</label>
              <input
                type="text"
                required
                value={inputNIS}
                onChange={e => setInputNIS(e.target.value.replace(/\D/g, ''))}
                placeholder="Contoh: 2324001"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis Kelamin</label>
              <select
                value={inputJK}
                onChange={e => setInputJK(e.target.value as 'L' | 'P')}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Kelas</label>
              <select
                required
                value={inputKelasId}
                onChange={e => setInputKelasId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="" disabled>-- Pilih Kelas --</option>
                {db.kelas.map(k => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              disabled={isSubmitting}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {isSubmitting ? "Menyimpan..." : "Simpan Siswa"}
            </button>
          </div>
        </form>
      )}

      {/* Edit Form */}
      {editingId && (
        <form onSubmit={handleSaveEdit} className="bg-amber-50/40 border border-amber-200/60 p-5 rounded-2xl space-y-4">
          <div className="text-sm font-semibold text-amber-800">Edit Identitas Siswa</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap Siswa</label>
              <input
                type="text"
                required
                value={inputNama}
                onChange={e => setInputNama(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">NISN</label>
              <input
                type="text"
                required
                maxLength={10}
                value={inputNISN}
                onChange={e => setInputNISN(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">NIS</label>
              <input
                type="text"
                required
                value={inputNIS}
                onChange={e => setInputNIS(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis Kelamin</label>
              <select
                value={inputJK}
                onChange={e => setInputJK(e.target.value as 'L' | 'P')}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kelas</label>
              <select
                required
                value={inputKelasId}
                onChange={e => setInputKelasId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {db.kelas.map(k => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              disabled={isSubmitting}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {isSubmitting ? "Menyimpan..." : "Selesai Edit"}
            </button>
          </div>
        </form>
      )}

      {/* Search and Filters toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari Siswa Berdasarkan Nama, NISN, atau NIS..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterKelasId}
            onChange={e => setFilterKelasId(e.target.value)}
            className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">Semua Kelas</option>
            {db.kelas.map(k => (
              <option key={k.id} value={k.id}>{k.nama}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Students List */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-bold tracking-wider uppercase">
              <th className="py-3.5 px-6">Identitas Siswa</th>
              <th className="py-3.5 px-6">NISN / NIS</th>
              <th className="py-3.5 px-6">JK</th>
              <th className="py-3.5 px-6">Kelas</th>
              <th className="py-3.5 px-6 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {filteredSiswa.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                  Tidak ditemukan data siswa yang cocok dengan pencarian / penyaringan.
                </td>
              </tr>
            ) : (
              filteredSiswa.map((s) => {
                const targetKelas = db.kelas.find(k => k.id === s.kelasId);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900">{s.nama}</div>
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-500 text-[11px] leading-relaxed">
                      <div>NISN: {s.nisn}</div>
                      <div>NIS: {s.nis}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.jenisKelamin === 'L' 
                          ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                          : 'bg-pink-50 text-pink-700 border border-pink-100'
                      }`}>
                        {s.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-medium text-slate-800">
                        {targetKelas ? targetKelas.nama : 'Pindah / Tidak Ada'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-1.5">
                      <button
                        onClick={() => handleStartEdit(s)}
                        disabled={!!isAdding || !!editingId}
                        className="p-1 px-2 text-slate-600 hover:bg-amber-50 hover:text-amber-700 rounded font-semibold text-[11px] transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(s.id)}
                        disabled={!!isAdding || !!editingId}
                        className="p-1 px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700 rounded font-semibold text-[11px] transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-fadeIn">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4 border border-rose-100">
              <Trash2 className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-sans">Hapus Data Siswa</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus data siswa ini? Ini akan membersihkan seluruh catatan nilai dan riwayat absensi bersangkutan secara permanen.
            </p>
            <div className="flex gap-3 w-full mt-6">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition duration-150 font-sans"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow-md transition duration-150 font-sans"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
