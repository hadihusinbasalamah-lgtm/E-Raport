/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SchemaDatabase, TujuanPembelajaran, NilaiSiswa, Siswa } from '../types';
import { Edit3, CheckCircle, Save, Award, RefreshCw, Zap, Printer, X, AlertTriangle } from 'lucide-react';

interface GuruNilaiProps {
  db: SchemaDatabase;
  guruId: string;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function GuruNilai({ db, guruId, onUpdate }: GuruNilaiProps) {
  const activePeriod = db.periodList.find(p => p.id === db.activePeriodId);
  const getFullTipeUjian = () => {
    const tipe = activePeriod?.tipeUjian;
    if (!tipe) return '';
    switch (tipe) {
      case 'PSTS1': return 'PENILAIAN SUMATIF TENGAH SEMESTER 1';
      case 'PSAS1': return 'PENILAIAN SUMATIF AKHIR SEMESTER 1';
      case 'PSTS2': return 'PENILAIAN SUMATIF TENGAH SEMESTER 2';
      case 'PSAT': return 'PENILAIAN SUMATIF AKHIR TAHUN';
      default: return (tipe as string).toUpperCase();
    }
  };
  const teacher = db.guru.find(g => g.id === guruId);
  const activeTeacher = activePeriod?.snapshotGuru.find(g => g.id === guruId) || teacher;

  if (!activePeriod) {
    return (
      <div className="p-8 text-center bg-amber-50 rounded-2xl border border-amber-200 text-amber-900">
        <h3 className="text-sm font-bold">Periode Akademik Aktif Belum Dirilis oleh Admin</h3>
        <p className="text-xs text-slate-500 mt-1">Lembaga Administrasi Akademik harus merilis Tahun Ajaran sebelum Guru dapat melakukan entri Nilai.</p>
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

  const formattedReportDate = new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'});

  // Build assignments list
  const assignments: { key: string; mapelId: string; mapelNama: string; kelasId: string; kelasNama: string }[] = [];

  const mapel1Obj = activePeriod.snapshotMapel.find(m => m.id === activeTeacher.mapel1Id);
  if (mapel1Obj) {
    const classIds1 = activeTeacher.mapel1KelasIds && activeTeacher.mapel1KelasIds.length > 0
      ? activeTeacher.mapel1KelasIds
      : (activeTeacher.mapel1KelasId ? [activeTeacher.mapel1KelasId] : []);
    
    classIds1.forEach((cid, index) => {
      const kelasObj = activePeriod.snapshotKelas.find(k => k.id === cid);
      if (kelasObj) {
        assignments.push({
          key: `as1_${index}_${cid}`,
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
      
      classIds2.forEach((cid, index) => {
        const kelasObj = activePeriod.snapshotKelas.find(k => k.id === cid);
        if (kelasObj) {
          assignments.push({
            key: `as2_${index}_${cid}`,
            mapelId: activeTeacher.mapel2Id,
            mapelNama: mapel2Obj.nama,
            kelasId: cid,
            kelasNama: kelasObj.nama
          });
        }
      });
    }
  }

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [tempIdx, setTempIdx] = useState(0);
  const activeAssignment = assignments[selectedIdx] || assignments[0];

  // Local state representing the grades form grid
  // Keyed by studentId
  interface LocalNilaiSiswa {
    siswaId: string;
    siswaNama: string;
    tp1Nilai: number | '';
    tp2Nilai: number | '';
    tp3Nilai?: number | '';
    tp4Nilai?: number | '';
    nilaiUjian: number | '';
    capaianKompetensi: string;
  }

  const [grades, setGrades] = useState<LocalNilaiSiswa[]>([]);
  const [activeTPs, setActiveTPs] = useState<TujuanPembelajaran | null>(null);
  const [message, setMessage] = useState('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Fetch TujuanPembelajaran setting & Populate students currently enrolled
  useEffect(() => {
    if (!activeAssignment) return;

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

    const targetJenjang = getJenjang(activeAssignment.kelasNama);

    // 1. Get TPs defined (by level/jenjang OR specific class ID for legacy)
    const tpRef = db.tujuanPembelajaran.find(
      t => t.periodeId === activePeriod.id &&
           t.guruId === guruId &&
           t.mapelId === activeAssignment.mapelId &&
           (t.kelasId === targetJenjang || t.kelasId === activeAssignment.kelasId)
    );
    setActiveTPs(tpRef || null);

    // 2. Fetch roster of students in this class in the snapshotted period
    const roster = activePeriod.snapshotSiswa.filter(s => s.kelasId === activeAssignment.kelasId);

    // 3. For each student, find existing grades in Master Database if any
    const localGrades: LocalNilaiSiswa[] = roster.map(student => {
      const gradeLookupKey = `${activePeriod.id}_${student.id}_${activeAssignment.mapelId}`;
      const existingGrade = db.nilaiSiswa.find(n => n.id === gradeLookupKey);

      return {
        siswaId: student.id,
        siswaNama: student.nama,
        tp1Nilai: existingGrade ? existingGrade.tp1Nilai : '',
        tp2Nilai: existingGrade ? existingGrade.tp2Nilai : '',
        tp3Nilai: (existingGrade && existingGrade.tp3Nilai !== undefined) ? existingGrade.tp3Nilai : (tpRef?.tp3 ? '' : undefined),
        tp4Nilai: (existingGrade && existingGrade.tp4Nilai !== undefined) ? existingGrade.tp4Nilai : (tpRef?.tp4 ? '' : undefined),
        nilaiUjian: existingGrade ? existingGrade.nilaiUjian : '',
        capaianKompetensi: existingGrade?.capaianKompetensi || ''
      };
    });

    setGrades(localGrades);
    setMessage('');
  }, [selectedIdx, activePeriod.id, guruId, db.nilaiSiswa, db.tujuanPembelajaran]);

  // Handle individual numeric inputs
  const handleNumChange = (studentId: string, field: 'tp1Nilai' | 'tp2Nilai' | 'tp3Nilai' | 'tp4Nilai' | 'nilaiUjian', value: string) => {
    const rawVal = value === '' ? '' : Math.min(100, Math.max(0, parseInt(value) || 0));
    setGrades(prev => prev.map(g => {
      if (g.siswaId === studentId) {
        return { ...g, [field]: rawVal };
      }
      return g;
    }));
  };

  // Handle description change
  const handleDescChange = (studentId: string, value: string) => {
    setGrades(prev => prev.map(g => {
      if (g.siswaId === studentId) {
        return { ...g, capaianKompetensi: value };
      }
      return g;
    }));
  };

  // Helper calculation for display
  const calculateNilaiAkhirLocal = (g: LocalNilaiSiswa) => {
    const tp1 = g.tp1Nilai === '' ? 0 : g.tp1Nilai;
    const tp2 = g.tp2Nilai === '' ? 0 : g.tp2Nilai;
    let sumTP = tp1 + tp2;
    let countTP = 2;
    if (g.tp3Nilai !== undefined && g.tp3Nilai !== '' && activeTPs?.tp3) {
      sumTP += g.tp3Nilai;
      countTP++;
    }
    if (g.tp4Nilai !== undefined && g.tp4Nilai !== '' && activeTPs?.tp4) {
      sumTP += g.tp4Nilai;
      countTP++;
    }
    const avgTP = sumTP / countTP;
    const ujian = g.nilaiUjian === '' ? 0 : g.nilaiUjian;
    return Math.round((avgTP + ujian) / 2);
  };

  const getAvgTP = (g: LocalNilaiSiswa) => {
    const tp1 = g.tp1Nilai === '' ? 0 : g.tp1Nilai;
    const tp2 = g.tp2Nilai === '' ? 0 : g.tp2Nilai;
    let sumTP = tp1 + tp2;
    let countTP = 2;
    if (g.tp3Nilai !== undefined && g.tp3Nilai !== '' && activeTPs?.tp3) {
      sumTP += g.tp3Nilai;
      countTP++;
    }
    if (g.tp4Nilai !== undefined && g.tp4Nilai !== '' && activeTPs?.tp4) {
      sumTP += g.tp4Nilai;
      countTP++;
    }
    return Math.round((sumTP / countTP) * 10) / 10;
  };

  const getDuplicateTPFields = (g: LocalNilaiSiswa) => {
    const activeFields: { field: 'tp1Nilai' | 'tp2Nilai' | 'tp3Nilai' | 'tp4Nilai'; val: number | '' }[] = [];
    activeFields.push({ field: 'tp1Nilai', val: g.tp1Nilai });
    activeFields.push({ field: 'tp2Nilai', val: g.tp2Nilai });
    if (g.tp3Nilai !== undefined && activeTPs?.tp3) {
      activeFields.push({ field: 'tp3Nilai', val: g.tp3Nilai });
    }
    if (g.tp4Nilai !== undefined && activeTPs?.tp4) {
      activeFields.push({ field: 'tp4Nilai', val: g.tp4Nilai });
    }

    const filledFields = activeFields.filter(item => item.val !== '');

    const counts: Record<number, number> = {};
    filledFields.forEach(item => {
      const numericVal = Number(item.val);
      counts[numericVal] = (counts[numericVal] || 0) + 1;
    });

    const duplicates = new Set<'tp1Nilai' | 'tp2Nilai' | 'tp3Nilai' | 'tp4Nilai'>();
    filledFields.forEach(item => {
      const numericVal = Number(item.val);
      if (counts[numericVal] > 1) {
        duplicates.add(item.field);
      }
    });

    return duplicates;
  };

  // Auto Generate Deskripsi (Kurikulum Merdeka generator)
  const handleAutoGenerateDesc = (studentId: string) => {
    const record = grades.find(g => g.siswaId === studentId);
    if (!record || !activeTPs) return;

    const tp1 = record.tp1Nilai === '' ? 0 : record.tp1Nilai;
    const tp2 = record.tp2Nilai === '' ? 0 : record.tp2Nilai;

    // Collate all active scores
    const items: { label: string; score: number }[] = [
      { label: activeTPs.tp1, score: tp1 },
      { label: activeTPs.tp2, score: tp2 }
    ];
    if (record.tp3Nilai !== undefined && record.tp3Nilai !== '' && activeTPs.tp3) {
      items.push({ label: activeTPs.tp3, score: record.tp3Nilai });
    }
    if (record.tp4Nilai !== undefined && record.tp4Nilai !== '' && activeTPs.tp4) {
      items.push({ label: activeTPs.tp4, score: record.tp4Nilai });
    }

    // Sort to find best and weakest
    const sorted = [...items].sort((a,b) => b.score - a.score);
    const best = sorted[0];
    const weakest = sorted[sorted.length - 1];

    let desc = '';
    if (best.score >= 80) {
      desc += `Menunjukan penguasaan sangat baik dalam ${best.label.toLowerCase()}.`;
    } else {
      desc += `Menunjukkan penguasaan yang cukup baik dalam hal ${best.label.toLowerCase()}.`;
    }

    if (best !== weakest) {
      desc += ` Serta perlu bimbingan dalam ${weakest.label.toLowerCase()}.`;
    }

    setGrades(prev => prev.map(g => {
      if (g.siswaId === studentId) {
        return { ...g, capaianKompetensi: desc };
      }
      return g;
    }));
  };

  const handleSaveAll = () => {
    if (!activeAssignment) return;

    // Check if any student has duplicate TP values
    const duplicateList: string[] = [];
    for (const g of grades) {
      if (getDuplicateTPFields(g).size > 0) {
        duplicateList.push(g.siswaNama);
      }
    }

    if (duplicateList.length > 0) {
      alert(`Gagal Menyimpan!\n\nSiswa berikut memiliki nilai TP yang sama/duplikat:\n${duplicateList.map(name => `• ${name}`).join('\n')}\n\nTiap siswa tidak boleh memiliki nilai TP yang sama. Sila ubah nilai TP yang diduplikat (ditandai dengan warna merah) sebelum menyimpan.`);
      setMessage("Gagal menyimpan: Terdeteksi nilai TP sama/duplikat pada siswa!");
      return;
    }

    // Convert local grades to the schema's NilaiSiswa structures
    const updatedEntries: NilaiSiswa[] = grades.map(g => {
      const dbKey = `${activePeriod.id}_${g.siswaId}_${activeAssignment.mapelId}`;
      const finalVal = calculateNilaiAkhirLocal(g);
      
      return {
        id: dbKey,
        periodeId: activePeriod.id,
        siswaId: g.siswaId,
        mapelId: activeAssignment.mapelId,
        guruId: guruId,
        tp1Nilai: g.tp1Nilai === '' ? 0 : g.tp1Nilai,
        tp2Nilai: g.tp2Nilai === '' ? 0 : g.tp2Nilai,
        tp3Nilai: g.tp3Nilai === '' || g.tp3Nilai === undefined ? undefined : g.tp3Nilai,
        tp4Nilai: g.tp4Nilai === '' || g.tp4Nilai === undefined ? undefined : g.tp4Nilai,
        nilaiUjian: g.nilaiUjian === '' ? 0 : g.nilaiUjian,
        nilaiAkhir: finalVal,
        capaianKompetensi: g.capaianKompetensi
      };
    });

    // Merge into db
    const updatedKeys = updatedEntries.map(e => e.id);
    const filteredMasterNilai = db.nilaiSiswa.filter(master => !updatedKeys.includes(master.id));
    const mergedNilaiList = [...filteredMasterNilai, ...updatedEntries];

    onUpdate({
      ...db,
      nilaiSiswa: mergedNilaiList
    });

    setMessage("Semua nilai siswa untuk kelas ini BERHASIL disimpan ke database master!");
  };

  if (assignments.length === 0) {
    return (
      <div className="p-8 text-center bg-amber-50 rounded-2xl text-slate-500">
        Anda belum mengampu pengajaran apapun di semester ini.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-emerald-600" />
            Buku Nilai & Capaian (Sikap/Matriks)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Input Nilai Kertas Kerja TP & Ujian Sumatif Raport Akhis Semester SMP Al Irsyad Surakarta.
          </p>
        </div>
        {activeTPs && grades.length > 0 && (
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-center">
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all justify-center"
            >
              <Printer className="w-4 h-4" />
              Print Rekap Kelas
            </button>
            <button
              onClick={handleSaveAll}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all justify-center"
            >
              <Save className="w-4 h-4" />
              Simpan Semua Nilai
            </button>
          </div>
        )}
      </div>

      {/* Selector Assignment Dropdown with Tampilkan button */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-end gap-3 max-w-xl shadow-3xs">
        <div className="flex-1 w-full space-y-1.5">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            PILIH MATA PELAJARAN & KELAS
          </label>
          <select
            value={tempIdx}
            onChange={(e) => setTempIdx(parseInt(e.target.value) || 0)}
            className="w-full text-xs font-semibold py-2 px-3 bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded-xl text-slate-800 shadow-3xs"
          >
            {assignments.map((as, idx) => (
              <option key={as.key} value={idx}>
                {as.mapelNama} — Kelas {as.kelasNama}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setSelectedIdx(tempIdx)}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md active:scale-95 transition-all w-full sm:w-auto shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Tampilkan
        </button>
      </div>

      {!activeTPs ? (
        <div className="p-6 text-center bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 space-y-2">
          <h3 className="text-sm font-bold">Harap Input Tujuan Pembelajaran (TP) Terlebih Dahulu</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Sebelum memasukkan nilai siswa untuk subjek <strong>{activeAssignment?.mapelNama} ({activeAssignment?.kelasNama})</strong>, Anda diwajibkan menyusun Tujuan Pembelajaran kurikulum di menu <b>Tujuan Pembelajaran</b> terlebih dahulu.
          </p>
        </div>
      ) : grades.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl text-slate-400 font-sans italic">
          Tidak ada siswa terdaftar dalam kelas {activeAssignment.kelasNama} di snapshot periode ini. Hubungi Admin.
        </div>
      ) : (
        <div className="space-y-4">
          
          {message && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-250 text-xs font-semibold rounded-xl flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              {message}
            </div>
          )}

          {/* Quick Info Box about current TPs */}
          <div className="bg-emerald-50/30 p-4 border border-emerald-100/40 rounded-xl">
            <h4 className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider mb-2">Tujuan Pembelajaran Terdefinisi:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-emerald-900 leading-relaxed font-sans font-medium">
              <div>• <strong>TP 1:</strong> {activeTPs.tp1}</div>
              <div>• <strong>TP 2:</strong> {activeTPs.tp2}</div>
              {activeTPs.tp3 && <div>• <strong>TP 3:</strong> {activeTPs.tp3}</div>}
              {activeTPs.tp4 && <div>• <strong>TP 4:</strong> {activeTPs.tp4}</div>}
            </div>
          </div>

          {/* Grid List for Students Grade Entry */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-bold tracking-wider uppercase">
                    <th className="py-3 px-4 w-1/5">Nama Siswa</th>
                    <th className="py-3 px-3 text-center w-12 font-mono">Nilai TP1</th>
                    <th className="py-3 px-3 text-center w-12 font-mono">Nilai TP2</th>
                    {activeTPs.tp3 && <th className="py-3 px-3 text-center w-12 font-mono">Nilai TP3</th>}
                    {activeTPs.tp4 && <th className="py-3 px-3 text-center w-12 font-mono">Nilai TP4</th>}
                    <th className="py-3 px-3 text-center w-12 font-mono">Nilai Ujian</th>
                    <th className="py-3 px-3 text-center w-14 font-semibold text-emerald-700">Nilai Akhir</th>
                    <th className="py-3 px-4 w-[35%]">Deskripsi Capaian Kompetensi (Kurikulum Merdeka)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {grades.map((g, idx) => {
                    const finalGrade = calculateNilaiAkhirLocal(g);
                    const dups = getDuplicateTPFields(g);
                    return (
                      <tr key={g.siswaId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 text-xs">{g.siswaNama}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex flex-col items-start gap-1">
                            <span>NIS: {activePeriod.snapshotSiswa.find(s => s.id === g.siswaId)?.nis || '-'}</span>
                            {dups.size > 0 && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded animate-pulse">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Nilai TP Duplikat
                              </span>
                            )}
                          </div>
                        </td>
                        
                        {/* TP 1 */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={g.tp1Nilai}
                            onChange={e => handleNumChange(g.siswaId, 'tp1Nilai', e.target.value)}
                            placeholder="0"
                            title={dups.has('tp1Nilai') ? "Nilai TP-1 duplikat dengan nilai TP lain pada siswa ini!" : undefined}
                            className={`w-12 text-center py-1 rounded text-xs focus:outline-none focus:ring-1 ${
                              dups.has('tp1Nilai')
                                ? 'border-2 border-rose-500 bg-rose-50 text-rose-900 font-bold focus:ring-rose-500'
                                : 'bg-slate-50 border border-slate-200 focus:ring-emerald-500 text-slate-800'
                            }`}
                          />
                        </td>

                        {/* TP 2 */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={g.tp2Nilai}
                            onChange={e => handleNumChange(g.siswaId, 'tp2Nilai', e.target.value)}
                            placeholder="0"
                            title={dups.has('tp2Nilai') ? "Nilai TP-2 duplikat dengan nilai TP lain pada siswa ini!" : undefined}
                            className={`w-12 text-center py-1 rounded text-xs focus:outline-none focus:ring-1 ${
                              dups.has('tp2Nilai')
                                ? 'border-2 border-rose-500 bg-rose-50 text-rose-900 font-bold focus:ring-rose-500'
                                : 'bg-slate-50 border border-slate-200 focus:ring-emerald-500 text-slate-800'
                            }`}
                          />
                        </td>

                        {/* TP 3 if exists */}
                        {activeTPs.tp3 && (
                          <td className="py-3 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={g.tp3Nilai ?? ''}
                              onChange={e => handleNumChange(g.siswaId, 'tp3Nilai', e.target.value)}
                              placeholder="0"
                              title={dups.has('tp3Nilai') ? "Nilai TP-3 duplikat dengan nilai TP lain pada siswa ini!" : undefined}
                              className={`w-12 text-center py-1 rounded text-xs focus:outline-none focus:ring-1 ${
                                dups.has('tp3Nilai')
                                  ? 'border-2 border-rose-500 bg-rose-50 text-rose-900 font-bold focus:ring-rose-500'
                                  : 'bg-slate-50 border border-slate-200 focus:ring-emerald-500 text-slate-800'
                              }`}
                            />
                          </td>
                        )}

                        {/* TP 4 if exists */}
                        {activeTPs.tp4 && (
                          <td className="py-3 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={g.tp4Nilai ?? ''}
                              onChange={e => handleNumChange(g.siswaId, 'tp4Nilai', e.target.value)}
                              placeholder="0"
                              title={dups.has('tp4Nilai') ? "Nilai TP-4 duplikat dengan nilai TP lain pada siswa ini!" : undefined}
                              className={`w-12 text-center py-1 rounded text-xs focus:outline-none focus:ring-1 ${
                                dups.has('tp4Nilai')
                                  ? 'border-2 border-rose-500 bg-rose-50 text-rose-900 font-bold focus:ring-rose-500'
                                  : 'bg-slate-50 border border-slate-200 focus:ring-emerald-500 text-slate-800'
                              }`}
                            />
                          </td>
                        )}

                        {/* Nilai Ujian */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={g.nilaiUjian}
                            onChange={e => handleNumChange(g.siswaId, 'nilaiUjian', e.target.value)}
                            placeholder="0"
                            className="w-12 text-center py-1 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded text-xs font-semibold"
                          />
                        </td>

                        {/* Nilai Akhir */}
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block w-10 text-center py-1 font-bold rounded ${
                            finalGrade >= 75 
                              ? 'bg-emerald-50 text-emerald-800' 
                              : 'bg-rose-50 text-rose-700'
                          }`}>
                            {finalGrade}
                          </span>
                        </td>

                        {/* Capaian Deskripsi */}
                        <td className="py-3 px-4">
                          <div className="flex gap-1.5 items-start">
                            <textarea
                              rows={2}
                              value={g.capaianKompetensi}
                              onChange={e => handleDescChange(g.siswaId, e.target.value)}
                              placeholder="Tulis capaian atau klik generate otomatis..."
                              className="flex-1 px-2.5 py-1 text-[11px] leading-snug border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 h-11"
                            />
                            <button
                              type="button"
                              onClick={() => handleAutoGenerateDesc(g.siswaId)}
                              title="Generate Otomatis Berdasarkan Nilai Kompetensi"
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-55 border border-emerald-100 rounded-lg hover:border-emerald-300 transition-colors shrink-0 flex items-center h-8 my-auto self-center"
                            >
                              <Zap className="w-3.5 h-3.5 fill-emerald-100" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end items-center gap-3">
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-600/10 active:scale-95 transition-all inline-flex items-center gap-1.5 border border-sky-500/10"
              >
                <Printer className="w-4 h-4" />
                Cetak / Print Data Kelas
              </button>
              <button
                onClick={handleSaveAll}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/10 active:scale-95 transition-all inline-flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                Simpan Desk Kerja & Nilai Raport
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal for GuruNilai */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn print:bg-white print:p-0 print:static print:block overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl relative my-8 flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:my-0 print:rounded-none">
            
            {/* Modal Controls Bar */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0 bg-slate-50 rounded-t-2xl print:hidden">
              <div>
                <h3 className="font-bold text-xs text-slate-800">Pratinjau Cetak Nilai Kelas</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Mata Pelajaran: {activeAssignment?.mapelNama} — Kelas: {activeAssignment?.kelasNama}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const printContent = document.getElementById('print-guru-nilai-area');
                    if (!printContent) return;

                    const existing = document.getElementById('print-helper-area');
                    if (existing) {
                      existing.remove();
                    }

                    // Create a clean container outside of React root
                    const printHelper = document.createElement('div');
                    printHelper.id = 'print-helper-area';
                    
                    // Clone content
                    printHelper.innerHTML = printContent.innerHTML;
                    
                    // Apply CSS directly to the helper element during screen preview & printing
                    const helperStyle = document.createElement('style');
                    helperStyle.id = 'print-helper-styles';
                    helperStyle.innerHTML = `
                      @media print {
                        body {
                          background: #ffffff !important;
                          color: #000000 !important;
                          -webkit-print-color-adjust: exact !important;
                          print-color-adjust: exact !important;
                        }
                        /* Hide absolutely everything at body root level except the print area */
                        body > *:not(#print-helper-area) {
                          display: none !important;
                          height: 0 !important;
                          overflow: hidden !important;
                          visibility: hidden !important;
                        }
                        #print-helper-area {
                          display: block !important;
                          width: 210mm !important;
                          min-height: 297mm !important;
                          padding: 10mm 12mm !important;
                          margin: 0 auto !important;
                          box-sizing: border-box !important;
                          background: #ffffff !important;
                          color: #000000 !important;
                        }
                        @page {
                          size: A4 portrait !important;
                          margin: 0 !important;
                        }
                        .print-no-break {
                          break-inside: avoid !important;
                        }
                        table {
                          border-collapse: collapse !important;
                          width: 100% !important;
                        }
                        table, th, td {
                          border: 1px solid #000000 !important;
                        }
                        td, th {
                          color: #000000 !important;
                          font-size: 11px !important;
                          padding: 3px 5px !important;
                          line-height: 1.15 !important;
                        }
                        th {
                          font-weight: bold !important;
                          background-color: #f8fafc !important;
                          -webkit-print-color-adjust: exact !important;
                          print-color-adjust: exact !important;
                        }
                      }
                    `;

                    document.head.appendChild(helperStyle);
                    document.body.appendChild(printHelper);
                    document.body.classList.add('printing-active');

                    // Execute print
                    setTimeout(() => {
                      window.print();
                      
                      // Small delay after print trigger to restore normal look (cleanup)
                      setTimeout(() => {
                        printHelper.remove();
                        helperStyle.remove();
                        document.body.classList.remove('printing-active');
                      }, 500);
                    }, 100);
                  }}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak / Print PDF
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1 px-2.5 text-slate-450 hover:text-slate-800 rounded bg-slate-100 hover:bg-slate-200 font-bold transition-colors text-xs flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Tutup
                </button>
              </div>
            </div>

            {/* Scrollable Print Contents */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 text-black bg-slate-100/20 font-sans print:p-0 print:bg-white print:overflow-visible">
              <div id="print-guru-nilai-area" className="w-full bg-white border border-slate-200/50 p-6 sm:p-8 shadow-md rounded-lg text-[12px] leading-relaxed relative print:shadow-none print:border-none print:p-0 print:w-full">
                
                {/* Table Title */}
                <div className="text-center mb-4">
                  <h3 className="text-[16px] font-extrabold tracking-wider uppercase">
                    DAFTAR NILAI DAN CAPAIAN KOMPETENSI (NILAI GURU)
                  </h3>
                  <p className="text-[16px] font-bold tracking-wide uppercase mt-1">
                    {getFullTipeUjian()}
                  </p>
                  <p className="text-[16px] font-bold tracking-wide uppercase mt-1">
                    TAHUN AJARAN {activePeriod?.tahunAjaran}
                  </p>
                </div>

                {/* Info Metadata */}
                <div className="grid grid-cols-2 gap-4 mb-3 border border-black/10 p-3 rounded-lg bg-slate-50/50 text-[12px] font-medium print:bg-white print:border-black/20">
                  <div className="space-y-1">
                    <div>Mata Pelajaran : <span className="font-bold">{activeAssignment?.mapelNama}</span></div>
                    <div>Kelas/Semester : <span className="font-bold">{activeAssignment?.kelasNama} / {activePeriod?.semester}</span></div>
                    <div>Tahun Pelajaran : <span className="font-mono">{activePeriod?.tahunAjaran}</span></div>
                  </div>
                  <div className="space-y-1">
                    <div>Nama Guru Pengampu : <span className="font-semibold">{activeTeacher?.nama}</span></div>
                    <div>NIK Guru : <span className="font-mono">{activeTeacher?.username || '-'}</span></div>
                    <div>Jenis Penilaian : <span className="font-bold uppercase font-mono text-emerald-800 print:text-black">{activePeriod?.tipeUjian}</span></div>
                  </div>
                </div>

                {/* List of Tujuan Pembelajaran (TP) for printing reference */}
                <div className="mb-3 text-[11px] border border-dashed border-slate-200 p-2 rounded bg-slate-50/30 print:border-black/10">
                  <span className="font-bold block text-slate-800 mb-1 text-[11.5px]">DAFTAR TUJUAN PEMBELAJARAN (TP) :</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-slate-600">
                    <div>1. TP 1: {activeTPs?.tp1}</div>
                    <div>2. TP 2: {activeTPs?.tp2}</div>
                    {activeTPs?.tp3 && <div>3. TP 3: {activeTPs?.tp3}</div>}
                    {activeTPs?.tp4 && <div>4. TP 4: {activeTPs?.tp4}</div>}
                  </div>
                </div>

                {/* Main Print Data Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-black text-center text-[12px]">
                    <thead>
                      <tr className="bg-slate-100 uppercase font-bold text-slate-800 print:bg-white print:text-black">
                        <th className="border border-black py-1.5 px-1 w-10">No Urut</th>
                        <th className="border border-black py-1.5 px-2 w-20">No Induk</th>
                        <th className="border border-black py-1.5 px-1 w-8 font-sans">L/P</th>
                        <th className="border border-black py-1.5 px-2 text-left w-48">Nama Siswa</th>
                        <th className="border border-black py-1.5 px-1 w-16">Nilai TP 1</th>
                        <th className="border border-black py-1.5 px-1 w-16">Nilai TP 2</th>
                        {activeTPs?.tp3 && <th className="border border-black py-1.5 px-1 w-16">Nilai TP 3</th>}
                        {activeTPs?.tp4 && <th className="border border-black py-1.5 px-1 w-16">Nilai TP 4</th>}
                        <th className="border border-black py-1.5 px-2 w-20">Nilai {activePeriod?.tipeUjian || 'Ujian'}</th>
                        <th className="border border-black py-1.5 px-2 w-20 bg-emerald-50 text-emerald-950/90 print:bg-white print:text-black font-extrabold">Nilai Raport</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map((g, idx) => {
                        const studentDetails = activePeriod.snapshotSiswa.find(s => s.id === g.siswaId);
                        const noInduk = studentDetails?.nis || studentDetails?.nisn || '-';
                        const gender = studentDetails?.jenisKelamin || '-';

                        const tp1Val = g.tp1Nilai === '' ? '-' : g.tp1Nilai;
                        const tp2Val = g.tp2Nilai === '' ? '-' : g.tp2Nilai;
                        const tp3Val = g.tp3Nilai !== undefined ? (g.tp3Nilai === '' ? '-' : g.tp3Nilai) : null;
                        const tp4Val = g.tp4Nilai !== undefined ? (g.tp4Nilai === '' ? '-' : g.tp4Nilai) : null;
                        
                        const rerataTP = getAvgTP(g);
                        const wrapUjian = g.nilaiUjian === '' ? '-' : g.nilaiUjian;
                        const naVal = calculateNilaiAkhirLocal(g);
 
                        return (
                          <tr key={g.siswaId} className="hover:bg-slate-50/50 print:hover:bg-white">
                            <td className="border border-black py-1 px-1 font-mono">{idx + 1}</td>
                            <td className="border border-black py-1 px-2 font-mono">{noInduk}</td>
                            <td className="border border-black py-1 px-1 font-sans">{gender}</td>
                            <td className="border border-black py-1 px-2 text-left font-semibold uppercase">{g.siswaNama}</td>
                            <td className="border border-black py-1 px-1 font-mono">{tp1Val}</td>
                            <td className="border border-black py-1 px-1 font-mono">{tp2Val}</td>
                            {tp3Val !== null && <td className="border border-black py-1 px-1 font-mono">{tp3Val}</td>}
                            {tp4Val !== null && <td className="border border-black py-1 px-1 font-mono">{tp4Val}</td>}
                            <td className="border border-black py-1 px-1 font-mono">{wrapUjian}</td>
                            <td className="border border-black py-1 px-1 font-mono font-bold bg-emerald-50/40 text-emerald-900 print:bg-white print:text-black">{naVal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Signature */}
                <div className="mt-6 flex justify-between items-start text-[12px] px-8 print:mt-6 print:px-4">
                  <div className="text-center flex flex-col items-center w-64 print:w-72">
                    <p className="font-semibold text-[12px]">Mengetahui,</p>
                    <p className="font-semibold text-[12px]">Kepala Sekolah</p>
                    <div className="h-14 print:h-11" />
                    <p className="font-bold underline text-[12px]">Andreas Raymonda, S.Pd, M.Hum</p>
                    <p className="text-[10.5px] text-slate-500 font-mono mt-0.5">NIK. 103.244.0072</p>
                  </div>
                  <div className="text-center flex flex-col items-center w-64 print:w-72">
                    <p className="text-[12px]">Surakarta, {formattedReportDate}</p>
                    <p className="font-semibold text-[12px]">Guru Pengampu</p>
                    <div className="h-14 print:h-11" />
                    <p className="font-bold underline text-[12px]">{activeTeacher?.nama}</p>
                    <p className="text-[10.5px] text-slate-500 font-mono mt-0.5">NIK. {activeTeacher?.username || '-'}</p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
