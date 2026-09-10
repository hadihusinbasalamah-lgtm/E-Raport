/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase, Guru, Mapel, Kelas } from '../types';
import { ShieldCheck, Plus, Edit2, Trash2, Check, Lock, GraduationCap, Search, X, BookOpen, User } from 'lucide-react';

interface AdminGuruProps {
  db: SchemaDatabase;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function AdminGuru({ db, onUpdate }: AdminGuruProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const [inputMapel3Id, setInputMapel3Id] = useState('');
  const [inputMapel3KelasId, setInputMapel3KelasId] = useState('');
  const [inputMapel3KelasIds, setInputMapel3KelasIds] = useState<string[]>([]);

  const handleCloseModal = () => {
    setIsAdding(false);
    setEditingId(null);
  };

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
    setInputMapel3Id('');
    setInputMapel3KelasId('');
    setInputMapel3KelasIds([]);
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (g: Guru) => {
    setEditingId(g.id);
    setIsAdding(false);
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
    setInputMapel3Id(g.mapel3Id || '');
    setInputMapel3KelasId(g.mapel3KelasId || '');
    setInputMapel3KelasIds(g.mapel3KelasIds || (g.mapel3KelasId ? [g.mapel3KelasId] : []));
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
      mapel2KelasIds: inputMapel2Id ? inputMapel2KelasIds : [],
      mapel3Id: inputMapel3Id,
      mapel3KelasId: inputMapel3Id && inputMapel3KelasIds.length > 0 ? inputMapel3KelasIds[0] : '',
      mapel3KelasIds: inputMapel3Id ? inputMapel3KelasIds : []
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
          mapel2KelasIds: inputMapel2Id ? inputMapel2KelasIds : [],
          mapel3Id: inputMapel3Id,
          mapel3KelasId: inputMapel3Id && inputMapel3KelasIds.length > 0 ? inputMapel3KelasIds[0] : '',
          mapel3KelasIds: inputMapel3Id ? inputMapel3KelasIds : []
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

  // Filtered teachers list based on search query
  const filteredGuruList = db.guru.filter((g) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();

    const map1 = db.mapel.find(m => m.id === g.mapel1Id);
    const map1KelasIds = g.mapel1KelasIds && g.mapel1KelasIds.length > 0 
      ? g.mapel1KelasIds 
      : (g.mapel1KelasId ? [g.mapel1KelasId] : []);
    const map1KelasNames = map1KelasIds
      .map(cid => db.kelas.find(c => c.id === cid)?.nama)
      .filter(Boolean)
      .join(' ');

    const map2 = g.mapel2Id ? db.mapel.find(m => m.id === g.mapel2Id) : null;
    const map2KelasIds = g.mapel2KelasIds && g.mapel2KelasIds.length > 0 
      ? g.mapel2KelasIds 
      : (g.mapel2KelasId ? [g.mapel2KelasId] : []);
    const map2KelasNames = map2KelasIds
      .map(cid => db.kelas.find(c => c.id === cid)?.nama)
      .filter(Boolean)
      .join(' ');

    const map3 = g.mapel3Id ? db.mapel.find(m => m.id === g.mapel3Id) : null;
    const map3KelasIds = g.mapel3KelasIds && g.mapel3KelasIds.length > 0 
      ? g.mapel3KelasIds 
      : (g.mapel3KelasId ? [g.mapel3KelasId] : []);
    const map3KelasNames = map3KelasIds
      .map(cid => db.kelas.find(c => c.id === cid)?.nama)
      .filter(Boolean)
      .join(' ');

    const wkKelas = g.isWaliKelas ? db.kelas.find(k => k.id === g.waliKelasKelasId) : null;

    return (
      g.nama.toLowerCase().includes(q) ||
      g.username.toLowerCase().includes(q) ||
      (map1 && map1.nama.toLowerCase().includes(q)) ||
      (map2 && map2.nama.toLowerCase().includes(q)) ||
      (map3 && map3.nama.toLowerCase().includes(q)) ||
      map1KelasNames.toLowerCase().includes(q) ||
      map2KelasNames.toLowerCase().includes(q) ||
      map3KelasNames.toLowerCase().includes(q) ||
      (wkKelas && wkKelas.nama.toLowerCase().includes(q)) ||
      (g.isWaliKelas && 'wali kelas'.includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 font-sans">
            <GraduationCap className="w-5 h-5 text-emerald-600" />
            Data Guru
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            Kelola data dewan guru, pengaturan multi-subject mengajar (maks. 3 mapel), dan flag Wali Kelas.
          </p>
        </div>
        <button
          onClick={handleStartAdd}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Tambah Guru
        </button>
      </div>

      {/* Search & Statistics Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama guru, username, mapel, atau kelas..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/80 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              title="Hapus pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 justify-between sm:justify-end">
          <span className="px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl text-[11px] font-medium text-slate-600">
            Total: <strong className="text-slate-900 font-bold">{filteredGuruList.length}</strong> {filteredGuruList.length !== db.guru.length ? `dari ${db.guru.length} guru` : 'guru'}
          </span>
        </div>
      </div>

      {/* POPUP MODAL: ADD / EDIT GURU */}
      {(isAdding || !!editingId) && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
          onClick={handleCloseModal}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-4xl lg:max-w-5xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] my-auto overflow-hidden animate-fadeIn"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${isAdding ? 'bg-emerald-50/50 border-emerald-100/70' : 'bg-amber-50/50 border-amber-100/70'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isAdding ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-sans">
                    {isAdding ? "Tambah Guru Baru" : `Edit Data Guru: ${inputNama}`}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-sans">
                    {isAdding ? "Lengkapi akun login dan penugasan mata pelajaran guru (maksimal 3 mapel)" : "Perbarui informasi akun, tugas wali kelas, atau mata pelajaran pengampu (maksimal 3 mapel)"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={isAdding ? handleSaveAdd : handleSaveEdit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
                
                {/* Account Credentials */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                    <input
                      type="text"
                      required
                      value={inputNama}
                      onChange={e => setInputNama(e.target.value)}
                      placeholder="Contoh: Ust. Ahmad, S.Pd.I"
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Username Login Guru (Unik)</label>
                    <input
                      type="text"
                      required
                      value={inputUsername}
                      onChange={e => setInputUsername(e.target.value.replace(/\s+/g, ''))}
                      placeholder="Contoh: ahmadguru"
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password Guru</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={inputPassword}
                        onChange={e => setInputPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full pl-8 pr-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans"
                      />
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                    </div>
                  </div>
                </div>

                {/* Walikelas configuration */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="isWaliModal"
                      checked={inputIsWali}
                      onChange={e => {
                        setInputIsWali(e.target.checked);
                        if (e.target.checked && !inputWaliKelasId) {
                          setInputWaliKelasId(db.kelas[0]?.id || '');
                        }
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="isWaliModal" className="text-xs font-bold text-slate-800 select-none cursor-pointer">
                      Tugaskan sebagai Wali Kelas?
                    </label>
                  </div>
                  {inputIsWali && (
                    <div className="max-w-xs animate-fadeIn pt-1">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Asosiasi Wali Kelas Untuk:</label>
                      <select
                        value={inputWaliKelasId}
                        onChange={e => setInputWaliKelasId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans"
                      >
                        {db.kelas.map(k => (
                          <option key={k.id} value={k.id}>{k.nama}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Mapels and Classes taught -- Up to 3 mapels */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  
                  {/* Mapel 1 (Utama - Wajib) */}
                  <div className="p-4 bg-emerald-50/30 border border-emerald-100 rounded-xl space-y-3">
                    <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      Mata Pelajaran 1 (Utama)
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mata Pelajaran</label>
                      <select
                        value={inputMapel1Id}
                        onChange={e => setInputMapel1Id(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans"
                      >
                        {db.mapel.map(m => (
                          <option key={m.id} value={m.id}>{m.nama}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                        Target Kelas ({inputMapel1KelasIds.length} dipilih)
                      </label>
                      <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-dashed border-emerald-200 max-h-36 overflow-y-auto">
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
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                isChecked 
                                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs' 
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

                  {/* Mapel 2 (Tugas Tambahan 1 - Opsional) */}
                  <div className="p-4 bg-amber-50/20 border border-amber-100 rounded-xl space-y-3">
                    <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Mata Pelajaran 2 (Tambahan)
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mata Pelajaran</label>
                      <select
                        value={inputMapel2Id}
                        onChange={e => setInputMapel2Id(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-sans"
                      >
                        <option value="">-- Tidak Ada Mapel Kedua --</option>
                        {db.mapel.map(m => (
                          <option key={m.id} value={m.id}>{m.nama}</option>
                        ))}
                      </select>
                    </div>
                    {inputMapel2Id && (
                      <div className="animate-fadeIn">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                          Target Kelas ({inputMapel2KelasIds.length} dipilih)
                        </label>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-dashed border-amber-200 max-h-36 overflow-y-auto">
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
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                  isChecked 
                                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs' 
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

                  {/* Mapel 3 (Tugas Tambahan 2 - Opsional) */}
                  <div className="p-4 bg-sky-50/20 border border-sky-100 rounded-xl space-y-3">
                    <div className="text-xs font-bold text-sky-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-500" />
                      Mata Pelajaran 3 (Tambahan)
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mata Pelajaran</label>
                      <select
                        value={inputMapel3Id}
                        onChange={e => setInputMapel3Id(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-sans"
                      >
                        <option value="">-- Tidak Ada Mapel Ketiga --</option>
                        {db.mapel.map(m => (
                          <option key={m.id} value={m.id}>{m.nama}</option>
                        ))}
                      </select>
                    </div>
                    {inputMapel3Id && (
                      <div className="animate-fadeIn">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                          Target Kelas ({inputMapel3KelasIds.length} dipilih)
                        </label>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-dashed border-sky-200 max-h-36 overflow-y-auto">
                          {db.kelas.map(k => {
                            const isChecked = inputMapel3KelasIds.includes(k.id);
                            return (
                              <button
                                key={k.id}
                                type="button"
                                onClick={() => {
                                  if (isChecked) {
                                    setInputMapel3KelasIds(prev => prev.filter(id => id !== k.id));
                                  } else {
                                    setInputMapel3KelasIds(prev => [...prev, k.id]);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                  isChecked 
                                    ? 'bg-sky-600 text-white border-sky-700 shadow-xs' 
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

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400 italic hidden sm:inline font-sans">
                  * Pastikan username unik dan minimal 1 kelas target dipilih
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-colors font-sans"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all font-sans"
                  >
                    <Check className="w-4 h-4" />
                    Simpan Profil Guru
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
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
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-medium font-sans">
                    Belum ada data guru. Klik tombol Tambah Guru untuk membuat baru.
                  </td>
                </tr>
              ) : filteredGuruList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-medium font-sans">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="w-8 h-8 text-slate-300 stroke-1" />
                      <p>Tidak ada guru yang sesuai dengan pencarian <strong className="text-slate-700">"{searchQuery}"</strong></p>
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="mt-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Reset Pencarian
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGuruList.map((g) => {
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

                  const map3 = g.mapel3Id ? db.mapel.find(m => m.id === g.mapel3Id) : null;
                  const map3KelasIds = g.mapel3KelasIds && g.mapel3KelasIds.length > 0 
                    ? g.mapel3KelasIds 
                    : (g.mapel3KelasId ? [g.mapel3KelasId] : []);
                  const map3KelasNames = map3KelasIds
                    .map(cid => db.kelas.find(c => c.id === cid)?.nama)
                    .filter(Boolean)
                    .join(', ');
                  
                  const wkKelas = g.isWaliKelas ? db.kelas.find(k => k.id === g.waliKelasKelasId) : null;

                  return (
                    <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-800">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {g.nama.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-900">{g.nama}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-slate-700 font-medium">user: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-rose-600 text-[10px] font-mono font-bold">{g.username}</code></div>
                        <div className="text-slate-400 text-[10px] mt-0.5">pass: {g.passwordKey}</div>
                      </td>
                      <td className="py-4 px-6 space-y-1">
                        {map1 && (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                              <span className="text-slate-800 font-semibold">{map1.nama}</span>
                            </div>
                            <span className="text-emerald-700 text-[10px] pl-3">Kelas: {map1KelasNames || '-'}</span>
                          </div>
                        )}
                        {map2 && (
                          <div className="flex flex-col gap-0.5 mt-1.5 border-t border-slate-100/70 pt-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                              <span className="text-slate-800 font-medium">{map2.nama}</span>
                            </div>
                            <span className="text-amber-700 text-[10px] pl-3">Kelas: {map2KelasNames || '-'}</span>
                          </div>
                        )}
                        {map3 && (
                          <div className="flex flex-col gap-0.5 mt-1.5 border-t border-slate-100/70 pt-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-sky-500 rounded-full" />
                              <span className="text-slate-800 font-medium">{map3.nama}</span>
                            </div>
                            <span className="text-sky-700 text-[10px] pl-3">Kelas: {map3KelasNames || '-'}</span>
                          </div>
                        )}
                        {!map1 && !map2 && !map3 && (
                          <span className="text-slate-400 italic">Belum mengampu mapel</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {g.isWaliKelas && wkKelas ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/60 rounded-lg text-[10px] font-bold">
                            <GraduationCap className="w-3.5 h-3.5" />
                            Wali Kelas {wkKelas.nama}
                          </span>
                        ) : (
                          <span className="text-slate-400">Bukan Wali Kelas</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right space-x-1.5">
                        <button
                          onClick={() => handleStartEdit(g)}
                          className="px-2.5 py-1 text-slate-600 hover:bg-amber-50 hover:text-amber-700 rounded-lg font-semibold text-[11px] transition-colors inline-flex items-center gap-1 border border-transparent hover:border-amber-200"
                          title="Edit Guru"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(g.id)}
                          className="px-2.5 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700 rounded-lg font-semibold text-[11px] transition-colors inline-flex items-center gap-1 border border-transparent hover:border-rose-200"
                          title="Hapus Guru"
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
