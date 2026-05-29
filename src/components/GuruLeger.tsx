/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase, Siswa, Mapel, Guru, Kelas, PeriodeAkademik } from '../types';
import { Printer, AlertTriangle, FileSpreadsheet, ClipboardList, Info, TrendingUp, Users } from 'lucide-react';

interface GuruLegerProps {
  db: SchemaDatabase;
  guruId: string;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function GuruLeger({ db, guruId, onUpdate }: GuruLegerProps) {
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
          Menu <strong>Cetak Leger Raport</strong> ini dilindungi sistem dan eksklusif bagi pengajar yang memegang mandat amanah sebagai <b>Wali Kelas</b> di semester aktif ini.
        </p>
      </div>
    );
  }

  // Get Wali Kelas classroom info
  const homeroomKelas = activePeriod.snapshotKelas.find(k => k.id === activeTeacher.waliKelasKelasId);
  const homeroomStudents = activePeriod.snapshotSiswa.filter(s => s.kelasId === activeTeacher.waliKelasKelasId);
  const rawSubjects = activePeriod.snapshotMapel;
  const subjects = rawSubjects.filter(mapel => {
    const nameLower = mapel.nama.toLowerCase();
    const isPai = nameLower.includes('pai') || nameLower.includes('pendidikan agama islam') || nameLower.includes('agama islam') || nameLower.startsWith('pai');
    const isTahfidz = nameLower.includes('tahfidz') || nameLower.includes('tahfidh') || nameLower.includes('alqur') || nameLower.includes('qur\'an') || nameLower.includes('quran');
    return !isPai && !isTahfidz;
  });

  // Process grades, attendance, totals, averages, and rankings for students
  const studentRows = homeroomStudents.map(student => {
    let totalScore = 0;
    let gradedCount = 0;
    const grades: { [mapelId: string]: number } = {};

    subjects.forEach(mapel => {
      const gradeId = `${activePeriod.id}_${student.id}_${mapel.id}`;
      const gradeRecord = db.nilaiSiswa.find(n => n.id === gradeId);
      if (gradeRecord && typeof gradeRecord.nilaiAkhir === 'number') {
        grades[mapel.id] = gradeRecord.nilaiAkhir;
        totalScore += gradeRecord.nilaiAkhir;
        gradedCount++;
      }
    });

    const averageScore = gradedCount > 0 ? Number((totalScore / gradedCount).toFixed(2)) : 0;
    
    // Get attendance from absensiDanCatatan
    const attendance = db.absensiDanCatatan.find(
      a => a.periodeId === activePeriod.id && a.siswaId === student.id
    );

    return {
      student,
      grades,
      totalScore,
      averageScore,
      gradedCount,
      sakit: attendance?.sakit || 0,
      izin: attendance?.izin || 0,
      alfa: attendance?.alfa || 0,
    };
  });

  // Sort by Total Score descending to calculate Rank
  const sortedRows = [...studentRows].sort((a, b) => b.totalScore - a.totalScore);
  
  // Create student ID to Rank lookup mapping
  const rankMap: { [studentId: string]: number } = {};
  let currentRank = 1;
  sortedRows.forEach((row, index) => {
    if (index > 0 && row.totalScore < sortedRows[index - 1].totalScore) {
      currentRank = index + 1;
    }
    rankMap[row.student.id] = currentRank;
  });

  // Back to original alphabetical student list by name if desired, or let's sort by name for school ledger consistency
  const finalRowsAlphabetical = [...studentRows].sort((a, b) => a.student.nama.localeCompare(b.student.nama));

  // Key metrics for the class
  const classAverages = subjects.map(mapel => {
    let totalGrades = 0;
    let count = 0;
    studentRows.forEach(row => {
      const grade = row.grades[mapel.id];
      if (grade !== undefined) {
        totalGrades += grade;
        count++;
      }
    });
    return {
      mapelId: mapel.id,
      average: count > 0 ? Number((totalGrades / count).toFixed(2)) : 0,
      count
    };
  });

  const overallClassAverage = studentRows.length > 0
    ? Number((studentRows.reduce((sum, r) => sum + r.averageScore, 0) / studentRows.length).toFixed(2))
    : 0;

  // Formatting date indicator for reporting
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

  // Print execution method
  const handlePrintLeger = () => {
    const printContent = document.getElementById('leger-print-area');
    if (!printContent) return;

    // Remove old prints if any
    const existing = document.getElementById('print-helper-area');
    if (existing) {
      existing.remove();
    }

    // Create container outside React root
    const printHelper = document.createElement('div');
    printHelper.id = 'print-helper-area';
    printHelper.innerHTML = printContent.innerHTML;

    // Landscape page styling and rules
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
          size: A4 landscape !important;
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
          padding: 4px 6px !important;
          font-size: 10px !important;
          color: #000000 !important;
        }
        th {
          background-color: #f1f5f9 !important;
          font-weight: bold !important;
        }
        .text-center {
          text-align: center !important;
        }
        .text-left {
          text-align: left !important;
        }
        .text-right {
          text-align: right !important;
        }
        .no-print {
          display: none !important;
        }
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

  return (
    <div className="space-y-6">
      
      {/* Overview Card */}
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
              Cetak ringkasan kolektif seluruh nilai siswa beserta kehadiran dan peringkat dalam satu lembar landscape formal.
            </p>
          </div>
          <button
            onClick={handlePrintLeger}
            className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
          >
            <Printer className="w-4 h-4" />
            Cetak Leger (Landscape A4)
          </button>
        </div>

        {/* Dashboard Quick Summary Stats */}
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
              <p className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Rerata Akhir Kelas</p>
              <h4 className="text-lg font-black text-slate-800 font-sans mt-0.5">{overallClassAverage} / 100</h4>
            </div>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Mata Pelajaran</p>
              <h4 className="text-lg font-black text-slate-800 font-sans mt-0.5">{subjects.length} Mapel</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Screen Preview Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-hidden">
        <div className="flex items-center gap-1.5 mb-4 text-slate-500 text-xs font-semibold">
          <Info className="w-4 h-4 text-slate-400" />
          <span>Pratinjau Leger Kelas (Scroll horizontal jika tabel terlalu luas):</span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[500px]">
          <table className="w-full text-slate-700 text-xs text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-3 font-bold border-r border-slate-200 text-center w-10 sticky left-0 bg-slate-50">No</th>
                <th className="py-3 px-3 font-bold border-r border-slate-200 text-center sticky left-10 bg-slate-50 min-w-[100px] w-20">NIS</th>
                <th className="py-3 px-4 font-bold border-r border-slate-200 sticky left-[120px] bg-slate-50 min-w-[200px]">Nama Peserta Didik</th>
                {subjects.map(mapel => (
                  <th key={mapel.id} className="py-3 px-2 font-bold border-r border-slate-200 text-center min-w-[70px] max-w-[100px]" title={mapel.nama}>
                    <div className="truncate text-[10px] tracking-tight">{mapel.nama}</div>
                  </th>
                ))}
                <th className="py-3 px-3 font-bold border-r border-slate-200 text-center bg-indigo-50/50">Total</th>
                <th className="py-3 px-3 font-bold border-r border-slate-200 text-center bg-indigo-50/50">Rerata</th>
                <th className="py-3 px-3 font-semibold border-r border-slate-200 text-center text-amber-800 bg-amber-50/50">S</th>
                <th className="py-3 px-3 font-semibold border-r border-slate-200 text-center text-amber-800 bg-amber-50/50">I</th>
                <th className="py-3 px-3 font-semibold border-r border-slate-200 text-center text-amber-800 bg-amber-50/50">A</th>
                <th className="py-3 px-3 font-bold text-center bg-emerald-50 text-emerald-800">Rank</th>
              </tr>
            </thead>
            <tbody>
              {finalRowsAlphabetical.map((row, idx) => {
                const rank = rankMap[row.student.id] || '-';
                return (
                  <tr key={row.student.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono text-slate-400 sticky left-0 bg-white">{idx + 1}</td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono text-slate-500 sticky left-10 bg-white">{row.student.nis || '-'}</td>
                    <td className="py-2.5 px-4 border-r border-slate-200 font-semibold text-slate-800 sticky left-[120px] bg-white">{row.student.nama}</td>
                    
                    {subjects.map(mapel => {
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
                    
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center font-medium bg-amber-50/10">{row.sakit || 0}</td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center font-medium bg-amber-50/10">{row.izin || 0}</td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center font-medium bg-amber-50/10 text-rose-500">{row.alfa || 0}</td>
                    
                    <td className="py-2.5 px-3 text-center bg-emerald-50/30 text-emerald-800 font-black text-sm">{rank}</td>
                  </tr>
                );
              })}
              
              {/* Row for Subject averages */}
              <tr className="bg-slate-100 font-extrabold border-t border-slate-300">
                <td colSpan={3} className="py-3 px-4 text-right pr-6">Rerata Nilai Mapel:</td>
                {subjects.map(mapel => {
                  const avgObj = classAverages.find(c => c.mapelId === mapel.id);
                  return (
                    <td key={mapel.id} className="py-3 px-2 text-center text-slate-800">
                      {avgObj ? avgObj.average : 0}
                    </td>
                  );
                })}
                <td colSpan={6} className="bg-slate-100"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* HIDDEN PRINT PREVIEW BLOCK (EXCLUSIVELY DESCRIPTIVE & CAPTURED BY JS PRINT HANDLER) */}
      <div className="hidden">
        <div id="leger-print-area" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
          
          {/* Header */}
          <div className="text-center" style={{ marginBottom: '15px' }}>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
              REKAPITULASI NILAI HASIL BELAJAR (LEGER)
            </h2>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              SMP AL IRSYAD SURAKARTA
            </h2>
            
            <table style={{ width: '100%', border: 'none', margin: '15px 0', fontSize: '11px' }} className="no-all-borders">
              <tbody>
                <tr style={{ border: 'none' }}>
                  <td style={{ border: 'none', width: '12%', fontWeight: 'bold', padding: '2px' }}>Satuan Pendidikan</td>
                  <td style={{ border: 'none', width: '30%', padding: '2px' }}>: SMP Al Irsyad Surakarta</td>
                  <td style={{ border: 'none', width: '12%', fontWeight: 'bold', padding: '2px' }}>Kelas</td>
                  <td style={{ border: 'none', padding: '2px' }}>: {homeroomKelas?.nama}</td>
                </tr>
                <tr style={{ border: 'none' }}>
                  <td style={{ border: 'none', fontWeight: 'bold', padding: '2px' }}>Tahun Pelajaran</td>
                  <td style={{ border: 'none', padding: '2px' }}>: {activePeriod.tahunAjaran}</td>
                  <td style={{ border: 'none', fontWeight: 'bold', padding: '2px' }}>Wali Kelas</td>
                  <td style={{ border: 'none', padding: '2px' }}>: {activeTeacher.nama}</td>
                </tr>
                <tr style={{ border: 'none' }}>
                  <td style={{ border: 'none', fontWeight: 'bold', padding: '2px' }}>Semester / Ujian</td>
                  <td style={{ border: 'none', padding: '2px' }}>: {activePeriod.semester} / {activePeriod.tipeUjian}</td>
                  <td style={{ border: 'none', fontWeight: 'none', padding: '2px' }}></td>
                  <td style={{ border: 'none', padding: '2px' }}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Leger Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', fontSize: '9px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ border: '1px solid #000000', width: '3%', textAlign: 'center', padding: '4px' }}>No</th>
                <th style={{ border: '1px solid #000000', width: '8%', textAlign: 'center', padding: '4px' }}>NIS</th>
                <th style={{ border: '1px solid #000000', width: '22%', textAlign: 'left', padding: '4px' }}>Nama Peserta Didik</th>
                {subjects.map(mapel => (
                  <th key={mapel.id} style={{ border: '1px solid #000000', textAlign: 'center', padding: '4px', transform: 'rotate(0deg)', fontSize: '8px' }}>
                    {mapel.nama.split(' ').map(word => {
                      // Abbreviate if too long to save landscape space
                      if (word.length > 10) return word.slice(0, 4) + '.';
                      return word;
                    }).join(' ')}
                  </th>
                ))}
                <th style={{ border: '1px solid #000000', width: '5%', textAlign: 'center', padding: '4px', fontWeight: 'bold' }}>Jml</th>
                <th style={{ border: '1px solid #000000', width: '5%', textAlign: 'center', padding: '4px', fontWeight: 'bold' }}>Rerata</th>
                <th style={{ border: '1px solid #000000', width: '2%', textAlign: 'center', padding: '4px', fontWeight: 'bold' }}>S</th>
                <th style={{ border: '1px solid #000000', width: '2%', textAlign: 'center', padding: '4px', fontWeight: 'bold' }}>I</th>
                <th style={{ border: '1px solid #000000', width: '2%', textAlign: 'center', padding: '4px', fontWeight: 'bold' }}>A</th>
                <th style={{ border: '1px solid #000000', width: '4%', textAlign: 'center', padding: '4px', fontWeight: 'bold' }}>Rank</th>
              </tr>
            </thead>
            <tbody>
              {finalRowsAlphabetical.map((row, idx) => {
                const rank = rankMap[row.student.id] || '-';
                return (
                  <tr key={row.student.id}>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '4px' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '4px' }}>{row.student.nis || '-'}</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'left', padding: '4px', fontWeight: 'bold' }}>{row.student.nama}</td>
                    {subjects.map(mapel => {
                      const grade = row.grades[mapel.id];
                      return (
                        <td key={mapel.id} style={{ border: '1px solid #000000', textAlign: 'center', padding: '4px', fontWeight: 'bold' }}>
                          {grade !== undefined ? grade : '-'}
                        </td>
                      );
                    })}
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '4px', fontWeight: 'bold' }}>{row.totalScore}</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '4px', fontWeight: 'bold' }}>{row.averageScore}</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '4px' }}>{row.sakit || 0}</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '4px' }}>{row.izin || 0}</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '4px' }}>{row.alfa || 0}</td>
                    <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '4px', fontWeight: 'bold' }}>{rank}</td>
                  </tr>
                );
              })}
              
              {/* Row for Subject averages */}
              <tr>
                <td colSpan={3} style={{ border: '1px solid #000000', textAlign: 'right', padding: '4px', fontWeight: 'bold' }}>Rata-rata Kelas:</td>
                {subjects.map(mapel => {
                  const avgObj = classAverages.find(c => c.mapelId === mapel.id);
                  return (
                    <td key={mapel.id} style={{ border: '1px solid #000000', textAlign: 'center', padding: '4px', fontWeight: 'bold' }}>
                      {avgObj ? avgObj.average : 0}
                    </td>
                  );
                })}
                <td colSpan={5} style={{ border: '1px solid #000000', padding: '4px' }}></td>
                <td style={{ border: '1px solid #000000', textAlign: 'center', padding: '4px', fontWeight: 'bold' }}>{overallClassAverage}</td>
              </tr>
            </tbody>
          </table>

          {/* Signature Grid */}
          <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <div style={{ textAlign: 'center', width: '30%' }}>
              <p style={{ margin: '0 0 55px 0' }}><br />Mengetahui,<br />Kemajelisan Orang Tua / Wali</p>
              <p style={{ margin: '0', fontWeight: 'bold' }}>.....................................................</p>
            </div>
            
            <div style={{ textAlign: 'center', width: '30%' }}>
              <p style={{ margin: '0 0 45px 0' }}>Mengetahui,<br />Kepala Sekolah</p>
              <p style={{ margin: '0', fontWeight: 'bold', textDecoration: 'underline' }}>Andreas Raymonda, S.Pd, M.Hum</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#475569' }}>NIK. 103.244.0072</p>
            </div>

            <div style={{ textAlign: 'center', width: '30%' }}>
              <p style={{ margin: '0 0 45px 0' }}>Surakarta, {formattedReportDate}<br />Wali Kelas</p>
              <p style={{ margin: '0', fontWeight: 'bold', textDecoration: 'underline' }}>{activeTeacher.nama}</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#475569' }}>NIK. {activeTeacher.username || '-'}</p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
