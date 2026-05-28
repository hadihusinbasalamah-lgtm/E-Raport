/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase, Guru, Mapel, Kelas } from '../types';
import { ShieldCheck, Plus, Edit2, Trash2, Check, Lock, GraduationCap } from 'lucide-react';

interface AdminGuruProps {
  db: SchemaDatabase;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function AdminGuru({ db, onUpdate }: AdminGuruProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [inputNama, setInputNama] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('guru123');
  const [inputIsWali, setInputIsWali] = useState(false);
  const [inputWaliKelasId, setInputWaliKelasId] = useState('');
  
  const [inputMapel1Id, setInputMapel1Id] = useState('');
  const [inputMapel1KelasId, setInputMapel1KelasId] = useState('');
  const [inputMapel1KelasIds, setInputMapel1KelasIds] = useState<string[]>([]);
  
  const [inputMapel2Id, setInputMapel2Id] = useState('');
  const [inputMapel2KelasId, setInputMapel2KelasId] = useState('');
  const [inputMapel2KelasIds, setInputMapel2KelasIds] = useState<string[]>([]);

  const handleStartAdd = () => {
    setInputNama('');
    setInputUsername('');
    setInputPassword('guru123');
    setInputIsWali(false);
    setInputWaliKelasId('');
    setInputMapel1Id(db.mapel[0]?.id || '');
    setInputMapel1KelasId(db.kelas[0]?.id || '');
    setInputMapel1KelasIds(db.kelas[0] ? [db.kelas[0].id] : []);
    setInputMapel2Id('');
    setInputMapel2KelasId('');
    setInputMapel2KelasIds([]);
    setIsAdding(true);
  };

  const handleStartEdit = (g: Guru) => {
    setEditingId(g.id);
    setInputNama(g.nama);
    setInputUsername(g.username);
    setInputPassword(g.passwordKey);
    setInputIsWali(g.isWaliKelas);
    setInputWaliKelasId(g.waliKelasKelasId || '');
    setInputMapel1Id(g.mapel1Id);
    setInputMapel1KelasId(g.mapel1KelasId);
    setInputMapel1KelasIds(g.mapel1KelasIds || (g.mapel1KelasId ? [g.mapel1KelasId] : []));
    setInputMapel2Id(g.mapel2Id || '');
    setInputMapel2KelasId(g.mapel2KelasId || '');
    setInputMapel2KelasIds(g.mapel2KelasIds || (g.mapel2KelasId ? [g.mapel2KelasId] : []));
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputNama.trim() || !inputUsername.trim() || !inputPassword.trim() || !inputMapel1Id || inputMapel1KelasIds.length === 0) {
      alert("Mohon isi field utama (Nama, Username, Password, Mapel 1, dan pilih minimal 1 kelas target)!");
      return;
    }

    // Check unique username
    if (db.guru.some(g => g.username.toLowerCase() === inputUsername.trim().toLowerCase())) {
      alert("Username sudah terdaftar! Gunakan username unik.");
      return;
    }

    const newId = 'g_' + Date.now();
    const newGuru: Guru = {
      id: newId,
      nama: inputNama.trim(),
      username: inputUsername.trim().toLowerCase(),
      passwordKey: inputPassword,
      isWaliKelas: inputIsWali,
      waliKelasKelasId: inputIsWali ? inputWaliKelasId : '',
      mapel1Id: inputMapel1Id,
      mapel1KelasId: inputMapel1KelasIds[0] || '',
      mapel1KelasIds: inputMapel1KelasIds,
      mapel2Id: inputMapel2Id,
      mapel2KelasId: inputMapel2Id && inputMapel2KelasIds.length > 0 ? inputMapel2KelasIds[0] : '',
      mapel2KelasIds: inputMapel2Id ? inputMapel2KelasIds : []
    };

    // Update master kelas list to reference this teacher as Wali Kelas
    let updatedKelas = [...db.kelas];
    
    // Clear old reference for this class first (in case someone else was wali kelas of inputWaliKelasId)
    if (inputIsWali && inputWaliKelasId) {
      updatedKelas = updatedKelas.map(k => {
        if (k.id === inputWaliKelasId) {
          return { ...k, waliKelasId: newId };
        }
        return k;
      });
    }

    onUpdate({
      ...db,
      guru: [...db.guru, newGuru],
      kelas: updatedKelas
    });

    setIsAdding(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !inputNama.trim() || !inputUsername.trim() || !inputPassword.trim() || !inputMapel1Id || inputMapel1KelasIds.length === 0) {
      alert("Mohon isi field utama, pilih Mapel 1, dan minimal 1 kelas target!");
      return;
    }

    if (db.guru.some(g => g.username.toLowerCase() === inputUsername.trim().toLowerCase() && g.id !== editingId)) {
      alert("Username sudah terdaftar!");
      return;
    }

    // Update kelas to remove this guru's old wali kelas designation
    let updatedKelas = db.kelas.map(k => {
      if (k.waliKelasId === editingId) {
        return { ...k, waliKelasId: '' };
      }
      return k;
    });

    // Update kelas to set this guru as wali kelas of the new option
    if (inputIsWali && inputWaliKelasId) {
      updatedKelas = updatedKelas.map(k => {
        if (k.id === inputWaliKelasId) {
          return { ...k, waliKelasId: editingId };
        }
        return k;
      });
    }

    const updatedGuru = db.guru.map(g => {
      if (g.id === editingId) {
        return {
          id: editingId,
          nama: inputNama.trim(),
          username: inputUsername.trim().toLowerCase(),
          passwordKey: inputPassword,
          isWaliKelas: inputIsWali,
          waliKelasKelasId: inputIsWali ? inputWaliKelasId : '',
          mapel1Id: inputMapel1Id,
          mapel1KelasId: inputMapel1KelasIds[0] || '',
          mapel1KelasIds: inputMapel1KelasIds,
          mapel2Id: inputMapel2Id,
          mapel2KelasId: inputMapel2Id && inputMapel2KelasIds.length > 0 ? inputMapel2KelasIds[0] : '',
          mapel2KelasIds: inputMapel2Id ? inputMapel2KelasIds : []
        };
      }
      return g;
    });

    onUpdate({
      ...db,
      guru: updatedGuru,
      kelas: updatedKelas
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
    const updatedGuru = db.guru.filter(g => g.id !== id);
    const updatedKelas = db.kelas.map(k => {
      if (k.waliKelasId === id) {
        return { ...k, waliKelasId: '' };
      }
      return k;
    });

    onUpdate({
      ...db,
      guru: updatedGuru,
      kelas: updatedKelas
    });
    setDeleteTargetId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-600" />
            Data Guru
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola data dewan guru, pengaturan multi-subject mengajar (maks. 2 mapel), dan flag Wali Kelas.
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={handleStartAdd}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Tambah Guru
          </button>
        )}
      </div>

      {/* Add / Edit Forms */}
      {(isAdding || editingId) && (
        <form onSubmit={isAdding ? handleSaveAdd : handleSaveEdit} className={`${isAdding ? 'bg-emerald-50/50 border-emerald-100' : 'bg-amber-50/40 border-amber-200/60'} border p-5 rounded-2xl space-y-5 shadow-sm`}>
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 border-b border-slate-100/50 pb-2">
            <GraduationCap className="w-4.5 h-4.5 text-emerald-600" />
            {isAdding ? "Tambah Guru Baru" : `Edit Data Guru: ${inputNama}`}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap & Gelar</label>
              <input
                type="text"
                required
                value={inputNama}
                onChange={e => setInputNama(e.target.value)}
                placeholder="Contoh: Ust. Ahmad, S.Pd.I"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Username Login Guru (Unik)</label>
              <input
                type="text"
                required
                value={inputUsername}
                onChange={e => setInputUsername(e.target.value.replace(/\s+/g, ''))}
                placeholder="Contoh: ahmadguru"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Password Baru Guru</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={inputPassword}
                  onChange={e => setInputPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
              </div>
            </div>
          </div>

          {/* Walikelas configuration */}
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isWali"
                checked={inputIsWali}
                onChange={e => {
                  setInputIsWali(e.target.checked);
                  if (e.target.checked && !inputWaliKelasId) {
                    setInputWaliKelasId(db.kelas[0]?.id || '');
                  }
                }}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <label htmlFor="isWali" className="text-xs font-bold text-slate-700 select-none cursor-pointer">
                Tugasi sebagai Wali Kelas?
              </label>
            </div>
            {inputIsWali && (
              <div className="max-w-xs animate-fadeIn">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Asosiasi Wali Kelas Untuk:</label>
                <select
                  value={inputWaliKelasId}
                  onChange={e => setInputWaliKelasId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none"
                >
                  {db.kelas.map(k => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Mapels and Classes taught -- Requirements state 2 mapels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Mapel 1 (Wajib) */}
            <div className="p-4 bg-emerald-50/20 border border-emerald-100/30 rounded-xl space-y-3">
              <div className="text-xs font-bold text-emerald-800">Mata Pelajaran Pengampu 1 (Utama)</div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Mata Pelajaran</label>
                <select
                  value={inputMapel1Id}
                  onChange={e => setInputMapel1Id(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none"
                >
                  {db.mapel.map(m => (
                    <option key={m.id} value={m.id}>{m.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Ditargetkan untuk Kelas (Pilih beberapa)</label>
                <div className="flex flex-wrap gap-1.5 p-1 bg-white/50 rounded-xl border border-dashed border-emerald-250">
                  {db.kelas.map(k => {
                    const isChecked = inputMapel1KelasIds.includes(k.id);
                    return (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setInputMapel1KelasIds(prev => prev.filter(id => id !== k.id));
                          } else {
                            setInputMapel1KelasIds(prev => [...prev, k.id]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          isChecked 
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {k.nama}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mapel 2 (Opsional) */}
            <div className="p-4 bg-orange-50/10 border border-orange-100/30 rounded-xl space-y-3">
              <div className="text-xs font-bold text-amber-800">Mata Pelajaran Pengampu 2 (Tugas Tambahan)</div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Mata Pelajaran</label>
                <select
                  value={inputMapel2Id}
                  onChange={e => setInputMapel2Id(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none"
                >
                  <option value="">-- Tidak Ada Mapel Kedua --</option>
                  {db.mapel.map(m => (
                    <option key={m.id} value={m.id}>{m.nama}</option>
                  ))}
                </select>
              </div>
              {inputMapel2Id && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Ditargetkan untuk Kelas (Pilih beberapa)</label>
                  <div className="flex flex-wrap gap-1.5 p-1 bg-white/50 rounded-xl border border-dashed border-amber-250 animate-fadeIn">
                    {db.kelas.map(k => {
                      const isChecked = inputMapel2KelasIds.includes(k.id);
                      return (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setInputMapel2KelasIds(prev => prev.filter(id => id !== k.id));
                            } else {
                              setInputMapel2KelasIds(prev => [...prev, k.id]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            isChecked 
                              ? 'bg-amber-600 text-white border-amber-700 shadow-sm' 
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {k.nama}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100/50 pt-3">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setEditingId(null); }}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              Simpan Profil Guru
            </button>
          </div>
        </form>
      )}

      {/* Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-bold tracking-wider uppercase">
              <th className="py-3.5 px-6">Nama Guru</th>
              <th className="py-3.5 px-6">Akun Login</th>
              <th className="py-3.5 px-6">Mata Pelajaran diampu (Kelas)</th>
              <th className="py-3.5 px-6">Tugas Wali Kelas</th>
              <th className="py-3.5 px-6 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {db.guru.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 font-medium font-sans">
                  Belum ada data guru. Klik tombol Tambah Guru untuk membuat any.
                </td>
              </tr>
            ) : (
              db.guru.map((g) => {
                const map1 = db.mapel.find(m => m.id === g.mapel1Id);
                const map1KelasIds = g.mapel1KelasIds && g.mapel1KelasIds.length > 0 
                  ? g.mapel1KelasIds 
                  : (g.mapel1KelasId ? [g.mapel1KelasId] : []);
                const map1KelasNames = map1KelasIds
                  .map(cid => db.kelas.find(c => c.id === cid)?.nama)
                  .filter(Boolean)
                  .join(', ');

                const map2 = g.mapel2Id ? db.mapel.find(m => m.id === g.mapel2Id) : null;
                const map2KelasIds = g.mapel2KelasIds && g.mapel2KelasIds.length > 0 
                  ? g.mapel2KelasIds 
                  : (g.mapel2KelasId ? [g.mapel2KelasId] : []);
                const map2KelasNames = map2KelasIds
                  .map(cid => db.kelas.find(c => c.id === cid)?.nama)
                  .filter(Boolean)
                  .join(', ');
                
                const wkKelas = g.isWaliKelas ? db.kelas.find(k => k.id === g.waliKelasKelasId) : null;

                return (
                  <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-800">{g.nama}</td>
                    <td className="py-4 px-6">
                      <div className="text-slate-700 font-medium">user: <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600 text-[10px]">{g.username}</code></div>
                      <div className="text-slate-400 text-[10px] mt-0.5">pass: {g.passwordKey}</div>
                    </td>
                    <td className="py-4 px-6 space-y-1">
                      {map1 && (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            <span className="text-slate-800 font-semibold">{map1.nama}</span>
                          </div>
                          <span className="text-emerald-700 text-[10px] pl-2.5">Kelas: {map1KelasNames || '-'}</span>
                        </div>
                      )}
                      {map2 && (
                        <div className="flex flex-col gap-0.5 mt-1.5 border-t border-slate-100/50 pt-1.5">
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                            <span className="text-slate-800 font-medium">{map2.nama}</span>
                          </div>
                          <span className="text-amber-700 text-[10px] pl-2.5">Kelas: {map2KelasNames || '-'}</span>
                        </div>
                      )}
                      {!map1 && !map2 && (
                        <span className="text-slate-400 italic">Belum mengampu mapel</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {g.isWaliKelas && wkKelas ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-100 rounded-lg text-[10px] font-bold">
                          <GraduationCap className="w-3.5 h-3.5" />
                          Wali Kelas {wkKelas.nama}
                        </span>
                      ) : (
                        <span className="text-slate-400">Bukan Wali Kelas</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right space-x-1">
                      <button
                        onClick={() => handleStartEdit(g)}
                        disabled={!!isAdding || !!editingId}
                        className="p-1 px-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700 rounded font-semibold text-[11px] transition-colors inline-flex items-center gap-0.5 disabled:opacity-50"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(g.id)}
                        disabled={!!isAdding || !!editingId}
                        className="p-1 px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700 rounded font-semibold text-[11px] transition-colors inline-flex items-center gap-0.5 disabled:opacity-50"
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
            <h3 className="text-base font-bold text-slate-900 font-sans">Hapus Data Guru</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus data Guru ini? Referensi Wali Kelas dan Mata Pelajaran Pengampu bersangkutan akan dikosongkan.
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
