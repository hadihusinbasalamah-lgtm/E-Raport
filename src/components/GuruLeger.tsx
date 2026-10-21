/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { SchemaDatabase, Siswa, Mapel, Guru, Kelas, PeriodeAkademik, formatTipeUjian } from '../types';
import { 
  Printer, AlertTriangle, FileSpreadsheet, ClipboardList, Info, TrendingUp, Users, 
  Award, Download, ArrowUpDown, CheckCircle2 
} from 'lucide-react';
import { getSubjectPriority, isYayasanSubject, sortAndDistributeMapel } from '../utils/mapelOrder';

interface GuruLegerProps {
  db: SchemaDatabase;
  guruId: string;
  onUpdate: (updatedDb: SchemaDatabase) => void;
  initialMode?: 'leger' | 'peringkat';
}

export function GuruLeger({ db, guruId, onUpdate, initialMode = 'leger' }: GuruLegerProps) {
  const [activeMode, setActiveMode] = useState<'leger' | 'peringkat'>(initialMode);
  const [sortByRank, setSortByRank] = useState<boolean>(false);

  useEffect(() => {
    if (initialMode) {
      setActiveMode(initialMode);
    }
  }, [initialMode]);

  const activePeriod = db.periodList.find(p => p.id === db.activePeriodId);
  const teacher = db.guru.find(g => g.id === guruId);
  const activeTeacher = activePeriod?.snapshotGuru.find(g => g.id === guruId) || teacher;

  if (!activePeriod) {
    return (
      <div className="p-8 text-center bg-amber-50 rounded-2xl border border-amber-200 text-amber-900">
        <h3 className="text-sm font-bold">Periode Akademik Aktif Belum Dirilis oleh Admin</h3>
        <p className="text-xs text-slate-500 mt-1">Lembaga Administrasi Akademik harus merilis Tahun Ajaran sebelum Guru dapat mengakses menu ini.</p>
      </div>
    );
  }

  if (!activeTeacher) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
        Profil pengajar tidak terdeteksi.
      </div>
    );
  }

  // Check if they are actually a Wali Kelas
  if (!activeTeacher.isWaliKelas || !activeTeacher.waliKelasKelasId) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center bg-rose-50 rounded-2xl border border-rose-200 text-rose-900 shadow-sm space-y-3">
        <AlertTriangle className="w-12 h-12 text-rose-600 mx-auto" />
        <h3 className="text-base font-bold text-rose-950 font-sans">Akses Terbatas: Wali Kelas Sahaja</h3>
        <p className="text-xs text-rose-800 leading-relaxed">
          Menu <strong>Cetak Leger & Peringkat Raport</strong> ini dilindungi sistem dan eksklusif bagi pengajar yang memegang mandat amanah sebagai <b>Wali Kelas</b> di semester aktif ini.
        </p>
      </div>
    );
  }

  // Get Wali Kelas classroom info
  const homeroomKelas = activePeriod.snapshotKelas.find(k => k.id === activeTeacher.waliKelasKelasId);
  const homeroomStudents = (activePeriod.snapshotSiswa || [])
    .filter(s => s.kelasId === activeTeacher.waliKelasKelasId)
    .sort((a, b) => {
      const noA = a.noAbsen !== undefined && a.noAbsen !== null ? a.noAbsen : 999999;
      const noB = b.noAbsen !== undefined && b.noAbsen !== null ? b.noAbsen : 999999;
      if (noA !== noB) return noA - noB;
      return a.nama.localeCompare(b.nama);
    });

  // Collect raw subjects from snapshots and master db
  const rawSubjects: Mapel[] = [];
  const seenMapel = new Set<string>();
  (activePeriod.snapshotMapel || []).forEach(m => {
    if (!seenMapel.has(m.id)) {
      seenMapel.add(m.id);
      rawSubjects.push(m);
    }
  });
  (db.mapel || []).forEach(m => {
    if (!seenMapel.has(m.id)) {
      seenMapel.add(m.id);
      rawSubjects.push(m);
    }
  });

  // Ensure Tahfidz Al Qur'an mapel exists if not already present
  const hasTahfidz = rawSubjects.some(m => {
    const l = m.nama.toLowerCase();
    return l.includes('tahfidz') || l.includes('tahfidh') || l.includes('qur\'an') || l.includes('quran');
  });
  if (!hasTahfidz) {
    rawSubjects.push({
      id: 'm_tahfidz_auto',
      nama: "Tahfidz Al Qur'an",
      urutan: 16,
      kategori: 'yayasan'
    });
  }

  // --- 1. SUBJECTS FOR PERINGKAT ---
  // "pada menu peringkat sama seperti yang sekarang hanya hilangkan S I A"
  // The current filter excluded PAI and Tahfidz from the ranking calculation:
  const subjectsPeringkat = useMemo(() => {
    return rawSubjects.filter(mapel => {
      const nameLower = mapel.nama.toLowerCase();
      const isPai = nameLower.includes('pai') || nameLower.includes('pendidikan agama islam') || nameLower.includes('agama islam') || nameLower.startsWith('pai');
      const isTahfidz = nameLower.includes('tahfidz') || nameLower.includes('tahfidh') || nameLower.includes('alqur') || nameLower.includes('qur\'an') || nameLower.includes('quran');
      return !isPai && !isTahfidz;
    }).sort((a, b) => {
      const pA = getSubjectPriority(a, false, db.mapel);
      const pB = getSubjectPriority(b, false, db.mapel);
      if (pA !== pB) return pA - pB;
      return a.nama.localeCompare(b.nama);
    });
  }, [rawSubjects, db.mapel]);

  // --- 2. SUBJECTS FOR LEGER ---
  // "sedangakan menu LEGER berisi semua daftar nilai juga nilai tahfidz Total dan Rata-rata saja"
  // All subjects including PAI and Tahfidz, ordered by official standard curriculum
  const subjectsLeger = useMemo(() => {
    const { sortedUmum, sortedYayasan } = sortAndDistributeMapel(rawSubjects, db.mapel);
    return [...sortedUmum, ...sortedYayasan];
  }, [rawSubjects, db.mapel]);

  // Helper to extract grade for student & mapel
  const getStudentGrade = (student: Siswa, mapel: Mapel): number | undefined => {
    const gradeId = `${activePeriod.id}_${student.id}_${mapel.id}`;
    const gradeRecord = (db.nilaiSiswa || []).find(n => 
      n.id === gradeId ||
      (n.siswaId === student.id && 
       (n.periodeId === activePeriod.id || !n.periodeId) && 
       (n.mapelId === mapel.id || 
        (db.mapel || []).find(m => m.id === n.mapelId)?.nama.trim().toLowerCase() === mapel.nama.trim().toLowerCase() ||
        (activePeriod.snapshotMapel || []).find(m => m.id === n.mapelId)?.nama.trim().toLowerCase() === mapel.nama.trim().toLowerCase()
       )
      )
    );

    let resolvedGrade: number | undefined;
    if (gradeRecord) {
      if (typeof gradeRecord.nilaiAkhir === 'number' && gradeRecord.nilaiAkhir > 0) {
        resolvedGrade = gradeRecord.nilaiAkhir;
      } else if (typeof gradeRecord.nilaiUjian === 'number' && gradeRecord.nilaiUjian > 0) {
        resolvedGrade = gradeRecord.nilaiUjian;
      } else if (typeof gradeRecord.nilaiUjianAsli === 'number' && gradeRecord.nilaiUjianAsli > 0) {
        resolvedGrade = gradeRecord.nilaiUjianAsli;
      } else if (typeof gradeRecord.nilaiAkhir === 'number') {
        resolvedGrade = gradeRecord.nilaiAkhir;
      }
    }

    // Fallback for Tahfidz from absensiDanCatatan.ekstrakurikuler if not in nilaiSiswa
    if (resolvedGrade === undefined) {
      const isTahfidz = mapel.nama.toLowerCase().includes('tahfidz') || mapel.nama.toLowerCase().includes('qur\'an');
      if (isTahfidz) {
        const attendance = db.absensiDanCatatan.find(
          a => a.periodeId === activePeriod.id && a.siswaId === student.id
        );
        const extraTahfidz = attendance?.ekstrakurikuler?.find(e => 
          e.nama.toLowerCase().includes('tahfidz') || e.nama.toLowerCase().includes('qur\'an')
        );
        if (extraTahfidz) {
          if (extraTahfidz.nilai === 'A') resolvedGrade = 90;
          else if (extraTahfidz.nilai === 'B') resolvedGrade = 82;
          else if (extraTahfidz.nilai === 'C') resolvedGrade = 75;
        }
      }
    }

    return resolvedGrade;
  };

  // Build rows for both modes
  // Rows for Peringkat Mode:
  const studentRowsPeringkat = useMemo(() => {
    return homeroomStudents.map(student => {
      let totalScore = 0;
      let gradedCount = 0;
      const grades: { [mapelId: string]: number } = {};

      subjectsPeringkat.forEach(mapel => {
        const grade = getStudentGrade(student, mapel);
        if (typeof grade === 'number') {
          grades[mapel.id] = grade;
          totalScore += grade;
          gradedCount++;
        }
      });

      const averageScore = gradedCount > 0 ? Number((totalScore / gradedCount).toFixed(2)) : 0;

      return {
        student,
        grades,
        totalScore,
        averageScore,
        gradedCount
      };
    });
  }, [homeroomStudents, subjectsPeringkat, db.nilaiSiswa, activePeriod.id]);

  // Calculate Rank Map for Peringkat Mode
  const rankMapPeringkat = useMemo(() => {
    const sorted = [...studentRowsPeringkat].sort((a, b) => b.totalScore - a.totalScore);
    const map: { [studentId: string]: number } = {};
    let currentRank = 1;
    sorted.forEach((row, index) => {
      if (index > 0 && row.totalScore < sorted[index - 1].totalScore) {
        currentRank = index + 1;
      }
      map[row.student.id] = currentRank;
    });
    return map;
  }, [studentRowsPeringkat]);

  // Rows for Leger Mode: (Semua mapel + tahfidz, Total & Rata-rata saja)
  const studentRowsLeger = useMemo(() => {
    return homeroomStudents.map(student => {
      let totalScore = 0;
      let gradedCount = 0;
      const grades: { [mapelId: string]: number } = {};

      subjectsLeger.forEach(mapel => {
        const grade = getStudentGrade(student, mapel);
        if (typeof grade === 'number') {
          grades[mapel.id] = grade;
          totalScore += grade;
          gradedCount++;
        }
      });

      const averageScore = gradedCount > 0 ? Number((totalScore / gradedCount).toFixed(2)) : 0;

      return {
        student,
        grades,
        totalScore,
        averageScore,
        gradedCount
      };
    });
  }, [homeroomStudents, subjectsLeger, db.nilaiSiswa, activePeriod.id]);

  // Class averages for Peringkat
  const classAveragesPeringkat = useMemo(() => {
    return subjectsPeringkat.map(mapel => {
      let total = 0;
      let count = 0;
      studentRowsPeringkat.forEach(row => {
        const grade = row.grades[mapel.id];
        if (grade !== undefined) {
          total += grade;
          count++;
        }
      });
      return {
        mapelId: mapel.id,
        average: count > 0 ? Number((total / count).toFixed(2)) : 0,
        count
      };
    });
  }, [subjectsPeringkat, studentRowsPeringkat]);

  // Class averages for Leger
  const classAveragesLeger = useMemo(() => {
    return subjectsLeger.map(mapel => {
      let total = 0;
      let count = 0;
      studentRowsLeger.forEach(row => {
        const grade = row.grades[mapel.id];
        if (grade !== undefined) {
          total += grade;
          count++;
        }
      });
      return {
        mapelId: mapel.id,
        average: count > 0 ? Number((total / count).toFixed(2)) : 0,
        count
      };
    });
  }, [subjectsLeger, studentRowsLeger]);

  const overallClassAveragePeringkat = studentRowsPeringkat.length > 0
    ? Number((studentRowsPeringkat.reduce((sum, r) => sum + r.averageScore, 0) / studentRowsPeringkat.length).toFixed(2))
    : 0;

  const overallClassAverageLeger = studentRowsLeger.length > 0
    ? Number((studentRowsLeger.reduce((sum, r) => sum + r.averageScore, 0) / studentRowsLeger.length).toFixed(2))
    : 0;

  // Sorting display rows
  const displayedRowsPeringkat = useMemo(() => {
    return [...studentRowsPeringkat].sort((a, b) => {
      if (sortByRank) {
        const rA = rankMapPeringkat[a.student.id] || 9999;
        const rB = rankMapPeringkat[b.student.id] || 9999;
        if (rA !== rB) return rA - rB;
      }
      const noA = a.student.noAbsen !== undefined && a.student.noAbsen !== null ? a.student.noAbsen : 999999;
      const noB = b.student.noAbsen !== undefined && b.student.noAbsen !== null ? b.student.noAbsen : 999999;
      if (noA !== noB) return noA - noB;
      return a.student.nama.localeCompare(b.student.nama);
    });
  }, [studentRowsPeringkat, sortByRank, rankMapPeringkat]);

  const displayedRowsLeger = useMemo(() => {
    return [...studentRowsLeger].sort((a, b) => {
      const noA = a.student.noAbsen !== undefined && a.student.noAbsen !== null ? a.student.noAbsen : 999999;
      const noB = b.student.noAbsen !== undefined && b.student.noAbsen !== null ? b.student.noAbsen : 999999;
      if (noA !== noB) return noA - noB;
      return a.student.nama.localeCompare(b.student.nama);
    });
  }, [studentRowsLeger]);

  // Formatted date indicator
  let formattedReportDate = 'Mei 2026';
  if (activePeriod.tanggalRaport) {
    try {
      const parts = activePeriod.tanggalRaport.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        formattedReportDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    } catch (e) {
      formattedReportDate = activePeriod.tanggalRaport;
    }
  }

  // Unified Print Handler
  const handlePrint = (mode: 'leger' | 'peringkat') => {
    const areaId = mode === 'peringkat' ? 'peringkat-print-area' : 'leger-print-area';
    const printContent = document.getElementById(areaId);
    if (!printContent) return;

    const existing = document.getElementById('print-helper-area');
    if (existing) {
      existing.remove();
    }

    const printHelper = document.createElement('div');
    printHelper.id = 'print-helper-area';
    printHelper.innerHTML = printContent.innerHTML;

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
          max-width: 100% !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: "Times New Roman", Times, serif !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        @page {
          size: 330mm 215mm !important;
          margin: 8mm 10mm 8mm 10mm !important;
        }
        table.table-identity-print,
        table.table-identity-print tr,
        table.table-identity-print td,
        .no-all-borders,
        .no-all-borders tr,
        .no-all-borders td {
          border: none !important;
          border-width: 0 !important;
          outline: none !important;
          box-shadow: none !important;
        }
        table.table-data-print {
          border-collapse: collapse !important;
          width: 100% !important;
          border: 1px solid #000000 !important;
        }
        table.table-data-print th,
        table.table-data-print td {
          border: 1px solid #000000 !important;
          padding: 3px 4px !important;
          font-size: ${mode === 'leger' ? '8px' : '9px'} !important;
          color: #000000 !important;
        }
        table.table-data-print th {
          background-color: #f1f5f9 !important;
          font-weight: bold !important;
        }
        .text-center { text-align: center !important; }
        .text-left { text-align: left !important; }
        .text-right { text-align: right !important; }
      }
    `;

    document.head.appendChild(helperStyle);
    document.body.appendChild(printHelper);
    document.body.classList.add('printing-active');

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        printHelper.remove();
        helperStyle.remove();
        document.body.classList.remove('printing-active');
      }, 500);
    }, 100);
  };

  // Export to Excel handler
  const handleExportExcel = (mode: 'leger' | 'peringkat') => {
    const isPeringkat = mode === 'peringkat';
    const subjs = isPeringkat ? subjectsPeringkat : subjectsLeger;
    const rows = isPeringkat ? displayedRowsPeringkat : displayedRowsLeger;

    // Build headers
    const headers = [
      'No', 
      'NIS', 
      'Nama Peserta Didik',
      ...subjs.map(s => s.nama),
      'Total Nilai',
      'Rata-rata',
      ...(isPeringkat ? ['Peringkat'] : [])
    ];

    const dataRows = rows.map((r, idx) => {
      const displayNo = r.student.noAbsen !== undefined && r.student.noAbsen !== null ? r.student.noAbsen : idx + 1;
      const rowData: any[] = [
        displayNo,
        r.student.nis || '-',
        r.student.nama
      ];

      subjs.forEach(s => {
        const val = r.grades[s.id];
        rowData.push(val !== undefined ? val : '');
      });

      rowData.push(r.totalScore);
      rowData.push(r.averageScore);

      if (isPeringkat) {
        rowData.push(rankMapPeringkat[r.student.id] || '-');
      }

      return rowData;
    });

    // Add subject averages row
    const averages = isPeringkat ? classAveragesPeringkat : classAveragesLeger;
    const avgRow: any[] = ['RATA-RATA KELAS', '', ''];
    subjs.forEach(s => {
      const a = averages.find(item => item.mapelId === s.id);
      avgRow.push(a ? a.average : 0);
    });
    avgRow.push('');
    avgRow.push(isPeringkat ? overallClassAveragePeringkat : overallClassAverageLeger);
    if (isPeringkat) avgRow.push('');

    const wsData = [
      [isPeringkat ? 'REKAPITULASI HASIL BELAJAR DAN PERINGKAT KELAS' : 'REKAPITULASI NILAI HASIL BELAJAR (LEGER)'],
      ['SMP AL IRSYAD SURAKARTA'],
      [`Kelas: ${homeroomKelas?.nama || '-'}`, `Tahun Pelajaran: ${activePeriod.tahunAjaran}`, `Semester: ${activePeriod.semester}`],
      [`Wali Kelas: ${activeTeacher.nama}`, `Tanggal Unduh: ${new Date().toLocaleDateString('id-ID')}`],
      [],
      headers,
      ...dataRows,
      avgRow
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isPeringkat ? 'Peringkat' : 'Leger');

    const cleanKelas = (homeroomKelas?.nama || 'Kelas').replace(/\s+/g, '_');
    const filename = isPeringkat 
      ? `Peringkat_${cleanKelas}_${activePeriod.tahunAjaran.replace(/\//g, '-')}.xlsx`
      : `Leger_Nilai_${cleanKelas}_${activePeriod.tahunAjaran.replace(/\//g, '-')}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="space-y-6">
      
      {/* 2-MENU SUB-NAVIGATION SWITCHER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 w-full sm:w-auto">
            {/* MENU 1: LEGER */}
            <button
              onClick={() => setActiveMode('leger')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMode === 'leger'
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <FileSpreadsheet className={`w-4 h-4 ${activeMode === 'leger' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>1. Cetak Leger Raport</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                activeMode === 'leger' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/70 text-slate-600'
              }`}>
                Semua Nilai + Tahfidz
              </span>
            </button>

            {/* MENU 2: PERINGKAT */}
            <button
              onClick={() => setActiveMode('peringkat')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMode === 'peringkat'
                  ? 'bg-white text-indigo-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Award className={`w-4 h-4 ${activeMode === 'peringkat' ? 'text-amber-500' : 'text-slate-400'}`} />
              <span>2. Cetak Peringkat Raport</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                activeMode === 'peringkat' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200/70 text-slate-600'
              }`}>
                Tanpa S I A
              </span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 text-xs text-slate-500 font-medium px-2">
            <span className="text-slate-400">Kelas Aktif:</span>
            <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md">{homeroomKelas?.nama}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: LEGER (Semua daftar nilai juga nilai tahfidz, Total & Rata-rata) */}
      {/* ========================================================================= */}
      {activeMode === 'leger' && (
        <div className="space-y-6">
          {/* Header Card Leger */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5" />
                  </span>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight font-sans">
                    Leger Nilai Raport Kelas {homeroomKelas?.nama}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                  Berisi seluruh rekapitulasi daftar nilai mata pelajaran lengkap beserta <strong>nilai Tahfidz Al Qur'an</strong>, <strong>Total Nilai</strong>, dan <strong>Rata-rata</strong> saja (tanpa kolom S I A & Peringkat).
                </p>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => handleExportExcel('leger')}
                  className="flex-1 md:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  Ekspor Excel
                </button>
                <button
                  onClick={() => handlePrint('leger')}
                  className="flex-1 md:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Leger (Landscape F4)
                </button>
              </div>
            </div>

            {/* Quick Stats Leger */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Jumlah Siswa</p>
                  <h4 className="text-lg font-black text-slate-800 font-sans mt-0.5">{homeroomStudents.length} Siswa</h4>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Rerata Akhir Kelas (Leger)</p>
                  <h4 className="text-lg font-black text-slate-800 font-sans mt-0.5">{overallClassAverageLeger} / 100</h4>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Total Mapel + Tahfidz</p>
                  <h4 className="text-lg font-black text-slate-800 font-sans mt-0.5">{subjectsLeger.length} Mapel</h4>
                </div>
              </div>
            </div>
          </div>

          {/* Screen Preview Leger Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-4 text-slate-500 text-xs font-semibold">
              <Info className="w-4 h-4 text-slate-400" />
              <span>Pratinjau Tabel Leger Lengkap (Mencakup seluruh daftar nilai & Tahfidz Al-Qur'an, Total dan Rata-rata saja):</span>
            </div>

            {/* School Identity Header */}
            <div className="mb-5 p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 font-serif">
              <div className="text-center mb-3">
                <h3 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-900">
                  REKAPITULASI NILAI HASIL BELAJAR (LEGER)
                </h3>
                <h4 className="text-xs font-bold tracking-wide uppercase text-slate-700 mt-0.5">
                  SMP AL IRSYAD SURAKARTA
                </h4>
              </div>

              <table className="w-full text-xs text-slate-700 border-none border-collapse">
                <tbody>
                  <tr className="border-none">
                    <td className="w-32 font-bold py-1 border-none whitespace-nowrap">Satuan Pendidikan</td>
                    <td className="w-4 text-center py-1 border-none">:</td>
                    <td className="py-1 border-none pr-4">SMP Al Irsyad Surakarta</td>
                    <td className="w-24 font-bold py-1 border-none whitespace-nowrap">Kelas</td>
                    <td className="w-4 text-center py-1 border-none">:</td>
                    <td className="py-1 font-bold border-none">{homeroomKelas?.nama || '-'}</td>
                  </tr>
                  <tr className="border-none">
                    <td className="font-bold py-1 border-none whitespace-nowrap">Tahun Pelajaran</td>
                    <td className="text-center py-1 border-none">:</td>
                    <td className="py-1 border-none pr-4">{activePeriod.tahunAjaran}</td>
                    <td className="font-bold py-1 border-none whitespace-nowrap">Wali Kelas</td>
                    <td className="text-center py-1 border-none">:</td>
                    <td className="py-1 border-none">{activeTeacher.nama}</td>
                  </tr>
                  <tr className="border-none">
                    <td className="font-bold py-1 border-none whitespace-nowrap">Semester / Ujian</td>
                    <td className="text-center py-1 border-none">:</td>
                    <td className="py-1 border-none pr-4">{activePeriod.semester} / {formatTipeUjian(activePeriod.tipeUjian)}</td>
                    <td className="font-bold py-1 border-none whitespace-nowrap">Fase</td>
                    <td className="text-center py-1 border-none">:</td>
                    <td className="py-1 font-bold border-none">D</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[550px]">
              <table className="w-full text-slate-700 text-xs text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-3 font-bold border-r border-slate-200 text-center w-10 sticky left-0 bg-slate-50">No</th>
                    <th className="py-3 px-3 font-bold border-r border-slate-200 text-center sticky left-10 bg-slate-50 min-w-[85px] w-20">NIS</th>
                    <th className="py-3 px-4 font-bold border-r border-slate-200 sticky left-[95px] bg-slate-50 min-w-[190px]">Nama Peserta Didik</th>
                    
                    {subjectsLeger.map((mapel, mIdx) => {
                      const isTahfidz = mapel.nama.toLowerCase().includes('tahfidz') || mapel.nama.toLowerCase().includes('qur\'an');
                      return (
                        <th 
                          key={mapel.id || mIdx} 
                          className={`py-2 px-2 font-bold border-r border-slate-200 text-center min-w-[65px] max-w-[95px] ${
                            isTahfidz ? 'bg-amber-100/60 text-amber-950 font-black' : ''
                          }`} 
                          title={mapel.nama}
                        >
                          <div className="truncate text-[10px] tracking-tight">{mapel.nama}</div>
                        </th>
                      );
                    })}

                    <th className="py-3 px-3 font-bold border-r border-slate-200 text-center bg-indigo-50/70 min-w-[70px]">Total</th>
                    <th className="py-3 px-3 font-bold text-center bg-emerald-50/70 text-emerald-900 min-w-[75px]">Rerata</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRowsLeger.map((row, idx) => {
                    const displayNo = row.student.noAbsen !== undefined && row.student.noAbsen !== null ? row.student.noAbsen : idx + 1;
                    return (
                      <tr key={row.student.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono text-slate-400 sticky left-0 bg-white">{displayNo}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono text-slate-500 sticky left-10 bg-white">{row.student.nis || '-'}</td>
                        <td className="py-2.5 px-4 border-r border-slate-200 font-semibold text-slate-800 sticky left-[95px] bg-white">{row.student.nama}</td>

                        {subjectsLeger.map((mapel, mIdx) => {
                          const grade = row.grades[mapel.id];
                          const isTahfidz = mapel.nama.toLowerCase().includes('tahfidz') || mapel.nama.toLowerCase().includes('qur\'an');
                          return (
                            <td 
                              key={mapel.id || mIdx} 
                              className={`py-2 px-2 border-r border-slate-200 text-center font-bold ${
                                isTahfidz ? 'bg-amber-50/40 text-amber-900' : ''
                              }`}
                            >
                              {grade !== undefined ? (
                                <span className={grade < 75 ? "text-rose-600" : (isTahfidz ? "text-emerald-800 font-black" : "text-slate-800")}>
                                  {grade}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-slate-900 bg-indigo-50/30">
                          {row.totalScore}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-800 bg-emerald-50/30">
                          {row.averageScore}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Subject averages row */}
                  <tr className="bg-slate-100 font-extrabold border-t border-slate-300">
                    <td colSpan={3} className="py-3 px-4 text-right pr-6">Rerata Nilai Mapel:</td>
                    {subjectsLeger.map((mapel, mIdx) => {
                      const avgObj = classAveragesLeger.find(c => c.mapelId === mapel.id);
                      const isTahfidz = mapel.nama.toLowerCase().includes('tahfidz') || mapel.nama.toLowerCase().includes('qur\'an');
                      return (
                        <td key={mapel.id || mIdx} className={`py-3 px-2 text-center ${isTahfidz ? 'text-amber-900 bg-amber-100/50' : 'text-slate-800'}`}>
                          {avgObj ? avgObj.average : 0}
                        </td>
                      );
                    })}
                    <td className="py-3 px-3 text-center bg-slate-200/60">-</td>
                    <td className="py-3 px-3 text-center font-black text-emerald-800 bg-emerald-100/60">
                      {overallClassAverageLeger}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: PERINGKAT (Sama seperti yang sekarang hanya hilangkan S I A)       */}
      {/* ========================================================================= */}
      {activeMode === 'peringkat' && (
        <div className="space-y-6">
          {/* Header Card Peringkat */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                    <Award className="w-5 h-5" />
                  </span>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight font-sans">
                    Rekapitulasi Peringkat Raport Kelas {homeroomKelas?.nama}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                  Daftar nilai hasil belajar dan urutan <strong>Peringkat (Rank)</strong> siswa berdasarkan total nilai & rata-rata raport <strong>(kolom S I A telah ditiadakan)</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => setSortByRank(!sortByRank)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer border ${
                    sortByRank
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                  title="Klik untuk beralih antara urutan Absen atau urutan Peringkat"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>{sortByRank ? 'Urut Peringkat' : 'Urut Absen'}</span>
                </button>

                <button
                  onClick={() => handleExportExcel('peringkat')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-indigo-600" />
                  Ekspor Excel
                </button>

                <button
                  onClick={() => handlePrint('peringkat')}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Peringkat (Landscape F4)
                </button>
              </div>
            </div>

            {/* Quick Stats Peringkat */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Jumlah Siswa</p>
                  <h4 className="text-lg font-black text-slate-800 font-sans mt-0.5">{homeroomStudents.length} Siswa</h4>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Rerata Peringkat Kelas</p>
                  <h4 className="text-lg font-black text-slate-800 font-sans mt-0.5">{overallClassAveragePeringkat} / 100</h4>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Peringkat 1 Kelas</p>
                  <h4 className="text-sm font-black text-slate-800 font-sans mt-0.5 truncate max-w-[170px]">
                    {displayedRowsPeringkat.find(r => rankMapPeringkat[r.student.id] === 1)?.student.nama || '-'}
                  </h4>
                </div>
              </div>
            </div>
          </div>

          {/* Screen Preview Peringkat Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-4 text-slate-500 text-xs font-semibold">
              <Info className="w-4 h-4 text-slate-400" />
              <span>Pratinjau Tabel Peringkat (Sama seperti sebelumnya tanpa kolom S I A):</span>
            </div>

            {/* School Identity Header */}
            <div className="mb-5 p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 font-serif">
              <div className="text-center mb-3">
                <h3 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-900">
                  REKAPITULASI HASIL BELAJAR DAN PERINGKAT KELAS
                </h3>
                <h4 className="text-xs font-bold tracking-wide uppercase text-slate-700 mt-0.5">
                  SMP AL IRSYAD SURAKARTA
                </h4>
              </div>

              <table className="w-full text-xs text-slate-700 border-none border-collapse">
                <tbody>
                  <tr className="border-none">
                    <td className="w-32 font-bold py-1 border-none whitespace-nowrap">Satuan Pendidikan</td>
                    <td className="w-4 text-center py-1 border-none">:</td>
                    <td className="py-1 border-none pr-4">SMP Al Irsyad Surakarta</td>
                    <td className="w-24 font-bold py-1 border-none whitespace-nowrap">Kelas</td>
                    <td className="w-4 text-center py-1 border-none">:</td>
                    <td className="py-1 font-bold border-none">{homeroomKelas?.nama || '-'}</td>
                  </tr>
                  <tr className="border-none">
                    <td className="font-bold py-1 border-none whitespace-nowrap">Tahun Pelajaran</td>
                    <td className="text-center py-1 border-none">:</td>
                    <td className="py-1 border-none pr-4">{activePeriod.tahunAjaran}</td>
                    <td className="font-bold py-1 border-none whitespace-nowrap">Wali Kelas</td>
                    <td className="text-center py-1 border-none">:</td>
                    <td className="py-1 border-none">{activeTeacher.nama}</td>
                  </tr>
                  <tr className="border-none">
                    <td className="font-bold py-1 border-none whitespace-nowrap">Semester / Ujian</td>
                    <td className="text-center py-1 border-none">:</td>
                    <td className="py-1 border-none pr-4">{activePeriod.semester} / {formatTipeUjian(activePeriod.tipeUjian)}</td>
                    <td className="font-bold py-1 border-none whitespace-nowrap">Fase</td>
                    <td className="text-center py-1 border-none">:</td>
                    <td className="py-1 font-bold border-none">D</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[550px]">
              <table className="w-full text-slate-700 text-xs text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-3 font-bold border-r border-slate-200 text-center w-10 sticky left-0 bg-slate-50">No</th>
                    <th className="py-3 px-3 font-bold border-r border-slate-200 text-center sticky left-10 bg-slate-50 min-w-[85px] w-20">NIS</th>
                    <th className="py-3 px-4 font-bold border-r border-slate-200 sticky left-[95px] bg-slate-50 min-w-[190px]">Nama Peserta Didik</th>

                    {subjectsPeringkat.map(mapel => (
                      <th key={mapel.id} className="py-3 px-2 font-bold border-r border-slate-200 text-center min-w-[70px] max-w-[100px]" title={mapel.nama}>
                        <div className="truncate text-[10px] tracking-tight">{mapel.nama}</div>
                      </th>
                    ))}

                    <th className="py-3 px-3 font-bold border-r border-slate-200 text-center bg-indigo-50/70">Total</th>
                    <th className="py-3 px-3 font-bold border-r border-slate-200 text-center bg-indigo-50/70">Rerata</th>
                    {/* S, I, A COLUMNS REMOVED AS REQUESTED */}
                    <th className="py-3 px-4 font-black text-center bg-amber-50 text-amber-900 border-l border-amber-200">
                      Peringkat
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRowsPeringkat.map((row, idx) => {
                    const rank = rankMapPeringkat[row.student.id] || '-';
                    const displayNo = row.student.noAbsen !== undefined && row.student.noAbsen !== null ? row.student.noAbsen : idx + 1;
                    return (
                      <tr key={row.student.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono text-slate-400 sticky left-0 bg-white">{displayNo}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono text-slate-500 sticky left-10 bg-white">{row.student.nis || '-'}</td>
                        <td className="py-2.5 px-4 border-r border-slate-200 font-semibold text-slate-800 sticky left-[95px] bg-white">{row.student.nama}</td>

                        {subjectsPeringkat.map(mapel => {
                          const grade = row.grades[mapel.id];
                          return (
                            <td key={mapel.id} className="py-2.5 px-2 border-r border-slate-200 text-center font-bold">
                              {grade !== undefined ? (
                                <span className={grade < 75 ? "text-rose-600" : "text-emerald-700"}>{grade}</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-slate-900 bg-indigo-50/20">{row.totalScore}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-indigo-700 bg-indigo-50/20">{row.averageScore}</td>
                        
                        {/* S, I, A CELLS ARE REMOVED */}

                        <td className="py-2.5 px-4 text-center bg-amber-50/50 text-amber-900 font-black text-sm border-l border-amber-200">
                          {rank === 1 ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-black">
                              ★ 1
                            </span>
                          ) : rank}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Subject averages row */}
                  <tr className="bg-slate-100 font-extrabold border-t border-slate-300">
                    <td colSpan={3} className="py-3 px-4 text-right pr-6">Rerata Nilai Mapel:</td>
                    {subjectsPeringkat.map(mapel => {
                      const avgObj = classAveragesPeringkat.find(c => c.mapelId === mapel.id);
                      return (
                        <td key={mapel.id} className="py-3 px-2 text-center text-slate-800">
                          {avgObj ? avgObj.average : 0}
                        </td>
                      );
                    })}
                    <td className="py-3 px-3 text-center bg-slate-200/50">-</td>
                    <td className="py-3 px-3 text-center font-black text-indigo-800 bg-indigo-100/50">
                      {overallClassAveragePeringkat}
                    </td>
                    <td className="bg-amber-100/30"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HIDDEN PRINT PREVIEWS (CAPTURED BY DYNAMIC PRINT HELPER)                   */}
      {/* ========================================================================= */}

      {/* 1. PRINT AREA FOR LEGER (Semua Mapel + Tahfidz, Total & Rata-rata) */}
      <div className="hidden">
        <div id="leger-print-area" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
          <div className="text-center" style={{ marginBottom: '12px' }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
              REKAPITULASI NILAI HASIL BELAJAR (LEGER)
            </h2>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              SMP AL IRSYAD SURAKARTA
            </h2>

            <table className="table-identity-print no-all-borders" style={{ width: '100%', border: 'none', borderCollapse: 'collapse', margin: '6px 0 10px 0', fontSize: '10px', textAlign: 'left' }}>
              <tbody>
                <tr style={{ border: 'none' }}>
                  <td style={{ border: 'none', width: '120px', fontWeight: 'bold', padding: '1px 3px', whiteSpace: 'nowrap' }}>Satuan Pendidikan</td>
                  <td style={{ border: 'none', width: '12px', textAlign: 'center', padding: '1px 0' }}>:</td>
                  <td style={{ border: 'none', width: '40%', padding: '1px 4px' }}>SMP Al Irsyad Surakarta</td>
                  <td style={{ border: 'none', width: '85px', fontWeight: 'bold', padding: '1px 3px', whiteSpace: 'nowrap' }}>Kelas</td>
                  <td style={{ border: 'none', width: '12px', textAlign: 'center', padding: '1px 0' }}>:</td>
                  <td style={{ border: 'none', padding: '1px 4px', fontWeight: 'bold' }}>{homeroomKelas?.nama || '-'}</td>
                </tr>
                <tr style={{ border: 'none' }}>
                  <td style={{ border: 'none', width: '120px', fontWeight: 'bold', padding: '1px 3px', whiteSpace: 'nowrap' }}>Tahun Pelajaran</td>
                  <td style={{ border: 'none', width: '12px', textAlign: 'center', padding: '1px 0' }}>:</td>
                  <td style={{ border: 'none', padding: '1px 4px' }}>{activePeriod.tahunAjaran}</td>
                  <td style={{ border: 'none', width: '85px', fontWeight: 'bold', padding: '1px 3px', whiteSpace: 'nowrap' }}>Wali Kelas</td>
                  <td style={{ border: 'none', width: '12px', textAlign: 'center', padding: '1px 0' }}>:</td>
                  <td style={{ border: 'none', padding: '1px 4px' }}>{activeTeacher.nama}</td>
                </tr>
                <tr style={{ border: 'none' }}>
                  <td style={{ border: 'none', width: '120px', fontWeight: 'bold', padding: '1px 3px', whiteSpace: 'nowrap' }}>Semester / Ujian</td>
                  <td style={{ border: 'none', width: '12px', textAlign: 'center', padding: '1px 0' }}>:</td>
                  <td style={{ border: 'none', padding: '1px 4px' }}>{activePeriod.semester} / {formatTipeUjian(activePeriod.tipeUjian)}</td>
                  <td style={{ border: 'none', width: '85px', fontWeight: 'bold', padding: '1px 3px', whiteSpace: 'nowrap' }}>Fase</td>
                  <td style={{ border: 'none', width: '12px', textAlign: 'center', padding: '1px 0' }}>:</td>
                  <td style={{ border: 'none', padding: '1px 4px', fontWeight: 'bold' }}>D</td>
                </tr>
              </tbody>
            </table>
          </div>

          <table className="table-data-print" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', fontSize: '8px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ border: '1px solid #000000', width: '2.5%', textAlign: 'center', padding: '3px 2px' }}>No</th>
                <th style={{ border: '1px solid #000000', width: '6.5%', textAlign: 'center', padding: '3px 2px' }}>NIS</th>
                <th style={{ border: '1px solid #000000', width: '20%', textAlign: 'left', padding: '3px 4px' }}>Nama Peserta Didik</th>
                {subjectsLeger.map((mapel, mIdx) => (
                  <th key={mapel.id || mIdx} style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px', fontSize: '7.5px' }}>
                    {mapel.nama.split(' ').map(w => (w.length > 8 ? w.slice(0, 4) + '.' : w)).join(' ')}
                  </th>
                ))}
                <th style={{ border: '1px solid #000000', width: '5%', textAlign: 'center', padding: '3px 2px', fontWeight: 'bold' }}>Jml</th>
                <th style={{ border: '1px solid #000000', width: '5%', textAlign: 'center', padding: '3px 2px', fontWeight: 'bold' }}>Rerata</th>
              </tr>
            </thead>
            <tbody>
              {displayedRowsLeger.map((row, idx) => {
                const displayNo = row.student.noAbsen !== undefined && row.student.noAbsen !== null ? row.student.noAbsen : idx + 1;
                return (
                  <tr key={row.student.id}>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '2px 2px' }}>{displayNo}</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '2px 2px' }}>{row.student.nis || '-'}</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'left', padding: '2px 4px', fontWeight: 'bold' }}>{row.student.nama}</td>
                    {subjectsLeger.map((mapel, mIdx) => {
                      const grade = row.grades[mapel.id];
                      return (
                        <td key={mapel.id || mIdx} style={{ border: '1px solid #000000', textAlign: 'center', padding: '2px 2px', fontWeight: 'bold' }}>
                          {grade !== undefined ? grade : '-'}
                        </td>
                      );
                    })}
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '2px 2px', fontWeight: 'bold' }}>{row.totalScore}</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '2px 2px', fontWeight: 'bold' }}>{row.averageScore}</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={3} style={{ border: '1px solid #000000', textAlign: 'right', padding: '3px 4px', fontWeight: 'bold' }}>Rata-rata Kelas:</td>
                {subjectsLeger.map((mapel, mIdx) => {
                  const avgObj = classAveragesLeger.find(c => c.mapelId === mapel.id);
                  return (
                    <td key={mapel.id || mIdx} style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px', fontWeight: 'bold' }}>
                      {avgObj ? avgObj.average : 0}
                    </td>
                  );
                })}
                <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px' }}>-</td>
                <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px', fontWeight: 'bold' }}>{overallClassAverageLeger}</td>
              </tr>
            </tbody>
          </table>

          {/* Signature Grid */}
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', fontSize: '10px' }}>
            <div style={{ textAlign: 'center', width: '30%' }}>
              <p style={{ margin: '0 0 40px 0' }}>Surakarta, {formattedReportDate}<br />Wali Kelas</p>
              <p style={{ margin: '0', fontWeight: 'bold', textDecoration: 'underline' }}>{activeTeacher.nama}</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#475569' }}>NIK. {activeTeacher.username || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PRINT AREA FOR PERINGKAT (Sama seperti sekarang tanpa S I A) */}
      <div className="hidden">
        <div id="peringkat-print-area" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
          <div className="text-center" style={{ marginBottom: '12px' }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
              REKAPITULASI HASIL BELAJAR DAN PERINGKAT KELAS
            </h2>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              SMP AL IRSYAD SURAKARTA
            </h2>

            <table className="table-identity-print no-all-borders" style={{ width: '100%', border: 'none', borderCollapse: 'collapse', margin: '6px 0 10px 0', fontSize: '10px', textAlign: 'left' }}>
              <tbody>
                <tr style={{ border: 'none' }}>
                  <td style={{ border: 'none', width: '120px', fontWeight: 'bold', padding: '1px 3px', whiteSpace: 'nowrap' }}>Satuan Pendidikan</td>
                  <td style={{ border: 'none', width: '12px', textAlign: 'center', padding: '1px 0' }}>:</td>
                  <td style={{ border: 'none', width: '40%', padding: '1px 4px' }}>SMP Al Irsyad Surakarta</td>
                  <td style={{ border: 'none', width: '85px', fontWeight: 'bold', padding: '1px 3px', whiteSpace: 'nowrap' }}>Kelas</td>
                  <td style={{ border: 'none', width: '12px', textAlign: 'center', padding: '1px 0' }}>:</td>
                  <td style={{ border: 'none', padding: '1px 4px', fontWeight: 'bold' }}>{homeroomKelas?.nama || '-'}</td>
                </tr>
                <tr style={{ border: 'none' }}>
                  <td style={{ border: 'none', width: '120px', fontWeight: 'bold', padding: '1px 3px', whiteSpace: 'nowrap' }}>Tahun Pelajaran</td>
                  <td style={{ border: 'none', width: '12px', textAlign: 'center', padding: '1px 0' }}>:</td>
                  <td style={{ border: 'none', padding: '1px 4px' }}>{activePeriod.tahunAjaran}</td>
                  <td style={{ border: 'none', width: '85px', fontWeight: 'bold', padding: '1px 3px', whiteSpace: 'nowrap' }}>Wali Kelas</td>
                  <td style={{ border: 'none', width: '12px', textAlign: 'center', padding: '1px 0' }}>:</td>
                  <td style={{ border: 'none', padding: '1px 4px' }}>{activeTeacher.nama}</td>
                </tr>
                <tr style={{ border: 'none' }}>
                  <td style={{ border: 'none', width: '120px', fontWeight: 'bold', padding: '1px 3px', whiteSpace: 'nowrap' }}>Semester / Ujian</td>
                  <td style={{ border: 'none', width: '12px', textAlign: 'center', padding: '1px 0' }}>:</td>
                  <td style={{ border: 'none', padding: '1px 4px' }}>{activePeriod.semester} / {formatTipeUjian(activePeriod.tipeUjian)}</td>
                  <td style={{ border: 'none', width: '85px', fontWeight: 'bold', padding: '1px 3px', whiteSpace: 'nowrap' }}>Fase</td>
                  <td style={{ border: 'none', width: '12px', textAlign: 'center', padding: '1px 0' }}>:</td>
                  <td style={{ border: 'none', padding: '1px 4px', fontWeight: 'bold' }}>D</td>
                </tr>
              </tbody>
            </table>
          </div>

          <table className="table-data-print" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', fontSize: '9px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ border: '1px solid #000000', width: '3%', textAlign: 'center', padding: '3px 2px' }}>No</th>
                <th style={{ border: '1px solid #000000', width: '8%', textAlign: 'center', padding: '3px 2px' }}>NIS</th>
                <th style={{ border: '1px solid #000000', width: '22%', textAlign: 'left', padding: '3px 4px' }}>Nama Peserta Didik</th>
                {subjectsPeringkat.map(mapel => (
                  <th key={mapel.id} style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px', fontSize: '8px' }}>
                    {mapel.nama.split(' ').map(w => (w.length > 9 ? w.slice(0, 4) + '.' : w)).join(' ')}
                  </th>
                ))}
                <th style={{ border: '1px solid #000000', width: '6%', textAlign: 'center', padding: '3px 2px', fontWeight: 'bold' }}>Jml</th>
                <th style={{ border: '1px solid #000000', width: '6%', textAlign: 'center', padding: '3px 2px', fontWeight: 'bold' }}>Rerata</th>
                {/* S, I, A HEADERS ARE REMOVED */}
                <th style={{ border: '1px solid #000000', width: '5%', textAlign: 'center', padding: '3px 2px', fontWeight: 'bold' }}>Rank</th>
              </tr>
            </thead>
            <tbody>
              {displayedRowsPeringkat.map((row, idx) => {
                const rank = rankMapPeringkat[row.student.id] || '-';
                const displayNo = row.student.noAbsen !== undefined && row.student.noAbsen !== null ? row.student.noAbsen : idx + 1;
                return (
                  <tr key={row.student.id}>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px' }}>{displayNo}</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px' }}>{row.student.nis || '-'}</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'left', padding: '3px 4px', fontWeight: 'bold' }}>{row.student.nama}</td>
                    {subjectsPeringkat.map(mapel => {
                      const grade = row.grades[mapel.id];
                      return (
                        <td key={mapel.id} style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px', fontWeight: 'bold' }}>
                          {grade !== undefined ? grade : '-'}
                        </td>
                      );
                    })}
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px', fontWeight: 'bold' }}>{row.totalScore}</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px', fontWeight: 'bold' }}>{row.averageScore}</td>
                    {/* S, I, A CELLS ARE REMOVED */}
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px', fontWeight: 'bold' }}>{rank}</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={3} style={{ border: '1px solid #000000', textAlign: 'right', padding: '3px 4px', fontWeight: 'bold' }}>Rata-rata Kelas:</td>
                {subjectsPeringkat.map(mapel => {
                  const avgObj = classAveragesPeringkat.find(c => c.mapelId === mapel.id);
                  return (
                    <td key={mapel.id} style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px', fontWeight: 'bold' }}>
                      {avgObj ? avgObj.average : 0}
                    </td>
                  );
                })}
                <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px' }}>-</td>
                <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px', fontWeight: 'bold' }}>{overallClassAveragePeringkat}</td>
                <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '3px 2px' }}></td>
              </tr>
            </tbody>
          </table>

          {/* Signature Grid */}
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', fontSize: '10px' }}>
            <div style={{ textAlign: 'center', width: '30%' }}>
              <p style={{ margin: '0 0 40px 0' }}>Surakarta, {formattedReportDate}<br />Wali Kelas</p>
              <p style={{ margin: '0', fontWeight: 'bold', textDecoration: 'underline' }}>{activeTeacher.nama}</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#475569' }}>NIK. {activeTeacher.username || '-'}</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
