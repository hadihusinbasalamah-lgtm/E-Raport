/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SchemaDatabase, Kelas, Mapel, Siswa, Guru, PeriodeAkademik, TujuanPembelajaran } from './types';

export const INITIAL_GURU: Guru[] = [
  {
    id: 'g_hadi',
    nama: 'Hadi Husin, S.Kom.',
    username: '103.244.00264',
    passwordKey: 'guru123',
    isWaliKelas: true,
    waliKelasKelasId: 'k5', // IX C - Putra
    mapel1Id: 'm10', // Informatika
    mapel1KelasId: 'k5',
    mapel1KelasIds: ['k5'],
    mapel2Id: '',
    mapel2KelasId: '',
  },
  {
    id: 'g1',
    nama: 'Ust. Ahmad Fauzi, S.Pd.',
    username: 'ahmadfauzi',
    passwordKey: 'guru123',
    isWaliKelas: true,
    waliKelasKelasId: 'k1', // VII A
    mapel1Id: 'm4', // Matematika
    mapel1KelasId: 'k1', // VII A
    mapel1KelasIds: ['k1'],
    mapel2Id: 'm3', // Bahasa Indonesia
    mapel2KelasId: 'k2', // VII B
    mapel2KelasIds: ['k2', 'k3'],
  },
  {
    id: 'g2',
    nama: 'Usth. Fatimah Az-Zahra, S.Pd.',
    username: 'fatimah',
    passwordKey: 'guru123',
    isWaliKelas: true,
    waliKelasKelasId: 'k2', // VII B
    mapel1Id: 'm7', // Bahasa Inggris
    mapel1KelasId: 'k2', // VII B
    mapel1KelasIds: ['k2'],
    mapel2Id: 'm3', // Bahasa Indonesia
    mapel2KelasId: 'k1', // VII A
    mapel2KelasIds: ['k1'],
  },
  {
    id: 'g3',
    nama: 'Ust. Ridwan Hakim, S.Ag.',
    username: 'ridwan',
    passwordKey: 'guru123',
    isWaliKelas: false,
    waliKelasKelasId: '',
    mapel1Id: 'm1', // Pendidikan Agama dan Budi Pekerti
    mapel1KelasId: 'k1', // VII A
    mapel1KelasIds: ['k1'],
    mapel2Id: 'm1',
    mapel2KelasId: 'k3', // VIII A
    mapel2KelasIds: ['k3'],
  },
  {
    id: 'g4',
    nama: 'Usth. Sarah Fitriani, S.Si.',
    username: 'sarah',
    passwordKey: 'guru123',
    isWaliKelas: true,
    waliKelasKelasId: 'k3', // VIII A
    mapel1Id: 'm5', // Ilmu Pengetahuan Alam
    mapel1KelasId: 'k1', // VII A
    mapel1KelasIds: ['k1', 'k2'],
    mapel2Id: 'm4', // Matematika
    mapel2KelasId: 'k2', // VII B
    mapel2KelasIds: ['k2'],
  }
];

export const INITIAL_KELAS: Kelas[] = [
  { id: 'k5', nama: 'IX C - Putra', waliKelasId: 'g_hadi' },
  { id: 'k1', nama: 'VII A', waliKelasId: 'g1' },
  { id: 'k2', nama: 'VII B', waliKelasId: 'g2' },
  { id: 'k3', nama: 'VIII A', waliKelasId: 'g4' },
  { id: 'k4', nama: 'VIII B', waliKelasId: '' },
];

export const INITIAL_MAPEL: Mapel[] = [
  { id: 'm1', nama: 'Pendidikan Agama dan Budi Pekerti', urutan: 1, kategori: 'umum' },
  { id: 'm2', nama: 'Pendidikan Pancasila dan Kewarganegaraan', urutan: 2, kategori: 'umum' },
  { id: 'm3', nama: 'Bahasa Indonesia', urutan: 3, kategori: 'umum' },
  { id: 'm4', nama: 'Matematika', urutan: 4, kategori: 'umum' },
  { id: 'm5', nama: 'Ilmu Pengetahuan Alam', urutan: 5, kategori: 'umum' },
  { id: 'm6', nama: 'Ilmu Pengetahuan Sosial', urutan: 6, kategori: 'umum' },
  { id: 'm7', nama: 'Bahasa Inggris', urutan: 7, kategori: 'umum' },
  { id: 'm8', nama: 'Seni Rupa', urutan: 8, kategori: 'umum' },
  { id: 'm9', nama: 'Pendidikan Jasmani, Olahraga dan Kesehatan', urutan: 9, kategori: 'umum' },
  { id: 'm10', nama: 'Informatika', urutan: 10, kategori: 'umum' },
  { id: 'm11', nama: 'Bahasa Jawa', urutan: 11, kategori: 'umum' },
  { id: 'm12', nama: 'Aqidah', urutan: 12, kategori: 'yayasan' },
  { id: 'm13', nama: 'SKI', urutan: 13, kategori: 'yayasan' },
  { id: 'm14', nama: 'Bahasa Arab', urutan: 14, kategori: 'yayasan' },
  { id: 'm15', nama: 'Fiqih', urutan: 15, kategori: 'yayasan' },
  { id: 'm16', nama: "Tahfidz Al Qur'an", urutan: 16, kategori: 'yayasan' },
];

export const INITIAL_SISWA: Siswa[] = [
  // IX C - Putra (Student from reference report card)
  { id: 's_daffa', nama: 'ABDURRAHMAN AD DAFFA', nisn: '3120547764', nis: '4715', jenisKelamin: 'L', kelasId: 'k5', noAbsen: 1 },

  // VII A Students
  { id: 's1', nama: 'Faisal Rahman', nisn: '0101234561', nis: '2324001', jenisKelamin: 'L', kelasId: 'k1', noAbsen: 1 },
  { id: 's2', nama: 'Hasna Nabilah', nisn: '0101234562', nis: '2324002', jenisKelamin: 'P', kelasId: 'k1', noAbsen: 2 },
  { id: 's3', nama: 'Ibrahim Ali', nisn: '0101234563', nis: '2324003', jenisKelamin: 'L', kelasId: 'k1', noAbsen: 3 },
  { id: 's4', nama: 'Khadijah Maryam', nisn: '0101234564', nis: '2324004', jenisKelamin: 'P', kelasId: 'k1', noAbsen: 4 },
  
  // VII B Students
  { id: 's5', nama: 'Muhammad Yusuf', nisn: '0101234565', nis: '2324005', jenisKelamin: 'L', kelasId: 'k2', noAbsen: 1 },
  { id: 's6', nama: 'Aisyah Humaira', nisn: '0101234566', nis: '2324006', jenisKelamin: 'P', kelasId: 'k2', noAbsen: 2 },
  { id: 's7', nama: 'Zaid bin Haritsah', nisn: '0101234567', nis: '2324007', jenisKelamin: 'L', kelasId: 'k2', noAbsen: 3 },
  { id: 's8', nama: 'Safiyya Nabila', nisn: '0101234568', nis: '2324008', jenisKelamin: 'P', kelasId: 'k2', noAbsen: 4 },

  // VIII A Students
  { id: 's9', nama: 'Abdullah Azzam', nisn: '0091234571', nis: '2223001', jenisKelamin: 'L', kelasId: 'k3', noAbsen: 1 },
  { id: 's10', nama: 'Fatima Zahra', nisn: '0091234572', nis: '2223002', jenisKelamin: 'P', kelasId: 'k3', noAbsen: 2 },
];

export const INITIAL_PERIODS: PeriodeAkademik[] = [
  {
    id: 'p1',
    tahunAjaran: '2025/2026',
    semester: 'Ganjil',
    tipeUjian: 'PSTS1',
    isPublished: true,
    publishedAt: '2025-10-15T07:20:00Z',
    snapshotKelas: INITIAL_KELAS,
    snapshotSiswa: INITIAL_SISWA,
    snapshotGuru: INITIAL_GURU,
    snapshotMapel: INITIAL_MAPEL
  }
];

export const INITIAL_TP: TujuanPembelajaran[] = [
  {
    id: 'tp_init_1',
    periodeId: 'p1',
    guruId: 'g1',
    mapelId: 'm1', // Matematika (Ust. Ahmad Fauzi di VII A)
    kelasId: 'VII',
    tp1: 'Memahami konsep bilangan bulat, rasional, dan operasinya dalam masalah kontekstual',
    tp2: 'Menyelesaikan permasalahan persamaan dan pertidaksamaan aljabar linier satu variabel',
    tp3: 'Mengaplikasikan konsep aritmetika sosial dalam transaksi ekonomi sehari-hari',
    tp4: 'Menyajikan dan menafsirkan data dalam bentuk diagram batang dan garis'
  },
  {
    id: 'tp_init_2',
    periodeId: 'p1',
    guruId: 'g2',
    mapelId: 'm4', // Bahasa Inggris (Usth. Fatimah di VII B)
    kelasId: 'VII',
    tp1: 'Mengidentifikasi konteks, gagasan utama, dan informasi rinci dari teks deskriptif lisan dan tulis',
    tp2: 'Menyusun teks interaksi interpersonal perkenalan diri dan sapaan dalam bahasa Inggris',
    tp3: 'Memahami teks prosedur sederhana tentang resep atau instruksi kerja harian'
  },
  {
    id: 'tp_init_3',
    periodeId: 'p1',
    guruId: 'g2',
    mapelId: 'm3', // Bahasa Indonesia (Usth. Fatimah di VII A - Rekan Ust. Ahmad Fauzi di VII B)
    kelasId: 'VII',
    tp1: 'Menganalisis ide pokok, pesan tersirat, dan struktur teks deskripsi secara kritis',
    tp2: 'Menyusun kerangka dan menulis teks prosedur dengan memperhatikan kaidah kebahasaan',
    tp3: 'Mempresentasikan hasil karya deskriptif lisan dengan intonasi dan artikulasi yang baik'
  },
  {
    id: 'tp_init_4',
    periodeId: 'p1',
    guruId: 'g4',
    mapelId: 'm2', // IPA Terpadu (Usth. Sarah)
    kelasId: 'VII',
    tp1: 'Menerapkan metode ilmiah dan pengukuran besaran fisis dalam penyelidikan sains',
    tp2: 'Menganalisis sifat zat, perubahan wujud materi, dan pemisahan campuran sederhana',
    tp3: 'Memahami organisasi kehidupan dari sel hingga organisme dan rantai makanan'
  },
  {
    id: 'tp_init_5',
    periodeId: 'p1',
    guruId: 'g3',
    mapelId: 'm5', // PAI (Ust. Ridwan)
    kelasId: 'VII',
    tp1: 'Membaca dan memahami kandungan ayat Al-Quran serta Hadis tentang menuntut ilmu',
    tp2: 'Meneladani sifat-sifat mulia Asmaul Husna dalam interaksi sosial sehari-hari',
    tp3: 'Mempraktikkan tata cara thaharah dan salat berjemaah dengan khusyuk'
  }
];

export const SAMPLE_DAFFA_GRADES = [
  { mapelId: 'm1', nilaiAkhir: 75, capaian: 'Menunjukkan penguasaan sangat baik dalam membaca dan memahami kandungan ayat al-quran serta hadis tentang ilmu. Perlu bimbingan dalam memahami sejarah perkembangan dakwah islam pada masa rasulullah saw.' },
  { mapelId: 'm2', nilaiAkhir: 81, capaian: 'Menunjukkan penguasaan sangat baik dalam memahami konsep dasar dan materi pokok pembelajaran pendidikan pancasila dan kewarganegaraan. Perlu bimbingan dalam menyajikan laporan serta refleksi pembelajaran pendidikan pancasila dan kewarganegaraan secara kolaboratif.' },
  { mapelId: 'm3', nilaiAkhir: 75, capaian: 'Menunjukkan penguasaan sangat baik dalam menganalisis ide pokok, pesan tersirat, dan struktur teks deskripsi secara kritis. Perlu bimbingan dalam menulis tanggapan kritis terhadap buku fiksi dan nonfiksi yang dibaca.' },
  { mapelId: 'm4', nilaiAkhir: 75, capaian: 'Menunjukkan penguasaan sangat baik dalam memahami konsep bilangan, aljabar, dan operasinya dalam masalah kontekstual. Perlu bimbingan dalam menyajikan dan menganalisis data dalam diagram batang dan garis.' },
  { mapelId: 'm5', nilaiAkhir: 87, capaian: 'Menunjukkan penguasaan sangat baik dalam ini adalah tp 1. Perlu bimbingan dalam menyajikan laporan dan refleksi pembelajaran ilmu pengetahuan alam secara kritis.' },
  { mapelId: 'm6', nilaiAkhir: 78, capaian: 'Menunjukkan penguasaan sangat baik dalam memahami interaksi antarruang dan pengaruhnya terhadap aktivitas ekonomi masyarakat. Perlu bimbingan dalam menelusuri peninggalan sejarah dan kebudayaan masa praaksara hingga kolonial.' },
  { mapelId: 'm7', nilaiAkhir: 87, capaian: 'Menunjukkan penguasaan sangat baik dalam mengidentifikasi gagasan utama dan informasi rinci teks deskriptif lisan dan tulis. Perlu bimbingan dalam mempresentasikan teks deskriptif sederhana dengan pelafalan yang tepat.' },
  { mapelId: 'm8', nilaiAkhir: 78, capaian: 'Menunjukkan penguasaan sangat baik dalam memahami konsep dasar dan materi pokok pembelajaran seni budaya. Perlu bimbingan dalam menyajikan laporan serta refleksi pembelajaran seni budaya secara kolaboratif.' },
  { mapelId: 'm9', nilaiAkhir: 81, capaian: 'Menunjukkan penguasaan sangat baik dalam mempraktikkan variasi gerak spesifik dalam permainan bola besar dan kecil. Perlu bimbingan dalam mempraktikkan keterampilan aktivitas gerak berirama secara kompak.' },
  { mapelId: 'm10', nilaiAkhir: 75, capaian: 'Menunjukkan penguasaan sangat baik dalam tp 1. Perlu bimbingan dalam menyajikan laporan dan refleksi pembelajaran informatika secara kritis.' },
  { mapelId: 'm11', nilaiAkhir: 81, capaian: 'Menunjukkan penguasaan sangat baik dalam memahami konsep dasar dan materi pokok pembelajaran bahasa jawa. Perlu bimbingan dalam menyajikan laporan serta refleksi pembelajaran bahasa jawa secara kolaboratif.' },
  { mapelId: 'm12', nilaiAkhir: 87, capaian: 'Menunjukkan penguasaan sangat baik dalam memahami konsep dasar dan materi pokok pembelajaran aqidah. Perlu bimbingan dalam menyajikan laporan serta refleksi pembelajaran aqidah secara kolaboratif.' },
  { mapelId: 'm13', nilaiAkhir: 78, capaian: 'Menunjukkan penguasaan sangat baik dalam memahami konsep dasar dan materi pokok pembelajaran ski. Perlu bimbingan dalam menyajikan laporan serta refleksi pembelajaran ski secara kolaboratif.' },
  { mapelId: 'm14', nilaiAkhir: 84, capaian: 'Menunjukkan penguasaan sangat baik dalam mendengarkan dan menirukan ungkapan sapaan dan perkenalan bahasa arab. Perlu bimbingan dalam mendemonstrasikan percakapan pendek bahasa arab dengan intonasi fasih.' },
  { mapelId: 'm15', nilaiAkhir: 84, capaian: 'Menunjukkan penguasaan sangat baik dalam memahami konsep dasar dan materi pokok pembelajaran fiqih. Perlu bimbingan dalam menyajikan laporan serta refleksi pembelajaran fiqih secara kolaboratif.' },
  { mapelId: 'm16', nilaiAkhir: 84, capaian: "Menunjukkan penguasaan sangat baik dalam memahami konsep dasar dan materi pokok pembelajaran tahfidz al qur'an. Perlu bimbingan dalam menyajikan laporan serta refleksi pembelajaran tahfidz al qur'an secara kolaboratif." },
];

export const STORAGE_KEY = 'e_raport_db';

export function getDatabase(): SchemaDatabase {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const db = JSON.parse(stored) as SchemaDatabase;
      // Ensure essential arrays and keys exist
      if (!db.kelas) db.kelas = INITIAL_KELAS;
      if (!db.mapel) db.mapel = INITIAL_MAPEL;
      if (!db.siswa) db.siswa = INITIAL_SISWA;
      if (!db.guru) db.guru = INITIAL_GURU;
      if (!db.periodList) db.periodList = INITIAL_PERIODS;
      if (db.activePeriodId === undefined) db.activePeriodId = 'p1';

      // Ensure IX C - Putra and Abdurrahman Ad Daffa exist in existing db
      if (!db.kelas.some(k => k.id === 'k5' || k.nama.toLowerCase().includes('ix c'))) {
        db.kelas.unshift({ id: 'k5', nama: 'IX C - Putra', waliKelasId: 'g_hadi' });
      }
      if (!db.guru.some(g => g.id === 'g_hadi' || g.nama.toLowerCase().includes('hadi husin'))) {
        db.guru.unshift(INITIAL_GURU[0]);
      }
      if (!db.siswa.some(s => s.id === 's_daffa' || s.nama.toLowerCase().includes('abdurrahman ad daffa'))) {
        db.siswa.unshift(INITIAL_SISWA[0]);
      }

      // Merge all 16 official subjects if missing
      INITIAL_MAPEL.forEach(im => {
        if (!db.mapel.some(m => m.id === im.id || m.nama.toLowerCase().trim() === im.nama.toLowerCase().trim())) {
          db.mapel.push(im);
        }
      });

      // Ensure active period's snapshot has the full class and mapels
      const activeP = db.periodList.find(p => p.id === db.activePeriodId);
      if (activeP) {
        if (!activeP.snapshotKelas?.some(k => k.id === 'k5' || k.nama.toLowerCase().includes('ix c'))) {
          activeP.snapshotKelas = [...(activeP.snapshotKelas || []), { id: 'k5', nama: 'IX C - Putra', waliKelasId: 'g_hadi' }];
        }
        if (!activeP.snapshotGuru?.some(g => g.id === 'g_hadi' || g.nama.toLowerCase().includes('hadi husin'))) {
          activeP.snapshotGuru = [...(activeP.snapshotGuru || []), INITIAL_GURU[0]];
        }
        if (!activeP.snapshotSiswa?.some(s => s.id === 's_daffa' || s.nama.toLowerCase().includes('abdurrahman ad daffa'))) {
          activeP.snapshotSiswa = [...(activeP.snapshotSiswa || []), INITIAL_SISWA[0]];
        }
        INITIAL_MAPEL.forEach(im => {
          if (!activeP.snapshotMapel?.some(m => m.id === im.id || m.nama.toLowerCase().trim() === im.nama.toLowerCase().trim())) {
            activeP.snapshotMapel = [...(activeP.snapshotMapel || []), im];
          }
        });
      }

      if (!db.tujuanPembelajaran || db.tujuanPembelajaran.length === 0) {
        db.tujuanPembelajaran = INITIAL_TP;
      } else {
        // Merge missing seed TPs to ensure peer teachers always exist
        INITIAL_TP.forEach(seedTp => {
          if (!db.tujuanPembelajaran.some(t => t.id === seedTp.id)) {
            db.tujuanPembelajaran.push(seedTp);
          }
        });
      }
      if (!db.nilaiSiswa) db.nilaiSiswa = [];
      
      // Ensure Abdurrahman Ad Daffa has his official 16 grades
      SAMPLE_DAFFA_GRADES.forEach(g => {
        const gradeKey = `p1_s_daffa_${g.mapelId}`;
        if (!db.nilaiSiswa.some(n => n.siswaId === 's_daffa' && n.mapelId === g.mapelId)) {
          db.nilaiSiswa.push({
            id: gradeKey,
            periodeId: 'p1',
            siswaId: 's_daffa',
            mapelId: g.mapelId,
            guruId: 'g_hadi',
            nilaiAkhir: g.nilaiAkhir,
            capaianKompetensi: g.capaian
          });
        }
      });

      if (!db.absensiDanCatatan) db.absensiDanCatatan = [];
      if (!db.absensiDanCatatan.some(a => a.siswaId === 's_daffa')) {
        db.absensiDanCatatan.push({
          id: 'p1_s_daffa',
          periodeId: 'p1',
          siswaId: 's_daffa',
          kelasId: 'k5',
          sakit: 1,
          izin: 1,
          alfa: 0,
          catatanWaliKelas: 'Menunjukkan perkembangan akademik dan akhlak yang sangat baik.',
          kelakuan: 'Sangat Baik',
          kerajinan: 'Sangat Baik',
          kerapihan: 'Sangat Baik',
          ekstrakurikuler: [
            { nama: 'Pramuka Penggalang', nilai: 'A' },
            { nama: "Tahfidz Al-Qur'an Juz 30", nilai: 'A' }
          ]
        });
      }

      if (!db.adminUsername) db.adminUsername = 'admin';
      if (!db.adminPasswordKey) db.adminPasswordKey = 'alirsyadsolo';
      return db;
    } catch (e) {
      console.error("Error parsing stored database, resetting to seed data", e);
    }
  }

  // Create initial seed data database
  const d: SchemaDatabase = {
    adminUsername: 'admin',
    adminPasswordKey: 'alirsyadsolo',
    kelas: INITIAL_KELAS,
    mapel: INITIAL_MAPEL,
    siswa: INITIAL_SISWA,
    guru: INITIAL_GURU,
    periodList: INITIAL_PERIODS,
    activePeriodId: 'p1',
    tujuanPembelajaran: INITIAL_TP,
    nilaiSiswa: [
      ...SAMPLE_DAFFA_GRADES.map(g => ({
        id: `p1_s_daffa_${g.mapelId}`,
        periodeId: 'p1',
        siswaId: 's_daffa',
        mapelId: g.mapelId,
        guruId: 'g_hadi',
        nilaiAkhir: g.nilaiAkhir,
        capaianKompetensi: g.capaian
      })),
      {
        id: 'p1_s1_m1',
        periodeId: 'p1',
        siswaId: 's1',
        mapelId: 'm1',
        guruId: 'g1',
        tp1Nilai: 85,
        tp2Nilai: 80,
        nilaiUjian: 78,
        nilaiAkhir: 81
      },
      {
        id: 'p1_s2_m1',
        periodeId: 'p1',
        siswaId: 's2',
        mapelId: 'm1',
        guruId: 'g1',
        tp1Nilai: 90,
        tp2Nilai: 88,
        nilaiUjian: 85,
        nilaiAkhir: 88
      }
    ],
    absensiDanCatatan: [
      {
        id: 'p1_s_daffa',
        periodeId: 'p1',
        siswaId: 's_daffa',
        kelasId: 'k5',
        sakit: 1,
        izin: 1,
        alfa: 0,
        catatanWaliKelas: 'Menunjukkan perkembangan akademik dan akhlak yang sangat baik.',
        kelakuan: 'Sangat Baik',
        kerajinan: 'Sangat Baik',
        kerapihan: 'Sangat Baik',
        ekstrakurikuler: [
          { nama: 'Pramuka Penggalang', nilai: 'A' },
          { nama: "Tahfidz Al-Qur'an Juz 30", nilai: 'A' }
        ]
      },
      {
        id: 'p1_s1',
        periodeId: 'p1',
        siswaId: 's1',
        kelasId: 'k1',
        sakit: 1,
        izin: 2,
        alfa: 0,
        catatanWaliKelas: 'Sangat baik dalam mengikuti kegiatan keagamaan sekolah. Pertahankan semangat belajarmu!',
        kelakuan: 'Sangat Baik',
        kerajinan: 'Baik',
        kerapihan: 'Sangat Baik'
      },
      {
        id: 'p1_s2',
        periodeId: 'p1',
        siswaId: 's2',
        kelasId: 'k1',
        sakit: 0,
        izin: 0,
        alfa: 0,
        catatanWaliKelas: 'Prestasi akademik sangat membanggakan. Teruslah belajar dengan rajin dan rendah hati.',
        kelakuan: 'Sangat Baik',
        kerajinan: 'Sangat Baik',
        kerapihan: 'Sangat Baik'
      }
    ]
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  return d;
}

export function saveDatabase(db: SchemaDatabase): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}
