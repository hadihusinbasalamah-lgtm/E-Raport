/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SchemaDatabase, TujuanPembelajaran, Guru } from '../types';
import { BookOpen, Check, ListChecks, Save } from 'lucide-react';

interface GuruTPProps {
  db: SchemaDatabase;
  guruId: string;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function GuruTP({ db, guruId, onUpdate }: GuruTPProps) {
  const activePeriod = db.periodList.find(p => p.id === db.activePeriodId);
  const teacher = db.guru.find(g => g.id === guruId);

  // Determine which options (Mapel + Kelas combinations) are available based on the ACTIVE snapshot
  // It's safest to find from the activePeriod's snapshotted guru data if exists, otherwise master
  const activeTeacher = activePeriod?.snapshotGuru.find(g => g.id === guruId) || teacher;

  if (!activePeriod) {
    return (
      <div className="p-8 text-center bg-amber-50 rounded-2xl border border-amber-200 text-amber-900">
        <h3 className="text-sm font-bold">Periode Akademik Aktif Belum Dirilis oleh Admin</h3>
        <p className="text-xs text-slate-500 mt-1">Lembaga Administrasi Akademik harus merilis Tahun Ajaran sebelum Guru dapat melakukan entri TP.</p>
      </div>
    );
  }

  if (!activeTeacher) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
        Profil Pengajar tidak terdeteksi dalam database rilis ini.
      </div>
    );
  }

  // Build the list of active assignments
  interface RawAssignment {
    mapelId: string;
    mapelNama: string;
    kelasId: string;
    kelasNama: string;
  }
  const rawAssignments: RawAssignment[] = [];

  const mapel1Obj = activePeriod.snapshotMapel.find(m => m.id === activeTeacher.mapel1Id);
  if (mapel1Obj) {
    const classIds1 = activeTeacher.mapel1KelasIds && activeTeacher.mapel1KelasIds.length > 0
      ? activeTeacher.mapel1KelasIds
      : (activeTeacher.mapel1KelasId ? [activeTeacher.mapel1KelasId] : []);
    
    classIds1.forEach(cid => {
      const kelasObj = activePeriod.snapshotKelas.find(k => k.id === cid);
      if (kelasObj) {
        rawAssignments.push({
          mapelId: activeTeacher.mapel1Id,
          mapelNama: mapel1Obj.nama,
          kelasId: cid,
          kelasNama: kelasObj.nama
        });
      }
    });
  }

  if (activeTeacher.mapel2Id) {
    const mapel2Obj = activePeriod.snapshotMapel.find(m => m.id === activeTeacher.mapel2Id);
    if (mapel2Obj) {
      const classIds2 = activeTeacher.mapel2KelasIds && activeTeacher.mapel2KelasIds.length > 0
        ? activeTeacher.mapel2KelasIds
        : (activeTeacher.mapel2KelasId ? [activeTeacher.mapel2KelasId] : []);
      
      classIds2.forEach(cid => {
        const kelasObj = activePeriod.snapshotKelas.find(k => k.id === cid);
        if (kelasObj) {
          rawAssignments.push({
            mapelId: activeTeacher.mapel2Id,
            mapelNama: mapel2Obj.nama,
            kelasId: cid,
            kelasNama: kelasObj.nama
          });
        }
      });
    }
  }

  // Parse Jenjang/level of classes (e.g., VII A -> VII, VIII B -> VIII, etc.)
  const getJenjang = (kelasNama: string): string => {
    const upper = (kelasNama || '').trim().toUpperCase();
    if (upper.startsWith("VIII")) return "VIII";
    if (upper.startsWith("VII")) return "VII";
    if (upper.startsWith("IX")) return "IX";
    if (upper.startsWith("8")) return "VIII";
    if (upper.startsWith("7")) return "VII";
    if (upper.startsWith("9")) return "IX";
    return upper.split(' ')[0] || "Lainnya";
  };

  // Group by Mapel + Jenjang
  interface GroupedAssignment {
    key: string;
    mapelId: string;
    mapelNama: string;
    jenjang: string;
    kelasIds: string[];
    kelasNames: string[];
  }

  const groupedAssignments: GroupedAssignment[] = [];
  rawAssignments.forEach(raw => {
    const jen = getJenjang(raw.kelasNama);
    const existing = groupedAssignments.find(
      g => g.mapelId === raw.mapelId && g.jenjang === jen
    );
    if (existing) {
      if (!existing.kelasIds.includes(raw.kelasId)) {
        existing.kelasIds.push(raw.kelasId);
        existing.kelasNames.push(raw.kelasNama);
      }
    } else {
      groupedAssignments.push({
        key: `${raw.mapelId}_${jen}`,
        mapelId: raw.mapelId,
        mapelNama: raw.mapelNama,
        jenjang: jen,
        kelasIds: [raw.kelasId],
        kelasNames: [raw.kelasNama]
      });
    }
  });

  const [selectedIdx, setSelectedIdx] = useState(0);

  // Form Fields
  const [tp1, setTp1] = useState('');
  const [tp2, setTp2] = useState('');
  const [tp3, setTp3] = useState('');
  const [tp4, setTp4] = useState('');
  const [message, setMessage] = useState('');

  const activeAssignment = groupedAssignments[selectedIdx];

  const existing = activeAssignment
    ? db.tujuanPembelajaran.find(
        t => t.periodeId === activePeriod.id &&
             t.guruId === guruId &&
             t.mapelId === activeAssignment.mapelId &&
             (t.kelasId === activeAssignment.jenjang || activeAssignment.kelasIds.includes(t.kelasId))
      )
    : undefined;

  const hasChanges = (() => {
    if (!activeAssignment) return false;
    if (!existing) {
      return tp1.trim().length > 0 || tp2.trim().length > 0 || tp3.trim().length > 0 || tp4.trim().length > 0;
    }
    const currentTp1 = tp1.trim();
    const currentTp2 = tp2.trim();
    const currentTp3 = tp3.trim();
    const currentTp4 = tp4.trim();
    
    const origTp1 = existing.tp1 || '';
    const origTp2 = existing.tp2 || '';
    const origTp3 = existing.tp3 || '';
    const origTp4 = existing.tp4 || '';
    
    return currentTp1 !== origTp1 ||
           currentTp2 !== origTp2 ||
           currentTp3 !== origTp3 ||
           currentTp4 !== origTp4;
  })();

  // Load existing TP when assignment or activePeriod Changes
  useEffect(() => {
    if (!activeAssignment) return;
    
    const existing = db.tujuanPembelajaran.find(
      t => t.periodeId === activePeriod.id &&
           t.guruId === guruId &&
           t.mapelId === activeAssignment.mapelId &&
           (t.kelasId === activeAssignment.jenjang || activeAssignment.kelasIds.includes(t.kelasId))
    );

    if (existing) {
      setTp1(existing.tp1);
      setTp2(existing.tp2);
      setTp3(existing.tp3 || '');
      setTp4(existing.tp4 || '');
    } else {
      setTp1('');
      setTp2('');
      setTp3('');
      setTp4('');
    }
    setMessage('');
  }, [selectedIdx, activePeriod.id, guruId, activeAssignment?.mapelId, activeAssignment?.jenjang]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignment) return;

    if (!tp1.trim() || !tp2.trim()) {
      alert("Sesuai instruksi: Tujuan Pembelajaran minimal harus diisi 2 TP (TP 1 & TP 2 wajib)!");
      return;
    }

    const tpKey = `${activePeriod.id}_${guruId}_${activeAssignment.mapelId}_${activeAssignment.jenjang}`;

    const newTpEntry: TujuanPembelajaran = {
      id: tpKey,
      periodeId: activePeriod.id,
      guruId: guruId,
      mapelId: activeAssignment.mapelId,
      kelasId: activeAssignment.jenjang, // Save per level/jenjang
      tp1: tp1.trim(),
      tp2: tp2.trim(),
      tp3: tp3.trim() || undefined,
      tp4: tp4.trim() || undefined
    };

    // Filter out old records for either this exact key or any specific classes in this group
    const filteredTp = db.tujuanPembelajaran.filter(
      t => !(
        t.periodeId === activePeriod.id &&
        t.guruId === guruId &&
        t.mapelId === activeAssignment.mapelId &&
        (t.kelasId === activeAssignment.jenjang || activeAssignment.kelasIds.includes(t.kelasId))
      )
    );
    const updatedTpList = [...filteredTp, newTpEntry];

    onUpdate({
      ...db,
      tujuanPembelajaran: updatedTpList
    });

    setMessage("Tujuan Pembelajaran berhasil disimpan!");
  };

  if (groupedAssignments.length === 0) {
    return (
      <div className="p-8 text-center bg-amber-50 rounded-2xl text-slate-500">
        Anda belum mengampu kelas pengajaran apapun pada Semester Aktif ini. Hubungi Admin jika ada kesalahan pemetaan guru.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-2">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-emerald-600" />
          Input Tujuan Pembelajaran (TP)
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Definisikan deskripsi kompetensi atau Tujuan Pembelajaran (TP) kurikulum kelas mengajar Anda.
        </p>
      </div>

      {/* Selector Classes & Mapel */}
      <div className="flex gap-2 bg-slate-100/60 p-1.5 rounded-xl border border-slate-200/50 max-w-fit overflow-x-auto">
        {groupedAssignments.map((as, idx) => (
          <button
            key={as.key}
            type="button"
            onClick={() => setSelectedIdx(idx)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-sm whitespace-nowrap ${
              selectedIdx === idx
                ? 'bg-emerald-600 text-white font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {as.mapelNama} - Jenjang {as.jenjang}
          </button>
        ))}
      </div>

      {activeAssignment && (
        <div className="bg-white rounded-2xl border border-slate-150 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-start border-b border-slate-100 pb-3 gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Mata Pelajaran & Jenjang Terpilih</span>
              <strong className="text-base text-slate-800 font-sans mt-0.5 inline-block">
                {activeAssignment.mapelNama} • Jenjang {activeAssignment.jenjang}
              </strong>
              <span className="text-[11px] text-slate-500 block mt-1">
                Berlaku otomatis untuk semua kelas yang Anda ampu di jenjang ini: <span className="font-semibold text-emerald-700">{activeAssignment.kelasNames.join(', ')}</span>
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shrink-0">
              Periode: {activePeriod.id}
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {message && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border-emerald-250 text-xs font-semibold rounded-xl flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                {message}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tujuan Pembelajaran 1 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={tp1}
                  onChange={e => {
                    setTp1(e.target.value);
                    if (message) setMessage('');
                  }}
                  placeholder="e.g. Memahami konsep persamaan kuadrat dan cara menyelesaikannya"
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tujuan Pembelajaran 2 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={tp2}
                  onChange={e => {
                    setTp2(e.target.value);
                    if (message) setMessage('');
                  }}
                  placeholder="e.g. Menerapkan logaritma dalam pemecahan masalah kehidupan sehari-hari"
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tujuan Pembelajaran 3 (Opsional)</label>
                <textarea
                  rows={2}
                  value={tp3}
                  onChange={e => {
                    setTp3(e.target.value);
                    if (message) setMessage('');
                  }}
                  placeholder="Deskripsi TP 3..."
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tujuan Pembelajaran 4 (Opsional)</label>
                <textarea
                  rows={2}
                  value={tp4}
                  onChange={e => {
                    setTp4(e.target.value);
                    if (message) setMessage('');
                  }}
                  placeholder="Deskripsi TP 4..."
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">Informasi Kurikulum Merdeka:</span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Deskripsi kompetensi (TP) ini akan dijadikan dasar pemetaan nilai raport siswa. Guru disarankan memasukkan deskripsi ringkas, diawali kata kerja operasional (cth: "Memahami...", "Mengidentifikasi...", "Menganalisis...").
              </p>
            </div>

            {hasChanges && (
              <div className="text-[11px] bg-amber-50 text-amber-800 border border-amber-250 p-3 rounded-xl flex items-center gap-1.5 leading-relaxed font-semibold">
                <span className="text-sm">⚠️</span>
                <span>Terdapat pembaharuan TP yang belum disimpan. Klik tombol <strong>Simpan Pembaharuan TP</strong> di bawah untuk menerapkan perubahan Anda ke database.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!hasChanges}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 transition-all mt-4 shadow-sm active:scale-95 ${
                hasChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100 cursor-pointer hover:-translate-y-0.5'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              {hasChanges ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4 text-emerald-500" />}
              {hasChanges ? 'Simpan Pembaharuan TP' : 'Tujuan Pembelajaran Tersimpan'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
