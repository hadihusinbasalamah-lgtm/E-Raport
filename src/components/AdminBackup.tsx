/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SchemaDatabase, Siswa, Kelas } from '../types';
import { generateSiswaPDF } from '../utils/pdfGenerator';
import JSZip from 'jszip';
import { 
  FolderArchive, ShieldCheck, ArrowRightLeft, Users, 
  UserCheck, Download, Loader2, AlertTriangle, CheckCircle2, ListOrdered
} from 'lucide-react';

interface AdminBackupProps {
  db: SchemaDatabase;
}

export function AdminBackup({ db }: AdminBackupProps) {
  const activePeriod = db.periodList.find(p => p.id === db.activePeriodId);

  // States
  const [selectedKelasId, setSelectedKelasId] = useState<string>('');
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [currentExportName, setCurrentExportName] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);

  // Checks
  if (!activePeriod) {
    return (
      <div className="p-8 text-center bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 max-w-xl mx-auto my-12 shadow-sm space-y-3">
        <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto" />
        <h3 className="text-base font-bold font-sans">Menu Terkunci: Rilis Akademik Dibutuhkan</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Administrator harus merilis/aktifkan Tahun Ajaran dan Semester aktif terlebih dahulu dari menu 
          <strong className="text-amber-950"> "Tahun Ajaran (Release)"</strong> sebelum fitur Backup Data Raport dapat dioperasikan.
        </p>
      </div>
    );
  }

  // Active snapshot data from class, students, subjects
  const classesList = activePeriod.snapshotKelas || [];
  const studentsList = activePeriod.snapshotSiswa || [];
  const subjectsList = activePeriod.snapshotMapel || [];

  // Filter students by selected Kelas
  const filteredStudents = useMemo(() => {
    if (!selectedKelasId) return [];
    return studentsList.filter(s => s.kelasId === selectedKelasId);
  }, [selectedKelasId, studentsList]);

  // Handle class select
  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedKelasId(val);
    setSelectedSiswaIds(studentsList.filter(s => s.kelasId === val).map(s => s.id));
    setExportSuccess(false);
  };

  // Toggle student selection
  const handleToggleSiswa = (siswaId: string) => {
    setExportSuccess(false);
    setSelectedSiswaIds(prev => {
      if (prev.includes(siswaId)) {
        return prev.filter(id => id !== siswaId);
      } else {
        return [...prev, siswaId];
      }
    });
  };

  // Toggle select all students in filtered list
  const handleToggleSelectAll = () => {
    setExportSuccess(false);
    if (selectedSiswaIds.length === filteredStudents.length) {
      setSelectedSiswaIds([]);
    } else {
      setSelectedSiswaIds(filteredStudents.map(s => s.id));
    }
  };

  // Count graded subjects for a student
  const getSiswaGradesStats = (studentId: string) => {
    let count = 0;
    subjectsList.forEach(mapel => {
      const gradeId = `${activePeriod.id}_${studentId}_${mapel.id}`;
      const hasGrade = db.nilaiSiswa.some(n => n.id === gradeId);
      if (hasGrade) {
        count++;
      }
    });
    return {
      gradedCount: count,
      totalCount: subjectsList.length,
      isFullyGraded: count === subjectsList.length && subjectsList.length > 0
    };
  };

  // Selected class detail
  const selectedKelasInfo = useMemo(() => {
    if (!selectedKelasId) return null;
    const kObj = classesList.find(k => k.id === selectedKelasId);
    if (!kObj) return null;

    const teacherObj = db.guru.find(g => g.id === kObj.waliKelasId) || activePeriod.snapshotGuru.find(g => g.id === kObj.waliKelasId);
    
    // Compute total class grade completion ratio
    let totalExpectedMapelGrades = filteredStudents.length * subjectsList.length;
    let totalGradedMapelGrades = 0;
    
    filteredStudents.forEach(stud => {
      subjectsList.forEach(mapel => {
        const gradeId = `${activePeriod.id}_${stud.id}_${mapel.id}`;
        if (db.nilaiSiswa.some(n => n.id === gradeId)) {
          totalGradedMapelGrades++;
        }
      });
    });

    const completionRate = totalExpectedMapelGrades > 0 
      ? Math.round((totalGradedMapelGrades / totalExpectedMapelGrades) * 100)
      : 0;

    return {
      name: kObj.nama,
      waliKelasName: teacherObj ? teacherObj.nama : 'Belum Ditugaskan',
      completionRate
    };
  }, [selectedKelasId, classesList, filteredStudents, subjectsList, db.nilaiSiswa, db.guru, activePeriod.snapshotGuru]);

  // Core ZIP & PDF Generator Action
  const handleBackupExport = async () => {
    if (selectedSiswaIds.length === 0 || !selectedKelasInfo) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportSuccess(false);

    const zip = new JSZip();

    try {
      // Loop through selected students sequentially to build PDFs cleanly
      for (let i = 0; i < selectedSiswaIds.length; i++) {
        const studentId = selectedSiswaIds[i];
        const student = filteredStudents.find(s => s.id === studentId);
        
        if (student) {
          // Set current status for loader UI
          setCurrentExportName(student.nama);
          setExportProgress(Math.round(((i) / selectedSiswaIds.length) * 100));

          // Small sleep to keep browser highly responsive and update progress bar fluidly
          await new Promise(resolve => setTimeout(resolve, 50));

          // Generate student's PDF
          const doc = generateSiswaPDF(student, db, activePeriod);
          
          // Export output PDF to binary array buffer
          const arrayBuffer = doc.output('arraybuffer');
          
          // Sanitize student name for standard file system compatibility
          const sanitizedSiswaName = student.nama.replace(/[/\\?%*:|"<>]/g, '_');
          const fileName = `${sanitizedSiswaName}_Raport_${activePeriod.tipeUjian}.pdf`;
          
          // Add file directly into the ZIP instance
          zip.file(fileName, arrayBuffer);
        }
      }

      setExportProgress(100);
      setCurrentExportName('Sedang memaketkan arsip ke ZIP...');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Compile everything into a single downloadable Blob
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Fire browser Download
      const sanitizedKelasName = selectedKelasInfo.name.replace(/[/\\?%*:|"<>]/g, '_');
      const zipFileName = `Raport_Kelas_${sanitizedKelasName}_SMP_AL_IRSYAD_${activePeriod.tipeUjian}_Export.zip`;
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipFileName;
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup pointers
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      setIsExporting(false);
      setExportSuccess(true);
    } catch (err) {
      console.error("Backup failed", err);
      setIsExporting(false);
      alert("Terjadi kegagalan ketika memproses kompilasi PDF. Coba ulangi beberapa saat lagi.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-2">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <FolderArchive className="w-5 h-5 text-emerald-600" />
          Backup Data e-Raport Digital (ZIP)
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Menu khusus Admin untuk mengekspor database raport Kurikulum Merdeka per-kelas sebagai kumpulan lembar file PDF yang dipaketkan langsung dalam satu wadah arsip ZIP.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form Settings and overview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Saring Kelas & Pengaturan</span>
            
            <div className="space-y-1.5Packed">
              <label className="block text-xs font-bold text-slate-700">Pilih Ruang Kelas:</label>
              <select
                value={selectedKelasId}
                onChange={handleClassChange}
                className="w-full px-3.5 py-2.5 border border-slate-200 hover:border-emerald-500 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white transition-all shadow-2xs"
              >
                <option value="">-- Silakan Pilih Kelas --</option>
                {classesList.map(kelas => (
                  <option key={kelas.id} value={kelas.id}>
                    Kelas {kelas.nama}
                  </option>
                ))}
              </select>
            </div>

            {selectedKelasInfo && (
              <div className="p-4 bg-emerald-50/45 rounded-xl border border-emerald-100/50 space-y-3 animate-fadeIn">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Spesifikasi Kelas Terpilih:</span>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block font-medium">Wali Kelas</span>
                    <span className="text-xs font-bold text-slate-800 truncate block">{selectedKelasInfo.waliKelasName}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block font-medium">Total Siswa Terpilih</span>
                    <span className="text-xs font-bold text-slate-800 block">{filteredStudents.length} Peserta Didik</span>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-emerald-200/55">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 mb-1">
                    <span>Kelengkapan Input Nilai Kelas:</span>
                    <span className="text-emerald-800 font-mono text-[11px]">{selectedKelasInfo.completionRate}%</span>
                  </div>
                  <div className="w-full bg-emerald-200/40 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${selectedKelasInfo.completionRate}%` }} 
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedKelasInfo && (
              <button
                onClick={handleBackupExport}
                disabled={selectedSiswaIds.length === 0}
                className={`w-full py-3 px-4 text-xs font-bold rounded-xl shadow-sm hover:shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all outline-none border focus:ring-2 ${
                  selectedSiswaIds.length > 0 
                    ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white cursor-pointer focus:ring-emerald-500' 
                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed focus:ring-transparent'
                }`}
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Backup {selectedSiswaIds.length} Siswa (.ZIP)</span>
              </button>
            )}

            {exportSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-2.5 text-xs font-semibold animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-950 font-sans">Ekspor Berhasil!</h4>
                  <p className="text-[11px] text-emerald-850 mt-0.5 leading-relaxed font-normal">
                    Arsip ZIP berisi raport PDF para siswa terpilih berhasil digenerate dan diunduh otomatis di browser Anda.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-100 border border-slate-200/80 p-5 rounded-2xl space-y-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Protokol Arsip & Keamanan</span>
            <div className="space-y-2 text-[11px] text-slate-600 leading-relaxed font-medium">
              <p className="flex gap-2 items-start">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Dokumen PDF yang dibackup dikompilasi menggunakan standar margin cetak presisi A4 Portrait, legal untuk keperluan dinas maupun pembagian fisik.</span>
              </p>
              <p className="flex gap-2 items-start">
                <ArrowRightLeft className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Kelengkapan penginputan mata pelajaran disarankan mencapai 100% sebelum Administrator mencetak/mendownload arsip backup kelas.</span>
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Students Checklist in Class */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Daftar Anggota Kelas</span>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-none">Pilih siswa yang ingin disertakan dalam paket backup</p>
            </div>

            {filteredStudents.length > 0 && (
              <button
                onClick={handleToggleSelectAll}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-bold focus:outline-none underline transition"
              >
                {selectedSiswaIds.length === filteredStudents.length ? 'Batal Pilih Semua' : 'Pilih Semua Siswa'}
              </button>
            )}
          </div>

          {filteredStudents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 italic text-xs font-medium bg-slate-50/50 rounded-xl border border-dashed border-slate-200/70 p-4 text-center">
              <Users className="w-10 h-10 text-slate-350 mb-2" />
              Sila tentukan / sortir kelas rilis di panel sebelah kiri untuk menampilkan daftar absensi dan mengarsipkan raport siswa.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto border border-slate-100 rounded-xl overflow-hidden shadow-2xs pr-1">
              {filteredStudents.map((siswa, idx) => {
                const stats = getSiswaGradesStats(siswa.id);
                const isChecked = selectedSiswaIds.includes(siswa.id);
                return (
                  <div 
                    key={siswa.id}
                    onClick={() => handleToggleSiswa(siswa.id)}
                    className={`p-3 sm:p-3.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition-all ${
                      isChecked ? 'bg-emerald-50/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Swallowed because parent card handles click smoothly
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer align-middle shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-xs truncate flex items-center gap-1.5">
                          <span>{idx + 1}. {siswa.nama}</span>
                          {stats.isFullyGraded && (
                            <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" title="Semua Nilai Terisi" />
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">NISN: {siswa.nisn} • NIS: {siswa.nis}</div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg ${
                        stats.isFullyGraded 
                          ? 'bg-emerald-100 text-emerald-950 border border-emerald-200/50' 
                          : stats.gradedCount > 0 
                            ? 'bg-amber-100 text-amber-950 border border-amber-200/50' 
                            : 'bg-slate-100 text-slate-500 border border-slate-200/60'
                      }`}>
                        {stats.gradedCount} / {stats.totalCount} Mapel Terisi
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ASYNCHRONOUS EXPORT LOADER MODAL OVERLAY */}
      {isExporting && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-fadeIn space-y-4">
            <div className="relative flex items-center justify-center">
              <Loader2 className="w-16 h-16 text-emerald-600 animate-spin" />
              <FolderArchive className="w-6 h-6 text-emerald-950 absolute" />
            </div>
            
            <div className="space-y-1 w-full text-center">
              <h3 className="text-sm font-bold text-slate-900 font-sans">Sedang Membuat Cadangan PDF...</h3>
              <p className="text-xs text-slate-400 truncate max-w-full px-2">
                Siswa: <span className="font-semibold text-slate-700">{currentExportName}</span>
              </p>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-600 h-full rounded-full transition-all duration-300" 
                style={{ width: `${exportProgress}%` }} 
              />
            </div>

            <span className="text-[11px] font-bold text-emerald-800 font-mono">{exportProgress}% Selesai</span>
            <p className="text-[10px] text-slate-400 italic">Harap jangan menutup jendela peramban atau me-refresh tab ini sewaktu proses backup berlangsung.</p>
          </div>
        </div>
      )}
    </div>
  );
}
