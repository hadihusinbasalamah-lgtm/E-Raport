/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SchemaDatabase, Kelas, Mapel, Siswa, Guru, PeriodeAkademik, TujuanPembelajaran, NilaiSiswa, AbsensiDanCatatan } from '../types';
import { sortKelasList } from '../utils/kelasOrder';

const STORAGE_URL_KEY = 'e_raport_supabase_url';
const STORAGE_ANON_KEY = 'e_raport_supabase_anon_key';
const STORAGE_PROVIDER_KEY = 'e_raport_db_provider';

/**
 * Mendapatkan konfigurasi URL dan Anon Key Supabase.
 * Membaca dari localStorage (jika disetel di UI Admin) atau dari variabel environment Vite.
 */
export function getSupabaseConfig(): { url: string; anonKey: string } {
  const localUrl = localStorage.getItem(STORAGE_URL_KEY);
  const localKey = localStorage.getItem(STORAGE_ANON_KEY);

  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  return {
    url: (localUrl || envUrl || '').trim(),
    anonKey: (localKey || envKey || '').trim()
  };
}

/**
 * Menyimpan konfigurasi Supabase ke localStorage
 */
export function saveSupabaseConfig(url: string, anonKey: string): void {
  if (url) localStorage.setItem(STORAGE_URL_KEY, url.trim());
  else localStorage.removeItem(STORAGE_URL_KEY);

  if (anonKey) localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
  else localStorage.removeItem(STORAGE_ANON_KEY);

  // Invalidate cached client
  cachedClient = null;
}

/**
 * Mengetahui database provider yang aktif saat ini (Supabase)
 */
export function getActiveDbProvider(): 'supabase' {
  return 'supabase';
}

/**
 * Mengubah database provider yang aktif (Supabase permanen)
 */
export function setActiveDbProvider(_provider: string): void {
  localStorage.setItem(STORAGE_PROVIDER_KEY, 'supabase');
}

/**
 * Cek apakah kredensial Supabase sudah terisi
 */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey && url.startsWith('http'));
}

let cachedClient: SupabaseClient | null = null;

/**
 * Mengambil instance Supabase Client
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey || !url.startsWith('http')) {
    return null;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
    return cachedClient;
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    return null;
  }
}

/**
 * Menguji koneksi ke Supabase dan mengecek keberadaan tabel
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'URL atau Anon Key Supabase belum diisi atau tidak valid.'
    };
  }

  try {
    const { data, error } = await client.from('config').select('*').limit(1);
    if (error) {
      if (error.code === '42P01') {
        return {
          success: false,
          message: 'Terkoneksi ke Supabase, namun tabel belum dibuat. Harap jalankan file "supabase_schema.sql" di SQL Editor Supabase.'
        };
      }
      return {
        success: false,
        message: `Gagal query Supabase: ${error.message} (Code: ${error.code})`
      };
    }

    return {
      success: true,
      message: 'Koneksi ke Supabase berhasil! Tabel ditemukan.',
      details: data
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Terjadi kendala jaringan saat menghubungi Supabase: ${err.message || String(err)}`
    };
  }
}

// ========================================================================
// MAPPERS: CamelCase (TypeScript) <-> snake_case (Postgres/Supabase)
// ========================================================================

export function mapKelasToSupabase(k: Kelas) {
  return {
    id: k.id,
    nama: k.nama,
    wali_kelas_id: k.waliKelasId || null
  };
}

export function mapKelasFromSupabase(row: any): Kelas {
  return {
    id: row.id,
    nama: row.nama,
    waliKelasId: row.wali_kelas_id || ''
  };
}

export function mapMapelToSupabase(m: Mapel) {
  return {
    id: m.id,
    nama: m.nama,
    urutan: m.urutan || 0,
    kategori: m.kategori || 'umum'
  };
}

export function mapMapelFromSupabase(row: any): Mapel {
  return {
    id: row.id,
    nama: row.nama,
    urutan: row.urutan || 0,
    kategori: row.kategori || 'umum'
  };
}

export function mapSiswaToSupabase(s: Siswa) {
  return {
    id: s.id,
    nisn: s.nisn || '',
    nis: s.nis || '',
    nama: s.nama,
    jenis_kelamin: s.jenisKelamin,
    kelas_id: s.kelasId,
    no_absen: s.noAbsen || null
  };
}

export function mapSiswaFromSupabase(row: any): Siswa {
  return {
    id: row.id,
    nisn: row.nisn || '',
    nis: row.nis || '',
    nama: row.nama,
    jenisKelamin: row.jenis_kelamin || 'L',
    kelasId: row.kelas_id || '',
    noAbsen: row.no_absen || undefined
  };
}

export function mapGuruToSupabase(g: Guru) {
  return {
    id: g.id,
    nama: g.nama,
    username: g.username,
    password_key: g.passwordKey,
    is_wali_kelas: Boolean(g.isWaliKelas),
    wali_kelas_kelas_id: g.waliKelasKelasId || '',
    mapel1_id: g.mapel1Id || '',
    mapel1_kelas_id: g.mapel1KelasId || '',
    mapel1_kelas_ids: g.mapel1KelasIds || [],
    mapel2_id: g.mapel2Id || '',
    mapel2_kelas_id: g.mapel2KelasId || '',
    mapel2_kelas_ids: g.mapel2KelasIds || [],
    mapel3_id: g.mapel3Id || '',
    mapel3_kelas_id: g.mapel3KelasId || '',
    mapel3_kelas_ids: g.mapel3KelasIds || []
  };
}

export function mapGuruFromSupabase(row: any): Guru {
  return {
    id: row.id,
    nama: row.nama,
    username: row.username,
    passwordKey: row.password_key,
    isWaliKelas: Boolean(row.is_wali_kelas),
    waliKelasKelasId: row.wali_kelas_kelas_id || '',
    mapel1Id: row.mapel1_id || '',
    mapel1KelasId: row.mapel1_kelas_id || '',
    mapel1KelasIds: Array.isArray(row.mapel1_kelas_ids) ? row.mapel1_kelas_ids : [],
    mapel2Id: row.mapel2_id || '',
    mapel2KelasId: row.mapel2_kelas_id || '',
    mapel2KelasIds: Array.isArray(row.mapel2_kelas_ids) ? row.mapel2_kelas_ids : [],
    mapel3Id: row.mapel3_id || '',
    mapel3KelasId: row.mapel3_kelas_id || '',
    mapel3KelasIds: Array.isArray(row.mapel3_kelas_ids) ? row.mapel3_kelas_ids : []
  };
}

export function mapPeriodToSupabase(p: PeriodeAkademik) {
  return {
    id: p.id,
    tahun_ajaran: p.tahunAjaran,
    semester: p.semester,
    tipe_ujian: p.tipeUjian,
    is_published: Boolean(p.isPublished),
    published_at: p.publishedAt || null,
    tanggal_raport: p.tanggalRaport || null,
    snapshot_kelas: p.snapshotKelas || [],
    snapshot_siswa: p.snapshotSiswa || [],
    snapshot_guru: p.snapshotGuru || [],
    snapshot_mapel: p.snapshotMapel || []
  };
}

export function mapPeriodFromSupabase(row: any): PeriodeAkademik {
  return {
    id: row.id,
    tahunAjaran: row.tahun_ajaran,
    semester: row.semester,
    tipeUjian: row.tipe_ujian,
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at || undefined,
    tanggalRaport: row.tanggal_raport || undefined,
    snapshotKelas: sortKelasList(Array.isArray(row.snapshot_kelas) ? row.snapshot_kelas : []),
    snapshotSiswa: Array.isArray(row.snapshot_siswa) ? row.snapshot_siswa : [],
    snapshotGuru: Array.isArray(row.snapshot_guru) ? row.snapshot_guru : [],
    snapshotMapel: Array.isArray(row.snapshot_mapel) ? row.snapshot_mapel : []
  };
}

export function mapTPToSupabase(tp: TujuanPembelajaran) {
  return {
    id: tp.id,
    periode_id: tp.periodeId,
    guru_id: tp.guruId,
    mapel_id: tp.mapelId,
    kelas_id: tp.kelasId,
    tp1: tp.tp1,
    tp2: tp.tp2,
    tp3: tp.tp3 || null,
    tp4: tp.tp4 || null
  };
}

export function mapTPFromSupabase(row: any): TujuanPembelajaran {
  return {
    id: row.id,
    periodeId: row.periode_id,
    guruId: row.guru_id,
    mapelId: row.mapel_id,
    kelasId: row.kelas_id,
    tp1: row.tp1,
    tp2: row.tp2,
    tp3: row.tp3 || undefined,
    tp4: row.tp4 || undefined
  };
}

export function mapNilaiToSupabase(n: NilaiSiswa) {
  return {
    id: n.id,
    periode_id: n.periodeId,
    siswa_id: n.siswaId,
    mapel_id: n.mapelId,
    guru_id: n.guruId,
    tp1_nilai_asli: n.tp1NilaiAsli ?? null,
    tp1_nilai: n.tp1Nilai ?? null,
    tp2_nilai_asli: n.tp2NilaiAsli ?? null,
    tp2_nilai: n.tp2Nilai ?? null,
    tp3_nilai_asli: n.tp3NilaiAsli ?? null,
    tp3_nilai: n.tp3Nilai ?? null,
    tp4_nilai_asli: n.tp4NilaiAsli ?? null,
    tp4_nilai: n.tp4Nilai ?? null,
    nilai_ujian_asli: n.nilaiUjianAsli ?? null,
    nilai_ujian: n.nilaiUjian ?? null,
    nilai_akhir: n.nilaiAkhir ?? 0,
    capaian_kompetensi: n.capaianKompetensi ?? null
  };
}

export function mapNilaiFromSupabase(row: any): NilaiSiswa {
  return {
    id: row.id,
    periodeId: row.periode_id,
    siswaId: row.siswa_id,
    mapelId: row.mapel_id,
    guruId: row.guru_id,
    tp1NilaiAsli: row.tp1_nilai_asli != null ? Number(row.tp1_nilai_asli) : undefined,
    tp1Nilai: row.tp1_nilai != null ? Number(row.tp1_nilai) : undefined,
    tp2NilaiAsli: row.tp2_nilai_asli != null ? Number(row.tp2_nilai_asli) : undefined,
    tp2Nilai: row.tp2_nilai != null ? Number(row.tp2_nilai) : undefined,
    tp3NilaiAsli: row.tp3_nilai_asli != null ? Number(row.tp3_nilai_asli) : undefined,
    tp3Nilai: row.tp3_nilai != null ? Number(row.tp3_nilai) : undefined,
    tp4NilaiAsli: row.tp4_nilai_asli != null ? Number(row.tp4_nilai_asli) : undefined,
    tp4Nilai: row.tp4_nilai != null ? Number(row.tp4_nilai) : undefined,
    nilaiUjianAsli: row.nilai_ujian_asli != null ? Number(row.nilai_ujian_asli) : undefined,
    nilaiUjian: row.nilai_ujian != null ? Number(row.nilai_ujian) : undefined,
    nilaiAkhir: Number(row.nilai_akhir || 0),
    capaianKompetensi: row.capaian_kompetensi || undefined
  };
}

export function mapAbsensiToSupabase(a: AbsensiDanCatatan) {
  return {
    id: a.id,
    periode_id: a.periodeId,
    siswa_id: a.siswaId,
    kelas_id: a.kelasId,
    sakit: a.sakit || 0,
    izin: a.izin || 0,
    alfa: a.alfa || 0,
    catatan_wali_kelas: a.catatanWaliKelas || '',
    kelakuan: a.kelakuan || null,
    kerajinan: a.kerajinan || null,
    kerapihan: a.kerapihan || null,
    ekstrakurikuler: a.ekstrakurikuler || []
  };
}

export function mapAbsensiFromSupabase(row: any): AbsensiDanCatatan {
  return {
    id: row.id,
    periodeId: row.periode_id,
    siswaId: row.siswa_id,
    kelasId: row.kelas_id,
    sakit: row.sakit || 0,
    izin: row.izin || 0,
    alfa: row.alfa || 0,
    catatanWaliKelas: row.catatan_wali_kelas || '',
    kelakuan: row.kelakuan || undefined,
    kerajinan: row.kerajinan || undefined,
    kerapihan: row.kerapihan || undefined,
    ekstrakurikuler: Array.isArray(row.ekstrakurikuler) ? row.ekstrakurikuler : []
  };
}

// Track the timestamp of the last local write to ignore self-triggered realtime echo events
let lastLocalWriteTime = 0;

export function recordLocalDatabaseWrite(): void {
  lastLocalWriteTime = Date.now();
}

// ========================================================================
// FETCH ALL DATA FROM SUPABASE
// ========================================================================

/**
 * Mengambil seluruh database dari Supabase dengan proteksi batas waktu (timeout).
 * Menjamin pengurutan terstruktur pada sisi client:
 * - Kelas diurutkan secara hierarkis (VII A ... IX C)
 * - Siswa diurutkan berdasarkan No. Absen & Nama
 * - Mapel diurutkan berdasarkan urutan & kategori
 */
export async function fetchEntireDatabaseFromSupabase(timeoutMs = 12000): Promise<SchemaDatabase | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const fetchPromise = async (): Promise<SchemaDatabase | null> => {
    const [
      configRes,
      kelasRes,
      mapelRes,
      siswaRes,
      guruRes,
      periodRes,
      tpRes,
      nilaiRes,
      absensiRes
    ] = await Promise.all([
      client.from('config').select('*').limit(1).maybeSingle(),
      client.from('kelas').select('*'),
      client.from('mapel').select('*').order('urutan', { ascending: true }),
      client.from('siswa').select('*').order('no_absen', { ascending: true }),
      client.from('guru').select('*'),
      client.from('period_list').select('*'),
      client.from('tujuan_pembelajaran').select('*'),
      client.from('nilai_siswa').select('*'),
      client.from('absensi_dan_catatan').select('*')
    ]);

    // Check if table missing error (e.g. 42P01 - schema not run yet)
    if (configRes.error?.code === '42P01' || kelasRes.error?.code === '42P01') {
      console.warn('Supabase tables have not been created yet. Please execute supabase_schema.sql');
      return null;
    }

    const configData = configRes.data || {};

    // Sort students consistently client-side by no_absen then nama
    const mappedSiswa = (siswaRes.data || []).map(mapSiswaFromSupabase).sort((a, b) => {
      const noA = a.noAbsen !== undefined && a.noAbsen !== null ? a.noAbsen : 999999;
      const noB = b.noAbsen !== undefined && b.noAbsen !== null ? b.noAbsen : 999999;
      if (noA !== noB) return noA - noB;
      return a.nama.localeCompare(b.nama);
    });

    return {
      adminUsername: configData.admin_username || 'admin',
      adminPasswordKey: configData.admin_password_key || 'alirsyadsolo',
      activePeriodId: configData.active_period_id || 'p1',
      kelas: sortKelasList((kelasRes.data || []).map(mapKelasFromSupabase)),
      mapel: (mapelRes.data || []).map(mapMapelFromSupabase),
      siswa: mappedSiswa,
      guru: (guruRes.data || []).map(mapGuruFromSupabase),
      periodList: (periodRes.data || []).map(mapPeriodFromSupabase),
      tujuanPembelajaran: (tpRes.data || []).map(mapTPFromSupabase),
      nilaiSiswa: (nilaiRes.data || []).map(mapNilaiFromSupabase),
      absensiDanCatatan: (absensiRes.data || []).map(mapAbsensiFromSupabase)
    };
  };

  const timeoutPromise = new Promise<null>((_, reject) => {
    setTimeout(() => reject(new Error('Batas waktu koneksi Supabase terlampaui (timeout)')), timeoutMs);
  });

  try {
    return await Promise.race([fetchPromise(), timeoutPromise]);
  } catch (err) {
    console.error('Error fetching entire database from Supabase:', err);
    return null;
  }
}

// ========================================================================
// SYNC LOCAL DATABASE CHANGES TO SUPABASE
// ========================================================================

export async function syncDatabaseChangeToSupabase(
  oldDb: SchemaDatabase,
  newDb: SchemaDatabase,
  userRole?: string | null,
  userId?: string | null
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  // Mark that a local save is underway to prevent self-echoing in realtime
  recordLocalDatabaseWrite();

  try {
    // 1. Sync config if admin modified it
    if (userRole === 'admin') {
      if (
        oldDb.adminUsername !== newDb.adminUsername ||
        oldDb.adminPasswordKey !== newDb.adminPasswordKey ||
        oldDb.activePeriodId !== newDb.activePeriodId
      ) {
        await client.from('config').upsert({
          id: 'main',
          admin_username: newDb.adminUsername,
          admin_password_key: newDb.adminPasswordKey,
          active_period_id: newDb.activePeriodId,
          is_seed_initialized: true,
          updated_at: new Date().toISOString()
        });
      }
    }

    // Generic collection helper with diffing
    const syncTable = async <T extends { id: string }>(
      tableName: string,
      oldArr: T[],
      newArr: T[],
      toSupabase: (item: T) => any
    ) => {
      // Find modified or added
      const toUpsert: any[] = [];
      for (const item of newArr) {
        const old = oldArr.find(x => x.id === item.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
          toUpsert.push(toSupabase(item));
        }
      }

      if (toUpsert.length > 0) {
        // Chunk by 200 for postgres efficiency
        for (let i = 0; i < toUpsert.length; i += 200) {
          const chunk = toUpsert.slice(i, i + 200);
          const { error } = await client.from(tableName).upsert(chunk);
          if (error) {
            console.error(`Supabase upsert error on ${tableName}:`, error);
          }
        }
      }

      // Find deleted
      const toDeleteIds: string[] = [];
      for (const item of oldArr) {
        if (!newArr.some(x => x.id === item.id)) {
          if (userRole === 'guru' && tableName === 'nilai_siswa' && (item as any).guruId && (item as any).guruId !== userId) {
            continue;
          }
          toDeleteIds.push(item.id);
        }
      }

      if (toDeleteIds.length > 0) {
        for (let i = 0; i < toDeleteIds.length; i += 200) {
          const chunk = toDeleteIds.slice(i, i + 200);
          const { error } = await client.from(tableName).delete().in('id', chunk);
          if (error) {
            console.error(`Supabase delete error on ${tableName}:`, error);
          }
        }
      }
    };

    const promises: Promise<any>[] = [];

    if (userRole === 'admin') {
      promises.push(syncTable('kelas', oldDb.kelas || [], newDb.kelas || [], mapKelasToSupabase));
      promises.push(syncTable('mapel', oldDb.mapel || [], newDb.mapel || [], mapMapelToSupabase));
      promises.push(syncTable('siswa', oldDb.siswa || [], newDb.siswa || [], mapSiswaToSupabase));
      promises.push(syncTable('guru', oldDb.guru || [], newDb.guru || [], mapGuruToSupabase));
      promises.push(syncTable('period_list', oldDb.periodList || [], newDb.periodList || [], mapPeriodToSupabase));
      promises.push(syncTable('tujuan_pembelajaran', oldDb.tujuanPembelajaran || [], newDb.tujuanPembelajaran || [], mapTPToSupabase));
      promises.push(syncTable('nilai_siswa', oldDb.nilaiSiswa || [], newDb.nilaiSiswa || [], mapNilaiToSupabase));
      promises.push(syncTable('absensi_dan_catatan', oldDb.absensiDanCatatan || [], newDb.absensiDanCatatan || [], mapAbsensiToSupabase));
    } else if (userRole === 'guru' && userId) {
      promises.push(syncTable('tujuan_pembelajaran', oldDb.tujuanPembelajaran || [], newDb.tujuanPembelajaran || [], mapTPToSupabase));
      promises.push(syncTable('nilai_siswa', oldDb.nilaiSiswa || [], newDb.nilaiSiswa || [], mapNilaiToSupabase));
      promises.push(syncTable('absensi_dan_catatan', oldDb.absensiDanCatatan || [], newDb.absensiDanCatatan || [], mapAbsensiToSupabase));
    }

    await Promise.all(promises);
  } catch (err) {
    console.error('Supabase sync failure:', err);
  }
}

// ========================================================================
// MIGRATE DATA FROM CURRENT DATABASE TO SUPABASE
// ========================================================================

export async function migrateDataToSupabase(currentDb: SchemaDatabase): Promise<{ success: boolean; message: string; counts?: any }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase client belum terkonfigurasi. Masukkan URL dan Anon Key terlebih dahulu.'
    };
  }

  try {
    // 1. Config
    const { error: cfgErr } = await client.from('config').upsert({
      id: 'main',
      admin_username: currentDb.adminUsername || 'admin',
      admin_password_key: currentDb.adminPasswordKey || 'alirsyadsolo',
      active_period_id: currentDb.activePeriodId || 'p1',
      is_seed_initialized: true,
      updated_at: new Date().toISOString()
    });
    if (cfgErr) throw new Error(`Gagal migrasi config: ${cfgErr.message}`);

    // Helper batch upsert
    const batchUpsert = async (tableName: string, items: any[]) => {
      if (!items || items.length === 0) return 0;
      for (let i = 0; i < items.length; i += 200) {
        const chunk = items.slice(i, i + 200);
        const { error } = await client.from(tableName).upsert(chunk);
        if (error) {
          throw new Error(`Gagal migrasi tabel ${tableName}: ${error.message}`);
        }
      }
      return items.length;
    };

    const counts = {
      kelas: await batchUpsert('kelas', (currentDb.kelas || []).map(mapKelasToSupabase)),
      mapel: await batchUpsert('mapel', (currentDb.mapel || []).map(mapMapelToSupabase)),
      siswa: await batchUpsert('siswa', (currentDb.siswa || []).map(mapSiswaToSupabase)),
      guru: await batchUpsert('guru', (currentDb.guru || []).map(mapGuruToSupabase)),
      periodList: await batchUpsert('period_list', (currentDb.periodList || []).map(mapPeriodToSupabase)),
      tujuanPembelajaran: await batchUpsert('tujuan_pembelajaran', (currentDb.tujuanPembelajaran || []).map(mapTPToSupabase)),
      nilaiSiswa: await batchUpsert('nilai_siswa', (currentDb.nilaiSiswa || []).map(mapNilaiToSupabase)),
      absensiDanCatatan: await batchUpsert('absensi_dan_catatan', (currentDb.absensiDanCatatan || []).map(mapAbsensiToSupabase)),
    };

    return {
      success: true,
      message: 'Seluruh data berhasil dimigrasikan ke Supabase!',
      counts
    };
  } catch (err: any) {
    console.error('Migration to Supabase failed:', err);
    return {
      success: false,
      message: err.message || 'Terjadi kesalahan saat memigrasikan data ke Supabase.'
    };
  }
}

// ========================================================================
// REALTIME SUBSCRIPTION & REVALIDATION FOR SUPABASE (CLIENT-SIDE FETCHING)
// ========================================================================

export type SyncStatusType = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

let realtimeDebounceTimer: any = null;

export function subscribeToSupabaseDatabase(
  onData: (db: SchemaDatabase) => void,
  onSyncStatus?: (status: SyncStatusType, message?: string) => void
): () => void {
  const client = getSupabaseClient();
  if (!client) {
    onSyncStatus?.('offline', 'Kredensial Supabase belum diisi');
    return () => {};
  }

  let isSubscribed = true;
  onSyncStatus?.('syncing', 'Mengambil data dari Supabase Cloud...');

  // Fetch immediately on subscription
  fetchEntireDatabaseFromSupabase().then((data) => {
    if (!isSubscribed) return;
    if (data) {
      onData(data);
      onSyncStatus?.('synced', 'Terkoneksi ke Supabase');
    } else {
      onSyncStatus?.('offline', 'Menggunakan data lokal');
    }
  }).catch((err) => {
    if (!isSubscribed) return;
    console.error('Error fetching Supabase data on subscription start:', err);
    onSyncStatus?.('error', err?.message || 'Gagal terhubung ke Supabase');
  });

  // Realtime subscription via Supabase Channel with Debounce & Self-Update echo suppression
  const channel = client
    .channel('e-raport-db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public' },
      () => {
        // Abaikan sinyal perubahan jika berasal dari operasi penyimpanan lokal kita sendiri dalam 2 detik terakhir
        if (Date.now() - lastLocalWriteTime < 2000) {
          return;
        }

        // Debounce incoming events (800ms) agar update batch nilai/data tidak membombardir database
        if (realtimeDebounceTimer) {
          clearTimeout(realtimeDebounceTimer);
        }

        realtimeDebounceTimer = setTimeout(async () => {
          if (!isSubscribed) return;
          try {
            onSyncStatus?.('syncing', 'Memperbarui data dari cloud...');
            const fresh = await fetchEntireDatabaseFromSupabase();
            if (fresh && isSubscribed) {
              onData(fresh);
              onSyncStatus?.('synced', 'Pembaruan realtime diterapkan');
            }
          } catch (e: any) {
            console.warn('Realtime fetch failed:', e);
            onSyncStatus?.('error', e?.message || 'Gagal memuat realtime data');
          }
        }, 800);
      }
    )
    .subscribe();

  return () => {
    isSubscribed = false;
    if (realtimeDebounceTimer) {
      clearTimeout(realtimeDebounceTimer);
    }
    try {
      client.removeChannel(channel);
    } catch (e) {
      console.warn('Error removing Supabase channel:', e);
    }
  };
}

/**
 * Pemicu manual untuk menarik data paling baru dari Supabase Cloud ke frontend
 */
export async function refreshDatabaseFromSupabase(
  onData: (db: SchemaDatabase) => void,
  onSyncStatus?: (status: SyncStatusType, message?: string) => void
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) {
    onSyncStatus?.('offline', 'Kredensial Supabase belum diatur');
    return false;
  }

  try {
    onSyncStatus?.('syncing', 'Menyinkronkan data dari cloud...');
    const fresh = await fetchEntireDatabaseFromSupabase();
    if (fresh) {
      onData(fresh);
      onSyncStatus?.('synced', 'Data cloud berhasil diperbarui');
      return true;
    } else {
      onSyncStatus?.('error', 'Gagal mengambil data dari Supabase');
      return false;
    }
  } catch (err: any) {
    onSyncStatus?.('error', err?.message || 'Kendala koneksi ke server');
    return false;
  }
}

// ========================================================================
// RESET SUPABASE TO ZERO
// ========================================================================

export async function resetSupabaseToZero(): Promise<void> {
  const client = getSupabaseClient();
  
  if (client) {
    const tables = [
      'nilai_siswa',
      'absensi_dan_catatan',
      'tujuan_pembelajaran',
      'period_list',
      'siswa',
      'guru',
      'mapel',
      'kelas'
    ];

    for (const table of tables) {
      try {
        await client.from(table).delete().neq('id', '___non_existent___');
      } catch (e) {
        console.error(`Error deleting from ${table}:`, e);
      }
    }

    try {
      await client.from('config').upsert({
        id: 'main',
        admin_username: 'admin',
        admin_password_key: 'alirsyadsolo',
        active_period_id: '',
        is_seed_initialized: true,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.error('Error resetting config:', e);
    }
  }

  // Also clear localStorage database
  const resetDb: SchemaDatabase = {
    adminUsername: 'admin',
    adminPasswordKey: 'alirsyadsolo',
    activePeriodId: '',
    kelas: [],
    mapel: [],
    siswa: [],
    guru: [],
    periodList: [],
    tujuanPembelajaran: [],
    nilaiSiswa: [],
    absensiDanCatatan: []
  };
  localStorage.setItem('e_raport_db_v1', JSON.stringify(resetDb));
}
