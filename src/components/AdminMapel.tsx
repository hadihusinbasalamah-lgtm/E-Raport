/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase, Mapel } from '../types';
import { 
  BookOpen, Plus, Edit2, Trash2, Check, HelpCircle, 
  ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, Sparkles, 
  Layers, Tag, Info, AlertCircle, FileText
} from 'lucide-react';
import { ModalUrutanMapel } from './ModalUrutanMapel';
import { isYayasanSubject, getSubjectPriority, applyDefaultAlIrsyadOrder } from '../utils/mapelOrder';

interface AdminMapelProps {
  db: SchemaDatabase;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function AdminMapel({ db, onUpdate }: AdminMapelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputNama, setInputNama] = useState('');
  const [inputKategori, setInputKategori] = useState<'umum' | 'yayasan'>('umum');
  const [isModalUrutanOpen, setIsModalUrutanOpen] = useState(false);
  const [tabFilter, setTabFilter] = useState<'semua' | 'umum' | 'yayasan'>('semua');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Show transient notification toast
  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage('');
    }, 3500);
  };

  // Helper to save new mapel list into db and sync with active period snapshot if present
  const saveNewMapelList = (newMapelList: Mapel[], toastMsg?: string) => {
    const updatedDb: SchemaDatabase = {
      ...db,
      mapel: newMapelList
    };

    if (db.activePeriodId && updatedDb.periodList) {
      updatedDb.periodList = updatedDb.periodList.map(p => {
        if (p.id === db.activePeriodId) {
          return {
            ...p,
            snapshotMapel: newMapelList.map(m => ({ ...m }))
          };
        }
        return p;
      });
    }

    onUpdate(updatedDb);
    if (toastMsg) {
      showFeedback(toastMsg);
    }
  };

  // Compute sorted mapels grouped by Umum and Yayasan with their page numbers
  const getSortedGroups = () => {
    const umumList: Mapel[] = [];
    const yayasanList: Mapel[] = [];

    db.mapel.forEach(m => {
      if (isYayasanSubject(m)) {
        yayasanList.push({ ...m, kategori: 'yayasan' });
      } else {
        umumList.push({ ...m, kategori: 'umum' });
      }
    });

    umumList.sort((a, b) => {
      const pA = typeof a.urutan === 'number' && a.urutan > 0 ? a.urutan : getSubjectPriority(a.nama, false);
      const pB = typeof b.urutan === 'number' && b.urutan > 0 ? b.urutan : getSubjectPriority(b.nama, false);
      if (pA !== pB) return pA - pB;
      return a.nama.localeCompare(b.nama);
    });

    yayasanList.sort((a, b) => {
      const pA = typeof a.urutan === 'number' && a.urutan > 0 ? a.urutan : getSubjectPriority(a.nama, true);
      const pB = typeof b.urutan === 'number' && b.urutan > 0 ? b.urutan : getSubjectPriority(b.nama, true);
      if (pA !== pB) return pA - pB;
      return a.nama.localeCompare(b.nama);
    });

    return { umumList, yayasanList };
  };

  const { umumList, yayasanList } = getSortedGroups();

  // Combine into single sorted list with metadata for table display
  let runningOrder = 1;
  const allSortedMapel = [
    ...umumList.map((m, idx) => {
      const page = idx < 5 ? 'Hal. 1' : 'Hal. 2';
      return {
        ...m,
        urutanRaport: runningOrder++,
        halamanRaport: page,
        isFirstInGroup: idx === 0,
        isLastInGroup: idx === umumList.length - 1,
        groupType: 'umum' as const,
        groupIndex: idx,
        groupTotal: umumList.length
      };
    }),
    ...yayasanList.map((m, idx) => {
      const page = idx === 0 ? 'Hal. 2' : 'Hal. 3';
      return {
        ...m,
        urutanRaport: runningOrder++,
        halamanRaport: page,
        isFirstInGroup: idx === 0,
        isLastInGroup: idx === yayasanList.length - 1,
        groupType: 'yayasan' as const,
        groupIndex: idx,
        groupTotal: yayasanList.length
      };
    })
  ];

  // Filtered list based on active tab
  const displayedMapel = allSortedMapel.filter(m => {
    if (tabFilter === 'umum') return m.groupType === 'umum';
    if (tabFilter === 'yayasan') return m.groupType === 'yayasan';
    return true;
  });

  // Reorder mapel directly via Up/Down arrow buttons
  const handleMoveMapel = (mapelId: string, direction: 'up' | 'down') => {
    const targetMapel = db.mapel.find(m => m.id === mapelId);
    if (!targetMapel) return;

    const isYayasan = isYayasanSubject(targetMapel);
    const currentList = isYayasan ? [...yayasanList] : [...umumList];
    const idx = currentList.findIndex(m => m.id === mapelId);

    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === currentList.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const [movedItem] = currentList.splice(idx, 1);
    currentList.splice(targetIdx, 0, movedItem);

    const newUmum = isYayasan ? umumList : currentList;
    const newYayasan = isYayasan ? currentList : yayasanList;

    let counter = 1;
    const reorderedUmum = newUmum.map(m => ({
      ...m,
      urutan: counter++,
      kategori: 'umum' as const
    }));

    const reorderedYayasan = newYayasan.map(m => ({
      ...m,
      urutan: counter++,
      kategori: 'yayasan' as const
    }));

    const finalCombined = [...reorderedUmum, ...reorderedYayasan];
    saveNewMapelList(
      finalCombined,
      `Urutan "${targetMapel.nama}" berhasil ${direction === 'up' ? 'dinaikkan' : 'diturunkan'} pada cetak raport.`
    );
  };

  // Reset to default SMP Al-Irsyad standard order
  const handleResetToDefaultAlIrsyad = () => {
    if (window.confirm("Apakah Anda yakin ingin mengatur ulang urutan seluruh mata pelajaran sesuai urutan resmi standar cetak raport SMP Al-Irsyad Surakarta?")) {
      const defaultOrdered = applyDefaultAlIrsyadOrder(db.mapel);
      saveNewMapelList(defaultOrdered, "Urutan mata pelajaran berhasil diatur ulang ke standar resmi SMP Al-Irsyad!");
    }
  };

  // Toggle category between Umum and Yayasan
  const handleToggleKategori = (mapelId: string) => {
    const target = db.mapel.find(m => m.id === mapelId);
    if (!target) return;
    const isCurrentlyYayasan = isYayasanSubject(target);
    const newKat: 'umum' | 'yayasan' = isCurrentlyYayasan ? 'umum' : 'yayasan';

    const updated = db.mapel.map(m => {
      if (m.id === mapelId) {
        return { ...m, kategori: newKat };
      }
      return m;
    });

    const newUmum = updated.filter(m => !isYayasanSubject(m));
    const newYayasan = updated.filter(m => isYayasanSubject(m));

    let counter = 1;
    const finalCombined = [
      ...newUmum.map(m => ({ ...m, urutan: counter++, kategori: 'umum' as const })),
      ...newYayasan.map(m => ({ ...m, urutan: counter++, kategori: 'yayasan' as const }))
    ];

    saveNewMapelList(
      finalCombined,
      `Kategori "${target.nama}" berhasil diubah menjadi ${newKat === 'yayasan' ? 'Ciri Khusus / Yayasan' : 'Mata Pelajaran Umum'}`
    );
  };

  const handleStartAdd = () => {
    setInputNama('');
    setInputKategori('umum');
    setIsAdding(true);
  };

  const handleStartEdit = (m: Mapel) => {
    setEditingId(m.id);
    setInputNama(m.nama);
    setInputKategori(isYayasanSubject(m) ? 'yayasan' : 'umum');
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputNama.trim()) return;

    const newMapel: Mapel = {
      id: 'm_' + Date.now(),
      nama: inputNama.trim(),
      kategori: inputKategori,
      urutan: db.mapel.length + 1
    };

    saveNewMapelList(
      [...db.mapel, newMapel],
      `Mata pelajaran "${newMapel.nama}" berhasil ditambahkan!`
    );

    setIsAdding(false);
    setInputNama('');
    setInputKategori('umum');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !inputNama.trim()) return;

    const updated = db.mapel.map(m => {
      if (m.id === editingId) {
        return { 
          ...m, 
          nama: inputNama.trim(),
          kategori: inputKategori
        };
      }
      return m;
    });

    saveNewMapelList(updated, `Mata pelajaran "${inputNama.trim()}" berhasil diperbarui!`);
    setEditingId(null);
  };

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    const targetMapel = db.mapel.find(m => m.id === id);
    const updated = db.mapel.filter(m => m.id !== id);
    saveNewMapelList(updated, `Mata pelajaran "${targetMapel?.nama || ''}" telah dihapus.`);
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
      if (g.mapel3Id === mapelId) {
        const mapel3KelasIds = g.mapel3KelasIds && g.mapel3KelasIds.length > 0
          ? g.mapel3KelasIds
          : (g.mapel3KelasId ? [g.mapel3KelasId] : []);
        const classNames = mapel3KelasIds
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
      {/* Toast Feedback Message */}
      {feedbackMessage && (
        <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md flex items-center justify-between animate-fadeIn transition-all">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-200" />
            <span>{feedbackMessage}</span>
          </div>
          <button 
            onClick={() => setFeedbackMessage('')}
            className="text-emerald-100 hover:text-white p-0.5 rounded-lg"
          >
            &times;
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            Data Mata Pelajaran (Mapel) & Urutan Raport
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola master mata pelajaran dan atur urutan tampilnya pada hasil cetak raport siswa.
          </p>
        </div>
        {!isAdding && !editingId && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleResetToDefaultAlIrsyad}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title="Reset seluruh urutan mapel ke urutan resmi standar SMP Al-Irsyad Surakarta"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Urutan Al-Irsyad
            </button>
            <button
              onClick={() => setIsModalUrutanOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
              title="Buka dialog lengkap untuk meninjau dan mengatur urutan cetak raport"
            >
              <ArrowUpDown className="w-4 h-4" />
              Atur Urutan Raport (Lengkap)
            </button>
            <button
              onClick={handleStartAdd}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Mapel
            </button>
          </div>
        )}
      </div>

      {/* Layout Distribution Summary Card */}
      <div className="bg-gradient-to-r from-slate-50 via-indigo-50/30 to-emerald-50/40 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-700 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span className="font-bold text-slate-900">Tata Letak Tampilan Cetak Raport (Standar Kurikulum Merdeka SMP Al-Irsyad):</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Total <strong>{allSortedMapel.length}</strong> Mapel ({umumList.length} Umum, {yayasanList.length} Ciri Khusus)
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
          <div className="bg-white/80 border border-blue-100 p-2.5 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-blue-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Halaman 1 Raport
              </span>
              <span className="text-[10px] font-mono text-slate-500">5 Mapel Pertama</span>
            </div>
            <p className="text-slate-600 text-[10.5px]">
              {umumList.slice(0, 5).map(m => m.nama).join(', ') || 'Belum ada mapel'}
            </p>
          </div>
          <div className="bg-white/80 border border-indigo-100 p-2.5 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-indigo-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Halaman 2 Raport
              </span>
              <span className="text-[10px] font-mono text-slate-500">Mapel 6-11 & Fiqih</span>
            </div>
            <p className="text-slate-600 text-[10.5px]">
              {[...umumList.slice(5, 11), ...yayasanList.slice(0, 1)].map(m => m.nama).join(', ') || 'Belum ada mapel'}
            </p>
          </div>
          <div className="bg-white/80 border border-amber-100 p-2.5 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-amber-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Halaman 3 Raport
              </span>
              <span className="text-[10px] font-mono text-slate-500">Ciri Khusus / Yayasan</span>
            </div>
            <p className="text-slate-600 text-[10.5px]">
              {yayasanList.slice(1).map(m => m.nama).join(', ') || 'Belum ada mapel yayasan berikutnya'}
            </p>
          </div>
        </div>
      </div>

      {/* Add Form */}
      {isAdding && (
        <form onSubmit={handleSaveAdd} className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl space-y-4">
          <div className="text-sm font-semibold text-emerald-800">Tambah Mata Pelajaran Baru</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Mata Pelajaran</label>
              <input
                type="text"
                required
                value={inputNama}
                onChange={e => {
                  const val = e.target.value;
                  setInputNama(val);
                  // Auto-detect kategori if user hasn't explicitly set it
                  if (isYayasanSubject(val)) {
                    setInputKategori('yayasan');
                  }
                }}
                placeholder="Contoh: Matematika, Bahasa Arab, IPA Terpadu"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kelompok Mata Pelajaran di Raport</label>
              <select
                value={inputKategori}
                onChange={e => setInputKategori(e.target.value as 'umum' | 'yayasan')}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="umum">Mata Pelajaran Umum (Mendikbud / Halaman 1 & 2)</option>
                <option value="yayasan">Muatan Ciri Khusus / Yayasan (Fiqih, Arab, dll / Hal. 2 & 3)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Mata Pelajaran</label>
              <input
                type="text"
                required
                value={inputNama}
                onChange={e => setInputNama(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kelompok Mata Pelajaran di Raport</label>
              <select
                value={inputKategori}
                onChange={e => setInputKategori(e.target.value as 'umum' | 'yayasan')}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="umum">Mata Pelajaran Umum (Mendikbud / Halaman 1 & 2)</option>
                <option value="yayasan">Muatan Ciri Khusus / Yayasan (Hal. 2 & 3)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Selesai Edit
            </button>
          </div>
        </form>
      )}

      {/* Tabs Filter Bar */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTabFilter('semua')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              tabFilter === 'semua'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Semua Mapel ({allSortedMapel.length})
          </button>
          <button
            onClick={() => setTabFilter('umum')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              tabFilter === 'umum'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Kelompok Umum ({umumList.length})
          </button>
          <button
            onClick={() => setTabFilter('yayasan')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              tabFilter === 'yayasan'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Ciri Khusus / Yayasan ({yayasanList.length})
          </button>
        </div>
        <div className="text-[11px] text-slate-500 hidden sm:block">
          Gunakan tombol <ArrowUp className="w-3 h-3 inline text-slate-700" /> / <ArrowDown className="w-3 h-3 inline text-slate-700" /> untuk mengatur urutan cetak raport.
        </div>
      </div>

      {/* List Table with Report Order Controls */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-bold tracking-wider uppercase">
              <th className="py-3.5 px-4 text-center w-36">Urutan Raport</th>
              <th className="py-3.5 px-4 w-44">Kelompok</th>
              <th className="py-3.5 px-4">Nama Mata Pelajaran</th>
              <th className="py-3.5 px-4">Guru Pengampu & Target Kelas</th>
              <th className="py-3.5 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {displayedMapel.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                  Belum ada data mata pelajaran pada kategori ini.
                </td>
              </tr>
            ) : (
              displayedMapel.map((m) => {
                const pengampuList = getGuruPengampu(m.id);
                const isYayasan = m.groupType === 'yayasan';

                return (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Urutan Raport Column with Up & Down Quick Buttons */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="flex items-center gap-1 bg-slate-100/90 text-slate-800 font-mono font-bold text-xs px-2 py-1 rounded-lg border border-slate-200/70 shadow-2xs">
                          <span>#{m.urutanRaport}</span>
                        </div>
                        <span 
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                            m.halamanRaport === 'Hal. 1'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : m.halamanRaport === 'Hal. 2'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                          title={`Tampil pada ${m.halamanRaport} cetak raport`}
                        >
                          {m.halamanRaport}
                        </span>
                        <div className="flex flex-col gap-0.5 ml-1">
                          <button
                            type="button"
                            onClick={() => handleMoveMapel(m.id, 'up')}
                            disabled={m.isFirstInGroup}
                            title={m.isFirstInGroup ? "Sudah berada di posisi teratas kelompoknya" : "Naikkan urutan pada cetak raport"}
                            className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveMapel(m.id, 'down')}
                            disabled={m.isLastInGroup}
                            title={m.isLastInGroup ? "Sudah berada di posisi terbawah kelompoknya" : "Turunkan urutan pada cetak raport"}
                            className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Kelompok Mapel Column */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <span 
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold w-fit border ${
                            isYayasan
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {isYayasan ? 'Ciri Khusus / Yayasan' : 'Mata Pelajaran Umum'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleKategori(m.id)}
                          className="text-[10px] text-slate-400 hover:text-indigo-600 underline text-left w-fit transition-colors cursor-pointer"
                          title="Klik untuk mengubah kelompok mapel ini"
                        >
                          Ubah ke {isYayasan ? 'Umum' : 'Yayasan'}
                        </button>
                      </div>
                    </td>

                    {/* Nama Mapel Column */}
                    <td className="py-3 px-4 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{m.nama}</span>
                      </div>
                    </td>

                    {/* Guru Pengampu Column */}
                    <td className="py-3 px-4">
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

                    {/* Action Column */}
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => handleStartEdit(m)}
                        disabled={!!isAdding || !!editingId}
                        className="p-1 px-2 text-slate-600 hover:bg-amber-50 hover:text-amber-700 rounded font-semibold text-[11px] transition-colors inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(m.id)}
                        disabled={!!isAdding || !!editingId}
                        className="p-1 px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700 rounded font-semibold text-[11px] transition-colors inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer"
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

      {/* Guidance Info Card */}
      <div className="bg-amber-50/40 p-4 border border-amber-200/60 rounded-2xl flex items-start gap-3 text-slate-700">
        <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-[11px] leading-relaxed space-y-1">
          <div className="font-bold text-slate-900">Ketentuan Urutan Mata Pelajaran pada Cetak Raport:</div>
          <p className="text-slate-600">
            • Urutan mata pelajaran di tabel atas langsung merefleksikan urutan mata pelajaran yang tercetak pada lembar <strong>Raport Siswa (PDF / Cetak Raport)</strong>.
          </p>
          <p className="text-slate-600">
            • Gunakan tombol <strong>Panah Naik / Turun</strong> di kolom Urutan Raport untuk menukar posisi mapel, atau klik tombol <strong>"Atur Urutan Raport (Lengkap)"</strong> untuk visualisasi menyeluruh dengan preview per halaman.
          </p>
          <p className="text-slate-600">
            • Guru Pengampu ditugaskan melalui menu <strong>Data Guru</strong>. Mapel yang belum memiliki guru pengampu tetap dapat diurutkan posisinya di raport.
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
              Apakah Anda yakin ingin menghapus Mata Pelajaran ini? Tindakan ini dapat mempengaruhi status penugasan pengampu pada Guru Terkait dan cetak raport.
            </p>
            <div className="flex gap-3 w-full mt-6">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition duration-150 font-sans cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow-md transition duration-150 font-sans cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Urutan Mapel Raport */}
      <ModalUrutanMapel 
        db={db}
        isOpen={isModalUrutanOpen}
        onClose={() => setIsModalUrutanOpen(false)}
        onUpdate={onUpdate}
      />

    </div>
  );
}
