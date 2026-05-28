/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase, Kelas, Guru } from '../types';
import { Users, Plus, Edit2, Check, X, ShieldAlert, Trash2 } from 'lucide-react';

interface AdminKelasProps {
  db: SchemaDatabase;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function AdminKelas({ db, onUpdate }: AdminKelasProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputNama, setInputNama] = useState('');
  const [inputWaliKelasId, setInputWaliKelasId] = useState('');

  // Start adding
  const handleStartAdd = () => {
    setInputNama('');
    setInputWaliKelasId('');
    setIsAdding(true);
  };

  // Start editing
  const handleStartEdit = (k: Kelas) => {
    setEditingId(k.id);
    setInputNama(k.nama);
    setInputWaliKelasId(k.waliKelasId);
  };

  // Save new class
  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputNama.trim()) return;

    const newId = 'k_' + Date.now();
    const newKelas: Kelas = {
      id: newId,
      nama: inputNama.trim(),
      waliKelasId: inputWaliKelasId
    };

    // If wali kelas is assigned, update that guru's wali kelas flag
    let updatedGuru = [...db.guru];
    if (inputWaliKelasId) {
      updatedGuru = updatedGuru.map(g => {
        // If they were already wali kelas elsewhere, reset them
        if (g.isWaliKelas && g.waliKelasKelasId === newId) {
          return { ...g, isWaliKelas: false, waliKelasKelasId: '' };
        }
        if (g.id === inputWaliKelasId) {
          return { ...g, isWaliKelas: true, waliKelasKelasId: newId };
        }
        return g;
      });
    }

    const updatedKelas = [...db.kelas, newKelas];

    onUpdate({
      ...db,
      kelas: updatedKelas,
      guru: updatedGuru
    });

    setIsAdding(false);
    setInputNama('');
    setInputWaliKelasId('');
  };

  // Save edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !inputNama.trim()) return;

    // Reset old wali-kelas who held this class, or update new one
    let updatedGuru = [...db.guru];
    
    // First, clear isWaliKelas status for the teacher who used to teach this class
    updatedGuru = updatedGuru.map(g => {
      if (g.waliKelasKelasId === editingId) {
        return { ...g, isWaliKelas: false, waliKelasKelasId: '' };
      }
      return g;
    });

    // Second, set isWaliKelas for current selected teacher
    if (inputWaliKelasId) {
      updatedGuru = updatedGuru.map(g => {
        // If this new teacher was teaching another class, clear that other class's reference
        if (g.id === inputWaliKelasId) {
          return { ...g, isWaliKelas: true, waliKelasKelasId: editingId };
        }
        return g;
      });
    }

    const updatedKelas = db.kelas.map(k => {
      if (k.id === editingId) {
        return { ...k, nama: inputNama.trim(), waliKelasId: inputWaliKelasId };
      }
      return k;
    });

    // Sync waliKelasId reference inside Kelas snapshotted for other teachers who might no longer be homeroom
    updatedGuru = updatedGuru.map(g => {
      // If a teacher is listed as wali kelas but wasn't assigned, correct it
      const matchesKelas = updatedKelas.find(k => k.waliKelasId === g.id);
      if (matchesKelas) {
        return { ...g, isWaliKelas: true, waliKelasKelasId: matchesKelas.id };
      } else if (g.isWaliKelas && g.waliKelasKelasId === editingId && inputWaliKelasId !== g.id) {
        return { ...g, isWaliKelas: false, waliKelasKelasId: '' };
      }
      return g;
    });

    onUpdate({
      ...db,
      kelas: updatedKelas,
      guru: updatedGuru
    });

    setEditingId(null);
  };

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleDeleteClick = (kelasId: string) => {
    setDeleteTargetId(kelasId);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    const kelasId = deleteTargetId;
    const kelasObj = db.kelas.find(k => k.id === kelasId);
    if (!kelasObj) {
      setDeleteTargetId(null);
      return;
    }

    // 1. Filter out class from classroom list
    const updatedKelas = db.kelas.filter(k => k.id !== kelasId);

    // 2. Clear Wali Kelas and update mapel class targets for Guru
    const updatedGuru = db.guru.map(g => {
      let isWali = g.isWaliKelas;
      let waliKelasId = g.waliKelasKelasId;
      if (g.waliKelasKelasId === kelasId) {
        isWali = false;
        waliKelasId = '';
      }

      const mapel1Ids = (g.mapel1KelasIds || []).filter(id => id !== kelasId);
      const map1Id = g.mapel1KelasId === kelasId ? (mapel1Ids[0] || '') : g.mapel1KelasId;

      const mapel2Ids = (g.mapel2KelasIds || []).filter(id => id !== kelasId);
      const map2Id = g.mapel2KelasId === kelasId ? (mapel2Ids[0] || '') : g.mapel2KelasId;

      return {
        ...g,
        isWaliKelas: isWali,
        waliKelasKelasId: waliKelasId,
        mapel1KelasId: map1Id,
        mapel1KelasIds: mapel1Ids,
        mapel2KelasId: map2Id,
        mapel2KelasIds: mapel2Ids
      };
    });

    // 3. Clear students belonging to this class and their grades/absences
    const siswaInKelas = db.siswa.filter(s => s.kelasId === kelasId);
    const siswaIds = siswaInKelas.map(s => s.id);

    const updatedSiswa = db.siswa.filter(s => s.kelasId !== kelasId);
    const updatedNilai = db.nilaiSiswa.filter(n => !siswaIds.includes(n.siswaId));
    const updatedAbsen = db.absensiDanCatatan.filter(a => !siswaIds.includes(a.siswaId));

    onUpdate({
      ...db,
      kelas: updatedKelas,
      guru: updatedGuru,
      siswa: updatedSiswa,
      nilaiSiswa: updatedNilai,
      absensiDanCatatan: updatedAbsen
    });

    setDeleteTargetId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Data Kelas
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola data tingkat kelas beserta penugasan Wali Kelas SMP Al Irsyad Surakarta.
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={handleStartAdd}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Tambah Kelas
          </button>
        )}
      </div>

      {/* Add New Class Form */}
      {isAdding && (
        <form onSubmit={handleSaveAdd} className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl space-y-4">
          <div className="text-sm font-semibold text-emerald-800">Tambah Kelas Baru</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Kelas / Jenjang</label>
              <input
                type="text"
                required
                value={inputNama}
                onChange={e => setInputNama(e.target.value)}
                placeholder="Contoh: VII A, VIII B, IX Al-Aqsha"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Wali Kelas (Opsional)</label>
              <select
                value={inputWaliKelasId}
                onChange={e => setInputWaliKelasId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- Tanpa Wali Kelas --</option>
                {db.guru.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.nama} {g.isWaliKelas ? `(Sudah ada: ${db.kelas.find(k => k.id === g.waliKelasKelasId)?.nama || ''})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              Simpan Kelas
            </button>
          </div>
        </form>
      )}

      {/* Edit Form Modal/Embedded */}
      {editingId && (
        <form onSubmit={handleSaveEdit} className="bg-amber-50/40 border border-amber-200/60 p-5 rounded-2xl space-y-4">
          <div className="text-sm font-semibold text-amber-800">Edit Kelas</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Kelas / Jenjang</label>
              <input
                type="text"
                required
                value={inputNama}
                onChange={e => setInputNama(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Wali Kelas (Opsional)</label>
              <select
                value={inputWaliKelasId}
                onChange={e => setInputWaliKelasId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">-- Tanpa Wali Kelas --</option>
                {db.guru.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.nama} {g.isWaliKelas && g.waliKelasKelasId !== editingId ? `(Wali kelas di ${db.kelas.find(k => k.id === g.waliKelasKelasId)?.nama || ''})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              Selesai Edit
            </button>
          </div>
        </form>
      )}

      {/* Class Lists Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-bold tracking-wider uppercase">
              <th className="py-3.5 px-6">Nama Kelas / Jenjang</th>
              <th className="py-3.5 px-6">Wali Kelas</th>
              <th className="py-3.5 px-6 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {db.kelas.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-slate-400 font-medium">
                  Belum ada data kelas. Klik tombol Tambah Kelas untuk membuat kelas baru.
                </td>
              </tr>
            ) : (
              db.kelas.map((k) => {
                const wali = db.guru.find(g => g.id === k.waliKelasId);
                return (
                  <tr key={k.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-800">{k.nama}</td>
                    <td className="py-4 px-6">
                      {wali ? (
                        <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg font-medium text-[11px] border border-emerald-100/50">
                          {wali.nama}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Belum ditentukan</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleStartEdit(k)}
                        disabled={!!editingId}
                        className="p-1.5 hover:bg-amber-50 hover:text-amber-750 text-slate-500 rounded-lg transition-colors inline-flex items-center gap-1 text-[11px] font-semibold disabled:opacity-50"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(k.id)}
                        disabled={!!editingId}
                        className="p-1.5 hover:bg-rose-50 hover:text-rose-700 text-slate-500 rounded-lg transition-colors inline-flex items-center gap-1 text-[11px] font-semibold disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
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

      <div className="bg-emerald-50/40 p-4 rounded-xl flex items-start gap-2.5 border border-emerald-100/30">
        <ShieldAlert className="w-4 h-4 text-emerald-600 mt-0.5" />
        <div className="text-[11px] text-emerald-950 font-medium leading-relaxed">
          <strong>Perhatian:</strong> Perubahan di atas bersifat dinamis dalam database master. Ketika admin melakukan <strong>Publish Tahun Ajaran</strong>, data kelas ini lah yang akan di-snapshot/disimpan secara permanen untuk semester rilis tersebut agar input nilai guru konsisten.
        </div>
      </div>

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-fadeIn">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4 border border-rose-100">
              <Trash2 className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-sans">Hapus Data Kelas</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus kelas ini? Menghapus kelas akan menghapus semua data siswa, nilai, dan absensi di kelas ini secara permanen dari database master!
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
