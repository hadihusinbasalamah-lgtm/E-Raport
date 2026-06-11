/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Kelas {
  id: string;
  nama: string; // e.g. "VII A", "VIII B", "IX C"
  waliKelasId: string; // Guru ID
}

export interface Mapel {
  id: string;
  nama: string; // e.g. "Matematika", "Ilmu Pengetahuan Alam", "Bahasa Indonesia"
}

export interface Siswa {
  id: string;
  nisn: string;
  nis: string;
  nama: string;
  jenisKelamin: 'L' | 'P'; // Laki-laki / Perempuan
  kelasId: string;
  noAbsen?: number;
}

export interface Guru {
  id: string;
  nama: string;
  username: string;
  passwordKey: string;
  isWaliKelas: boolean;
  waliKelasKelasId: string; // ID Kelas yang diampu jika isWaliKelas true
  
  // Setiap guru bisa mengajar 2 mapel dan setiap mapel ditargetnya beda kelas
  mapel1Id: string;
  mapel1KelasId: string;
  mapel1KelasIds?: string[];
  
  mapel2Id: string; // bisa kosong ""
  mapel2KelasId: string; // bisa kosong ""
  mapel2KelasIds?: string[];
}

export type TipeUjian = 'PSTS1' | 'PSAS1' | 'PSTS2' | 'PSAT';

export interface PeriodeAkademik {
  id: string; // e.g., "2025-2026_Ganjil_PSTS1"
  tahunAjaran: string; // e.g., "2025/2026"
  semester: 'Ganjil' | 'Genap';
  tipeUjian: TipeUjian;
  isPublished: boolean;
  publishedAt?: string;
  tanggalRaport?: string;
  
  // Snapshotted structures of the database when admin clicked publish
  snapshotKelas: Kelas[];
  snapshotSiswa: Siswa[];
  snapshotGuru: Guru[];
  snapshotMapel: Mapel[];
}

export interface TujuanPembelajaran {
  id: string;
  periodeId: string;
  guruId: string;
  mapelId: string;
  kelasId: string;
  tp1: string; // min 2 TP
  tp2: string;
  tp3?: string;
  tp4?: string;
}

export interface NilaiSiswa {
  id: string; // periodeId_siswaId_mapelId
  periodeId: string;
  siswaId: string;
  mapelId: string;
  guruId: string;
  
  tp1NilaiAsli?: number;
  tp1Nilai: number;
  tp2NilaiAsli?: number;
  tp2Nilai: number;
  tp3NilaiAsli?: number;
  tp3Nilai?: number;
  tp4NilaiAsli?: number;
  tp4Nilai?: number;
  nilaiUjianAsli?: number;
  nilaiUjian: number;
  nilaiAkhir: number; // calculated
  
  capaianKompetensi?: string; // Deskripsi capaian
}

export interface EkstrakurikulerItem {
  nama: string;
  nilai: 'A' | 'B' | 'C';
}

export interface AbsensiDanCatatan {
  id: string; // periodeId_siswaId
  periodeId: string;
  siswaId: string;
  kelasId: string;
  sakit: number;
  izin: number;
  alfa: number;
  catatanWaliKelas: string;
  kelakuan?: string; // Kurikulum Merdeka traits (e.g., Sangat Baik, Baik)
  kerajinan?: string;
  kerapihan?: string;
  ekstrakurikuler?: EkstrakurikulerItem[];
}

export interface SchemaDatabase {
  adminUsername: string;
  adminPasswordKey: string;
  
  kelas: Kelas[];
  mapel: Mapel[];
  siswa: Siswa[];
  guru: Guru[];
  
  periodList: PeriodeAkademik[];
  activePeriodId: string; // ID of the currently published / active period
  
  tujuanPembelajaran: TujuanPembelajaran[];
  nilaiSiswa: NilaiSiswa[];
  absensiDanCatatan: AbsensiDanCatatan[];
}

export type LoginRole = 'admin' | 'guru' | null;

export interface SessionState {
  role: LoginRole;
  userId: string; // "admin" or Guru.id
  name: string; // "Administrator" or Guru.nama
}

export function formatTipeUjian(tipe: string | undefined | null): string {
  if (!tipe) return '';
  return tipe.replace(/([A-Za-z]+)(\d+)/g, '$1 $2');
}
