/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SchemaDatabase, Kelas, Mapel, Siswa, Guru, PeriodeAkademik } from './types';

export const INITIAL_GURU: Guru[] = [
  {
    id: 'g1',
    nama: 'Ust. Ahmad Fauzi, S.Pd.',
    username: 'ahmadfauzi',
    passwordKey: 'guru123',
    isWaliKelas: true,
    waliKelasKelasId: 'k1', // VII A
    mapel1Id: 'm1', // Matematika
    mapel1KelasId: 'k1', // VII A
    mapel2Id: 'm3', // Bahasa Indonesia
    mapel2KelasId: 'k3', // VIII A
  },
  {
    id: 'g2',
    nama: 'Usth. Fatimah Az-Zahra, S.Pd.',
    username: 'fatimah',
    passwordKey: 'guru123',
    isWaliKelas: true,
    waliKelasKelasId: 'k2', // VII B
    mapel1Id: 'm4', // Bahasa Inggris
    mapel1KelasId: 'k2', // VII B
    mapel2Id: 'm3', // Bahasa Indonesia
    mapel2KelasId: 'k1', // VII A
  },
  {
    id: 'g3',
    nama: 'Ust. Ridwan Hakim, S.Ag.',
    username: 'ridwan',
    passwordKey: 'guru123',
    isWaliKelas: false,
    waliKelasKelasId: '',
    mapel1Id: 'm5', // Pendidikan Agama Islam
    mapel1KelasId: 'k1', // VII A
    mapel2Id: 'm5', // Pendidikan Agama Islam
    mapel2KelasId: 'k3', // VIII A
  },
  {
    id: 'g4',
    nama: 'Usth. Sarah Fitriani, S.Si.',
    username: 'sarah',
    passwordKey: 'guru123',
    isWaliKelas: true,
    waliKelasKelasId: 'k3', // VIII A
    mapel1Id: 'm2', // Ilmu Pengetahuan Alam
    mapel1KelasId: 'k1', // VII A
    mapel2Id: 'm2', // Ilmu Pengetahuan Alam
    mapel2KelasId: 'k2', // VII B
  }
];

export const INITIAL_KELAS: Kelas[] = [
  { id: 'k1', nama: 'VII A', waliKelasId: 'g1' },
  { id: 'k2', nama: 'VII B', waliKelasId: 'g2' },
  { id: 'k3', nama: 'VIII A', waliKelasId: 'g4' },
  { id: 'k4', nama: 'VIII B', waliKelasId: '' },
];

export const INITIAL_MAPEL: Mapel[] = [
  { id: 'm5', nama: 'Pendidikan Agama Islam' },
  { id: 'm1', nama: 'Matematika' },
  { id: 'm2', nama: 'Ilmu Pengetahuan Alam (IPA)' },
  { id: 'm3', nama: 'Bahasa Indonesia' },
  { id: 'm4', nama: 'Bahasa Inggris' },
  { id: 'm6', nama: 'Pendidikan Pancasila' },
];

export const INITIAL_SISWA: Siswa[] = [
  // VII A Students
  { id: 's1', nama: 'Faisal Rahman', nisn: '0101234561', nis: '2324001', jenisKelamin: 'L', kelasId: 'k1' },
  { id: 's2', nama: 'Hasna Nabilah', nisn: '0101234562', nis: '2324002', jenisKelamin: 'P', kelasId: 'k1' },
  { id: 's3', nama: 'Ibrahim Ali', nisn: '0101234563', nis: '2324003', jenisKelamin: 'L', kelasId: 'k1' },
  { id: 's4', nama: 'Khadijah Maryam', nisn: '0101234564', nis: '2324004', jenisKelamin: 'P', kelasId: 'k1' },
  
  // VII B Students
  { id: 's5', nama: 'Muhammad Yusuf', nisn: '0101234565', nis: '2324005', jenisKelamin: 'L', kelasId: 'k2' },
  { id: 's6', nama: 'Aisyah Humaira', nisn: '0101234566', nis: '2324006', jenisKelamin: 'P', kelasId: 'k2' },
  { id: 's7', nama: 'Zaid bin Haritsah', nisn: '0101234567', nis: '2324007', jenisKelamin: 'L', kelasId: 'k2' },
  { id: 's8', nama: 'Safiyya Nabila', nisn: '0101234568', nis: '2324008', jenisKelamin: 'P', kelasId: 'k2' },

  // VIII A Students
  { id: 's9', nama: 'Abdullah Azzam', nisn: '0091234571', nis: '2223001', jenisKelamin: 'L', kelasId: 'k3' },
  { id: 's10', nama: 'Fatima Zahra', nisn: '0091234572', nis: '2223002', jenisKelamin: 'P', kelasId: 'k3' },
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
      if (!db.tujuanPembelajaran) db.tujuanPembelajaran = [];
      if (!db.nilaiSiswa) db.nilaiSiswa = [];
      if (!db.absensiDanCatatan) db.absensiDanCatatan = [];
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
    tujuanPembelajaran: [
      {
        id: 'tp_init_1',
        periodeId: 'p1',
        guruId: 'g1',
        mapelId: 'm1',
        kelasId: 'k1',
        tp1: 'Memahami konsep bilangan bulat dan operasinya',
        tp2: 'Menyelesaikan permasalahan aljabar sederhana'
      },
      {
        id: 'tp_init_2',
        periodeId: 'p1',
        guruId: 'g2',
        mapelId: 'm4',
        kelasId: 'k2',
        tp1: 'Mengidentifikasi teks deskriptif lisan dan tulis',
        tp2: 'Menyusun naskah perkenalan diri dalam Bahasa Inggris'
      }
    ],
    nilaiSiswa: [
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
