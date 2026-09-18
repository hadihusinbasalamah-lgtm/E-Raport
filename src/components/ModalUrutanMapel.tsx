/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase, Mapel } from '../types';
import { 
  ArrowUpDown, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, 
  RotateCcw, Check, X, FileText, Sparkles, BookOpen, Layers, Info
} from 'lucide-react';
import { 
  isYayasanSubject, 
  DEFAULT_UMUM_PRIORITY, 
  DEFAULT_YAYASAN_PRIORITY,
  getSubjectPriority
} from '../utils/mapelOrder';

interface ModalUrutanMapelProps {
  db: SchemaDatabase;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function ModalUrutanMapel({ db, isOpen, onClose, onUpdate }: ModalUrutanMapelProps) {
  const activePeriod = db.periodList.find(p => p.id === db.activePeriodId);

  // Initialize working copy of mapels
  const initializeMapels = () => {
    // Collect all unique mapel from active snapshot and db.mapel
    const seen = new Set<string>();
    const list: Mapel[] = [];

    const addM = (m: Mapel) => {
      if (!m || !m.nama || seen.has(m.id)) return;
      seen.add(m.id);
      list.push({ ...m });
    };

    (activePeriod?.snapshotMapel || []).forEach(addM);
    (db.mapel || []).forEach(addM);

    // Categorize
    const umumList: Mapel[] = [];
    const yayasanList: Mapel[] = [];

    list.forEach(m => {
      if (isYayasanSubject(m)) {
        yayasanList.push({ ...m, kategori: 'yayasan' });
      } else {
        umumList.push({ ...m, kategori: 'umum' });
      }
    });

    // Sort initially by urutan if present, otherwise by default priority
    umumList.sort((a, b) => {
      const ordA = typeof a.urutan === 'number' && a.urutan > 0 ? a.urutan : getSubjectPriority(a.nama, false);
      const ordB = typeof b.urutan === 'number' && b.urutan > 0 ? b.urutan : getSubjectPriority(b.nama, false);
      if (ordA !== ordB) return ordA - ordB;
      return a.nama.localeCompare(b.nama);
    });

    yayasanList.sort((a, b) => {
      const ordA = typeof a.urutan === 'number' && a.urutan > 0 ? a.urutan : getSubjectPriority(a.nama, true);
      const ordB = typeof b.urutan === 'number' && b.urutan > 0 ? b.urutan : getSubjectPriority(b.nama, true);
      if (ordA !== ordB) return ordA - ordB;
      return a.nama.localeCompare(b.nama);
    });

    return {
      umum: umumList,
      yayasan: yayasanList
    };
  };

  const [activeTab, setActiveTab] = useState<'semua' | 'umum' | 'yayasan'>('semua');
  const [mapelState, setMapelState] = useState(initializeMapels);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reset internal state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setMapelState(initializeMapels());
      setSaveSuccess(false);
    }
  }, [isOpen, db.mapel, db.activePeriodId]);

  if (!isOpen) return null;

  const { umum, yayasan } = mapelState;

  // Move an item in an array
  const moveItem = (list: Mapel[], fromIndex: number, toIndex: number): Mapel[] => {
    if (toIndex < 0 || toIndex >= list.length) return list;
    const copy = [...list];
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, moved);
    return copy;
  };

  const handleMoveUmum = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    let targetIndex = index;
    if (direction === 'up') targetIndex = index - 1;
    if (direction === 'down') targetIndex = index + 1;
    if (direction === 'top') targetIndex = 0;
    if (direction === 'bottom') targetIndex = umum.length - 1;

    setMapelState(prev => ({
      ...prev,
      umum: moveItem(prev.umum, index, targetIndex)
    }));
  };

  const handleMoveYayasan = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    let targetIndex = index;
    if (direction === 'up') targetIndex = index - 1;
    if (direction === 'down') targetIndex = index + 1;
    if (direction === 'top') targetIndex = 0;
    if (direction === 'bottom') targetIndex = yayasan.length - 1;

    setMapelState(prev => ({
      ...prev,
      yayasan: moveItem(prev.yayasan, index, targetIndex)
    }));
  };

  // Toggle category between Umum and Yayasan
  const handleSwitchCategory = (mapelId: string, currentCategory: 'umum' | 'yayasan') => {
    if (currentCategory === 'umum') {
      const item = umum.find(m => m.id === mapelId);
      if (!item) return;
      setMapelState(prev => ({
        umum: prev.umum.filter(m => m.id !== mapelId),
        yayasan: [...prev.yayasan, { ...item, kategori: 'yayasan' }]
      }));
    } else {
      const item = yayasan.find(m => m.id === mapelId);
      if (!item) return;
      setMapelState(prev => ({
        yayasan: prev.yayasan.filter(m => m.id !== mapelId),
        umum: [...prev.umum, { ...item, kategori: 'umum' }]
      }));
    }
  };

  // Reset to default Al-Irsyad standard order
  const handleResetToDefault = () => {
    const all = [...umum, ...yayasan];
    const defaultUmum: Mapel[] = [];
    const defaultYayasan: Mapel[] = [];

    all.forEach(m => {
      // Check standard keywords
      const lower = m.nama.toLowerCase();
      const isRel = (
        lower.includes('aqidah') || lower.includes('akidah') ||
        lower.includes('fiqih') || lower.includes('fikih') ||
        lower.includes('ski') || lower.includes('sejarah kebudayaan islam') ||
        lower.includes('bahasa arab') || lower.includes('tahfidz') ||
        lower.includes('qur\'an') || lower.includes('quran')
      );

      if (isRel) {
        defaultYayasan.push({ ...m, kategori: 'yayasan' });
      } else {
        defaultUmum.push({ ...m, kategori: 'umum' });
      }
    });

    // Sort by official defaults
    defaultUmum.sort((a, b) => {
      const pA = getSubjectPriority(a.nama, false);
      const pB = getSubjectPriority(b.nama, false);
      if (pA !== pB) return pA - pB;
      return a.nama.localeCompare(b.nama);
    });

    defaultYayasan.sort((a, b) => {
      const pA = getSubjectPriority(a.nama, true);
      const pB = getSubjectPriority(b.nama, true);
      if (pA !== pB) return pA - pB;
      return a.nama.localeCompare(b.nama);
    });

    setMapelState({
      umum: defaultUmum,
      yayasan: defaultYayasan
    });
  };

  // Sort alphabetically
  const handleSortAlphabetical = (group: 'umum' | 'yayasan') => {
    if (group === 'umum') {
      const copy = [...umum].sort((a, b) => a.nama.localeCompare(b.nama));
      setMapelState(prev => ({ ...prev, umum: copy }));
    } else {
      const copy = [...yayasan].sort((a, b) => a.nama.localeCompare(b.nama));
      setMapelState(prev => ({ ...prev, yayasan: copy }));
    }
  };

  // Save the new order
  const handleSave = () => {
    let orderCounter = 1;

    const orderedUmum = umum.map(m => ({
      ...m,
      urutan: orderCounter++,
      kategori: 'umum' as const
    }));

    const orderedYayasan = yayasan.map(m => ({
      ...m,
      urutan: orderCounter++,
      kategori: 'yayasan' as const
    }));

    const finalOrderedMapel = [...orderedUmum, ...orderedYayasan];

    // Build updated db
    const updatedDb: SchemaDatabase = {
      ...db,
      mapel: finalOrderedMapel
    };

    // Also update snapshotMapel in periodList if activePeriod exists
    if (db.activePeriodId && updatedDb.periodList) {
      updatedDb.periodList = updatedDb.periodList.map(p => {
        if (p.id === db.activePeriodId) {
          return {
            ...p,
            snapshotMapel: finalOrderedMapel.map(m => ({ ...m }))
          };
        }
        return p;
      });
    }

    onUpdate(updatedDb);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  // Helper to determine which report page this item falls onto
  const getPageInfo = (type: 'umum' | 'yayasan', index: number) => {
    if (type === 'umum') {
      if (index < 5) {
        return { page: 'Halaman 1', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      }
      return { page: 'Halaman 2', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' };
    } else {
      if (index === 0) {
        return { page: 'Halaman 2 (Bawah)', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' };
      }
      return { page: 'Halaman 3', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' };
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-5 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-start justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <ArrowUpDown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white font-sans">
                  Atur Urutan Mata Pelajaran Raport
                </h3>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono rounded-full font-bold border border-emerald-500/30">
                  Kurikulum Merdeka
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Tentukan urutan mata pelajaran persis seperti yang akan dicetak pada lembar Raport Peserta Didik (Halaman 1, 2, dan 3) serta Leger Nilai.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* INFO BANNER & PAGE DISTRIBUTION GUIDE */}
        <div className="bg-emerald-50/70 border-b border-emerald-100 p-3.5 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-emerald-950">
            <Info className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">Pembagian Halaman Raport Resmi SMP Al-Irsyad:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-800 rounded-md font-medium">
              <strong>Hal. 1:</strong> Umum 1–5
            </span>
            <span className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 rounded-md font-medium">
              <strong>Hal. 2:</strong> Umum 6–11 + Yayasan 1
            </span>
            <span className="px-2 py-0.5 bg-white border border-purple-200 text-purple-800 rounded-md font-medium">
              <strong>Hal. 3:</strong> Yayasan 2–5+
            </span>
          </div>
        </div>

        {/* TOOLBAR & TABS */}
        <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('semua')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'semua'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({umum.length + yayasan.length})
            </button>
            <button
              onClick={() => setActiveTab('umum')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'umum'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mata Pelajaran Umum ({umum.length})
            </button>
            <button
              onClick={() => setActiveTab('yayasan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'yayasan'
                  ? 'bg-white text-purple-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Muatan Yayasan ({yayasan.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-2xs"
              title="Kembalikan urutan sesuai format standar Al-Irsyad"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset ke Standar Al-Irsyad
            </button>

            {activeTab !== 'semua' && (
              <button
                type="button"
                onClick={() => handleSortAlphabetical(activeTab)}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs"
              >
                Urut A-Z
              </button>
            )}
          </div>
        </div>

        {/* LIST CONTAINER (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* TAB: SEMUA MAPEL (UNIFIED VIEW) */}
          {activeTab === 'semua' && (
            <div className="space-y-6">
              
              {/* SECTION: UMUM */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 font-sans">
                      A. MATA PELAJARAN UMUM ({umum.length} Mapel)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Ditampilkan pada Halaman 1 & Halaman 2
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs">
                  {umum.map((m, idx) => {
                    const pageInfo = getPageInfo('umum', idx);
                    return (
                      <div 
                        key={m.id} 
                        className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-slate-800 truncate font-sans">
                              {m.nama}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${pageInfo.badgeColor}`}>
                                {pageInfo.page}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ID: {m.id}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Quick Switch category */}
                          <button
                            type="button"
                            onClick={() => handleSwitchCategory(m.id, 'umum')}
                            className="text-[10px] px-2 py-1 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg border border-slate-200 font-medium transition"
                            title="Pindah ke kelompok Muatan Yayasan"
                          >
                            Jadikan Yayasan
                          </button>

                          {/* Re-order buttons */}
                          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleMoveUmum(idx, 'top')}
                              disabled={idx === 0}
                              className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition"
                              title="Paling Atas"
                            >
                              <ChevronsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveUmum(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition border-l border-slate-150"
                              title="Naik Satu Tingkat"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveUmum(idx, 'down')}
                              disabled={idx === umum.length - 1}
                              className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition border-l border-slate-150"
                              title="Turun Satu Tingkat"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveUmum(idx, 'bottom')}
                              disabled={idx === umum.length - 1}
                              className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition border-l border-slate-150"
                              title="Paling Bawah"
                            >
                              <ChevronsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION: YAYASAN */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 font-sans">
                      B. MATA PELAJARAN CIRI KHUSUS / MUATAN YAYASAN ({yayasan.length} Mapel)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    No. {umum.length + 1} di Halaman 2, sisanya di Halaman 3
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs">
                  {yayasan.map((m, idx) => {
                    const pageInfo = getPageInfo('yayasan', idx);
                    const globalNumber = umum.length + idx + 1;
                    return (
                      <div 
                        key={m.id} 
                        className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-purple-50 text-purple-800 border border-purple-200/80 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                            {globalNumber}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-slate-800 truncate font-sans">
                              {m.nama}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${pageInfo.badgeColor}`}>
                                {pageInfo.page}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ID: {m.id}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Quick Switch category */}
                          <button
                            type="button"
                            onClick={() => handleSwitchCategory(m.id, 'yayasan')}
                            className="text-[10px] px-2 py-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-200 font-medium transition"
                            title="Pindah ke kelompok Mata Pelajaran Umum"
                          >
                            Jadikan Umum
                          </button>

                          {/* Re-order buttons */}
                          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleMoveYayasan(idx, 'top')}
                              disabled={idx === 0}
                              className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition"
                              title="Paling Atas"
                            >
                              <ChevronsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveYayasan(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition border-l border-slate-150"
                              title="Naik Satu Tingkat"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveYayasan(idx, 'down')}
                              disabled={idx === yayasan.length - 1}
                              className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition border-l border-slate-150"
                              title="Turun Satu Tingkat"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveYayasan(idx, 'bottom')}
                              disabled={idx === yayasan.length - 1}
                              className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition border-l border-slate-150"
                              title="Paling Bawah"
                            >
                              <ChevronsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB: UMUM ONLY */}
          {activeTab === 'umum' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                Gunakan tombol panah untuk menaikkan atau menurunkan posisi mapel. Mapel 1 s/d 5 akan dicetak di Halaman 1, sedangkan mapel 6 s/d 11 dicetak di Halaman 2.
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs">
                {umum.map((m, idx) => {
                  const pageInfo = getPageInfo('umum', idx);
                  return (
                    <div key={m.id} className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-slate-800 font-sans">{m.nama}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${pageInfo.badgeColor} mt-0.5 inline-block`}>
                            {pageInfo.page}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSwitchCategory(m.id, 'umum')}
                          className="text-[10px] px-2 py-1 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg border border-slate-200 font-medium"
                        >
                          Pindah ke Yayasan
                        </button>
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                          <button onClick={() => handleMoveUmum(idx, 'up')} disabled={idx === 0} className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleMoveUmum(idx, 'down')} disabled={idx === umum.length - 1} className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 border-l border-slate-150">
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: YAYASAN ONLY */}
          {activeTab === 'yayasan' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                Mapel nomor 1 (paling atas) akan dicetak pada tabel bawah Halaman 2 raport (misal: Fiqih). Mapel berikutnya akan dicetak pada Halaman 3 raport.
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs">
                {yayasan.map((m, idx) => {
                  const pageInfo = getPageInfo('yayasan', idx);
                  const globalNumber = umum.length + idx + 1;
                  return (
                    <div key={m.id} className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-purple-50 text-purple-800 border border-purple-200/80 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                          {globalNumber}
                        </span>
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-slate-800 font-sans">{m.nama}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${pageInfo.badgeColor} mt-0.5 inline-block`}>
                            {pageInfo.page}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSwitchCategory(m.id, 'yayasan')}
                          className="text-[10px] px-2 py-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-200 font-medium"
                        >
                          Pindah ke Umum
                        </button>
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                          <button onClick={() => handleMoveYayasan(idx, 'up')} disabled={idx === 0} className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleMoveYayasan(idx, 'down')} disabled={idx === yayasan.length - 1} className="p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 border-l border-slate-150">
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            {saveSuccess && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-600" />
                Urutan Mapel berhasil disimpan dan diperbarui di seluruh Raport!
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <Check className="w-4 h-4" />
              Simpan Urutan Mapel
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
