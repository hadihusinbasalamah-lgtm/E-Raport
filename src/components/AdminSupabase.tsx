/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { SchemaDatabase } from '../types';
import { saveDatabase } from '../data';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  testSupabaseConnection, 
  migrateDataToSupabase,
  fetchEntireDatabaseFromSupabase,
  syncDatabaseChangeToSupabase
} from '../lib/supabase';
import { 
  Database, Server, CheckCircle2, AlertTriangle, RefreshCw, Copy, 
  ExternalLink, ShieldCheck, Zap, DownloadCloud, Sparkles, Check, Key, 
  CloudDownload, Download, FileSpreadsheet, FileCode, FileText, UploadCloud,
  CheckCircle, ArrowRight
} from 'lucide-react';

interface AdminSupabaseProps {
  db: SchemaDatabase;
  onUpdateDb?: (newDb: SchemaDatabase) => void;
}

// Utility to trigger file downloads
function downloadBlob(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Escape SQL values safely for PostgreSQL
function escapeSql(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

// Generate full SQL statements for Supabase SQL Editor
function generateSqlDump(database: SchemaDatabase): string {
  const lines: string[] = [];
  const timestamp = new Date().toISOString();

  lines.push(`-- ==========================================================`);
  lines.push(`-- BACKUP DATABASE FULL E-RAPORT SMP AL IRSYAD SURAKARTA`);
  lines.push(`-- Waktu Ekspor: ${timestamp}`);
  lines.push(`-- Target: Supabase / PostgreSQL Database`);
  lines.push(`-- ==========================================================\n`);

  lines.push(`BEGIN;\n`);

  // 1. Config
  lines.push(`-- 1. CONFIG`);
  lines.push(`INSERT INTO public.config (id, admin_username, admin_password_key, active_period_id, is_seed_initialized)`);
  lines.push(`VALUES ('main', ${escapeSql(database.adminUsername || 'admin')}, ${escapeSql(database.adminPasswordKey || 'alirsyadsolo')}, ${escapeSql(database.activePeriodId || 'p1')}, true)`);
  lines.push(`ON CONFLICT (id) DO UPDATE SET`);
  lines.push(`  admin_username = EXCLUDED.admin_username,`);
  lines.push(`  admin_password_key = EXCLUDED.admin_password_key,`);
  lines.push(`  active_period_id = EXCLUDED.active_period_id;\n`);

  // 2. Kelas
  if (database.kelas && database.kelas.length > 0) {
    lines.push(`-- 2. KELAS (${database.kelas.length} baris data)`);
    for (const k of database.kelas) {
      lines.push(`INSERT INTO public.kelas (id, nama, wali_kelas_id) VALUES (${escapeSql(k.id)}, ${escapeSql(k.nama)}, ${escapeSql(k.waliKelasId)}) ON CONFLICT (id) DO UPDATE SET nama = EXCLUDED.nama, wali_kelas_id = EXCLUDED.wali_kelas_id;`);
    }
    lines.push('');
  }

  // 3. Mapel
  if (database.mapel && database.mapel.length > 0) {
    lines.push(`-- 3. MAPEL (${database.mapel.length} baris data)`);
    for (const m of database.mapel) {
      lines.push(`INSERT INTO public.mapel (id, nama, urutan, kategori) VALUES (${escapeSql(m.id)}, ${escapeSql(m.nama)}, ${escapeSql(m.urutan || 0)}, ${escapeSql(m.kategori || 'umum')}) ON CONFLICT (id) DO UPDATE SET nama = EXCLUDED.nama, urutan = EXCLUDED.urutan, kategori = EXCLUDED.kategori;`);
    }
    lines.push('');
  }

  // 4. Siswa
  if (database.siswa && database.siswa.length > 0) {
    lines.push(`-- 4. SISWA (${database.siswa.length} baris data)`);
    for (const s of database.siswa) {
      lines.push(`INSERT INTO public.siswa (id, nisn, nis, nama, jenis_kelamin, kelas_id, no_absen) VALUES (${escapeSql(s.id)}, ${escapeSql(s.nisn)}, ${escapeSql(s.nis)}, ${escapeSql(s.nama)}, ${escapeSql(s.jenisKelamin || 'L')}, ${escapeSql(s.kelasId)}, ${escapeSql(s.noAbsen)}) ON CONFLICT (id) DO UPDATE SET nisn = EXCLUDED.nisn, nis = EXCLUDED.nis, nama = EXCLUDED.nama, jenis_kelamin = EXCLUDED.jenis_kelamin, kelas_id = EXCLUDED.kelas_id, no_absen = EXCLUDED.no_absen;`);
    }
    lines.push('');
  }

  // 5. Guru
  if (database.guru && database.guru.length > 0) {
    lines.push(`-- 5. GURU (${database.guru.length} baris data)`);
    for (const g of database.guru) {
      lines.push(`INSERT INTO public.guru (id, nama, username, password_key, is_wali_kelas, wali_kelas_kelas_id, mapel1_id, mapel1_kelas_id, mapel1_kelas_ids, mapel2_id, mapel2_kelas_id, mapel2_kelas_ids, mapel3_id, mapel3_kelas_id, mapel3_kelas_ids) VALUES (${escapeSql(g.id)}, ${escapeSql(g.nama)}, ${escapeSql(g.username)}, ${escapeSql(g.passwordKey)}, ${escapeSql(g.isWaliKelas || false)}, ${escapeSql(g.waliKelasKelasId || '')}, ${escapeSql(g.mapel1Id || '')}, ${escapeSql(g.mapel1KelasId || '')}, ${escapeSql(g.mapel1KelasIds || [])}, ${escapeSql(g.mapel2Id || '')}, ${escapeSql(g.mapel2KelasId || '')}, ${escapeSql(g.mapel2KelasIds || [])}, ${escapeSql(g.mapel3Id || '')}, ${escapeSql(g.mapel3KelasId || '')}, ${escapeSql(g.mapel3KelasIds || [])}) ON CONFLICT (id) DO UPDATE SET nama = EXCLUDED.nama, username = EXCLUDED.username, password_key = EXCLUDED.password_key, is_wali_kelas = EXCLUDED.is_wali_kelas, wali_kelas_kelas_id = EXCLUDED.wali_kelas_kelas_id, mapel1_id = EXCLUDED.mapel1_id, mapel1_kelas_id = EXCLUDED.mapel1_kelas_id, mapel1_kelas_ids = EXCLUDED.mapel1_kelas_ids, mapel2_id = EXCLUDED.mapel2_id, mapel2_kelas_id = EXCLUDED.mapel2_kelas_id, mapel2_kelas_ids = EXCLUDED.mapel2_kelas_ids, mapel3_id = EXCLUDED.mapel3_id, mapel3_kelas_id = EXCLUDED.mapel3_kelas_id, mapel3_kelas_ids = EXCLUDED.mapel3_kelas_ids;`);
    }
    lines.push('');
  }

  // 6. Period List
  if (database.periodList && database.periodList.length > 0) {
    lines.push(`-- 6. PERIOD LIST (${database.periodList.length} baris data)`);
    for (const p of database.periodList) {
      lines.push(`INSERT INTO public.period_list (id, tahun_ajaran, semester, tipe_ujian, is_published, published_at, tanggal_raport, snapshot_kelas, snapshot_siswa, snapshot_guru, snapshot_mapel) VALUES (${escapeSql(p.id)}, ${escapeSql(p.tahunAjaran)}, ${escapeSql(p.semester)}, ${escapeSql(p.tipeUjian)}, ${escapeSql(p.isPublished || false)}, ${escapeSql(p.publishedAt || '')}, ${escapeSql(p.tanggalRaport || '')}, ${escapeSql(p.snapshotKelas || [])}, ${escapeSql(p.snapshotSiswa || [])}, ${escapeSql(p.snapshotGuru || [])}, ${escapeSql(p.snapshotMapel || [])}) ON CONFLICT (id) DO UPDATE SET tahun_ajaran = EXCLUDED.tahun_ajaran, semester = EXCLUDED.semester, tipe_ujian = EXCLUDED.tipe_ujian, is_published = EXCLUDED.is_published, published_at = EXCLUDED.published_at, tanggal_raport = EXCLUDED.tanggal_raport, snapshot_kelas = EXCLUDED.snapshot_kelas, snapshot_siswa = EXCLUDED.snapshot_siswa, snapshot_guru = EXCLUDED.snapshot_guru, snapshot_mapel = EXCLUDED.snapshot_mapel;`);
    }
    lines.push('');
  }

  // 7. Tujuan Pembelajaran
  if (database.tujuanPembelajaran && database.tujuanPembelajaran.length > 0) {
    lines.push(`-- 7. TUJUAN PEMBELAJARAN (${database.tujuanPembelajaran.length} baris data)`);
    for (const tp of database.tujuanPembelajaran) {
      lines.push(`INSERT INTO public.tujuan_pembelajaran (id, periode_id, guru_id, mapel_id, kelas_id, tp1, tp2, tp3, tp4) VALUES (${escapeSql(tp.id)}, ${escapeSql(tp.periodeId)}, ${escapeSql(tp.guruId)}, ${escapeSql(tp.mapelId)}, ${escapeSql(tp.kelasId)}, ${escapeSql(tp.tp1)}, ${escapeSql(tp.tp2)}, ${escapeSql(tp.tp3 || null)}, ${escapeSql(tp.tp4 || null)}) ON CONFLICT (id) DO UPDATE SET tp1 = EXCLUDED.tp1, tp2 = EXCLUDED.tp2, tp3 = EXCLUDED.tp3, tp4 = EXCLUDED.tp4;`);
    }
    lines.push('');
  }

  // 8. Nilai Siswa
  if (database.nilaiSiswa && database.nilaiSiswa.length > 0) {
    lines.push(`-- 8. NILAI SISWA (${database.nilaiSiswa.length} baris data)`);
    for (const n of database.nilaiSiswa) {
      lines.push(`INSERT INTO public.nilai_siswa (id, periode_id, siswa_id, mapel_id, guru_id, tp1_nilai_asli, tp1_nilai, tp2_nilai_asli, tp2_nilai, tp3_nilai_asli, tp3_nilai, tp4_nilai_asli, tp4_nilai, nilai_ujian_asli, nilai_ujian, nilai_akhir, capaian_kompetensi) VALUES (${escapeSql(n.id)}, ${escapeSql(n.periodeId)}, ${escapeSql(n.siswaId)}, ${escapeSql(n.mapelId)}, ${escapeSql(n.guruId)}, ${escapeSql(n.tp1NilaiAsli)}, ${escapeSql(n.tp1Nilai)}, ${escapeSql(n.tp2NilaiAsli)}, ${escapeSql(n.tp2Nilai)}, ${escapeSql(n.tp3NilaiAsli)}, ${escapeSql(n.tp3Nilai)}, ${escapeSql(n.tp4NilaiAsli)}, ${escapeSql(n.tp4Nilai)}, ${escapeSql(n.nilaiUjianAsli)}, ${escapeSql(n.nilaiUjian)}, ${escapeSql(n.nilaiAkhir || 0)}, ${escapeSql(n.capaianKompetensi)}) ON CONFLICT (id) DO UPDATE SET tp1_nilai_asli = EXCLUDED.tp1_nilai_asli, tp1_nilai = EXCLUDED.tp1_nilai, tp2_nilai_asli = EXCLUDED.tp2_nilai_asli, tp2_nilai = EXCLUDED.tp2_nilai, tp3_nilai_asli = EXCLUDED.tp3_nilai_asli, tp3_nilai = EXCLUDED.tp3_nilai, tp4_nilai_asli = EXCLUDED.tp4_nilai_asli, tp4_nilai = EXCLUDED.tp4_nilai, nilai_ujian_asli = EXCLUDED.nilai_ujian_asli, nilai_ujian = EXCLUDED.nilai_ujian, nilai_akhir = EXCLUDED.nilai_akhir, capaian_kompetensi = EXCLUDED.capaian_kompetensi;`);
    }
    lines.push('');
  }

  // 9. Absensi dan Catatan
  if (database.absensiDanCatatan && database.absensiDanCatatan.length > 0) {
    lines.push(`-- 9. ABSENSI DAN CATATAN (${database.absensiDanCatatan.length} baris data)`);
    for (const a of database.absensiDanCatatan) {
      lines.push(`INSERT INTO public.absensi_dan_catatan (id, periode_id, siswa_id, kelas_id, sakit, izin, alfa, catatan_wali_kelas, kelakuan, kerajinan, kerapihan, ekstrakurikuler) VALUES (${escapeSql(a.id)}, ${escapeSql(a.periodeId)}, ${escapeSql(a.siswaId)}, ${escapeSql(a.kelasId)}, ${escapeSql(a.sakit || 0)}, ${escapeSql(a.izin || 0)}, ${escapeSql(a.alfa || 0)}, ${escapeSql(a.catatanWaliKelas || '')}, ${escapeSql(a.kelakuan || '')}, ${escapeSql(a.kerajinan || '')}, ${escapeSql(a.kerapihan || '')}, ${escapeSql(a.ekstrakurikuler || [])}) ON CONFLICT (id) DO UPDATE SET sakit = EXCLUDED.sakit, izin = EXCLUDED.izin, alfa = EXCLUDED.alfa, catatan_wali_kelas = EXCLUDED.catatan_wali_kelas, kelakuan = EXCLUDED.kelakuan, kerajinan = EXCLUDED.kerajinan, kerapihan = EXCLUDED.kerapihan, ekstrakurikuler = EXCLUDED.ekstrakurikuler;`);
    }
    lines.push('');
  }

  lines.push(`COMMIT;\n`);
  return lines.join('\n');
}

export function AdminSupabase({ db, onUpdateDb }: AdminSupabaseProps) {
  const [subTab, setSubTab] = useState<'config' | 'export'>('config');

  const [config, setConfig] = useState(getSupabaseConfig());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; message: string; counts?: any } | null>(null);

  const [isPulling, setIsPulling] = useState(false);
  const [pullResult, setPullResult] = useState<{ success: boolean; message: string; counts?: any } | null>(null);

  const [copiedSql, setCopiedSql] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Export States
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Restore / Import States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreStatus, setRestoreStatus] = useState<{ success: boolean; message: string } | null>(null);

  const sqlSchemaSnippet = `-- Jalankan skrip ini di SQL Editor Supabase Anda:
CREATE TABLE IF NOT EXISTS public.config (
    id TEXT PRIMARY KEY DEFAULT 'main',
    admin_username TEXT NOT NULL DEFAULT 'admin',
    admin_password_key TEXT NOT NULL DEFAULT 'alirsyadsolo',
    active_period_id TEXT DEFAULT 'p1',
    is_seed_initialized BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.kelas (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    wali_kelas_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.mapel (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    urutan INTEGER DEFAULT 0,
    kategori TEXT DEFAULT 'umum',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.siswa (
    id TEXT PRIMARY KEY,
    nisn TEXT,
    nis TEXT,
    nama TEXT NOT NULL,
    jenis_kelamin TEXT DEFAULT 'L',
    kelas_id TEXT,
    no_absen INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.guru (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_key TEXT NOT NULL,
    is_wali_kelas BOOLEAN DEFAULT false,
    wali_kelas_kelas_id TEXT DEFAULT '',
    mapel1_id TEXT DEFAULT '',
    mapel1_kelas_id TEXT DEFAULT '',
    mapel1_kelas_ids JSONB DEFAULT '[]'::jsonb,
    mapel2_id TEXT DEFAULT '',
    mapel2_kelas_id TEXT DEFAULT '',
    mapel2_kelas_ids JSONB DEFAULT '[]'::jsonb,
    mapel3_id TEXT DEFAULT '',
    mapel3_kelas_id TEXT DEFAULT '',
    mapel3_kelas_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.period_list (
    id TEXT PRIMARY KEY,
    tahun_ajaran TEXT NOT NULL,
    semester TEXT NOT NULL,
    tipe_ujian TEXT NOT NULL,
    is_published BOOLEAN DEFAULT false,
    published_at TEXT,
    tanggal_raport TEXT,
    snapshot_kelas JSONB DEFAULT '[]'::jsonb,
    snapshot_siswa JSONB DEFAULT '[]'::jsonb,
    snapshot_guru JSONB DEFAULT '[]'::jsonb,
    snapshot_mapel JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tujuan_pembelajaran (
    id TEXT PRIMARY KEY,
    periode_id TEXT NOT NULL,
    guru_id TEXT NOT NULL,
    mapel_id TEXT NOT NULL,
    kelas_id TEXT NOT NULL,
    tp1 TEXT NOT NULL,
    tp2 TEXT NOT NULL,
    tp3 TEXT,
    tp4 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.nilai_siswa (
    id TEXT PRIMARY KEY,
    periode_id TEXT NOT NULL,
    siswa_id TEXT NOT NULL,
    mapel_id TEXT NOT NULL,
    guru_id TEXT NOT NULL,
    tp1_nilai_asli NUMERIC,
    tp1_nilai NUMERIC,
    tp2_nilai_asli NUMERIC,
    tp2_nilai NUMERIC,
    tp3_nilai_asli NUMERIC,
    tp3_nilai NUMERIC,
    tp4_nilai_asli NUMERIC,
    tp4_nilai NUMERIC,
    nilai_ujian_asli NUMERIC,
    nilai_ujian NUMERIC,
    nilai_akhir NUMERIC NOT NULL DEFAULT 0,
    capaian_kompetensi TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.absensi_dan_catatan (
    id TEXT PRIMARY KEY,
    periode_id TEXT NOT NULL,
    siswa_id TEXT NOT NULL,
    kelas_id TEXT NOT NULL,
    sakit INTEGER DEFAULT 0,
    izin INTEGER DEFAULT 0,
    alfa INTEGER DEFAULT 0,
    catatan_wali_kelas TEXT,
    kelakuan TEXT,
    kerajinan TEXT,
    kerapihan TEXT,
    ekstrakurikuler JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Buka izin akses untuk public/anon e-Raport:
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tujuan_pembelajaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nilai_siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absensi_dan_catatan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access on config" ON public.config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access on kelas" ON public.kelas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access on mapel" ON public.mapel FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access on siswa" ON public.siswa FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access on guru" ON public.guru FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access on period_list" ON public.period_list FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access on tujuan_pembelajaran" ON public.tujuan_pembelajaran FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access on nilai_siswa" ON public.nilai_siswa FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access on absensi_dan_catatan" ON public.absensi_dan_catatan FOR ALL USING (true) WITH CHECK (true);
`;

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(config.url, config.anonKey);
    setSaveMessage('Konfigurasi Supabase berhasil disimpan!');
    setTestResult(null);
    setTimeout(() => setSaveMessage(''), 4000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      saveSupabaseConfig(config.url, config.anonKey);
      const res = await testSupabaseConnection();
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Gagal melakukan tes koneksi.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleMigrate = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menyalin dan mengunggah seluruh data saat ini ke tabel Supabase?')) {
      return;
    }
    setIsMigrating(true);
    setMigrationResult(null);
    try {
      const res = await migrateDataToSupabase(db);
      setMigrationResult(res);
    } catch (e: any) {
      setMigrationResult({
        success: false,
        message: e.message || 'Terjadi kesalahan migrasi data.'
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handlePullFromCloud = async () => {
    setIsPulling(true);
    setPullResult(null);
    try {
      const freshDb = await fetchEntireDatabaseFromSupabase();
      if (!freshDb) {
        throw new Error('Gagal mengambil data dari Supabase. Pastikan tabel telah dibuat dan kredensial valid.');
      }
      if (onUpdateDb) {
        onUpdateDb(freshDb);
      }
      setPullResult({
        success: true,
        message: 'Data terbaru dari Supabase Cloud berhasil ditarik dan diperbarui ke frontend!',
        counts: {
          kelas: freshDb.kelas?.length || 0,
          mapel: freshDb.mapel?.length || 0,
          siswa: freshDb.siswa?.length || 0,
          guru: freshDb.guru?.length || 0,
          periodList: freshDb.periodList?.length || 0,
          tujuanPembelajaran: freshDb.tujuanPembelajaran?.length || 0,
          nilaiSiswa: freshDb.nilaiSiswa?.length || 0,
          absensiDanCatatan: freshDb.absensiDanCatatan?.length || 0
        }
      });
    } catch (e: any) {
      setPullResult({
        success: false,
        message: e.message || 'Gagal menarik data dari cloud.'
      });
    } finally {
      setIsPulling(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchemaSnippet);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const isConfigured = Boolean(config.url && config.anonKey);

  // ==========================================
  // EXPORT HANDLERS
  // ==========================================

  const getExportDatabase = async (): Promise<SchemaDatabase> => {
    // If Supabase is configured, offer freshest or current db
    return db;
  };

  // 1. Export JSON Full
  const handleExportJson = async () => {
    setIsExporting(true);
    try {
      const targetDb = await getExportDatabase();
      const timestamp = new Date().toISOString();
      const dateStr = new Date().toISOString().split('T')[0];
      
      const payload = {
        metadata: {
          appName: 'E-Raport SMP Al Irsyad Surakarta',
          version: '1.0.0',
          exportedAt: timestamp,
          provider: 'supabase_postgresql',
          recordCounts: {
            kelas: targetDb.kelas?.length || 0,
            mapel: targetDb.mapel?.length || 0,
            siswa: targetDb.siswa?.length || 0,
            guru: targetDb.guru?.length || 0,
            periodList: targetDb.periodList?.length || 0,
            tujuanPembelajaran: targetDb.tujuanPembelajaran?.length || 0,
            nilaiSiswa: targetDb.nilaiSiswa?.length || 0,
            absensiDanCatatan: targetDb.absensiDanCatatan?.length || 0,
          }
        },
        database: targetDb
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      downloadBlob(jsonStr, `Full_Backup_Database_SMP_Al_Irsyad_${dateStr}.json`, 'application/json');
      setExportNotice('File Backup JSON Database berhasil diunduh!');
      setTimeout(() => setExportNotice(null), 5000);
    } catch (e: any) {
      alert('Gagal mengunduh file JSON: ' + (e.message || 'Error'));
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Export SQL Dump
  const handleExportSql = async () => {
    setIsExporting(true);
    try {
      const targetDb = await getExportDatabase();
      const dateStr = new Date().toISOString().split('T')[0];
      const sqlContent = generateSqlDump(targetDb);
      downloadBlob(sqlContent, `Full_Dump_SQL_SMP_Al_Irsyad_${dateStr}.sql`, 'text/plain;charset=utf-8');
      setExportNotice('File SQL Dump PostgreSQL Supabase berhasil diunduh!');
      setTimeout(() => setExportNotice(null), 5000);
    } catch (e: any) {
      alert('Gagal mengunduh file SQL: ' + (e.message || 'Error'));
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Export Excel Multi-Sheet
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const targetDb = await getExportDatabase();
      const dateStr = new Date().toISOString().split('T')[0];
      const wb = XLSX.utils.book_new();

      // Sheet 1: Ringkasan
      const summaryData = [
        ['REKAPITULASI BACKUP DATABASE FULL E-RAPORT'],
        ['SMP AL IRSYAD SURAKARTA'],
        ['Tanggal Ekspor', new Date().toLocaleString('id-ID')],
        ['Format', 'Multi-Sheet Spreadsheet Excel'],
        ['Backend Database', 'Supabase PostgreSQL Cloud'],
        [],
        ['Tabel Database', 'Jumlah Rekaman'],
        ['Kelas', targetDb.kelas?.length || 0],
        ['Mata Pelajaran (Mapel)', targetDb.mapel?.length || 0],
        ['Peserta Didik (Siswa)', targetDb.siswa?.length || 0],
        ['Tenaga Pengajar (Guru)', targetDb.guru?.length || 0],
        ['Tahun Ajaran & Semester', targetDb.periodList?.length || 0],
        ['Tujuan Pembelajaran (TP)', targetDb.tujuanPembelajaran?.length || 0],
        ['Nilai Raport Siswa', targetDb.nilaiSiswa?.length || 0],
        ['Absensi & Catatan Wali', targetDb.absensiDanCatatan?.length || 0],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

      // Sheet 2: Kelas
      if (targetDb.kelas?.length) {
        const wsKelas = XLSX.utils.json_to_sheet(targetDb.kelas);
        XLSX.utils.book_append_sheet(wb, wsKelas, 'Kelas');
      }

      // Sheet 3: Mapel
      if (targetDb.mapel?.length) {
        const wsMapel = XLSX.utils.json_to_sheet(targetDb.mapel);
        XLSX.utils.book_append_sheet(wb, wsMapel, 'Mapel');
      }

      // Sheet 4: Siswa
      if (targetDb.siswa?.length) {
        const wsSiswa = XLSX.utils.json_to_sheet(targetDb.siswa);
        XLSX.utils.book_append_sheet(wb, wsSiswa, 'Siswa');
      }

      // Sheet 5: Guru
      if (targetDb.guru?.length) {
        const wsGuru = XLSX.utils.json_to_sheet(targetDb.guru.map(g => ({
          id: g.id,
          nama: g.nama,
          username: g.username,
          isWaliKelas: g.isWaliKelas ? 'Ya' : 'Tidak',
          waliKelasKelasId: g.waliKelasKelasId || '',
          mapel1Id: g.mapel1Id || '',
          mapel2Id: g.mapel2Id || '',
          mapel3Id: g.mapel3Id || ''
        })));
        XLSX.utils.book_append_sheet(wb, wsGuru, 'Guru');
      }

      // Sheet 6: Periode
      if (targetDb.periodList?.length) {
        const wsPeriode = XLSX.utils.json_to_sheet(targetDb.periodList.map(p => ({
          id: p.id,
          tahunAjaran: p.tahunAjaran,
          semester: p.semester,
          tipeUjian: p.tipeUjian,
          isPublished: p.isPublished ? 'Ya' : 'Tidak',
          tanggalRaport: p.tanggalRaport || '',
          publishedAt: p.publishedAt || ''
        })));
        XLSX.utils.book_append_sheet(wb, wsPeriode, 'Tahun Ajaran');
      }

      // Sheet 7: TP
      if (targetDb.tujuanPembelajaran?.length) {
        const wsTP = XLSX.utils.json_to_sheet(targetDb.tujuanPembelajaran);
        XLSX.utils.book_append_sheet(wb, wsTP, 'TP Guru');
      }

      // Sheet 8: Nilai Siswa
      if (targetDb.nilaiSiswa?.length) {
        const wsNilai = XLSX.utils.json_to_sheet(targetDb.nilaiSiswa);
        XLSX.utils.book_append_sheet(wb, wsNilai, 'Nilai Siswa');
      }

      // Sheet 9: Absensi
      if (targetDb.absensiDanCatatan?.length) {
        const wsAbsensi = XLSX.utils.json_to_sheet(targetDb.absensiDanCatatan.map(a => ({
          id: a.id,
          periodeId: a.periodeId,
          siswaId: a.siswaId,
          kelasId: a.kelasId,
          sakit: a.sakit,
          izin: a.izin,
          alfa: a.alfa,
          catatanWaliKelas: a.catatanWaliKelas,
          kelakuan: a.kelakuan || '',
          kerajinan: a.kerajinan || '',
          kerapihan: a.kerapihan || '',
          ekstrakurikuler: JSON.stringify(a.ekstrakurikuler || [])
        })));
        XLSX.utils.book_append_sheet(wb, wsAbsensi, 'Absensi & Catatan');
      }

      XLSX.writeFile(wb, `Rekap_Database_Full_SMP_Al_Irsyad_${dateStr}.xlsx`);
      setExportNotice('File Rekap Multi-Sheet Excel (.xlsx) berhasil diunduh!');
      setTimeout(() => setExportNotice(null), 5000);
    } catch (e: any) {
      alert('Gagal mengunduh file Excel: ' + (e.message || 'Error'));
    } finally {
      setIsExporting(false);
    }
  };

  // Restore Handler from JSON File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Detect if payload has nested database or raw database
        const restoredDb: SchemaDatabase = parsed.database ? parsed.database : parsed;

        if (!restoredDb.kelas || !restoredDb.siswa || !restoredDb.guru) {
          throw new Error('Format file tidak valid. Struktur database e-Raport tidak ditemukan.');
        }

        const confirmMsg = `Konfirmasi Pemulihan Database:
File berisi:
- ${restoredDb.kelas?.length || 0} Kelas
- ${restoredDb.siswa?.length || 0} Siswa
- ${restoredDb.guru?.length || 0} Guru
- ${restoredDb.nilaiSiswa?.length || 0} Nilai Siswa

Apakah Anda yakin ingin memulihkan (restore) seluruh data ini ke dalam sistem? Data lama akan digantikan dengan data dari file backup ini.`;

        if (!window.confirm(confirmMsg)) {
          return;
        }

        // Save locally
        saveDatabase(restoredDb);
        if (onUpdateDb) {
          onUpdateDb(restoredDb);
        }

        // If Supabase configured, ask to sync to cloud
        if (isConfigured) {
          const syncCloud = window.confirm('Data lokal telah dipulihkan. Apakah Anda ingin langsung menyinkronkan data ini ke Supabase Cloud?');
          if (syncCloud) {
            await migrateDataToSupabase(restoredDb);
          }
        }

        setRestoreStatus({
          success: true,
          message: 'Database berhasil dipulihkan secara penuh!'
        });
      } catch (err: any) {
        setRestoreStatus({
          success: false,
          message: 'Gagal memulihkan database: ' + (err.message || 'File tidak valid')
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-6 h-6 text-emerald-600" />
              Database Supabase (PostgreSQL)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Kelola koneksi cloud, sinkronisasi data relasional, dan ekspor penuh seluruh database e-Raport SMP Al Irsyad Surakarta.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Status Backend:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xs ${
              isConfigured 
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}>
              <Database className="w-3.5 h-3.5" />
              {isConfigured ? 'Supabase (Aktif)' : 'Menunggu Kredensial'}
            </span>
          </div>
        </div>
      </div>

      {/* 2-MENU SUB-NAVIGATION SWITCHER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 w-full sm:w-auto">
            {/* SUBTAB 1: KONFIGURASI & SINKRONISASI */}
            <button
              onClick={() => setSubTab('config')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subTab === 'config'
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Server className={`w-4 h-4 ${subTab === 'config' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>1. Konfigurasi & Sinkronisasi</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600">
                Cloud SQL
              </span>
            </button>

            {/* SUBTAB 2: EKSPORT DATABASE FULL */}
            <button
              onClick={() => setSubTab('export')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subTab === 'export'
                  ? 'bg-white text-emerald-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Download className={`w-4 h-4 ${subTab === 'export' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>2. Eksport Database Full</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                subTab === 'export' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/70 text-slate-600'
              }`}>
                JSON • SQL • Excel
              </span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 text-xs text-slate-500 font-medium px-2">
            <span className="text-slate-400">Total Rekaman:</span>
            <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md font-mono">
              {(db.siswa?.length || 0) + (db.guru?.length || 0) + (db.nilaiSiswa?.length || 0)} Data
            </span>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {exportNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs animate-fade-in">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button 
            onClick={() => setExportNotice(null)} 
            className="text-[11px] text-emerald-700 hover:underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: KONFIGURASI & SINKRONISASI SUPABASE                                */}
      {/* ========================================================================= */}
      {subTab === 'config' && (
        <div className="space-y-6">
          {/* Main Status & Info Banner */}
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-emerald-800/40">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold tracking-widest text-emerald-300 uppercase block font-mono">
                  DATABASE UTAMA • SUPABASE POSTGRESQL
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Penyimpanan Database Mandiri & Aman
                </h3>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Firebase telah sepenuhnya dihapus dari sistem ini. Seluruh transaksi data guru, siswa, kelas, tujuan pembelajaran, nilai rapor, dan leger kini dikelola secara eksklusif melalui database relasional PostgreSQL di akun Supabase Anda.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting || !isConfigured}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 text-emerald-950 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  {isTesting ? 'Menguji...' : 'Uji Koneksi Supabase'}
                </button>
                <button
                  onClick={() => setSubTab('export')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Eksport Database Full</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Grid: 2 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Col: Credentials Form & Test */}
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-600" />
                    Kredensial API Supabase
                  </span>
                  <a 
                    href="https://supabase.com/dashboard" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-[11px] font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <span>Dashboard Supabase</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <form onSubmit={handleSaveConfig} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Project URL Supabase:
                    </label>
                    <input
                      type="text"
                      placeholder="https://abcdefghijklm.supabase.co"
                      value={config.url}
                      onChange={(e) => setConfig({ ...config, url: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white transition"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Ditemukan di Supabase Dashboard &gt; Project Settings &gt; API &gt; Project URL
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Anon Public API Key:
                    </label>
                    <textarea
                      rows={3}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={config.anonKey}
                      onChange={(e) => setConfig({ ...config, anonKey: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white transition"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Ditemukan di Supabase Dashboard &gt; Project Settings &gt; API &gt; Project API keys (anon / public)
                    </span>
                  </div>

                  {saveMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{saveMessage}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                    >
                      Simpan Kredensial
                    </button>
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting || !config.url || !config.anonKey}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-emerald-600" />}
                      <span>{isTesting ? 'Menguji...' : 'Uji Koneksi'}</span>
                    </button>
                  </div>
                </form>

                {/* Test Connection Output */}
                {testResult && (
                  <div className={`p-4 rounded-xl border text-xs font-medium space-y-1 ${
                    testResult.success 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span>{testResult.success ? 'Koneksi Berhasil' : 'Peringatan / Gagal Terhubung'}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed pl-6">{testResult.message}</p>
                  </div>
                )}
              </div>

              {/* 1-Click Migration Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <DownloadCloud className="w-4 h-4 text-emerald-600" />
                    Sinkronisasi & Migrasi Data Supabase
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Cloud Sync
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Unggah seluruh data lokal saat ini ke cloud Supabase, atau tarik data terbaru dari cloud ke sistem.
                </p>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Kelas</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">{db.kelas?.length || 0}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Mapel</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">{db.mapel?.length || 0}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Siswa</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">{db.siswa?.length || 0}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Guru</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">{db.guru?.length || 0}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Tahun Ajaran</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">{db.periodList?.length || 0}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">TP Guru</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">{db.tujuanPembelajaran?.length || 0}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Nilai Siswa</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">{db.nilaiSiswa?.length || 0}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Absensi</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">{db.absensiDanCatatan?.length || 0}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleMigrate}
                    disabled={isMigrating || isPulling || !config.url || !config.anonKey}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                  >
                    {isMigrating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sedang Mengunggah Data ke Supabase...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Migrasikan Data ke Cloud</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handlePullFromCloud}
                    disabled={isPulling || isMigrating || !config.url || !config.anonKey}
                    className="py-3 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                  >
                    {isPulling ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                        <span>Menarik Data...</span>
                      </>
                    ) : (
                      <>
                        <CloudDownload className="w-4 h-4 text-emerald-600" />
                        <span>Tarik Data Terbaru</span>
                      </>
                    )}
                  </button>
                </div>

                {pullResult && (
                  <div className={`p-4 rounded-xl border text-xs font-medium space-y-2 ${
                    pullResult.success 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      {pullResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{pullResult.message}</span>
                    </div>
                    {pullResult.counts && (
                      <div className="text-[11px] text-slate-600 grid grid-cols-2 gap-1 pt-1 font-mono">
                        <span>• Kelas: {pullResult.counts.kelas} data</span>
                        <span>• Mapel: {pullResult.counts.mapel} data</span>
                        <span>• Siswa: {pullResult.counts.siswa} data</span>
                        <span>• Guru: {pullResult.counts.guru} data</span>
                        <span>• TP: {pullResult.counts.tujuanPembelajaran} data</span>
                        <span>• Nilai: {pullResult.counts.nilaiSiswa} data</span>
                        <span>• Absensi: {pullResult.counts.absensiDanCatatan} data</span>
                      </div>
                    )}
                  </div>
                )}

                {migrationResult && (
                  <div className={`p-4 rounded-xl border text-xs font-medium space-y-2 ${
                    migrationResult.success 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      {migrationResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{migrationResult.message}</span>
                    </div>
                    {migrationResult.counts && (
                      <div className="text-[11px] text-slate-600 grid grid-cols-2 gap-1 pt-1 font-mono">
                        <span>• Kelas: {migrationResult.counts.kelas} data</span>
                        <span>• Mapel: {migrationResult.counts.mapel} data</span>
                        <span>• Siswa: {migrationResult.counts.siswa} data</span>
                        <span>• Guru: {migrationResult.counts.guru} data</span>
                        <span>• TP: {migrationResult.counts.tujuanPembelajaran} data</span>
                        <span>• Nilai: {migrationResult.counts.nilaiSiswa} data</span>
                        <span>• Absensi: {migrationResult.counts.absensiDanCatatan} data</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Col: SQL Schema Preview & Steps */}
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col h-full">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Skema SQL Database (PostgreSQL)</span>
                    <span className="text-[10px] text-slate-400">Tersedia juga di file <code>supabase_schema.sql</code></span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? 'Tersalin!' : 'Salin SQL'}</span>
                  </button>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 max-h-[360px] overflow-y-auto text-[11px] font-mono text-emerald-300 leading-relaxed shadow-inner">
                  <pre className="whitespace-pre-wrap">{sqlSchemaSnippet}</pre>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Petunjuk Eksekusi di Supabase:
                  </span>
                  <ol className="text-xs text-slate-600 space-y-1.5 list-decimal pl-4 font-normal leading-relaxed">
                    <li>Buka dashboard proyek Anda di <strong>https://supabase.com</strong>.</li>
                    <li>Pilih menu <strong>SQL Editor</strong> pada bilah sisi kiri.</li>
                    <li>Klik tombol <strong>New Query</strong>, tempel (paste) kode SQL di atas, lalu tekan tombol <strong>RUN</strong>.</li>
                    <li>Salin <strong>Project URL</strong> dan <strong>Anon Key</strong> dari menu Settings &gt; API, tempel ke kolom di sebelah kiri, lalu klik <strong>Uji Koneksi</strong>.</li>
                  </ol>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EKSPORT DATABASE FULL (Pilihan Format: JSON, SQL Dump, Excel)       */}
      {/* ========================================================================= */}
      {subTab === 'export' && (
        <div className="space-y-6">
          
          {/* Export Header Hero */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-emerald-800/40">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold tracking-widest text-emerald-300 uppercase block font-mono">
                  BACKUP ARSIP LENGKAP • EXPORT FULL DATABASE
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Download className="w-5 h-5 text-emerald-400" />
                  Eksport Keseluruhan Database e-Raport
                </h3>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Fitur ini mencakup seluruh tabel sistem: Master Data (Kelas, Mapel, Siswa, Guru), Histori Periode Akademik & Snapshot, Capaian Tujuan Pembelajaran (TP), Nilai Raport Murni & Konversi, serta Absensi & Catatan Wali Kelas.
                </p>
              </div>

              {isConfigured && (
                <button
                  onClick={handlePullFromCloud}
                  disabled={isPulling}
                  className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shrink-0"
                  title="Tarik data terbaru dari Supabase sebelum mengunduh backup"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
                  <span>{isPulling ? 'Menarik...' : 'Refresh dari Supabase'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Database Summary Snapshot Cards */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                Rangkuman Rekaman Data yang Siap Diekspor:
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Waktu: {new Date().toLocaleString('id-ID')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">Data Kelas</span>
                <span className="text-lg font-black text-emerald-950 font-mono mt-0.5 block">{db.kelas?.length || 0}</span>
                <span className="text-[10px] text-emerald-600">VII A - IX C</span>
              </div>
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <span className="text-[10px] uppercase font-bold text-indigo-800 tracking-wider block">Peserta Didik</span>
                <span className="text-lg font-black text-indigo-950 font-mono mt-0.5 block">{db.siswa?.length || 0}</span>
                <span className="text-[10px] text-indigo-600">Siswa Terdaftar</span>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">Guru & Mapel</span>
                <span className="text-lg font-black text-amber-950 font-mono mt-0.5 block">
                  {db.guru?.length || 0} / {db.mapel?.length || 0}
                </span>
                <span className="text-[10px] text-amber-700">Pengajar & Mapel</span>
              </div>
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                <span className="text-[10px] uppercase font-bold text-purple-800 tracking-wider block">Nilai Siswa</span>
                <span className="text-lg font-black text-purple-950 font-mono mt-0.5 block">{db.nilaiSiswa?.length || 0}</span>
                <span className="text-[10px] text-purple-700">Nilai & Capaian</span>
              </div>
            </div>
          </div>

          {/* 3 Main Export Format Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* OPTION 1: JSON BACKUP */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-all hover:shadow-sm">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Format JSON (.json)</h4>
                  <p className="text-[11px] font-bold text-emerald-700 font-mono mt-0.5">Rekomendasi Utama Cadangan</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Menyimpan struktur objek database e-Raport secara lengkap dan persis. File ini dapat langsung dipulihkan (restore) ke aplikasi kapan pun dibutuhkan.
                </p>
              </div>

              <div className="pt-5">
                <button
                  onClick={handleExportJson}
                  disabled={isExporting}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Backup JSON</span>
                </button>
              </div>
            </div>

            {/* OPTION 2: SQL DUMP FOR SUPABASE */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-all hover:shadow-sm">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">SQL Dump PostgreSQL (.sql)</h4>
                  <p className="text-[11px] font-bold text-indigo-700 font-mono mt-0.5">Untuk Supabase SQL Editor</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Berisi kueri <code>INSERT INTO ... ON CONFLICT DO UPDATE</code> seluruh tabel PostgreSQL. Siap dijalankan langsung di SQL Editor Supabase untuk migrasi antar proyek.
                </p>
              </div>

              <div className="pt-5">
                <button
                  onClick={handleExportSql}
                  disabled={isExporting}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh SQL Dump (.sql)</span>
                </button>
              </div>
            </div>

            {/* OPTION 3: EXCEL MULTI-SHEET */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-all hover:shadow-sm">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Rekap Excel Multi-Sheet (.xlsx)</h4>
                  <p className="text-[11px] font-bold text-amber-700 font-mono mt-0.5">Arsip & Analisis Spreadsheet</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Seluruh tabel diekspor ke dalam satu file spreadsheet dengan tab terpisah: Ringkasan, Kelas, Siswa, Guru, Mapel, Periode, TP, Nilai Siswa, dan Absensi.
                </p>
              </div>

              <div className="pt-5">
                <button
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Excel (.xlsx)</span>
                </button>
              </div>
            </div>

          </div>

          {/* Restore / Import Database Section */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-emerald-600" />
                  Pulihkan / Restore Database dari File Cadangan (JSON)
                </span>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pilih file <code>.json</code> hasil ekspor sebelumnya untuk mengembalikan seluruh kondisi data sistem e-Raport secara utuh.
                </p>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json,application/json"
                  className="hidden"
                  id="restore-database-input"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-2 transition cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4 text-emerald-600" />
                  <span>Pilih File Backup JSON</span>
                </button>
              </div>
            </div>

            {restoreStatus && (
              <div className={`p-3.5 rounded-xl border text-xs font-medium space-y-1 ${
                restoreStatus.success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {restoreStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{restoreStatus.message}</span>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
