/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { SchemaDatabase, NilaiSiswa, formatTipeUjian, Siswa, Kelas, Mapel, Guru } from '../types';
import { compareKelasNama, sortKelasList, parseKelasInfo } from '../utils/kelasOrder';
import { 
  CheckSquare, FileSpreadsheet, Download, Printer, Search, Filter, 
  Users, BookOpen, GraduationCap, CheckCircle2, AlertTriangle, Clock, 
  ChevronDown, ChevronUp, Eye, EyeOff, Sparkles, ArrowRight, Info, 
  Layers, RefreshCw, BarChart2, ShieldCheck, ArrowUpDown
} from 'lucide-react';

interface AdminCekNilaiProps {
  db: SchemaDatabase;
  onUpdate?: (updatedDb: SchemaDatabase) => void;
  onNavigateToTab?: (tabId: string) => void;
}

export function AdminCekNilai({ db, onUpdate, onNavigateToTab }: AdminCekNilaiProps) {
  const activePeriod = db.periodList.find(p => p.id === db.activePeriodId);

  // Data resolution with fallback to master
  const currentKelas: Kelas[] = useMemo(() => {
    const list = activePeriod?.snapshotKelas || db.kelas || [];
    return sortKelasList([...list]);
  }, [activePeriod, db.kelas]);

  const currentMapels: Mapel[] = useMemo(() => {
    return activePeriod?.snapshotMapel || db.mapel || [];
  }, [activePeriod, db.mapel]);

  const currentSiswa: Siswa[] = useMemo(() => {
    return activePeriod?.snapshotSiswa || db.siswa || [];
  }, [activePeriod, db.siswa]);

  const currentGurus: Guru[] = useMemo(() => {
    return activePeriod?.snapshotGuru || db.guru || [];
  }, [activePeriod, db.guru]);

  const allNilai: NilaiSiswa[] = db.nilaiSiswa || [];
  const allTPs = db.tujuanPembelajaran || [];

  // Filter States
  const [selectedTingkat, setSelectedTingkat] = useState<string>('ALL'); // ALL, 7, 8, 9
  const [selectedKelasId, setSelectedKelasId] = useState<string>(() => {
    return currentKelas.length > 0 ? currentKelas[0].id : '';
  });
  const [selectedMapelId, setSelectedMapelId] = useState<string>(() => {
    return currentMapels.length > 0 ? currentMapels[0].id : '';
  });
  const [viewMode, setViewMode] = useState<'both' | 'asli' | 'konversi'>('both');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'GRADED' | 'UNGRADED'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTabSubView, setActiveTabSubView] = useState<'detail' | 'matriks'>('detail');

  // Filtered classes according to selected tingkat (7, 8, 9)
  const filteredKelasList = useMemo(() => {
    if (selectedTingkat === 'ALL') return currentKelas;
    return currentKelas.filter(k => {
      const parsed = parseKelasInfo(k.nama);
      return String(parsed.jenjangNum) === selectedTingkat;
    });
  }, [currentKelas, selectedTingkat]);

  // Ensure selected class is valid when tingkat changes
  React.useEffect(() => {
    if (filteredKelasList.length > 0 && !filteredKelasList.some(k => k.id === selectedKelasId)) {
      setSelectedKelasId(filteredKelasList[0].id);
    }
  }, [filteredKelasList, selectedKelasId]);

  const activeKelas = currentKelas.find(k => k.id === selectedKelasId);
  const activeMapel = currentMapels.find(m => m.id === selectedMapelId);

  // Find the assigned teacher for this class & subject
  const assignedTeacher = useMemo(() => {
    if (!selectedKelasId || !selectedMapelId) return null;
    return currentGurus.find(g => {
      const c1 = g.mapel1KelasIds && g.mapel1KelasIds.length > 0
        ? g.mapel1KelasIds
        : (g.mapel1KelasId ? [g.mapel1KelasId] : []);
      if (g.mapel1Id === selectedMapelId && c1.includes(selectedKelasId)) return true;

      const c2 = g.mapel2KelasIds && g.mapel2KelasIds.length > 0
        ? g.mapel2KelasIds
        : (g.mapel2KelasId ? [g.mapel2KelasId] : []);
      if (g.mapel2Id === selectedMapelId && c2.includes(selectedKelasId)) return true;

      const c3 = g.mapel3KelasIds && g.mapel3KelasIds.length > 0
        ? g.mapel3KelasIds
        : (g.mapel3KelasId ? [g.mapel3KelasId] : []);
      if (g.mapel3Id === selectedMapelId && c3.includes(selectedKelasId)) return true;

      return false;
    });
  }, [selectedKelasId, selectedMapelId, currentGurus]);

  // Find TP defined for this subject and jenjang
  const activeTP = useMemo(() => {
    if (!activeKelas || !activeMapel || !activePeriod) return null;
    return allTPs.find(tp => {
      const periMatch = tp.periodeId === activePeriod.id;
      const mapelMatch = tp.mapelId === activeMapel.id;
      const kelasMatch = tp.kelasId === activeKelas.id;
      const teacherMatch = assignedTeacher ? tp.guruId === assignedTeacher.id : true;
      return periMatch && mapelMatch && (kelasMatch || teacherMatch);
    }) || allTPs.find(tp => tp.mapelId === activeMapel.id && tp.periodeId === activePeriod.id);
  }, [activeKelas, activeMapel, activePeriod, allTPs, assignedTeacher]);

  // Students in selected class, sorted by noAbsen then nama
  const studentsInKelas = useMemo(() => {
    if (!selectedKelasId) return [];
    return currentSiswa
      .filter(s => s.kelasId === selectedKelasId)
      .sort((a, b) => {
        const noA = a.noAbsen !== undefined && a.noAbsen !== null ? a.noAbsen : 999999;
        const noB = b.noAbsen !== undefined && b.noAbsen !== null ? b.noAbsen : 999999;
        if (noA !== noB) return noA - noB;
        return a.nama.localeCompare(b.nama);
      });
  }, [currentSiswa, selectedKelasId]);

  // Combined rows for the selected class & subject
  const detailedRows = useMemo(() => {
    if (!selectedMapelId || !activePeriod) return [];

    return studentsInKelas.map((student, idx) => {
      const record = allNilai.find(n => 
        n.siswaId === student.id && 
        n.mapelId === selectedMapelId && 
        (n.periodeId === activePeriod.id || !n.periodeId)
      );

      const hasAnyGrade = record && (
        record.tp1Nilai !== undefined || 
        record.tp1NilaiAsli !== undefined || 
        record.tp2Nilai !== undefined || 
        record.tp2NilaiAsli !== undefined || 
        record.nilaiAkhir !== undefined
      );

      const isComplete = record && 
        (record.tp1Nilai !== undefined || record.tp1NilaiAsli !== undefined) &&
        (record.tp2Nilai !== undefined || record.tp2NilaiAsli !== undefined) &&
        (record.nilaiUjian !== undefined || record.nilaiUjianAsli !== undefined) &&
        typeof record.nilaiAkhir === 'number';

      return {
        idx: idx + 1,
        noAbsen: student.noAbsen ?? (idx + 1),
        student,
        record,
        hasAnyGrade,
        isComplete,
        // TP 1
        tp1Asli: record?.tp1NilaiAsli ?? (record?.tp1Nilai !== undefined ? record.tp1Nilai : ''),
        tp1Konversi: record?.tp1Nilai ?? (record?.tp1NilaiAsli !== undefined ? record.tp1NilaiAsli : ''),
        // TP 2
        tp2Asli: record?.tp2NilaiAsli ?? (record?.tp2Nilai !== undefined ? record.tp2Nilai : ''),
        tp2Konversi: record?.tp2Nilai ?? (record?.tp2NilaiAsli !== undefined ? record.tp2NilaiAsli : ''),
        // TP 3
        tp3Asli: record?.tp3NilaiAsli ?? (record?.tp3Nilai !== undefined ? record.tp3Nilai : ''),
        tp3Konversi: record?.tp3Nilai ?? (record?.tp3NilaiAsli !== undefined ? record.tp3NilaiAsli : ''),
        // TP 4
        tp4Asli: record?.tp4NilaiAsli ?? (record?.tp4Nilai !== undefined ? record.tp4Nilai : ''),
        tp4Konversi: record?.tp4Nilai ?? (record?.tp4NilaiAsli !== undefined ? record.tp4NilaiAsli : ''),
        // Ujian
        ujianAsli: record?.nilaiUjianAsli ?? (record?.nilaiUjian !== undefined ? record.nilaiUjian : ''),
        ujianKonversi: record?.nilaiUjian ?? (record?.nilaiUjianAsli !== undefined ? record.nilaiUjianAsli : ''),
        // Final
        nilaiAkhir: typeof record?.nilaiAkhir === 'number' ? record.nilaiAkhir : '',
        capaian: record?.capaianKompetensi || ''
      };
    }).filter(row => {
      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = row.student.nama.toLowerCase().includes(q);
        const matchesNis = (row.student.nis || '').toLowerCase().includes(q);
        if (!matchesName && !matchesNis) return false;
      }
      // Status filter
      if (statusFilter === 'GRADED') return row.hasAnyGrade;
      if (statusFilter === 'UNGRADED') return !row.hasAnyGrade;
      return true;
    });
  }, [studentsInKelas, allNilai, selectedMapelId, activePeriod, searchTerm, statusFilter]);

  // Statistics for current selected class & mapel
  const classStats = useMemo(() => {
    const validRows = detailedRows.filter(r => typeof r.nilaiAkhir === 'number');
    const totalSiswa = studentsInKelas.length;
    const totalGraded = validRows.length;
    const progressPct = totalSiswa > 0 ? Math.round((totalGraded / totalSiswa) * 100) : 0;

    // Averages calculation
    const calcAvg = (getter: (r: typeof detailedRows[0]) => number | '') => {
      const numbers = detailedRows
        .map(getter)
        .filter((v): v is number => typeof v === 'number' && !isNaN(v));
      if (numbers.length === 0) return 0;
      const sum = numbers.reduce((a, b) => a + b, 0);
      return Number((sum / numbers.length).toFixed(1));
    };

    const calcMinMax = (getter: (r: typeof detailedRows[0]) => number | '') => {
      const numbers = detailedRows
        .map(getter)
        .filter((v): v is number => typeof v === 'number' && !isNaN(v));
      if (numbers.length === 0) return { min: 0, max: 0 };
      return { min: Math.min(...numbers), max: Math.max(...numbers) };
    };

    const avgTp1Asli = calcAvg(r => r.tp1Asli);
    const avgTp1Konv = calcAvg(r => r.tp1Konversi);
    const avgTp2Asli = calcAvg(r => r.tp2Asli);
    const avgTp2Konv = calcAvg(r => r.tp2Konversi);
    const avgTp3Asli = calcAvg(r => r.tp3Asli);
    const avgTp3Konv = calcAvg(r => r.tp3Konversi);
    const avgTp4Asli = calcAvg(r => r.tp4Asli);
    const avgTp4Konv = calcAvg(r => r.tp4Konversi);
    const avgUjianAsli = calcAvg(r => r.ujianAsli);
    const avgUjianKonv = calcAvg(r => r.ujianKonversi);
    const avgNilaiAkhir = calcAvg(r => r.nilaiAkhir);

    // Overall Asli average (combining all valid raw components)
    const allRawScores: number[] = [];
    detailedRows.forEach(r => {
      [r.tp1Asli, r.tp2Asli, r.tp3Asli, r.tp4Asli, r.ujianAsli].forEach(v => {
        if (typeof v === 'number' && !isNaN(v)) allRawScores.push(v);
      });
    });
    const avgOverallAsli = allRawScores.length > 0 
      ? Number((allRawScores.reduce((a, b) => a + b, 0) / allRawScores.length).toFixed(1)) 
      : 0;

    const minMaxAkhir = calcMinMax(r => r.nilaiAkhir);

    return {
      totalSiswa,
      totalGraded,
      progressPct,
      avgTp1Asli,
      avgTp1Konv,
      avgTp2Asli,
      avgTp2Konv,
      avgTp3Asli,
      avgTp3Konv,
      avgTp4Asli,
      avgTp4Konv,
      avgUjianAsli,
      avgUjianKonv,
      avgNilaiAkhir,
      avgOverallAsli,
      minAkhir: minMaxAkhir.min,
      maxAkhir: minMaxAkhir.max,
      katrolDiff: Number((avgNilaiAkhir - avgOverallAsli).toFixed(1))
    };
  }, [detailedRows, studentsInKelas]);

  // Overall Global Matrix (All classes & all subjects overview)
  const allClassSubjectMatrix = useMemo(() => {
    if (!activePeriod) return [];

    const matrix: {
      kelasId: string;
      kelasNama: string;
      mapelId: string;
      mapelNama: string;
      teacherNama: string;
      totalSiswa: number;
      gradedCount: number;
      percentage: number;
      avgAsli: number;
      avgKonversi: number;
    }[] = [];

    currentKelas.forEach(kls => {
      const students = currentSiswa.filter(s => s.kelasId === kls.id);
      if (students.length === 0) return;

      currentMapels.forEach(mpl => {
        // Teacher
        const t = currentGurus.find(g => {
          const c1 = g.mapel1KelasIds && g.mapel1KelasIds.length > 0 ? g.mapel1KelasIds : (g.mapel1KelasId ? [g.mapel1KelasId] : []);
          if (g.mapel1Id === mpl.id && c1.includes(kls.id)) return true;
          const c2 = g.mapel2KelasIds && g.mapel2KelasIds.length > 0 ? g.mapel2KelasIds : (g.mapel2KelasId ? [g.mapel2KelasId] : []);
          if (g.mapel2Id === mpl.id && c2.includes(kls.id)) return true;
          const c3 = g.mapel3KelasIds && g.mapel3KelasIds.length > 0 ? g.mapel3KelasIds : (g.mapel3KelasId ? [g.mapel3KelasId] : []);
          if (g.mapel3Id === mpl.id && c3.includes(kls.id)) return true;
          return false;
        });

        // Grades count
        let graded = 0;
        let sumFinal = 0;
        let sumRaw = 0;
        let rawCount = 0;

        students.forEach(st => {
          const rec = allNilai.find(n => n.siswaId === st.id && n.mapelId === mpl.id && (n.periodeId === activePeriod.id || !n.periodeId));
          if (rec && typeof rec.nilaiAkhir === 'number') {
            graded++;
            sumFinal += rec.nilaiAkhir;
            [rec.tp1NilaiAsli, rec.tp2NilaiAsli, rec.tp3NilaiAsli, rec.tp4NilaiAsli, rec.nilaiUjianAsli].forEach(v => {
              if (typeof v === 'number') {
                sumRaw += v;
                rawCount++;
              }
            });
          }
        });

        // Filter by tingkat if selected
        if (selectedTingkat !== 'ALL') {
          const parsed = parseKelasInfo(kls.nama);
          if (String(parsed.jenjangNum) !== selectedTingkat) return;
        }

        matrix.push({
          kelasId: kls.id,
          kelasNama: kls.nama,
          mapelId: mpl.id,
          mapelNama: mpl.nama,
          teacherNama: t?.nama || 'Belum Ditugaskan',
          totalSiswa: students.length,
          gradedCount: graded,
          percentage: students.length > 0 ? Math.round((graded / students.length) * 100) : 0,
          avgAsli: rawCount > 0 ? Number((sumRaw / rawCount).toFixed(1)) : 0,
          avgKonversi: graded > 0 ? Number((sumFinal / graded).toFixed(1)) : 0
        });
      });
    });

    return matrix;
  }, [activePeriod, currentKelas, currentMapels, currentSiswa, currentGurus, allNilai, selectedTingkat]);

  // Export Table to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!activeKelas || !activeMapel || detailedRows.length === 0) {
      alert("Tidak ada data untuk diekspor ke Excel.");
      return;
    }

    const headers = [
      "No",
      "NIS",
      "Nama Siswa",
      "TP 1 (Asli)",
      "TP 1 (Konversi)",
      "TP 2 (Asli)",
      "TP 2 (Konversi)",
      "TP 3 (Asli)",
      "TP 3 (Konversi)",
      "TP 4 (Asli)",
      "TP 4 (Konversi)",
      "Ujian (Asli)",
      "Ujian (Konversi)",
      "Nilai Akhir Rapor",
      "Capaian Kompetensi"
    ];

    const dataRows = detailedRows.map((r, i) => [
      r.noAbsen,
      r.student.nis || '-',
      r.student.nama,
      r.tp1Asli !== '' ? r.tp1Asli : '-',
      r.tp1Konversi !== '' ? r.tp1Konversi : '-',
      r.tp2Asli !== '' ? r.tp2Asli : '-',
      r.tp2Konversi !== '' ? r.tp2Konversi : '-',
      r.tp3Asli !== '' ? r.tp3Asli : '-',
      r.tp3Konversi !== '' ? r.tp3Konversi : '-',
      r.tp4Asli !== '' ? r.tp4Asli : '-',
      r.tp4Konversi !== '' ? r.tp4Konversi : '-',
      r.ujianAsli !== '' ? r.ujianAsli : '-',
      r.ujianKonversi !== '' ? r.ujianKonversi : '-',
      r.nilaiAkhir !== '' ? r.nilaiAkhir : '-',
      r.capaian || '-'
    ]);

    const titleBlock = [
      ["SMP AL IRSYAD SURAKARTA - REKAPITULASI NILAI SISWA"],
      [`Kelas: ${activeKelas.nama}`, `Mata Pelajaran: ${activeMapel.nama}`],
      [`Guru Pengampu: ${assignedTeacher?.nama || '-'}`, `Tahun Ajaran: ${activePeriod?.tahunAjaran || '-'} (${activePeriod?.semester || '-'})`],
      []
    ];

    const aoa = [...titleBlock, headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 28 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 50 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Nilai_${activeKelas.nama}`);
    const safeKelas = activeKelas.nama.replace(/[^a-zA-Z0-9]/g, '_');
    const safeMapel = activeMapel.nama.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `Rekap_Nilai_${safeKelas}_${safeMapel}.xlsx`);
  };

  // Print execution method
  const handlePrint = () => {
    const printArea = document.getElementById('admin-print-nilai-area');
    if (!printArea) return;

    const existingHelper = document.getElementById('print-helper-area');
    if (existingHelper) existingHelper.remove();

    const printHelper = document.createElement('div');
    printHelper.id = 'print-helper-area';
    printHelper.innerHTML = printArea.innerHTML;

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
        body > *:not(#print-helper-area) {
          display: none !important;
          height: 0 !important;
          overflow: hidden !important;
          visibility: hidden !important;
        }
        #print-helper-area, #print-helper-area * {
          visibility: visible !important;
        }
        #print-helper-area {
          display: block !important;
          width: 100% !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: "Times New Roman", Times, serif !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        @page {
          size: landscape !important;
          margin: 10mm 10mm 10mm 10mm !important;
        }
        table {
          border-collapse: collapse !important;
          width: 100% !important;
        }
        table, th, td {
          border: 1px solid #000000 !important;
        }
        th, td {
          padding: 4px 5px !important;
          font-size: 9px !important;
          color: #000000 !important;
        }
        th {
          background-color: #f1f5f9 !important;
          font-weight: bold !important;
          text-align: center !important;
        }
        .table-no-border, .table-no-border tr, .table-no-border td {
          border: none !important;
        }
      }
    `;

    document.head.appendChild(helperStyle);
    document.body.appendChild(printHelper);

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        printHelper.remove();
        helperStyle.remove();
      }, 500);
    }, 100);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <CheckSquare className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-black text-slate-800 tracking-tight font-sans">
                Monitoring & Cek Input Nilai Semua Kelas
              </h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
              Pemeriksaan komprehensif input nilai siswa — tinjau perbandingan <strong>Nilai Asli</strong> (skor murni guru) vs <strong>Nilai Konversi</strong> (katrol/skala rapor), nilai akhir, dan capaian kompetensi seluruh kelas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* View Mode Switcher: Detail vs Matriks */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setActiveTabSubView('detail')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTabSubView === 'detail'
                    ? 'bg-white text-emerald-900 shadow-2xs font-extrabold'
                    : 'hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>Detail Kelas & Mapel</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTabSubView('matriks')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTabSubView === 'matriks'
                    ? 'bg-white text-emerald-900 shadow-2xs font-extrabold'
                    : 'hover:text-slate-900'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Matriks Rekap Semua Kelas</span>
              </button>
            </div>

            {activeTabSubView === 'detail' && (
              <>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                  title="Unduh data nilai asli dan konversi ke Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                  title="Cetak format cetak resmi"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Rekap</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Global Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" /> Total Siswa Kelas
            </span>
            <div className="text-xl font-black text-slate-800 mt-1">
              {classStats.totalSiswa} <span className="text-xs text-slate-400 font-normal">Siswa</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">{classStats.totalGraded} siswa telah dinilai</p>
          </div>

          <div className="p-3.5 bg-amber-50/60 border border-amber-100 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-amber-800 font-mono tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Rerata Nilai Asli
            </span>
            <div className="text-xl font-black text-amber-950 mt-1">
              {classStats.avgOverallAsli > 0 ? classStats.avgOverallAsli : '-'}
            </div>
            <p className="text-[10px] text-amber-700/80 mt-0.5">Skor murni sebelum konversi</p>
          </div>

          <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-emerald-800 font-mono tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Rerata Nilai Rapor
            </span>
            <div className="text-xl font-black text-emerald-950 mt-1">
              {classStats.avgNilaiAkhir > 0 ? classStats.avgNilaiAkhir : '-'}
            </div>
            <p className="text-[10px] text-emerald-700/80 mt-0.5">
              {classStats.katrolDiff > 0 ? `+${classStats.katrolDiff} poin katrol/skala` : 'Sesuai nilai murni'}
            </p>
          </div>

          <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-blue-800 font-mono tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Progres Pengisian
            </span>
            <div className="text-xl font-black text-blue-950 mt-1">
              {classStats.progressPct}%
            </div>
            <div className="w-full bg-blue-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${classStats.progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & SELECTION CONTROLS */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        
        {/* Row 1: Tingkat & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Tingkat:
            </span>
            {['ALL', '7', '8', '9'].map(lvl => (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedTingkat(lvl)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedTingkat === lvl
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {lvl === 'ALL' ? 'Semua Tingkat' : `Kelas ${lvl}`}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cari nama atau NIS siswa..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Row 2: Kelas Dropdown, Mapel Dropdown, and View Mode */}
        {activeTabSubView === 'detail' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            
            {/* Kelas Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Pilih Kelas
              </label>
              <select
                value={selectedKelasId}
                onChange={e => setSelectedKelasId(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
              >
                {filteredKelasList.map(k => (
                  <option key={k.id} value={k.id}>
                    Kelas {k.nama} ({currentSiswa.filter(s => s.kelasId === k.id).length} Siswa)
                  </option>
                ))}
              </select>
            </div>

            {/* Mapel Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Pilih Mata Pelajaran
              </label>
              <select
                value={selectedMapelId}
                onChange={e => setSelectedMapelId(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
              >
                {currentMapels.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode Kolom: Asli & Konversi */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Tampilan Kolom Nilai
              </label>
              <div className="grid grid-cols-3 bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setViewMode('both')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'both' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Tampilkan Nilai Asli dan Konversi berdampingan"
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('asli')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'asli' ? 'bg-amber-100 text-amber-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Hanya Nilai Asli (Murni)"
                >
                  Asli
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('konversi')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'konversi' ? 'bg-emerald-100 text-emerald-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Hanya Nilai Konversi / Rapor"
                >
                  Konversi
                </button>
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Status Pengisian Siswa
              </label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">Semua Siswa ({studentsInKelas.length})</option>
                <option value="GRADED">Sudah Ada Nilai ({detailedRows.filter(r => r.hasAnyGrade).length})</option>
                <option value="UNGRADED">Belum Diisi ({detailedRows.filter(r => !r.hasAnyGrade).length})</option>
              </select>
            </div>

          </div>
        )}

      </div>

      {/* DETAIL VIEW: PER KELAS & MAPEL */}
      {activeTabSubView === 'detail' && (
        <div className="space-y-4">
          
          {/* Active Teacher & TP Indicator Card */}
          <div className="p-4 bg-gradient-to-r from-emerald-50/70 via-slate-50 to-amber-50/40 rounded-2xl border border-emerald-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                  Kelas {activeKelas?.nama} • {activeMapel?.nama}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800">
                  {activePeriod?.tahunAjaran} ({activePeriod?.semester})
                </span>
              </div>
              <p className="text-xs text-slate-600 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-emerald-700" />
                <span>Guru Pengampu: <strong>{assignedTeacher?.nama || 'Belum Ditugaskan di Data Guru'}</strong></span>
                {assignedTeacher?.username && (
                  <span className="text-[10px] text-slate-400 font-mono">({assignedTeacher.username})</span>
                )}
              </p>
            </div>

            {/* TP defined info */}
            <div className="text-right text-[11px] text-slate-500">
              {activeTP ? (
                <div className="flex items-center gap-1 text-emerald-800 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>TP Terdefinisi: <strong>{[activeTP.tp1, activeTP.tp2, activeTP.tp3, activeTP.tp4].filter(Boolean).length} TP</strong></span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-amber-700 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Guru belum menyusun TP untuk mapel & jenjang ini</span>
                </div>
              )}
            </div>
          </div>

          {/* MAIN DATA TABLE */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 text-[10px] font-bold tracking-wider uppercase">
                    <th className="py-3 px-3 text-center w-12 border-r border-slate-100">No</th>
                    <th className="py-3 px-3 text-center w-24 border-r border-slate-100">NIS</th>
                    <th className="py-3 px-4 min-w-[180px] border-r border-slate-100">Nama Siswa</th>
                    
                    {/* TP 1 */}
                    {(viewMode === 'both' || viewMode === 'asli') && (
                      <th className="py-3 px-2 text-center w-14 font-mono text-amber-900 bg-amber-50/60 border-r border-amber-100" title="Nilai Asli / Murni TP 1">
                        TP1 Asli
                      </th>
                    )}
                    {(viewMode === 'both' || viewMode === 'konversi') && (
                      <th className="py-3 px-2 text-center w-14 font-mono text-emerald-900 bg-emerald-50/50 border-r border-emerald-100" title="Nilai Konversi / Rapor TP 1">
                        TP1 Rapor
                      </th>
                    )}

                    {/* TP 2 */}
                    {(viewMode === 'both' || viewMode === 'asli') && (
                      <th className="py-3 px-2 text-center w-14 font-mono text-amber-900 bg-amber-50/60 border-r border-amber-100" title="Nilai Asli / Murni TP 2">
                        TP2 Asli
                      </th>
                    )}
                    {(viewMode === 'both' || viewMode === 'konversi') && (
                      <th className="py-3 px-2 text-center w-14 font-mono text-emerald-900 bg-emerald-50/50 border-r border-emerald-100" title="Nilai Konversi / Rapor TP 2">
                        TP2 Rapor
                      </th>
                    )}

                    {/* TP 3 */}
                    {(activeTP?.tp3 || detailedRows.some(r => r.tp3Asli !== '' || r.tp3Konversi !== '')) && (
                      <>
                        {(viewMode === 'both' || viewMode === 'asli') && (
                          <th className="py-3 px-2 text-center w-14 font-mono text-amber-900 bg-amber-50/60 border-r border-amber-100" title="Nilai Asli / Murni TP 3">
                            TP3 Asli
                          </th>
                        )}
                        {(viewMode === 'both' || viewMode === 'konversi') && (
                          <th className="py-3 px-2 text-center w-14 font-mono text-emerald-900 bg-emerald-50/50 border-r border-emerald-100" title="Nilai Konversi / Rapor TP 3">
                            TP3 Rapor
                          </th>
                        )}
                      </>
                    )}

                    {/* TP 4 */}
                    {(activeTP?.tp4 || detailedRows.some(r => r.tp4Asli !== '' || r.tp4Konversi !== '')) && (
                      <>
                        {(viewMode === 'both' || viewMode === 'asli') && (
                          <th className="py-3 px-2 text-center w-14 font-mono text-amber-900 bg-amber-50/60 border-r border-amber-100" title="Nilai Asli / Murni TP 4">
                            TP4 Asli
                          </th>
                        )}
                        {(viewMode === 'both' || viewMode === 'konversi') && (
                          <th className="py-3 px-2 text-center w-14 font-mono text-emerald-900 bg-emerald-50/50 border-r border-emerald-100" title="Nilai Konversi / Rapor TP 4">
                            TP4 Rapor
                          </th>
                        )}
                      </>
                    )}

                    {/* Ujian */}
                    {(viewMode === 'both' || viewMode === 'asli') && (
                      <th className="py-3 px-2 text-center w-14 font-mono text-amber-900 bg-amber-50/60 border-r border-amber-100" title="Nilai Asli / Murni Ujian">
                        Ujian Asli
                      </th>
                    )}
                    {(viewMode === 'both' || viewMode === 'konversi') && (
                      <th className="py-3 px-2 text-center w-14 font-mono text-emerald-900 bg-emerald-50/50 border-r border-emerald-100" title="Nilai Konversi / Rapor Ujian">
                        Ujian Rapor
                      </th>
                    )}

                    {/* Nilai Akhir */}
                    <th className="py-3 px-3 text-center w-16 font-bold text-slate-900 bg-slate-100 border-r border-slate-200">
                      Nilai Akhir
                    </th>

                    {/* Deskripsi Capaian */}
                    <th className="py-3 px-4 min-w-[240px]">
                      Deskripsi Capaian (Kurikulum Merdeka)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {detailedRows.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-slate-400 italic">
                        Tidak ada data siswa ditemukan untuk kriteria filter yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    detailedRows.map((row) => {
                      const isGraded = typeof row.nilaiAkhir === 'number';
                      const isPassed = isGraded && (row.nilaiAkhir as number) >= 75;

                      return (
                        <tr key={row.student.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400 border-r border-slate-100">
                            {row.noAbsen}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-500 border-r border-slate-100">
                            {row.student.nis || '-'}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900 border-r border-slate-100">
                            {row.student.nama}
                          </td>

                          {/* TP 1 */}
                          {(viewMode === 'both' || viewMode === 'asli') && (
                            <td className="py-2.5 px-2 text-center font-mono font-medium text-amber-900 bg-amber-50/20 border-r border-amber-50">
                              {row.tp1Asli !== '' ? row.tp1Asli : <span className="text-slate-300">-</span>}
                            </td>
                          )}
                          {(viewMode === 'both' || viewMode === 'konversi') && (
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-800 bg-emerald-50/20 border-r border-emerald-50">
                              {row.tp1Konversi !== '' ? row.tp1Konversi : <span className="text-slate-300">-</span>}
                            </td>
                          )}

                          {/* TP 2 */}
                          {(viewMode === 'both' || viewMode === 'asli') && (
                            <td className="py-2.5 px-2 text-center font-mono font-medium text-amber-900 bg-amber-50/20 border-r border-amber-50">
                              {row.tp2Asli !== '' ? row.tp2Asli : <span className="text-slate-300">-</span>}
                            </td>
                          )}
                          {(viewMode === 'both' || viewMode === 'konversi') && (
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-800 bg-emerald-50/20 border-r border-emerald-50">
                              {row.tp2Konversi !== '' ? row.tp2Konversi : <span className="text-slate-300">-</span>}
                            </td>
                          )}

                          {/* TP 3 */}
                          {(activeTP?.tp3 || detailedRows.some(r => r.tp3Asli !== '' || r.tp3Konversi !== '')) && (
                            <>
                              {(viewMode === 'both' || viewMode === 'asli') && (
                                <td className="py-2.5 px-2 text-center font-mono font-medium text-amber-900 bg-amber-50/20 border-r border-amber-50">
                                  {row.tp3Asli !== '' ? row.tp3Asli : <span className="text-slate-300">-</span>}
                                </td>
                              )}
                              {(viewMode === 'both' || viewMode === 'konversi') && (
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-800 bg-emerald-50/20 border-r border-emerald-50">
                                  {row.tp3Konversi !== '' ? row.tp3Konversi : <span className="text-slate-300">-</span>}
                                </td>
                              )}
                            </>
                          )}

                          {/* TP 4 */}
                          {(activeTP?.tp4 || detailedRows.some(r => r.tp4Asli !== '' || r.tp4Konversi !== '')) && (
                            <>
                              {(viewMode === 'both' || viewMode === 'asli') && (
                                <td className="py-2.5 px-2 text-center font-mono font-medium text-amber-900 bg-amber-50/20 border-r border-amber-50">
                                  {row.tp4Asli !== '' ? row.tp4Asli : <span className="text-slate-300">-</span>}
                                </td>
                              )}
                              {(viewMode === 'both' || viewMode === 'konversi') && (
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-800 bg-emerald-50/20 border-r border-emerald-50">
                                  {row.tp4Konversi !== '' ? row.tp4Konversi : <span className="text-slate-300">-</span>}
                                </td>
                              )}
                            </>
                          )}

                          {/* Ujian */}
                          {(viewMode === 'both' || viewMode === 'asli') && (
                            <td className="py-2.5 px-2 text-center font-mono font-medium text-amber-900 bg-amber-50/20 border-r border-amber-50">
                              {row.ujianAsli !== '' ? row.ujianAsli : <span className="text-slate-300">-</span>}
                            </td>
                          )}
                          {(viewMode === 'both' || viewMode === 'konversi') && (
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-800 bg-emerald-50/20 border-r border-emerald-50">
                              {row.ujianKonversi !== '' ? row.ujianKonversi : <span className="text-slate-300">-</span>}
                            </td>
                          )}

                          {/* Nilai Akhir */}
                          <td className="py-2.5 px-3 text-center border-r border-slate-200 bg-slate-50/60 font-mono">
                            {isGraded ? (
                              <span className={`inline-block px-2 py-0.5 rounded font-black text-xs ${
                                isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {row.nilaiAkhir}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-bold">-</span>
                            )}
                          </td>

                          {/* Deskripsi Capaian */}
                          <td className="py-2.5 px-4 text-slate-600 text-[11px] leading-relaxed">
                            {row.capaian ? (
                              <span>{row.capaian}</span>
                            ) : (
                              <span className="text-slate-400 italic">Belum di-generate</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Summary / Averages Row */}
                  {detailedRows.length > 0 && (
                    <tr className="bg-slate-100/90 font-extrabold text-slate-800 text-[11px] border-t-2 border-slate-300">
                      <td colSpan={3} className="py-3 px-4 text-right pr-6 uppercase tracking-wider text-[10px] text-slate-600">
                        Rata-Rata Kelas:
                      </td>

                      {/* TP 1 Averages */}
                      {(viewMode === 'both' || viewMode === 'asli') && (
                        <td className="py-3 px-2 text-center font-mono text-amber-900 bg-amber-100/50">
                          {classStats.avgTp1Asli > 0 ? classStats.avgTp1Asli : '-'}
                        </td>
                      )}
                      {(viewMode === 'both' || viewMode === 'konversi') && (
                        <td className="py-3 px-2 text-center font-mono text-emerald-900 bg-emerald-100/50">
                          {classStats.avgTp1Konv > 0 ? classStats.avgTp1Konv : '-'}
                        </td>
                      )}

                      {/* TP 2 Averages */}
                      {(viewMode === 'both' || viewMode === 'asli') && (
                        <td className="py-3 px-2 text-center font-mono text-amber-900 bg-amber-100/50">
                          {classStats.avgTp2Asli > 0 ? classStats.avgTp2Asli : '-'}
                        </td>
                      )}
                      {(viewMode === 'both' || viewMode === 'konversi') && (
                        <td className="py-3 px-2 text-center font-mono text-emerald-900 bg-emerald-100/50">
                          {classStats.avgTp2Konv > 0 ? classStats.avgTp2Konv : '-'}
                        </td>
                      )}

                      {/* TP 3 Averages */}
                      {(activeTP?.tp3 || detailedRows.some(r => r.tp3Asli !== '' || r.tp3Konversi !== '')) && (
                        <>
                          {(viewMode === 'both' || viewMode === 'asli') && (
                            <td className="py-3 px-2 text-center font-mono text-amber-900 bg-amber-100/50">
                              {classStats.avgTp3Asli > 0 ? classStats.avgTp3Asli : '-'}
                            </td>
                          )}
                          {(viewMode === 'both' || viewMode === 'konversi') && (
                            <td className="py-3 px-2 text-center font-mono text-emerald-900 bg-emerald-100/50">
                              {classStats.avgTp3Konv > 0 ? classStats.avgTp3Konv : '-'}
                            </td>
                          )}
                        </>
                      )}

                      {/* TP 4 Averages */}
                      {(activeTP?.tp4 || detailedRows.some(r => r.tp4Asli !== '' || r.tp4Konversi !== '')) && (
                        <>
                          {(viewMode === 'both' || viewMode === 'asli') && (
                            <td className="py-3 px-2 text-center font-mono text-amber-900 bg-amber-100/50">
                              {classStats.avgTp4Asli > 0 ? classStats.avgTp4Asli : '-'}
                            </td>
                          )}
                          {(viewMode === 'both' || viewMode === 'konversi') && (
                            <td className="py-3 px-2 text-center font-mono text-emerald-900 bg-emerald-100/50">
                              {classStats.avgTp4Konv > 0 ? classStats.avgTp4Konv : '-'}
                            </td>
                          )}
                        </>
                      )}

                      {/* Ujian Averages */}
                      {(viewMode === 'both' || viewMode === 'asli') && (
                        <td className="py-3 px-2 text-center font-mono text-amber-900 bg-amber-100/50">
                          {classStats.avgUjianAsli > 0 ? classStats.avgUjianAsli : '-'}
                        </td>
                      )}
                      {(viewMode === 'both' || viewMode === 'konversi') && (
                        <td className="py-3 px-2 text-center font-mono text-emerald-900 bg-emerald-100/50">
                          {classStats.avgUjianKonv > 0 ? classStats.avgUjianKonv : '-'}
                        </td>
                      )}

                      {/* Nilai Akhir Average */}
                      <td className="py-3 px-2 text-center font-mono text-slate-900 bg-slate-200">
                        {classStats.avgNilaiAkhir > 0 ? classStats.avgNilaiAkhir : '-'}
                      </td>

                      <td className="py-3 px-4 text-[10px] text-slate-500 font-normal">
                        Nilai Min: {classStats.minAkhir} • Nilai Max: {classStats.maxAkhir}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW: MATRIKS REKAP SEMUA KELAS */}
      {activeTabSubView === 'matriks' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Rekapitulasi Seluruh Kelas & Mata Pelajaran</h3>
              <p className="text-xs text-slate-500 mt-0.5">Ringkasan status input dan perbandingan rerata nilai asli vs konversi.</p>
            </div>
            <div className="text-xs text-slate-500 font-semibold">
              Total {allClassSubjectMatrix.length} kombinasi Kelas & Mapel
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200 text-slate-600 text-[10px] font-bold tracking-wider uppercase">
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Mata Pelajaran</th>
                  <th className="py-3 px-4">Guru Pengampu</th>
                  <th className="py-3 px-3 text-center">Siswa Terisi</th>
                  <th className="py-3 px-4 text-center min-w-[130px]">Progres</th>
                  <th className="py-3 px-3 text-center font-mono text-amber-900 bg-amber-50/40">Rerata Asli</th>
                  <th className="py-3 px-3 text-center font-mono text-emerald-900 bg-emerald-50/40">Rerata Rapor</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {allClassSubjectMatrix.map((item, idx) => (
                  <tr key={`${item.kelasId}_${item.mapelId}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      Kelas {item.kelasNama}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {item.mapelNama}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {item.teacherNama}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      <span className="font-bold text-slate-800">{item.gradedCount}</span>
                      <span className="text-slate-400"> / {item.totalSiswa}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.percentage === 100 
                                ? 'bg-emerald-500' 
                                : item.percentage > 0 
                                ? 'bg-amber-500' 
                                : 'bg-slate-300'
                            }`}
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 w-8 text-right font-mono">
                          {item.percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-medium text-amber-950 bg-amber-50/15">
                      {item.avgAsli > 0 ? item.avgAsli : '-'}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-950 bg-emerald-50/15">
                      {item.avgKonversi > 0 ? item.avgKonversi : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedKelasId(item.kelasId);
                          setSelectedMapelId(item.mapelId);
                          setActiveTabSubView('detail');
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                      >
                        <span>Cek Nilai</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HIDDEN PRINT PREVIEW BLOCK (EXCLUSIVELY DESCRIPTIVE & CAPTURED BY JS PRINT HANDLER) */}
      <div className="hidden">
        <div id="admin-print-nilai-area">
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              REKAPITULASI INPUT NILAI SISWA (ASLI & KONVERSI)
            </h2>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold' }}>
              SMP AL IRSYAD SURAKARTA
            </h3>
            
            <table className="table-no-border" style={{ width: '100%', margin: '10px 0 14px 0', fontSize: '11px', textAlign: 'left' }}>
              <tbody>
                <tr>
                  <td style={{ width: '15%', fontWeight: 'bold', padding: '2px 0' }}>Kelas</td>
                  <td style={{ width: '2%', padding: '2px 0' }}>:</td>
                  <td style={{ width: '33%', padding: '2px 0' }}>{activeKelas?.nama || '-'}</td>
                  <td style={{ width: '15%', fontWeight: 'bold', padding: '2px 0' }}>Tahun Pelajaran</td>
                  <td style={{ width: '2%', padding: '2px 0' }}>:</td>
                  <td style={{ padding: '2px 0' }}>{activePeriod?.tahunAjaran || '-'} ({activePeriod?.semester || '-'})</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '2px 0' }}>Mata Pelajaran</td>
                  <td style={{ padding: '2px 0' }}>:</td>
                  <td style={{ padding: '2px 0' }}>{activeMapel?.nama || '-'}</td>
                  <td style={{ fontWeight: 'bold', padding: '2px 0' }}>Guru Pengampu</td>
                  <td style={{ padding: '2px 0' }}>:</td>
                  <td style={{ padding: '2px 0' }}>{assignedTeacher?.nama || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ width: '3%' }}>No</th>
                <th style={{ width: '8%' }}>NIS</th>
                <th style={{ width: '20%', textAlign: 'left' }}>Nama Siswa</th>
                <th style={{ width: '7%' }}>TP1 Asli</th>
                <th style={{ width: '7%' }}>TP1 Rapor</th>
                <th style={{ width: '7%' }}>TP2 Asli</th>
                <th style={{ width: '7%' }}>TP2 Rapor</th>
                <th style={{ width: '7%' }}>Ujian Asli</th>
                <th style={{ width: '7%' }}>Ujian Rapor</th>
                <th style={{ width: '8%' }}>Nilai Akhir</th>
                <th style={{ textAlign: 'left' }}>Deskripsi Capaian</th>
              </tr>
            </thead>
            <tbody>
              {detailedRows.map(row => (
                <tr key={row.student.id}>
                  <td style={{ textAlign: 'center' }}>{row.noAbsen}</td>
                  <td style={{ textAlign: 'center' }}>{row.student.nis || '-'}</td>
                  <td style={{ fontWeight: 'bold' }}>{row.student.nama}</td>
                  <td style={{ textAlign: 'center' }}>{row.tp1Asli !== '' ? row.tp1Asli : '-'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.tp1Konversi !== '' ? row.tp1Konversi : '-'}</td>
                  <td style={{ textAlign: 'center' }}>{row.tp2Asli !== '' ? row.tp2Asli : '-'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.tp2Konversi !== '' ? row.tp2Konversi : '-'}</td>
                  <td style={{ textAlign: 'center' }}>{row.ujianAsli !== '' ? row.ujianAsli : '-'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.ujianKonversi !== '' ? row.ujianKonversi : '-'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.nilaiAkhir !== '' ? row.nilaiAkhir : '-'}</td>
                  <td>{row.capaian || '-'}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                <td colSpan={3} style={{ textAlign: 'right' }}>Rata-rata:</td>
                <td style={{ textAlign: 'center' }}>{classStats.avgTp1Asli || '-'}</td>
                <td style={{ textAlign: 'center' }}>{classStats.avgTp1Konv || '-'}</td>
                <td style={{ textAlign: 'center' }}>{classStats.avgTp2Asli || '-'}</td>
                <td style={{ textAlign: 'center' }}>{classStats.avgTp2Konv || '-'}</td>
                <td style={{ textAlign: 'center' }}>{classStats.avgUjianAsli || '-'}</td>
                <td style={{ textAlign: 'center' }}>{classStats.avgUjianKonv || '-'}</td>
                <td style={{ textAlign: 'center' }}>{classStats.avgNilaiAkhir || '-'}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
