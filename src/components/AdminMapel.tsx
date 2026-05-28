/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase, Mapel } from '../types';
import { BookOpen, Plus, Edit2, Trash2, Check, HelpCircle } from 'lucide-react';

interface AdminMapelProps {
  db: SchemaDatabase;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function AdminMapel({ db, onUpdate }: AdminMapelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputNama, setInputNama] = useState('');

  const handleStartAdd = () => {
    setInputNama('');
    setIsAdding(true);
  };

  const handleStartEdit = (m: Mapel) => {
    setEditingId(m.id);
    setInputNama(m.nama);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputNama.trim()) return;

    const newMapel: Mapel = {
      id: 'm_' + Date.now(),
      nama: inputNama.trim()
    };

    onUpdate({
      ...db,
      mapel: [...db.mapel, newMapel]
    });

    setIsAdding(false);
    setInputNama('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !inputNama.trim()) return;

    const updated = db.mapel.map(m => {
      if (m.id === editingId) {
        return { ...m, nama: inputNama.trim() };
      }
      return m;
    });

    onUpdate({
      ...db,
      mapel: updated
    });

    setEditingId(null);
  };

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    const updated = db.mapel.filter(m => m.id !== id);
    onUpdate({
      ...db,
      mapel: updated
    });
    setDeleteTargetId(null);
  };

  // Helper to find all teachers and target classes assigned to a specific subject
  const getGuruPengampu = (mapelId: string) => {
    const list: { guruNama: string; kelasNama: string }[] = [];
    db.guru.forEach(g => {
      if (g.mapel1Id === mapelId) {
        const mapel1KelasIds = g.mapel1KelasIds && g.mapel1KelasIds.length > 0
          ? g.mapel1KelasIds
          : (g.mapel1KelasId ? [g.mapel1KelasId] : []);
        const classNames = mapel1KelasIds
          .map(cid => db.kelas.find(c => c.id === cid)?.nama)
          .filter(Boolean)
          .join(', ');
        list.push({ guruNama: g.nama, kelasNama: classNames || '-' });
      }
      if (g.mapel2Id === mapelId) {
        const mapel2KelasIds = g.mapel2KelasIds && g.mapel2KelasIds.length > 0
          ? g.mapel2KelasIds
          : (g.mapel2KelasId ? [g.mapel2KelasId] : []);
        const classNames = mapel2KelasIds
          .map(cid => db.kelas.find(c => c.id === cid)?.nama)
          .filter(Boolean)
          .join(', ');
        list.push({ guruNama: g.nama, kelasNama: classNames || '-' });
      }
    });
    return list;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            Data Mata Pelajaran (Mapel)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola master mata pelajaran beserta relasi guru pengampu yang terdaftar.
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={handleStartAdd}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Tambah Mapel
          </button>
        )}
      </div>

      {/* Add Form */}
      {isAdding && (
        <form onSubmit={handleSaveAdd} className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl space-y-4">
          <div className="text-sm font-semibold text-emerald-800">Tambah Mata Pelajaran Baru</div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Mata Pelajaran</label>
            <input
              type="text"
              required
              value={inputNama}
              onChange={e => setInputNama(e.target.value)}
              placeholder="Contoh: Matematika, Bahasa Arab, IPA Terpadu"
              className="w-full max-w-md px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-2">
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
              Simpan Mapel
            </button>
          </div>
        </form>
      )}

      {/* Edit Form */}
      {editingId && (
        <form onSubmit={handleSaveEdit} className="bg-amber-50/40 border border-amber-200/60 p-5 rounded-2xl space-y-4">
          <div className="text-sm font-semibold text-amber-800">Edit Mata Pelajaran</div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Mata Pelajaran</label>
            <input
              type="text"
              required
              value={inputNama}
              onChange={e => setInputNama(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div className="flex gap-2">
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

      {/* List Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-bold tracking-wider uppercase">
              <th className="py-3.5 px-6">Nama Mata Pelajaran</th>
              <th className="py-3.5 px-6">Guru Pengampu & Target Kelas</th>
              <th className="py-3.5 px-6 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {db.mapel.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-slate-400 font-medium">
                  Belum ada data mata pelajaran. Klik tombol Tambah Mapel untuk membuat mapel baru.
                </td>
              </tr>
            ) : (
              db.mapel.map((m) => {
                const pengampuList = getGuruPengampu(m.id);
                return (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-800">{m.nama}</td>
                    <td className="py-4 px-6">
                      {pengampuList.length === 0 ? (
                        <span className="text-slate-400 italic text-[11px]">Belum ditugaskan ke Guru</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {pengampuList.map((p, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded text-[11px]"
                            >
                              <strong>{p.guruNama}</strong>
                              <span className="text-amber-600">({p.kelasNama})</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleStartEdit(m)}
                        disabled={!!isAdding || !!editingId}
                        className="p-1 px-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700 rounded font-semibold text-[11px] transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(m.id)}
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

      <div className="bg-amber-50/30 p-4 border border-amber-200/50 rounded-xl flex items-start gap-2 text-slate-700">
        <HelpCircle className="w-4.5 h-4.5 text-amber-600 mt-0.5" />
        <div className="text-[11px] leading-relaxed">
          <strong>Bagaimana cara menugaskan Guru Pengampu?</strong>
          <p className="mt-0.5 text-slate-600">
            Guru Pengampu didefinisikan pada menu <strong>Data Guru</strong>. Di sana Anda dapat menetapkan mata pelajaran apa saja yang diampu oleh Guru tersebut beserta kelas targetnya masing-masing. Di atas adalah rangkuman otomatis hasil penugasan tersebut.
          </p>
        </div>
      </div>

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-fadeIn">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4 border border-rose-100">
              <Trash2 className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-sans">Hapus Mata Pelajaran</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus Mata Pelajaran ini? Tindakan ini dapat mempengaruhi status penugasan pengampu pada Guru Terkait.
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
