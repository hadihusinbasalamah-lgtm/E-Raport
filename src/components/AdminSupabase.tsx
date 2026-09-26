/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SchemaDatabase } from '../types';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  getActiveDbProvider, 
  setActiveDbProvider, 
  testSupabaseConnection, 
  migrateDataToSupabase,
  fetchEntireDatabaseFromSupabase,
  refreshDatabaseFromSupabase
} from '../lib/supabase';
import { 
  Database, Server, CheckCircle2, AlertTriangle, RefreshCw, Copy, 
  ExternalLink, ArrowRight, ShieldCheck, Zap, DownloadCloud, Sparkles, Check, Key, CloudDownload
} from 'lucide-react';

interface AdminSupabaseProps {
  db: SchemaDatabase;
  onUpdateDb?: (newDb: SchemaDatabase) => void;
}

export function AdminSupabase({ db, onUpdateDb }: AdminSupabaseProps) {
  const [config, setConfig] = useState(getSupabaseConfig());
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; message: string; counts?: any } | null>(null);

  const [isPulling, setIsPulling] = useState(false);
  const [pullResult, setPullResult] = useState<{ success: boolean; message: string; counts?: any } | null>(null);

  const [copiedSql, setCopiedSql] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

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
              Sistem ini telah dikonfigurasi menggunakan Supabase PostgreSQL sebagai backend database cloud utama untuk SMP Al Irsyad Surakarta.
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

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleTestConnection}
              disabled={isTesting || !isConfigured}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 text-emerald-950 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? 'Menguji...' : 'Uji Koneksi Supabase'}
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
                Migrasi 1-Klik Data ke Supabase
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Data Siap Salin
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Fungsi ini akan mengambil seluruh data yang saat ini ada di sistem e-Raport dan memasukkannya (upsert) secara otomatis ke tabel-tabel Supabase yang telah dibuat.
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
  );
}
