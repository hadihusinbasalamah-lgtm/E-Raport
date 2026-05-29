/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SchemaDatabase, Siswa, AbsensiDanCatatan, NilaiSiswa, EkstrakurikulerItem } from '../types';
import { Printer, Save, CheckCircle2, FileText, X, AlertTriangle, UserCheck, Plus, Trash2 } from 'lucide-react';

interface GuruCetakProps {
  db: SchemaDatabase;
  guruId: string;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function GuruCetak({ db, guruId, onUpdate }: GuruCetakProps) {
  const activePeriod = db.periodList.find(p => p.id === db.activePeriodId);
  const teacher = db.guru.find(g => g.id === guruId);
  const activeTeacher = activePeriod?.snapshotGuru.find(g => g.id === guruId) || teacher;

  // Selected student for printing preview
  const [previewSiswa, setPreviewSiswa] = useState<Siswa | null>(null);

  // Attendance & Extracurricular form local state
  const [selectedSiswaId, setSelectedSiswaId] = useState<string | null>(null);
  const [sakit, setSakit] = useState(0);
  const [izin, setIzin] = useState(0);
  const [alfa, setAlfa] = useState(0);
  const [ekskulList, setEkskulList] = useState<EkstrakurikulerItem[]>([]);
  const [message, setMessage] = useState('');

  if (!activePeriod) {
    return (
      <div className="p-8 text-center bg-amber-50 rounded-2xl border border-amber-200 text-amber-900">
        <h3 className="text-sm font-bold">Periode Akademik Aktif Belum Dirilis oleh Admin</h3>
        <p className="text-xs text-slate-500 mt-1">Lembaga Administrasi Akademik harus merilis Tahun Ajaran sebelum Guru dapat mengakses Cetak Raport.</p>
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
          Menu <strong>Cetak Kurikulum Merdeka Raport</strong> ini dilindungi sistem dan eksklusif bagi pengajar yang memegang mandat amanah sebagai <b>Wali Kelas</b> di semester aktif ini.
        </p>
        <div className="p-3 bg-white border border-rose-100 rounded-xl text-left">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Status Jabatan Terbaca:</p>
          <div className="text-[11px] text-slate-700">📌 {activeTeacher.nama} • <span className="font-bold text-rose-600">BUKAN WALI KELAS</span></div>
        </div>
      </div>
    );
  }

  // Get Wali Kelas classroom info
  const homeroomKelas = activePeriod.snapshotKelas.find(k => k.id === activeTeacher.waliKelasKelasId);
  const homeroomStudents = activePeriod.snapshotSiswa.filter(s => s.kelasId === activeTeacher.waliKelasKelasId);

  // Helper to add, update and remove extracurriculars
  const handleAddEkskul = () => {
    setEkskulList([...ekskulList, { nama: '', nilai: 'A' }]);
  };

  const handleUpdateEkskulFieldName = (index: number, val: string) => {
    const copy = [...ekskulList];
    copy[index].nama = val;
    setEkskulList(copy);
  };

  const handleUpdateEkskulFieldNilai = (index: number, val: 'A' | 'B' | 'C') => {
    const copy = [...ekskulList];
    copy[index].nilai = val;
    setEkskulList(copy);
  };

  const handleRemoveEkskul = (index: number) => {
    const copy = ekskulList.filter((_, i) => i !== index);
    setEkskulList(copy);
  };

  // Load attendance form inputs for selected student
  const handleSelectSiswa = (siswa: Siswa) => {
    setSelectedSiswaId(siswa.id);
    const existing = db.absensiDanCatatan.find(
      a => a.periodeId === activePeriod.id && a.siswaId === siswa.id
    );

    if (existing) {
      setSakit(existing.sakit);
      setIzin(existing.izin);
      setAlfa(existing.alfa);
      setEkskulList(existing.ekstrakurikuler || [
        { nama: 'Pendidikan Pramuka', nilai: 'A' }
      ]);
    } else {
      setSakit(0);
      setIzin(0);
      setAlfa(0);
      setEkskulList([
        { nama: 'Pendidikan Pramuka', nilai: 'A' }
      ]);
    }
    setMessage('');
  };

  const handleSaveAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSiswaId || !homeroomKelas) return;

    const recordKey = `${activePeriod.id}_${selectedSiswaId}`;

    const newAttendanceRecord: AbsensiDanCatatan = {
      id: recordKey,
      periodeId: activePeriod.id,
      siswaId: selectedSiswaId,
      kelasId: homeroomKelas.id,
      sakit,
      izin,
      alfa,
      catatanWaliKelas: '',
      ekstrakurikuler: ekskulList.filter(item => item.nama.trim() !== '')
    };

    const filtered = db.absensiDanCatatan.filter(a => a.id !== recordKey);
    const updatedList = [...filtered, newAttendanceRecord];

    onUpdate({
      ...db,
      absensiDanCatatan: updatedList
    });

    setMessage("Absensi & Ekstrakurikuler berhasil disimpan!");
    setTimeout(() => setMessage(''), 3000);
  };

  // Helper inside report print modal to compile grades
  const getSiswaReportSheet = (student: Siswa) => {
    // Collect all subjects published in active period snapshot
    const results: { mapelNama: string; nilaiAkhir: number; capaian: string }[] = [];

    activePeriod.snapshotMapel.forEach(mapel => {
      const gradeId = `${activePeriod.id}_${student.id}_${mapel.id}`;
      const gradeRecord = db.nilaiSiswa.find(n => n.id === gradeId);
      
      if (gradeRecord) {
        results.push({
          mapelNama: mapel.nama,
          nilaiAkhir: gradeRecord.nilaiAkhir,
          capaian: gradeRecord.capaianKompetensi || 'Telah mengikuti pembelajaran dengan baik.'
        });
      }
    });

    const attendance = db.absensiDanCatatan.find(
      a => a.periodeId === activePeriod.id && a.siswaId === student.id
    );

    return {
      results,
      attendance
    };
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-2">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Printer className="w-5 h-5 text-emerald-600" />
          Cetak Raport Siswa (Wali Kelas)
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Akses Wali Kelas untuk input ketidakhadiran, catatan asuhan kepribadian, dan cetak lembar raport kelas <strong>{homeroomKelas?.nama}</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Students list of homeroom class */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Daftar Siswa Kelas {homeroomKelas?.nama}</span>
          
          <div className="divide-y divide-slate-150 border border-slate-100 rounded-xl overflow-hidden max-h-[480px] overflow-y-auto">
            {homeroomStudents.length === 0 ? (
              <div className="p-4 text-center text-slate-400 italic text-xs">Tidak ada siswa terdaftar dalam kelas ini.</div>
            ) : (
              homeroomStudents.map((s, idx) => {
                const isFormOpened = selectedSiswaId === s.id;
                const attendanceSaved = db.absensiDanCatatan.some(a => a.periodeId === activePeriod.id && a.siswaId === s.id);
                
                return (
                  <div 
                    key={s.id} 
                    className={`p-3.5 flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer transition-colors ${isFormOpened ? 'bg-emerald-50/40 hover:bg-emerald-50/45 border-l-4 border-emerald-600' : ''}`}
                    onClick={() => handleSelectSiswa(s)}
                  >
                    <div>
                      <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        {idx + 1}. {s.nama}
                        {attendanceSaved && (
                          <span className="w-2 h-2 bg-emerald-500 rounded-full" title="Kehadiran & Catatan Terisi" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">NISN: {s.nisn} • NIS: {s.nis}</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSiswa(s);
                          setPreviewSiswa(s);
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-800 rounded-lg text-[10px] font-bold transition-all border border-slate-200 hover:border-emerald-300 flex items-center gap-1"
                      >
                        <Printer className="w-3 h-3" />
                        Cetak
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Attendance and Comment edit panel */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          {selectedSiswaId ? (
            (() => {
              const currentSiswa = homeroomStudents.find(s => s.id === selectedSiswaId);
              return (
                <form onSubmit={handleSaveAttendance} className="space-y-4">
                  <div className="flex justify-between items-start border-b border-sidebar-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold tracking-wider block uppercase">Input Kehadiran & Catatan Wali</span>
                      <strong className="text-sm text-slate-800 font-bold">{currentSiswa?.nama}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewSiswa(currentSiswa || null)}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold hover:bg-emerald-100 flex items-center gap-1 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Pratinjau Raport Lembar
                    </button>
                  </div>

                  {message && (
                    <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {message}
                    </div>
                  )}

                  {/* Attendance numbers */}
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                    <span className="text-xs font-bold text-slate-700 block">Bagian 1: Rekapitulasi Absensi Ketidakhadiran</span>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sakit (Hari)</label>
                        <input
                          type="number"
                          min="0"
                          value={sakit}
                          onChange={e => setSakit(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Izin (Hari)</label>
                        <input
                          type="number"
                          min="0"
                          value={izin}
                          onChange={e => setIzin(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tanpa Ket. / Alfa (Hari)</label>
                        <input
                          type="number"
                          min="0"
                          value={alfa}
                          onChange={e => setAlfa(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ekstrakurikuler List (Bagian 2) */}
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                    <div className="flex justify-between items-center bg-slate-100/40 p-2 rounded-lg">
                      <span className="text-xs font-bold text-slate-700">Bagian 2: Nilai Kegiatan Ekstrakurikuler</span>
                      <button
                        type="button"
                        onClick={handleAddEkskul}
                        className="px-2.5 py-1 bg-emerald-650 hover:bg-emerald-700 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        Tambah Ekskul
                      </button>
                    </div>

                    {ekskulList.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic py-4 text-center bg-white rounded-lg border border-dashed border-slate-200">
                        Belum ada kegiatan ekstrakurikuler yang ditambahkan. Klik tombol di atas untuk menambah.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {ekskulList.map((item, index) => (
                          <div key={index} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200/80 shadow-sm">
                            <div className="flex-1">
                              <input
                                type="text"
                                value={item.nama}
                                onChange={e => handleUpdateEkskulFieldName(index, e.target.value)}
                                placeholder="Pendidikan Pramuka, Seni Musik, dll."
                                className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                                required
                              />
                            </div>
                            <div className="w-24">
                              <select
                                value={item.nilai}
                                onChange={e => handleUpdateEkskulFieldNilai(index, e.target.value as 'A' | 'B' | 'C')}
                                className="w-full px-2 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-emerald-800"
                              >
                                <option value="A">Nilai A</option>
                                <option value="B">Nilai B</option>
                                <option value="C">Nilai C</option>
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveEkskul(index)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Simpan Data & Ekstrakurikuler
                  </button>
                </form>
              );
            })()
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-16 text-slate-400 font-sans italic p-4 text-center">
              <UserCheck className="w-10 h-10 text-slate-300 mb-2" />
              Sila klik / pilih nama siswa di daftar sebelah kiri untuk merekam absensi dan mencetak lembar raport.
            </div>
          )}
        </div>

      </div>

      {/* RENDER THE MAJESTIC REPORT PAPER PRINT PREVIEW MODAL */}
      {previewSiswa && (() => {
        const reportData = getSiswaReportSheet(previewSiswa);
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl relative my-8 flex flex-col max-h-[90vh]">
              
              {/* Modal controls bar */}
              <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0 bg-slate-50 rounded-t-2xl">
                <div>
                  <h3 className="font-bold text-xs text-slate-800">Pratinjau Lembar Raport Cetak</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Berukuran kertas standar A4 portrait dengan tata letak profesional</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const printContent = document.getElementById('raport-print-area');
                      if (!printContent) return;

                      // Remove old prints if any
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
                          }
                          /* Hide absolutely everything at body root level except the print area */
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
                            padding: 0 !important;
                            margin: 0 !important;
                          }
                          #raport-print-area {
                            display: block !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            gap: 0 !important;
                          }
                          @page {
                            size: A4 portrait !important;
                            margin: 10mm 12mm 10mm 12mm !important;
                          }
                          .raport-page {
                            width: 100% !important;
                            min-height: 260mm !important;
                            height: 260mm !important;
                            max-height: 260mm !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            border: none !important;
                            box-shadow: none !important;
                            background: #ffffff !important;
                            box-sizing: border-box !important;
                            display: flex !important;
                            flex-direction: column !important;
                            justify-content: space-between !important;
                            page-break-after: always !important;
                            break-after: page !important;
                            overflow: hidden !important;
                          }
                          .raport-page:last-of-type {
                            page-break-after: avoid !important;
                            break-after: avoid !important;
                          }
                          .print-no-break {
                            break-inside: avoid !important;
                          }
                          .raport-page td, .raport-page th {
                            padding: 3px 5px !important;
                            font-size: 11px !important;
                            line-height: 1.2 !important;
                          }
                          .raport-page th {
                            font-weight: bold !important;
                            padding: 4px 5px !important;
                          }
                          /* Border rules strictly inside tables except border-none */
                          .raport-page table:not(.border-none) {
                            border: 1px solid #000000 !important;
                            border-collapse: collapse !important;
                            width: 100% !important;
                          }
                          .raport-page table:not(.border-none) th, 
                          .raport-page table:not(.border-none) td {
                            border: 1px solid #000000 !important;
                          }
                          .raport-page table.table-raport-nilai {
                            table-layout: fixed !important;
                            width: 100% !important;
                            word-wrap: break-word !important;
                          }
                          .raport-page table.table-raport-nilai th,
                          .raport-page table.table-raport-nilai td {
                            word-break: break-word !important;
                            overflow-wrap: break-word !important;
                          }
                          .raport-page table.border-none,
                          .raport-page table.border-none tr,
                          .raport-page table.border-none td {
                            border: none !important;
                            border-width: 0 !important;
                          }
                          /* Tighter print spacing for elements to fit perfect to sheet */
                          .raport-page .h-20 {
                            height: 10mm !important;
                          }
                          .raport-page .mb-6 {
                            margin-bottom: 4mm !important;
                          }
                          .raport-page .mb-5 {
                            margin-bottom: 3mm !important;
                          }
                          .raport-page .mt-6 {
                            margin-top: 4mm !important;
                          }
                          .raport-page .gap-5 {
                            gap: 3mm !important;
                          }
                          .raport-page .grid-cols-12 {
                            display: grid !important;
                            grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
                          }
                          .raport-page .col-span-12 {
                            grid-column: span 12 / span 12 !important;
                          }
                          .raport-page .col-span-7 {
                            grid-column: span 7 / span 7 !important;
                          }
                          .raport-page .col-span-5 {
                            grid-column: span 5 / span 5 !important;
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
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all active:scale-95"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Cetak Fisik / PDF
                  </button>
                  <button
                    onClick={() => setPreviewSiswa(null)}
                    className="p-1 px-2.5 text-slate-400 hover:text-slate-800 rounded bg-slate-100 font-bold transition-colors text-xs"
                  >
                    <X className="w-4 h-4 inline" /> Tutup
                  </button>
                </div>
              </div>

              {/* Document/Paper Page body inside modal (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 text-black bg-slate-200/50 font-sans leading-normal flex flex-col items-center gap-6">
                
                {/* Print and Screen stylesheet integration */}
                <style>{`
                  @media screen {
                    .raport-page {
                      width: 210mm;
                      min-height: 297mm;
                      padding: 20mm 15mm;
                      margin: 0 auto;
                      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                      border: 1px solid #cbd5e1;
                      border-radius: 4px;
                      background: white;
                      box-sizing: border-box;
                      display: flex;
                      flex-direction: column;
                      justify-content: space-between;
                    }
                    .raport-page.raport-cover {
                      justify-content: flex-start !important;
                    }
                  }
                  @media print {
                    @page {
                      size: A4 portrait;
                      margin: 10mm 12mm 10mm 12mm !important;
                    }
                    
                    /* Hide standard live app UI completely scrollable content, buttons, sidebar, backgrounds */
                    body * {
                      visibility: hidden !important;
                    }

                    /* Unhide only the print area and its contents */
                    #raport-print-area, #raport-print-area * {
                      visibility: visible !important;
                    }

                    /* Absolute positioning at top-left of paper printable sheet */
                    #raport-print-area {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 100% !important;
                      height: auto !important;
                      padding: 0 !important;
                      margin: 0 !important;
                      border: none !important;
                      box-shadow: none !important;
                      background: #ffffff !important;
                      gap: 0 !important;
                      display: block !important;
                    }

                    /* Page break and force sizing for print sheets */
                    .raport-page {
                      width: 100% !important;
                      min-height: 260mm !important;
                      height: 260mm !important;
                      max-height: 260mm !important;
                      padding: 0 !important;
                      margin: 0 !important;
                      border: none !important;
                      box-shadow: none !important;
                      background: #ffffff !important;
                      box-sizing: border-box !important;
                      display: flex !important;
                      flex-direction: column !important;
                      justify-content: space-between !important;
                      page-break-after: always !important;
                      break-after: page !important;
                      overflow: hidden !important;
                    }
                    
                    .raport-page:last-of-type {
                      page-break-after: avoid !important;
                      break-after: avoid !important;
                      margin-bottom: 0 !important;
                    }

                    .raport-page.raport-cover {
                      justify-content: flex-start !important;
                    }

                    .raport-page td, .raport-page th {
                      padding: 3px 5px !important;
                      font-size: 11px !important;
                      line-height: 1.2 !important;
                    }
                    .raport-page th {
                      font-weight: bold !important;
                      padding: 4px 5px !important;
                    }

                    /* Border rules strictly inside tables except border-none */
                    .raport-page table:not(.border-none) {
                      border: 1px solid #000000 !important;
                      border-collapse: collapse !important;
                      width: 100% !important;
                    }
                    .raport-page table:not(.border-none) th, 
                    .raport-page table:not(.border-none) td {
                      border: 1px solid #000000 !important;
                      border-color: #000000 !important;
                    }
                    .raport-page table.table-raport-nilai {
                      table-layout: fixed !important;
                      width: 100% !important;
                      word-wrap: break-word !important;
                    }
                    .raport-page table.table-raport-nilai th,
                    .raport-page table.table-raport-nilai td {
                      word-break: break-word !important;
                      overflow-wrap: break-word !important;
                    }
                    .raport-page table.border-none,
                    .raport-page table.border-none tr,
                    .raport-page table.border-none td {
                      border: none !important;
                      border-width: 0 !important;
                    }
                    
                    /* Tighter print spacing for elements to fit perfect to sheet */
                    .raport-page .h-20 {
                      height: 10mm !important;
                    }
                    .raport-page .mb-6 {
                      margin-bottom: 4mm !important;
                    }
                    .raport-page .mb-5 {
                      margin-bottom: 3mm !important;
                    }
                    .raport-page .mt-6 {
                      margin-top: 4mm !important;
                    }
                    .raport-page .gap-5 {
                      gap: 3mm !important;
                    }
                    .raport-page .grid-cols-12 {
                      display: grid !important;
                      grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
                    }
                    .raport-page .col-span-12 {
                      grid-column: span 12 / span 12 !important;
                    }
                    .raport-page .col-span-7 {
                      grid-column: span 7 / span 7 !important;
                    }
                    .raport-page .col-span-5 {
                      grid-column: span 5 / span 5 !important;
                    }
                  }
                `}</style>

                <div 
                  id="raport-print-area" 
                  className="w-[210mm] flex flex-col gap-6"
                >
                  {(() => {
                    // Helper to split competency descriptions into Mastery vs Needed support
                    const splitCapaian = (desc: string) => {
                      const fallback = {
                        master: 'Menunjukkan penguasaan sangat baik dalam keseluruhan tujuan pembelajaran yang ditempuh.',
                        needsImprovement: 'Perlu bimbingan dan pembiasaan berkelanjutan dalam pemantapan materi.'
                      };
                      if (!desc || desc.trim() === '') return fallback;

                      const separators = [
                        ' Serta perlu bimbingan ',
                        ' serta perlu bimbingan ',
                        ' Serta perlu bimbingan dalam ',
                        ' serta perlu bimbingan dalam ',
                        '. Serta perlu bimbingan ',
                        '. serta perlu bimbingan ',
                        'perlu bimbingan dalam',
                        'Perlu bimbingan dalam'
                      ];

                      for (const sep of separators) {
                        const idx = desc.toLowerCase().indexOf(sep.toLowerCase());
                        if (idx !== -1) {
                          let master = desc.substring(0, idx).trim();
                          let needsImprovement = desc.substring(idx + sep.length).trim();

                          if (!needsImprovement.toLowerCase().startsWith('perlu bimbingan')) {
                            needsImprovement = 'Perlu bimbingan ' + needsImprovement;
                          } else {
                            needsImprovement = needsImprovement.charAt(0).toUpperCase() + needsImprovement.slice(1);
                          }

                          if (master && !master.endsWith('.')) master += '.';
                          if (needsImprovement && !needsImprovement.endsWith('.')) needsImprovement += '.';

                          return { master, needsImprovement };
                        }
                      }

                      return {
                        master: desc.endsWith('.') ? desc : desc + '.',
                        needsImprovement: 'Perlu bimbingan dalam pemantapan pemahaman keseluruhan materi.'
                      };
                    };

                    // Helper to identify Yayasan religious subjects
                    const isYayasanSubject = (name: string): boolean => {
                      const lowercaseName = name.toLowerCase();
                      return (
                        lowercaseName.includes('aqidah') ||
                        lowercaseName.includes('akidah') ||
                        lowercaseName.includes('fiqih') ||
                        lowercaseName.includes('fikih') ||
                        lowercaseName.includes('ski') ||
                        lowercaseName.includes('sejarah kebudayaan islam') ||
                        lowercaseName.includes('bahasa arab') ||
                        lowercaseName.includes('tahfidz') ||
                        lowercaseName.includes('qur\'an') ||
                        lowercaseName.includes('quran') ||
                        lowercaseName.includes('hadist') ||
                        lowercaseName.includes('hadits') ||
                        lowercaseName.includes('al-qur') ||
                        lowercaseName.includes('ulumul quran')
                      );
                    };

                    const rawResults = reportData.results;
                    const unfilteredUmum = rawResults.filter(r => !isYayasanSubject(r.mapelNama));
                    const yayasanList = rawResults.filter(r => isYayasanSubject(r.mapelNama));

                    // Sort umumList to put "Pendidikan Agama Islam" at position 1 (index 0)
                    const umumList = [...unfilteredUmum].sort((a, b) => {
                      const aAgama = a.mapelNama.toLowerCase().includes('pendidikan agama islam') || a.mapelNama.toLowerCase().includes('agama islam');
                      const bAgama = b.mapelNama.toLowerCase().includes('pendidikan agama islam') || b.mapelNama.toLowerCase().includes('agama islam');
                      if (aAgama && !bAgama) return -1;
                      if (!aAgama && bAgama) return 1;
                      return 0;
                    });

                    // Distribute subjects to 3 pages exactly as in your document
                    const page1Umum = umumList.slice(0, 5); // Subjects 1 to 5 (Mata Pelajaran Umum)
                    const page2Umum = umumList.slice(5, 11); // Subjects 6 to 11 (Mata Pelajaran Umum)
                    const page2Yayasan = yayasanList.slice(0, 1); // Subject 12 (Aqidah - YAYASAN)
                    const page3Yayasan = yayasanList.slice(1); // Subjects 13 to 16 (Fiqih, SKI, Arab, Tahfidz)

                    const formattedSemester = (sem: string) => {
                      if (sem.toLowerCase().includes('ganjil') || sem === '1' || sem.toLowerCase() === 'i') {
                        return 'I (Satu)';
                      }
                      return 'II (Dua)';
                    };

                    const formattedReportDate = activePeriod.tanggalRaport 
                      ? new Date(activePeriod.tanggalRaport).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) 
                      : new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'});

                    return (
                      <>
                        {/* ================= COVER PAGE ================= */}
                        <div className="raport-page raport-cover text-black flex flex-col justify-start" style={{ minHeight: '260mm', fontFamily: '"Times New Roman", Times, serif' }}>
                          <div className="text-center mt-12 print:mt-10">
                            <h1 className="text-[20px] font-bold tracking-widest uppercase text-black leading-relaxed">
                              LAPORAN HASIL BELAJAR SISWA
                            </h1>
                            <h1 className="text-[20px] font-bold tracking-widest uppercase text-black leading-relaxed">
                              SMP AL IRSYAD SURAKARTA
                            </h1>
                          </div>

                          <div className="flex-grow print:flex-grow h-[80mm] print:h-auto" />

                          <div className="flex flex-col items-center gap-4 w-full max-w-[480px] mx-auto text-black">
                            <div className="w-full text-center">
                              <p className="text-[20px] font-bold tracking-widest text-[#000000] uppercase mb-2">NAMA PESERTA DIDIK</p>
                              <div className="border border-black w-full py-4 px-4 text-center font-normal text-[20px] tracking-wide uppercase bg-white">
                                {previewSiswa.nama}
                              </div>
                            </div>

                            <div className="w-full text-center mt-2">
                              <p className="text-[20px] font-bold tracking-widest text-[#000000] uppercase mb-2">NISN</p>
                              <div className="border border-black w-full py-4 px-4 text-center font-normal text-[20px] tracking-widest bg-white">
                                {previewSiswa.nisn || previewSiswa.nis || '-'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ================= PAGE 1 ================= */}
                        <div className="raport-page font-sans text-black">
                          <div>
                            {/* TITLE */}
                            <h1 className="text-center text-[16px] font-bold tracking-widest uppercase mb-6">
                              PENCAPAIAN KOMPETENSI PESERTA DIDIK
                            </h1>

                            {/* STUDENT METADATA */}
                            <table className="w-full text-[12px] mb-5 border-none text-left" style={{ border: 'none' }}>
                              <tbody>
                                <tr style={{ border: 'none' }}>
                                  <td className="py-0.5" style={{ width: '18%', border: 'none' }}>Nama Sekolah</td>
                                  <td className="py-0.5" style={{ width: '2%', border: 'none' }}>:</td>
                                  <td className="py-0.5 font-semibold" style={{ width: '40%', border: 'none' }}>SMP Al-Irsyad Surakarta</td>
                                  <td className="py-0.5" style={{ width: '15%', border: 'none' }}>Kelas</td>
                                  <td className="py-0.5" style={{ width: '2%', border: 'none' }}>:</td>
                                  <td className="py-0.5 font-semibold" style={{ width: '23%', border: 'none' }}>{homeroomKelas?.nama}</td>
                                </tr>
                                <tr style={{ border: 'none' }}>
                                  <td className="py-0.5 align-top" style={{ border: 'none' }}>Alamat</td>
                                  <td className="py-0.5 align-top" style={{ border: 'none' }}>:</td>
                                  <td className="py-0.5 font-medium align-top pr-3 text-[11px]" style={{ border: 'none' }}>Jl. Kapten Mulyadi No. 117 Surakarta</td>
                                  <td className="py-0.5 align-top" style={{ border: 'none' }}>Fase</td>
                                  <td className="py-0.5 align-top" style={{ border: 'none' }}>:</td>
                                  <td className="py-0.5 font-semibold align-top" style={{ border: 'none' }}>D</td>
                                </tr>
                                <tr style={{ border: 'none' }}>
                                  <td className="py-0.5" style={{ border: 'none' }}>Nama Peserta Didik</td>
                                  <td className="py-0.5" style={{ border: 'none' }}>:</td>
                                  <td className="py-0.5 font-bold uppercase" style={{ border: 'none' }}>{previewSiswa.nama}</td>
                                  <td className="py-0.5" style={{ border: 'none' }}>Semester</td>
                                  <td className="py-0.5" style={{ border: 'none' }}>:</td>
                                  <td className="py-0.5 font-semibold" style={{ border: 'none' }}>{formattedSemester(activePeriod.semester)}</td>
                                </tr>
                                <tr style={{ border: 'none' }}>
                                  <td className="py-0.5" style={{ border: 'none' }}>Nomor Induk</td>
                                  <td className="py-0.5" style={{ border: 'none' }}>:</td>
                                  <td className="py-0.5 font-mono font-semibold" style={{ border: 'none' }}>{previewSiswa.nis}</td>
                                  <td className="py-0.5" style={{ border: 'none' }}>Tahun Ajaran</td>
                                  <td className="py-0.5" style={{ border: 'none' }}>:</td>
                                  <td className="py-0.5 font-semibold" style={{ border: 'none' }}>{activePeriod.tahunAjaran}</td>
                                </tr>
                              </tbody>
                            </table>

                            {/* GRADES TABLE */}
                            <table className="table-raport-nilai w-full border-collapse border border-black text-left text-[12px] leading-relaxed">
                              <colgroup>
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '27%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '58%' }} />
                              </colgroup>
                              <thead>
                                <tr className="bg-slate-50 border-b border-black text-center font-bold text-[12px]">
                                  <th className="border border-black py-2.5 px-1.5 text-center align-middle" style={{ width: '5%' }}>No</th>
                                  <th className="border border-black py-2.5 px-3 text-center align-middle" style={{ width: '27%' }}>Mata Pelajaran</th>
                                  <th className="border border-black py-2.5 px-1 text-center align-middle font-bold leading-tight" style={{ width: '10%' }}>Nilai Akhir</th>
                                  <th className="border border-black py-2.5 px-3 text-center align-middle" style={{ width: '58%' }}>Capaian Kompetensi</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="bg-slate-100/70 border-b border-black font-extrabold text-[12px]">
                                  <td colSpan={4} className="border border-black px-3 py-1.5 uppercase font-bold tracking-wide">
                                    Mata Pelajaran Umum
                                  </td>
                                </tr>
                                {page1Umum.map((r, idx) => {
                                  const split = splitCapaian(r.capaian);
                                  return (
                                    <React.Fragment key={r.mapelNama}>
                                      <tr className="align-top border-b border-black">
                                        <td className="border border-black text-center align-middle py-2.5 px-1 text-[12px]" rowSpan={2}>{idx + 1}</td>
                                        <td className="border border-black text-center align-middle py-2.5 px-3 font-semibold text-[12px]" rowSpan={2}>{r.mapelNama}</td>
                                        <td className="border border-black text-center align-middle py-2.5 px-1 font-bold text-[12px]" rowSpan={2}>{r.nilaiAkhir}</td>
                                        <td className="border border-black py-2 px-3 text-justify text-[12px] leading-relaxed">{split.master}</td>
                                      </tr>
                                      <tr className="align-top border-b border-black">
                                        <td className="border border-black py-2 px-3 text-justify text-[12px] leading-relaxed">{split.needsImprovement}</td>
                                      </tr>
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* FOOTER */}
                          <div className="text-[9px] text-slate-400 font-mono text-center flex justify-between border-t border-slate-100 pt-3 mt-6 shrink-0">
                            <span>SMP Al-Irsyad Surakarta • Raport Kurikulum Merdeka</span>
                            <span>Halaman 1 dari 3</span>
                          </div>
                        </div>

                        {/* ================= PAGE 2 ================= */}
                        <div className="raport-page font-sans text-black">
                          <div>
                            {/* GRADES TABLE CONTINUATION */}
                            <table className="table-raport-nilai w-full border-collapse border border-black text-left text-[12px] leading-relaxed">
                              <colgroup>
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '27%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '58%' }} />
                              </colgroup>
                              <thead>
                                <tr className="bg-slate-50 border-b border-black text-center font-bold text-[12px]">
                                  <th className="border border-black py-2.5 px-1.5 text-center align-middle" style={{ width: '5%' }}>No</th>
                                  <th className="border border-black py-2.5 px-3 text-center align-middle" style={{ width: '27%' }}>Mata Pelajaran</th>
                                  <th className="border border-black py-2.5 px-1 text-center align-middle font-bold leading-tight" style={{ width: '10%' }}>Nilai Akhir</th>
                                  <th className="border border-black py-2.5 px-3 text-center align-middle" style={{ width: '58%' }}>Capaian Kompetensi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {page2Umum.map((r, idx) => {
                                  const split = splitCapaian(r.capaian);
                                  const globalIdx = 5 + idx + 1; // continues from 6
                                  return (
                                    <React.Fragment key={r.mapelNama}>
                                      <tr className="align-top border-b border-black">
                                        <td className="border border-black text-center align-middle py-2.5 px-1 text-[12px]" rowSpan={2}>{globalIdx}</td>
                                        <td className="border border-black text-center align-middle py-2.5 px-3 font-semibold text-[12px]" rowSpan={2}>{r.mapelNama}</td>
                                        <td className="border border-black text-center align-middle py-2.5 px-1 font-bold text-[12px]" rowSpan={2}>{r.nilaiAkhir}</td>
                                        <td className="border border-black py-2 px-3 text-justify text-[12px] leading-relaxed">{split.master}</td>
                                      </tr>
                                      <tr className="align-top border-b border-black">
                                        <td className="border border-black py-2 px-3 text-justify text-[12px] leading-relaxed">{split.needsImprovement}</td>
                                      </tr>
                                    </React.Fragment>
                                  );
                                })}

                                {page2Yayasan.length > 0 && (
                                  <>
                                    <tr className="bg-slate-100/70 border-b border-black font-extrabold text-[12px]">
                                      <td colSpan={4} className="border border-black px-3 py-1.5 uppercase font-bold tracking-wide">
                                        YAYASAN
                                      </td>
                                    </tr>
                                    {page2Yayasan.map((r, idx) => {
                                      const split = splitCapaian(r.capaian);
                                      const globalIdx = 11 + idx + 1; // Subject 12
                                      return (
                                        <React.Fragment key={r.mapelNama}>
                                          <tr className="align-top border-b border-black">
                                            <td className="border border-black text-center align-middle py-2.5 px-1 text-[12px]" rowSpan={2}>{globalIdx}</td>
                                            <td className="border border-black text-center align-middle py-2.5 px-3 font-semibold text-[12px]" rowSpan={2}>{r.mapelNama}</td>
                                            <td className="border border-black text-center align-middle py-2.5 px-1 font-bold text-[12px]" rowSpan={2}>{r.nilaiAkhir}</td>
                                            <td className="border border-black py-2 px-3 text-justify text-[12px] leading-relaxed">{split.master}</td>
                                          </tr>
                                          <tr className="align-top border-b border-black">
                                            <td className="border border-black py-2 px-3 text-justify text-[12px] leading-relaxed">{split.needsImprovement}</td>
                                          </tr>
                                        </React.Fragment>
                                      );
                                    })}
                                  </>
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* FOOTER */}
                          <div className="text-[9px] text-slate-400 font-mono text-center flex justify-between border-t border-slate-100 pt-3 mt-6 shrink-0">
                            <span>SMP Al-Irsyad Surakarta • Laporan Hasil Belajar</span>
                            <span>Halaman 2 dari 3</span>
                          </div>
                        </div>

                        {/* ================= PAGE 3 ================= */}
                        <div className="raport-page font-sans text-black">
                          <div>
                            {/* GRADES TABLE CONTINUATION */}
                            <table className="table-raport-nilai w-full border-collapse border border-black text-left text-[12px] leading-relaxed mb-6">
                              <colgroup>
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '27%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '58%' }} />
                              </colgroup>
                              <thead>
                                <tr className="bg-slate-50 border-b border-black text-center font-bold text-[12px]">
                                  <th className="border border-black py-2.5 px-1.5 text-center align-middle" style={{ width: '5%' }}>No</th>
                                  <th className="border border-black py-2.5 px-3 text-center align-middle" style={{ width: '27%' }}>Mata Pelajaran</th>
                                  <th className="border border-black py-2.5 px-1 text-center align-middle font-bold leading-tight" style={{ width: '10%' }}>Nilai Akhir</th>
                                  <th className="border border-black py-2.5 px-3 text-center align-middle" style={{ width: '58%' }}>Capaian Kompetensi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {page3Yayasan.map((r, idx) => {
                                  const split = splitCapaian(r.capaian);
                                  const globalIdx = 12 + idx + 1; // starts from 13
                                  return (
                                    <React.Fragment key={r.mapelNama}>
                                      <tr className="align-top border-b border-black">
                                        <td className="border border-black text-center align-middle py-2.5 px-1 text-[12px]" rowSpan={2}>{globalIdx}</td>
                                        <td className="border border-black text-center align-middle py-2.5 px-3 font-semibold text-[12px]" rowSpan={2}>{r.mapelNama}</td>
                                        <td className="border border-black text-center align-middle py-2.5 px-1 font-bold text-[12px]" rowSpan={2}>{r.nilaiAkhir}</td>
                                        <td className="border border-black py-2 px-3 text-justify text-[12px] leading-relaxed">{split.master}</td>
                                      </tr>
                                      <tr className="align-top border-b border-black">
                                        <td className="border border-black py-2 px-3 text-justify text-[12px] leading-relaxed">{split.needsImprovement}</td>
                                      </tr>
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>

                            {/* EXTRA & ATTENDANCE CONTAINER - SPLIT SIDE BY SIDE */}
                            <div className="grid grid-cols-12 gap-5 mb-5 items-start">
                              {/* C. Ekstrakurikuler */}
                              <div className="col-span-7">
                                <h2 className="font-bold text-[12px] uppercase mb-1.5">C. Ekstrakurikuler</h2>
                                <table className="w-full border-collapse border border-black text-[12px]">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-black font-bold h-7 text-center">
                                      <th className="border border-black py-1 px-2" style={{ width: '12%' }}>No</th>
                                      <th className="border border-black py-1 px-3 text-left" style={{ width: '68%' }}>Kegiatan Ekstrakurikuler</th>
                                      <th className="border border-black py-1 px-2 text-center" style={{ width: '20%' }}>Predikat</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      const studentEkskulRaw = reportData.attendance?.ekstrakurikuler || [];
                                      const displayEkskul = [...studentEkskulRaw];
                                      while (displayEkskul.length < 3) {
                                        displayEkskul.push({ nama: '', nilai: '' as any });
                                      }
                                      return displayEkskul.map((item, idx) => (
                                        <tr key={idx}>
                                          <td className="border border-black text-center py-1.5 px-2">{idx + 1}</td>
                                          <td className="border border-black py-1.5 px-3 font-medium h-7 text-left">{item.nama}</td>
                                          <td className="border border-black text-center py-1.5 px-2 font-bold">{item.nilai}</td>
                                        </tr>
                                      ));
                                    })()}
                                  </tbody>
                                </table>
                              </div>

                              {/* D. Ketidakhadiran */}
                              <div className="col-span-5">
                                <h2 className="font-bold text-[12px] uppercase mb-1.5">D. Ketidakhadiran</h2>
                                <table className="w-full border-collapse border border-black text-[12px]">
                                  <tbody>
                                    <tr>
                                      <td className="border border-black py-1.5 px-3 font-medium" style={{ width: '55%' }}>Sakit</td>
                                      <td className="border border-black py-1.5 px-1.5 text-center" style={{ width: '10%' }}>:</td>
                                      <td className="border border-black py-1.5 px-3 text-center font-bold" style={{ width: '35%' }}>{reportData.attendance?.sakit || 0} Hari</td>
                                    </tr>
                                    <tr>
                                      <td className="border border-black py-1.5 px-3 font-medium">Izin</td>
                                      <td className="border border-black py-1.5 px-1.5 text-center">:</td>
                                      <td className="border border-black py-1.5 px-3 text-center font-bold">{reportData.attendance?.izin || 0} Hari</td>
                                    </tr>
                                    <tr>
                                      <td className="border border-black py-1.5 px-3 font-medium">Tanpa Keterangan</td>
                                      <td className="border border-black py-1.5 px-1.5 text-center">:</td>
                                      <td className="border border-black py-1.5 px-3 text-center font-bold">{reportData.attendance?.alfa || 0} Hari</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* SIGNATURE SECTION */}
                            <div className="grid grid-cols-2 gap-24 text-[12px] mt-6">
                              {/* Left Column: Orang Tua */}
                              <div className="text-center">
                                <p className="invisible">Date Space Row Placeholder</p> 
                                <p className="font-semibold">Mengetahui,</p>
                                <p className="font-semibold">Orangtua/ Wali</p>
                                <div className="h-20" />
                                <p className="font-medium">.....................................................</p>
                              </div>

                              {/* Right Column: Wali Kelas */}
                              <div className="text-center">
                                <p>Surakarta, {formattedReportDate}</p>
                                <p className="font-semibold">Mengetahui,</p>
                                <p className="font-semibold">Wali Kelas</p>
                                <div className="h-20" />
                                <p className="font-bold underline text-[12px]">{activeTeacher.nama}</p>
                                <p className="text-[10px] text-slate-500 font-mono">NIK. {activeTeacher.username || '-'}</p>
                              </div>
                            </div>

                            {/* Principal Center Signature */}
                            <div className="text-center text-[12px] mt-4 flex flex-col items-center">
                              <p className="font-semibold">Mengetahui,</p>
                              <p className="font-semibold">Kepala Sekolah</p>
                              <div className="h-20" />
                              <p className="font-bold underline text-[12px]">Andreas Raymonda, S.Pd, M.Hum</p>
                              <p className="text-[10px] text-slate-500 font-mono">NIK. 103.244.0072</p>
                            </div>
                          </div>

                          {/* FOOTER */}
                          <div className="text-[9px] text-slate-400 font-mono text-center flex justify-between border-t border-slate-100 pt-3 mt-6 shrink-0">
                            <span>SMP Al-Irsyad Surakarta • Laporan Hasil Belajar</span>
                            <span>Halaman 3 dari 3</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
