/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase, NilaiSiswa, TujuanPembelajaran, AbsensiDanCatatan, Guru, Mapel, Siswa } from '../types';
import { 
  Sparkles, CheckCircle2, AlertCircle, RefreshCw, Trash2, 
  ArrowRight, Database, FileSpreadsheet, Check, HelpCircle
} from 'lucide-react';

interface AdminDemoNilaiProps {
  db: SchemaDatabase;
  onUpdate: (updatedDb: SchemaDatabase) => void;
  onNavigateToTab?: (tabId: string) => void;
}

export function AdminDemoNilai({ db, onUpdate, onNavigateToTab }: AdminDemoNilaiProps) {
  const [selectedKelasId, setSelectedKelasId] = useState<string>('all');
  const [gradePreset, setGradePreset] = useState<'varied' | 'high' | 'mixed'>('varied');
  const [includeTP, setIncludeTP] = useState<boolean>(true);
  const [includeAbsensi, setIncludeAbsensi] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // Active period
  const activePeriod = db.periodList.find(p => p.id === db.activePeriodId) || db.periodList[0];

  if (!activePeriod) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-sm">
        <AlertCircle className="w-5 h-5 text-amber-600 mb-2" />
        <p className="font-bold">Tidak ada periode akademik aktif</p>
        <p className="text-xs text-amber-700 mt-1">
          Harap buat dan publikasikan Tahun Ajaran / Periode Akademik terlebih dahulu di menu Tahun Ajaran.
        </p>
      </div>
    );
  }

  // Active or fallback master lists
  const currentKelas = activePeriod.snapshotKelas?.length ? activePeriod.snapshotKelas : db.kelas;
  const currentSiswa = activePeriod.snapshotSiswa?.length ? activePeriod.snapshotSiswa : db.siswa;
  const currentMapel = activePeriod.snapshotMapel?.length ? activePeriod.snapshotMapel : db.mapel;
  const currentGuru = activePeriod.snapshotGuru?.length ? activePeriod.snapshotGuru : db.guru;

  // Filter students based on classroom selection
  const targetStudents = selectedKelasId === 'all' 
    ? currentSiswa 
    : currentSiswa.filter(s => s.kelasId === selectedKelasId);

  // Calculate current filled grades count
  const allCurrentNilai = db.nilaiSiswa || [];
  const activePeriodGrades = allCurrentNilai.filter(n => n.periodeId === activePeriod.id);
  const targetTotalCombinations = targetStudents.length * currentMapel.length;
  const currentFilledCount = targetStudents.reduce((acc, s) => {
    return acc + currentMapel.filter(m => {
      const key = `${activePeriod.id}_${s.id}_${m.id}`;
      return activePeriodGrades.some(n => n.id === key && typeof n.nilaiAkhir === 'number');
    }).length;
  }, 0);

  const fillPercentage = targetTotalCombinations > 0 
    ? Math.min(100, Math.round((currentFilledCount / targetTotalCombinations) * 100))
    : 0;

  // Helper: Find teacher for a subject and class
  const findTeacherForSubject = (mapelId: string, kelasId: string): string => {
    const assigned = currentGuru.find(g => {
      if (g.mapel1Id === mapelId && (g.mapel1KelasId === kelasId || g.mapel1KelasIds?.includes(kelasId))) return true;
      if (g.mapel2Id === mapelId && (g.mapel2KelasId === kelasId || g.mapel2KelasIds?.includes(kelasId))) return true;
      if (g.mapel3Id === mapelId && (g.mapel3KelasId === kelasId || g.mapel3KelasIds?.includes(kelasId))) return true;
      return false;
    });

    if (assigned) return assigned.id;

    // Fallback: any teacher teaching this subject
    const anyForMapel = currentGuru.find(g => g.mapel1Id === mapelId || g.mapel2Id === mapelId || g.mapel3Id === mapelId);
    if (anyForMapel) return anyForMapel.id;

    return currentGuru[0]?.id || 'g1';
  };

  // Helper: Generate default TPs if none exist for this subject and class
  const getOrCreateTPs = (mapel: Mapel, kelasId: string, teacherId: string): { tp1: string; tp2: string; tp3: string; tp4: string; record?: TujuanPembelajaran } => {
    // Check if TP already exists in db
    const existing = (db.tujuanPembelajaran || []).find(t => 
      t.periodeId === activePeriod.id && 
      t.mapelId === mapel.id && 
      (t.kelasId === kelasId || t.kelasId === 'VII' || t.kelasId === 'VIII' || t.kelasId === 'IX')
    );

    if (existing) {
      return {
        tp1: existing.tp1,
        tp2: existing.tp2,
        tp3: existing.tp3 || `Mengaplikasikan materi pokok ${mapel.nama} dalam kehidupan sehari-hari`,
        tp4: existing.tp4 || `Menyajikan laporan dan refleksi pembelajaran ${mapel.nama} secara kritis`,
        record: undefined
      };
    }

    // Generate authentic TP descriptions based on subject
    const nameLower = mapel.nama.toLowerCase();
    let tp1 = `Memahami konsep dasar dan materi pokok pembelajaran ${mapel.nama}`;
    let tp2 = `Menerapkan keterampilan dan prosedur praktis dalam pembelajaran ${mapel.nama}`;
    let tp3 = `Menganalisis permasalahan kontekstual dan mengevaluasi hasil karya ${mapel.nama}`;
    let tp4 = `Menyajikan laporan serta refleksi pembelajaran ${mapel.nama} secara kolaboratif`;

    if (nameLower.includes('matematika')) {
      tp1 = 'Memahami konsep bilangan, aljabar, dan operasinya dalam masalah kontekstual';
      tp2 = 'Menyelesaikan permasalahan persamaan dan pertidaksamaan linier satu variabel';
      tp3 = 'Mengaplikasikan konsep aritmetika sosial dalam transaksi ekonomi harian';
      tp4 = 'Menyajikan dan menganalisis data dalam diagram batang dan garis';
    } else if (nameLower.includes('inggris')) {
      tp1 = 'Mengidentifikasi gagasan utama dan informasi rinci teks deskriptif lisan dan tulis';
      tp2 = 'Menyusun teks interaksi interpersonal perkenalan dan sapaan bahasa Inggris';
      tp3 = 'Memahami teks prosedur sederhana tentang instruksi kerja dan resep harian';
      tp4 = 'Mempresentasikan teks deskriptif sederhana dengan pelafalan yang tepat';
    } else if (nameLower.includes('indonesia')) {
      tp1 = 'Menganalisis ide pokok, pesan tersirat, dan struktur teks deskripsi secara kritis';
      tp2 = 'Menyusun kerangka dan menulis teks prosedur dengan kaidah kebahasaan tepat';
      tp3 = 'Mempresentasikan hasil karya deskriptif lisan dengan intonasi yang baik';
      tp4 = 'Menulis tanggapan kritis terhadap buku fiksi dan nonfiksi yang dibaca';
    } else if (nameLower.includes('ipa') || nameLower.includes('alam')) {
      tp1 = 'Menerapkan metode ilmiah dan pengukuran besaran fisis dalam penyelidikan sains';
      tp2 = 'Menganalisis sifat zat, perubahan wujud materi, dan pemisahan campuran';
      tp3 = 'Memahami organisasi kehidupan dari tingkat sel hingga organisme dan ekosistem';
      tp4 = 'Melakukan penyelidikan sederhana mengenai kalor dan perpindahannya';
    } else if (nameLower.includes('ips') || nameLower.includes('sosial')) {
      tp1 = 'Memahami interaksi antarruang dan pengaruhnya terhadap aktivitas ekonomi masyarakat';
      tp2 = 'Menganalisis dinamika kependudukan dan keragaman sosial budaya di Indonesia';
      tp3 = 'Menjelaskan peran pelaku ekonomi dalam kegiatan produksi, distribusi, dan konsumsi';
      tp4 = 'Menelusuri peninggalan sejarah dan kebudayaan masa praaksara hingga kolonial';
    } else if (nameLower.includes('pai') || nameLower.includes('agama') || nameLower.includes('islam')) {
      tp1 = 'Membaca dan memahami kandungan ayat Al-Quran serta Hadis tentang ilmu';
      tp2 = 'Meneladani sifat-sifat mulia Asmaul Husna dalam interaksi sosial sehari-hari';
      tp3 = 'Mempraktikkan tata cara thaharah dan salat berjemaah dengan khusyuk';
      tp4 = 'Memahami sejarah perkembangan dakwah Islam pada masa Rasulullah saw';
    } else if (nameLower.includes('arab')) {
      tp1 = 'Mendengarkan dan menirukan ungkapan sapaan dan perkenalan bahasa Arab';
      tp2 = 'Membaca teks dialog sederhana tentang tema lingkungan madrasah dan keluarga';
      tp3 = 'Menyusun kalimat sederhana menggunakan struktur tata bahasa Arab dasar';
      tp4 = 'Mendemonstrasikan percakapan pendek bahasa Arab dengan intonasi fasih';
    } else if (nameLower.includes('informatika')) {
      tp1 = 'Menerapkan berpikir komputasional untuk menyelesaikan masalah logis terstruktur';
      tp2 = 'Memahami fungsi perangkat keras, sistem operasi, dan jaringan komputer dasar';
      tp3 = 'Mengolah dan memvisualisasikan data menggunakan aplikasi lembar kerja';
      tp4 = 'Membuat program visual sederhana menggunakan blok pemrograman terstruktur';
    } else if (nameLower.includes('pjok') || nameLower.includes('olahraga')) {
      tp1 = 'Mempraktikkan variasi gerak spesifik dalam permainan bola besar dan kecil';
      tp2 = 'Melakukan latihan peningkatan kebugaran jasmani yang terkait kesehatan';
      tp3 = 'Memahami konsep pola makan sehat dan bahaya pergaulan bebas serta narkoba';
      tp4 = 'Mempraktikkan keterampilan aktivitas gerak berirama secara kompak';
    }

    const newRecord: TujuanPembelajaran = {
      id: `tp_demo_${activePeriod.id}_${mapel.id}_${kelasId}`,
      periodeId: activePeriod.id,
      guruId: teacherId,
      mapelId: mapel.id,
      kelasId: kelasId,
      tp1,
      tp2,
      tp3,
      tp4
    };

    return { tp1, tp2, tp3, tp4, record: newRecord };
  };

  // Main Action: Generate and Fill All Student Grades
  const handleGenerateDemoGrades = async () => {
    if (targetStudents.length === 0) {
      setErrorMessage('Tidak ada siswa yang ditemukan pada kelas yang dipilih.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const newNilaiEntries: NilaiSiswa[] = [];
      const newTPEntries: TujuanPembelajaran[] = [...(db.tujuanPembelajaran || [])];
      const newAbsensiEntries: AbsensiDanCatatan[] = [...(db.absensiDanCatatan || [])];

      let targetClasses = currentKelas;
      if (selectedKelasId !== 'all') {
        targetClasses = currentKelas.filter(k => k.id === selectedKelasId);
      }

      // 1. Process each class and student
      targetClasses.forEach((kelas) => {
        const classStudents = targetStudents.filter(s => s.kelasId === kelas.id);

        currentMapel.forEach((mapel, mIdx) => {
          const teacherId = findTeacherForSubject(mapel.id, kelas.id);
          const tpData = getOrCreateTPs(mapel, kelas.id, teacherId);

          if (includeTP && tpData.record) {
            if (!newTPEntries.some(t => t.id === tpData.record!.id)) {
              newTPEntries.push(tpData.record);
            }
          }

          classStudents.forEach((siswa, sIdx) => {
            // Determine base score
            let baseScore = 82;
            if (gradePreset === 'high') {
              baseScore = 87 + ((sIdx * 3 + mIdx * 2) % 9); // 87 .. 95
            } else if (gradePreset === 'mixed') {
              baseScore = 74 + ((sIdx * 4 + mIdx * 3) % 15); // 74 .. 88
            } else {
              // 'varied' - balanced and natural
              baseScore = 80 + ((sIdx * 3 + mIdx * 2) % 11); // 80 .. 90
            }

            // Guarantee strictly pairwise-distinct TP scores to satisfy Kurikulum Merdeka duplicate check
            const tp1 = Math.min(99, Math.max(65, baseScore + 3));
            const tp2 = Math.min(99, Math.max(65, baseScore - 2));
            const tp3 = Math.min(99, Math.max(65, baseScore + 1));
            const tp4 = Math.min(99, Math.max(65, baseScore - 4));
            const ujian = Math.min(99, Math.max(65, baseScore + 2));

            const avgTP = (tp1 + tp2 + tp3 + tp4) / 4;
            let finalGrade = Math.round((avgTP + ujian) / 2);

            // If active period is PSAS1 or PSAT, factor in PSTS grade
            if (activePeriod.tipeUjian === 'PSAS1' || activePeriod.tipeUjian === 'PSAT') {
              const pstsScore = Math.min(99, Math.max(65, baseScore - 1));
              finalGrade = Math.round((avgTP + ujian + pstsScore) / 3);

              // Also ensure matching PSTS record exists in db for historical completeness
              const targetPstsType = activePeriod.tipeUjian === 'PSAS1' ? 'PSTS1' : 'PSTS2';
              const pstsPeriod = db.periodList.find(p => 
                p.tahunAjaran === activePeriod.tahunAjaran && 
                p.semester === activePeriod.semester && 
                p.tipeUjian === targetPstsType
              );

              if (pstsPeriod) {
                const pstsKey = `${pstsPeriod.id}_${siswa.id}_${mapel.id}`;
                newNilaiEntries.push({
                  id: pstsKey,
                  periodeId: pstsPeriod.id,
                  siswaId: siswa.id,
                  mapelId: mapel.id,
                  guruId: teacherId,
                  tp1NilaiAsli: tp1 - 1,
                  tp1Nilai: tp1 - 1,
                  tp2NilaiAsli: tp2 - 1,
                  tp2Nilai: tp2 - 1,
                  tp3NilaiAsli: tp3 - 1,
                  tp3Nilai: tp3 - 1,
                  nilaiUjianAsli: pstsScore,
                  nilaiUjian: pstsScore,
                  nilaiAkhir: pstsScore,
                  capaianKompetensi: `Menunjukkan penguasaan yang baik pada penilaian tengah semester.`
                });
              }
            }

            // Create formatted Kurikulum Merdeka competence statement
            // Best TP: tp1 (highest), Weakest TP: tp4 (lowest)
            const bestTPText = tpData.tp1;
            const weakestTPText = tpData.tp4;
            let capaianText = `Menunjukkan penguasaan sangat baik dalam ${bestTPText.toLowerCase()}.`;
            if (bestTPText !== weakestTPText) {
              capaianText += ` Serta perlu bimbingan dalam ${weakestTPText.toLowerCase()}.`;
            }

            const gradeKey = `${activePeriod.id}_${siswa.id}_${mapel.id}`;
            newNilaiEntries.push({
              id: gradeKey,
              periodeId: activePeriod.id,
              siswaId: siswa.id,
              mapelId: mapel.id,
              guruId: teacherId,
              tp1NilaiAsli: tp1,
              tp1Nilai: tp1,
              tp2NilaiAsli: tp2,
              tp2Nilai: tp2,
              tp3NilaiAsli: tp3,
              tp3Nilai: tp3,
              tp4NilaiAsli: tp4,
              tp4Nilai: tp4,
              nilaiUjianAsli: ujian,
              nilaiUjian: ujian,
              nilaiAkhir: finalGrade,
              capaianKompetensi: capaianText
            });
          });
        });

        // 2. Process Absensi, Catatan Wali Kelas, & Ekstrakurikuler for each student
        if (includeAbsensi) {
          classStudents.forEach((siswa, sIdx) => {
            const absKey = `${activePeriod.id}_${siswa.id}`;
            const existingAbsIdx = newAbsensiEntries.findIndex(a => a.id === absKey);

            const sampleCatatan = [
              'Ananda menunjukkan antusiasme belajar yang tinggi serta akhlak dan adab yang terpuji di sekolah. Pertahankan prestasimu!',
              'Memiliki motivasi belajar yang sangat baik dan aktif dalam kegiatan ibadah madrasah. Terus tingkatkan capaian prestasimu.',
              'Menunjukkan sikap santun, mandiri, dan berakhlak mulia. Teruslah istiqomah dalam menuntut ilmu dan beramal sholeh.',
              'Ananda disiplin, berprestasi, dan memiliki empati tinggi terhadap rekan sejawat. Pertahankan semangat belajar yang luar biasa ini!'
            ];

            const absRecord: AbsensiDanCatatan = {
              id: absKey,
              periodeId: activePeriod.id,
              siswaId: siswa.id,
              kelasId: kelas.id,
              sakit: sIdx % 5 === 0 ? 1 : 0,
              izin: sIdx % 7 === 0 ? 1 : 0,
              alfa: 0,
              catatanWaliKelas: sampleCatatan[sIdx % sampleCatatan.length],
              kelakuan: 'Sangat Baik',
              kerajinan: 'Sangat Baik',
              kerapihan: 'Sangat Baik',
              ekstrakurikuler: [
                { nama: 'Pramuka Penggalang', nilai: 'A' },
                { nama: 'Tahfidz Al-Qur\'an Juz 30', nilai: 'A' }
              ]
            };

            if (existingAbsIdx !== -1) {
              newAbsensiEntries[existingAbsIdx] = absRecord;
            } else {
              newAbsensiEntries.push(absRecord);
            }
          });
        }
      });

      // Merge newly generated grades into existing master database
      const newKeysSet = new Set(newNilaiEntries.map(e => e.id));
      const filteredExistingNilai = (db.nilaiSiswa || []).filter(n => !newKeysSet.has(n.id));
      const finalNilaiSiswa = [...filteredExistingNilai, ...newNilaiEntries];

      // Update database master
      onUpdate({
        ...db,
        tujuanPembelajaran: newTPEntries,
        nilaiSiswa: finalNilaiSiswa,
        absensiDanCatatan: newAbsensiEntries
      });

      setSuccessMessage(
        `Sukses! Berhasil mengisi ${newNilaiEntries.length} rekor nilai untuk ${targetStudents.length} siswa pada ${currentMapel.length} mata pelajaran. Seluruh kolom nilai, ujian, capaian kompetensi, dan absensi kini telah 100% lengkap.`
      );
    } catch (err: any) {
      console.error("Gagal men-generate demo nilai:", err);
      setErrorMessage(`Terjadi kesalahan saat mengisi nilai demo: ${err?.message || 'Gagal menyimpan ke database'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Clear Demo Grades (without touching master classes, teachers, students)
  const handleClearDemoGrades = () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let filteredNilai: NilaiSiswa[];
      let filteredAbsensi: AbsensiDanCatatan[];

      if (selectedKelasId === 'all') {
        // Clear all grades for active period
        filteredNilai = (db.nilaiSiswa || []).filter(n => n.periodeId !== activePeriod.id);
        filteredAbsensi = (db.absensiDanCatatan || []).filter(a => a.periodeId !== activePeriod.id);
      } else {
        // Clear only selected class
        const targetStudentIds = new Set(targetStudents.map(s => s.id));
        filteredNilai = (db.nilaiSiswa || []).filter(n => !(n.periodeId === activePeriod.id && targetStudentIds.has(n.siswaId)));
        filteredAbsensi = (db.absensiDanCatatan || []).filter(a => !(a.periodeId === activePeriod.id && targetStudentIds.has(a.siswaId)));
      }

      onUpdate({
        ...db,
        nilaiSiswa: filteredNilai,
        absensiDanCatatan: filteredAbsensi
      });

      setShowClearConfirm(false);
      setSuccessMessage('Data nilai demo berhasil dikosongkan. Master data guru, kelas, dan siswa tetap aman terjaga.');
    } catch (err: any) {
      setErrorMessage('Gagal mengosongkan nilai demo.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* CARD: Main Demo Generator Box */}
      <div className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden">
        {/* Card Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold tracking-wider uppercase">
              <Sparkles className="w-3 h-3" />
              Fitur Pengujian Sistem
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Isi Otomatis Semua Kolom Nilai Siswa (Data Demo)
            </h3>
            <p className="text-xs text-emerald-200/90 max-w-xl leading-relaxed">
              Generate nilai lengkap seluruh siswa secara otomatis untuk menguji alur perhitungan nilai, rumus Kurikulum Merdeka, cetak raport 3 halaman, dan buku leger.
            </p>
          </div>

          {/* Quick Active Period Tag */}
          <div className="px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs text-right shrink-0">
            <div className="text-[10px] text-emerald-200 uppercase font-semibold">Periode Aktif</div>
            <div className="text-xs font-bold text-white mt-0.5">
              T.A. {activePeriod.tahunAjaran} • {activePeriod.semester}
            </div>
            <div className="text-[10px] text-emerald-300 font-mono mt-0.5">
              Tipe Ujian: <span className="font-bold">{activePeriod.tipeUjian}</span>
            </div>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="p-6 bg-slate-50/70 border-b border-slate-150 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Siswa Sasaran</span>
            <span className="text-xl font-black text-slate-800 mt-0.5 block">{targetStudents.length} Siswa</span>
            <span className="text-[10px] text-slate-500 font-medium">Kelas {selectedKelasId === 'all' ? 'Semua' : currentKelas.find(k => k.id === selectedKelasId)?.nama}</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mata Pelajaran</span>
            <span className="text-xl font-black text-slate-800 mt-0.5 block">{currentMapel.length} Mapel</span>
            <span className="text-[10px] text-slate-500 font-medium">Terdaftar Aktif</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Rekor Nilai</span>
            <span className="text-xl font-black text-slate-800 mt-0.5 block">{targetTotalCombinations} Nilai</span>
            <span className="text-[10px] text-slate-500 font-medium">Kombinasi Siswa x Mapel</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kelengkapan</span>
              <span className="text-xs font-bold text-emerald-600">{fillPercentage}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                style={{ width: `${fillPercentage}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 font-medium mt-1 block">
              {currentFilledCount} dari {targetTotalCombinations} terisi
            </span>
          </div>
        </div>

        {/* Generator Options Form */}
        <div className="p-6 space-y-6">
          {/* Notifications */}
          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs space-y-2 animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed font-medium">
                  {successMessage}
                </div>
              </div>

              {/* Quick Navigation Action Pills */}
              {onNavigateToTab && (
                <div className="pt-2 border-t border-emerald-200/60 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-emerald-800">Cek Hasil Sekarang:</span>
                  <button
                    type="button"
                    onClick={() => onNavigateToTab('dashboard')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-semibold rounded-lg shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span>Dashboard Admin</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToTab('backup')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-semibold rounded-lg shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                    <span>Periksa Kelengkapan & Leger (Backup)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Target Kelas Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Pilih Target Kelas Siswa
              </label>
              <select
                value={selectedKelasId}
                onChange={(e) => setSelectedKelasId(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="all">🌟 Semua Kelas ({currentKelas.length} Ruang Kelas, {currentSiswa.length} Siswa)</option>
                {currentKelas.map(k => {
                  const sCount = currentSiswa.filter(s => s.kelasId === k.id).length;
                  return (
                    <option key={k.id} value={k.id}>
                      Kelas {k.nama} ({sCount} Siswa)
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Pilih "Semua Kelas" untuk mengisi seluruh siswa di sekolah sekaligus.
              </p>
            </div>

            {/* Model Rentang Nilai */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Karakteristik & Rentang Nilai
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setGradePreset('varied')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    gradePreset === 'varied'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-400'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-[11px]">Variatif & Alami</div>
                  <div className="text-[10px] text-emerald-700 font-mono mt-0.5">78 - 95 (Baku)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setGradePreset('high')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    gradePreset === 'high'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-400'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-[11px]">Sangat Baik</div>
                  <div className="text-[10px] text-emerald-700 font-mono mt-0.5">85 - 98 (Unggul)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setGradePreset('mixed')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    gradePreset === 'mixed'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-400'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-[11px]">Heterogen</div>
                  <div className="text-[10px] text-emerald-700 font-mono mt-0.5">72 - 88 (Campur)</div>
                </button>
              </div>
            </div>
          </div>

          {/* Checklist of What Columns Will Be Filled */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Kelengkapan Kolom yang Akan Diisi Otomatis:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span>TP 1, TP 2, TP 3, & TP 4 (Nilai Asli & Olahan)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span>Nilai Ujian ({activePeriod.tipeUjian}) & Nilai Akhir Otomatis</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span>Deskripsi Capaian Kompetensi Kurikulum Merdeka</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span>Tanpa Nilai TP Duplikat (Lolos Validasi Sistem)</span>
              </div>
            </div>

            {/* Checkbox options */}
            <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center gap-4 text-xs font-semibold text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeTP}
                  onChange={(e) => setIncludeTP(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>Lengkapi Tujuan Pembelajaran (TP) jika belum ada</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeAbsensi}
                  onChange={(e) => setIncludeAbsensi(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>Isi Absensi, Catatan Wali Kelas, & Ekstrakurikuler</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-auto">
              {!showClearConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={isProcessing || allCurrentNilai.length === 0}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Kosongkan Nilai Siswa</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 p-1.5 bg-rose-50 rounded-xl border border-rose-200 animate-fadeIn">
                  <span className="text-[11px] text-rose-800 font-bold px-2">Hapus nilai periode ini?</span>
                  <button
                    type="button"
                    onClick={handleClearDemoGrades}
                    className="px-2.5 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition"
                  >
                    Ya, Kosongkan
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-1.5 bg-white text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-slate-50 transition"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleGenerateDemoGrades}
              disabled={isProcessing}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sedang Mengisi & Menyinkronkan...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Isi Semua Kolom Nilai Siswa (Demo)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* CARD: Verification Guide & How to Check */}
      <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-slate-800">
          <HelpCircle className="w-4 h-4 text-emerald-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider">
            Panduan Cara Memeriksa Setelah Nilai Terisi
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs leading-relaxed text-slate-600">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-1">
            <span className="font-bold text-slate-900 block">1. Cek Grafik Dashboard</span>
            <p className="text-[11px] text-slate-500">
              Buka menu <strong>Dashboard Admin</strong> untuk melihat grafik persentase nilai tiap mata pelajaran yang telah mencapai 100%.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-1">
            <span className="font-bold text-slate-900 block">2. Cek Akun Guru Pengajar</span>
            <p className="text-[11px] text-slate-500">
              Login dengan akun guru (contoh: <code>ahmad_fauzi</code> / <code>guru123</code>). Di menu <strong>Input Nilai Siswa</strong>, kolom TP1-TP4 hingga Nilai Akhir akan terlihat penuh.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-1">
            <span className="font-bold text-slate-900 block">3. Cek Cetak Raport & Leger</span>
            <p className="text-[11px] text-slate-500">
              Buka menu <strong>Cetak Raport</strong> atau <strong>Backup Data</strong> untuk mencetak dokumen PDF raport 3 halaman dan buku leger dengan nilai yang utuh.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
