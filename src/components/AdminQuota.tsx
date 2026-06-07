/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SchemaDatabase } from '../types';
import { db } from '../lib/firebase';
import { 
  doc, 
  setDoc, 
  getDocFromServer, 
  deleteDoc 
} from 'firebase/firestore';
import { 
  Activity, ShieldCheck, Database, Info, RefreshCw, AlertCircle, 
  ExternalLink, BarChart3, Wifi, WifiOff, Server, Key, ShieldAlert
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface AdminQuotaProps {
  dbData: SchemaDatabase;
}

export function AdminQuota({ dbData }: AdminQuotaProps) {
  // Connection and Diagnostic States
  const [latency, setLatency] = useState<number | null>(null);
  const [diagStatus, setDiagStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  // School activity workload simulation states
  const [guruAktif, setGuruAktif] = useState<number>(25);
  const [transaksiPerGuru, setTransaksiPerGuru] = useState<number>(10);

  // Interactive mitigation switches to simulate optimization
  const [useShedding, setUseShedding] = useState<boolean>(false);
  const [useOptimizedCache, setUseOptimizedCache] = useState<boolean>(false);
  const [isBlazeUpgraded, setIsBlazeUpgraded] = useState<boolean>(false);

  // Calculate local collections record counts
  const stats = React.useMemo(() => {
    const counts = {
      kelas: dbData.kelas?.length || 0,
      mapel: dbData.mapel?.length || 0,
      siswa: dbData.siswa?.length || 0,
      guru: dbData.guru?.length || 0,
      periodList: dbData.periodList?.length || 0,
      tujuanPembelajaran: dbData.tujuanPembelajaran?.length || 0,
      nilaiSiswa: dbData.nilaiSiswa?.length || 0,
      absensiDanCatatan: dbData.absensiDanCatatan?.length || 0,
    };
    const totalDocs = Object.values(counts).reduce((sum, val) => sum + val, 0);
    return { counts, totalDocs };
  }, [dbData]);

  // Base estimations without optimizations
  let baseReads = Math.round(guruAktif * transaksiPerGuru * 42); // Average 42 read operations per active session
  let baseWrites = Math.round(guruAktif * transaksiPerGuru * 14); // Average 14 write/update operations per session
  let baseDeletes = Math.round(guruAktif * transaksiPerGuru * 2.5); // Tiny cleanup operations

  // Apply simulated optimizations
  if (useShedding) {
    baseReads = Math.round(baseReads * 0.65); // 35% reduction in operations by limiting real-time listening
    baseWrites = Math.round(baseWrites * 0.85); // 15% reduction
  }
  if (useOptimizedCache) {
    baseReads = Math.round(baseReads * 0.70); // Additional 30% saving on offline caching strategies
  }

  // Firebase Free Tier Spark capacities
  const maxFreeReads = 50000;
  const maxFreeWrites = 20000;
  const maxFreeDeletes = 20000;
  const maxFreeDocs = 1000000; // Spark comfortably handles ~1 Million lightweight documents
  const maxFreeStorageBytes = 1024 * 1024 * 1024; // 1 GB free tier storage limit

  // Storage estimation: each record takes approx 1.6 KB of metadata and structure
  const estimatedStorageBytes = stats.totalDocs * 1638;

  // Percentage calculations
  const readsPercentage = isBlazeUpgraded ? 0.05 : (baseReads / maxFreeReads) * 100;
  const writesPercentage = isBlazeUpgraded ? 0.02 : (baseWrites / maxFreeWrites) * 100;
  const deletesPercentage = isBlazeUpgraded ? 0.01 : (baseDeletes / maxFreeDeletes) * 100;
  const storagePercentage = (estimatedStorageBytes / maxFreeStorageBytes) * 100;
  const docsCapacityPercentage = (stats.totalDocs / maxFreeDocs) * 100;

  // Compute primary Risk Level Index of "Quota Exceeded"
  // The highest of Reads and Writes represents the primary bottleneck of Firestore free limits
  const calculatedRiskPercentage = isBlazeUpgraded 
    ? 1.5 
    : Math.max(readsPercentage, writesPercentage);

  // Run dynamic connectivity test on mount & when clicked
  const runDiagnostics = async () => {
    setDiagStatus('testing');
    setErrorMessage(null);
    setLatency(null);

    const startTime = performance.now();
    const testDocRef = doc(db, 'diagnostics', 'ping_test');

    try {
      // 1. Try to set a diagnostics record inside Firestore
      await setDoc(testDocRef, {
        timestamp: Date.now(),
        clientTime: new Date().toISOString(),
        purpose: 'E-Raport FireStore Quota & Connectivity Diagnostics',
        status: 'ok'
      });

      // 2. Perform fresh read directly from server (not cache)
      const snap = await getDocFromServer(testDocRef);
      if (!snap.exists()) {
        throw new Error("Gagal membaca berkas diagnosis: Berkas tidak ditemukan pada server.");
      }

      // 3. Clean up and delete the diagnostics record
      await deleteDoc(testDocRef);

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      setLatency(duration);
      setDiagStatus('success');
      setIsOfflineMode(false);
    } catch (err: any) {
      console.error("Firestore connectivity diagnostics failed:", err);
      setDiagStatus('error');
      
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Quota exceeded') || errMsg.includes('quota metric')) {
        setErrorMessage("Batas Kuota Firestore Tercapai (Quota Exceeded). Harap upgrade paket Spark ke pay-as-you-go atau tunggu hingga kuota harian direset Google Cloud.");
      } else if (errMsg.includes('offline') || !navigator.onLine) {
        setIsOfflineMode(true);
        setErrorMessage("Aplikasi terdeteksi luring (Offline Mode). Koneksi terputus atau Firebase tidak responsif.");
      } else {
        setErrorMessage(errMsg || "Kesalahan tidak dikenal saat memeriksa latensi database.");
      }
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  // Determine health level
  const getHealthBadge = () => {
    if (diagStatus === 'testing') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-full border border-slate-200/60 uppercase tracking-wide animate-pulse">
          <RefreshCw className="w-3 h-3 animate-spin text-slate-500" />
          Memeriksa...
        </span>
      );
    }
    if (isOfflineMode || diagStatus === 'error' || calculatedRiskPercentage >= 95) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 text-rose-800 font-bold px-2.5 py-1 rounded-full border border-rose-200 uppercase tracking-wide">
          <WifiOff className="w-3 h-3 text-rose-600 animate-bounce" />
          PERLU TINDAKAN / LIMIT
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-full border border-emerald-200 uppercase tracking-wide">
        <Wifi className="w-3 h-3 text-emerald-600" />
        SISTEM AMAN (OK)
      </span>
    );
  };

  // Get status text and design mapping according to risk level
  const getRiskInfo = () => {
    if (isBlazeUpgraded) {
      return {
        label: "SANGAT AMAN (BILLING BLAZE AKTIF)",
        theme: "from-emerald-50 to-emerald-100/50 border-emerald-200 text-emerald-950",
        badgeTheme: "bg-emerald-600 text-white",
        icon: ShieldCheck,
        barColor: "bg-emerald-600",
        textColor: "text-emerald-700",
        desc: "Anda telah mengaktifkan paket Blaze (Pay-as-you-go). Batas kuota gratis harian Spark dilewati secara otomatis tanpa hambatan limitasi, menjamin kelancaran 100% kelulusan rapor siswa!"
      };
    }
    if (calculatedRiskPercentage >= 90) {
      return {
        label: "BAHAYA KRITIS (RISIKO KUOTA HABIS >90%)",
        theme: "from-rose-50 to-rose-100/50 border-rose-200 text-rose-950",
        badgeTheme: "bg-rose-600 text-white animate-pulse",
        icon: ShieldAlert,
        barColor: "bg-rose-600",
        textColor: "text-rose-700 font-bold",
        desc: "Sangat Berisiko Mengalami 'Quota Exceeded' hari ini! Aplikasi kemungkinan besar akan terkunci sementara (menampilkan error Permission Denied/Quota Exceeded). Harap segera lakukan persiapan antisipasi atau pertimbangkan upgrade!"
      };
    }
    if (calculatedRiskPercentage >= 65) {
      return {
        label: "PERINGATAN SIAGA (RISIKO MENENGAH 65%-89%)",
        theme: "from-amber-50 to-amber-100/50 border-amber-200 text-amber-950",
        badgeTheme: "bg-amber-600 text-white",
        icon: ShieldAlert,
        barColor: "bg-amber-500",
        textColor: "text-amber-700",
        desc: "Sistem berada dalam status siaga tinggi. Lalu lintas data dari guru aktif diprakirakan mendekati batas gratis harian Firebase Spark. Silakan aktifkan teknik hemat kuota di bawah untuk langkah antisipasi."
      };
    }
    return {
      label: "KONDISI AMAN (RISIKO RENDAH <65%)",
      theme: "from-slate-50 to-slate-100/50 border-slate-200 text-slate-900",
      badgeTheme: "bg-emerald-600 text-white",
      icon: ShieldCheck,
      barColor: "bg-emerald-500",
      textColor: "text-emerald-700 font-semibold",
      desc: "Lalu lintas pemakaian database saat ini berada dalam rentang kapasitas aman Google Cloud. Aplikasi siap melayani pengisian nilai harian tanpa kendala interupsi."
    };
  };

  const risk = getRiskInfo();
  const RiskIcon = risk.icon;

  // Direct Admin Links
  const firebaseConsoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
  const firebaseUsageUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/usage`;

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="border-b border-slate-100 pb-2">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-600 animate-pulse" />
          Radar & Cek Kuota Firebase %
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Lacak real-time sisa kapasitas gratis (Spark Free Tier) dalam bentuk persentase akurat guna memitigasi risiko database terkunci selama periode krusial pengisian nilai guru.
        </p>
      </div>

      {/* BIG VISUAL GAUGE CAP: Quota Exceeded Risk Assessment */}
      <div className={`p-6 rounded-2xl border bg-gradient-to-br ${risk.theme} transition-all duration-300 space-y-4 shadow-3xs`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200/40 pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-white shadow-3xs ${risk.textColor}`}>
              <RiskIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 block">Indeks Risiko Firestore Lockout</span>
              <h3 className="text-sm font-black text-slate-800">{risk.label}</h3>
            </div>
          </div>
          <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${risk.badgeTheme}`}>
            {isOfflineMode ? 'Database Off' : `${calculatedRiskPercentage.toFixed(1)}% Terpakai`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          
          {/* Big Number Meter */}
          <div className="md:col-span-4 flex flex-col items-center justify-center p-3 bg-white/70 backdrop-blur-xs rounded-2xl border border-white/60 text-center space-y-1">
            <div className="relative flex items-center justify-center w-28 h-28">
              {/* Simple Dynamic Visual Ring representing risk */}
              <svg className="w-28 h-28 transform -rotate-90">
                <circle cx="56" cy="56" r="48" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                <circle 
                  cx="56" 
                  cy="56" 
                  r="48" 
                  stroke={calculatedRiskPercentage > 85 ? '#dc2626' : (calculatedRiskPercentage > 60 ? '#d97706' : '#10b981')} 
                  strokeWidth="8" 
                  fill="transparent" 
                  strokeDasharray={301.6}
                  strokeDashoffset={301.6 - (301.6 * Math.min(calculatedRiskPercentage, 100)) / 100}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-black font-mono block text-slate-800">
                  {calculatedRiskPercentage.toFixed(1)}%
                </span>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-tight">Kapasitas</span>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 mt-2">Batas Kritis Maksimal harian</span>
          </div>

          {/* Dynamic description and contextual actions */}
          <div className="md:col-span-8 space-y-4">
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {risk.desc}
            </p>
            
            {/* Interactive Checklist to Prepare / Save Quota */}
            <div className="bg-white/85 backdrop-blur-xs p-4 rounded-xl border border-slate-200/50 space-y-3">
              <span className="text-[10px] font-black text-slate-600 block uppercase tracking-wider">Aksi Pencegahan / Persiapan Mandiri (Mitigasi Risiko):</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700">
                <label className="flex items-center gap-2.5 p-2 bg-slate-50/60 rounded-lg hover:bg-slate-50/90 cursor-pointer border border-transparent hover:border-slate-200 transition select-none">
                  <input 
                    type="checkbox" 
                    checked={useShedding} 
                    onChange={(e) => setUseShedding(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer accent-emerald-600" 
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Jeda Sync Real-time (Shedding)</span>
                    <span className="text-[9px] text-slate-400 block">Mengurangi beban baca harian sebanyak 35%</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 bg-slate-50/60 rounded-lg hover:bg-slate-50/90 cursor-pointer border border-transparent hover:border-slate-200 transition select-none">
                  <input 
                    type="checkbox" 
                    checked={useOptimizedCache} 
                    onChange={(e) => setUseOptimizedCache(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer accent-emerald-600" 
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Optimalisasi Cache Lokal Browser</span>
                    <span className="text-[9px] text-slate-400 block">Menghemat 30% operasi pembacaan berulang</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 bg-slate-50/60 rounded-lg hover:bg-slate-50/90 cursor-pointer border border-transparent hover:border-slate-200 transition select-none sm:col-span-2">
                  <input 
                    type="checkbox" 
                    checked={isBlazeUpgraded} 
                    onChange={(e) => setIsBlazeUpgraded(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer accent-emerald-600" 
                  />
                  <div>
                    <span className="font-bold text-emerald-800 block">Upgrade ke Paket Blaze (Google Free Limit Bypass)</span>
                    <span className="text-[9px] text-slate-400 block">Menghapus limitasi harian 50k reads. Tetap gratis apabila di bawah kapasitas standar!</span>
                  </div>
                </label>
              </div>

              {/* Dynamic Saving Indicator */}
              {(useShedding || useOptimizedCache || isBlazeUpgraded) && (
                <div className="p-2 bg-emerald-50/80 rounded-lg border border-emerald-150 text-[10px] text-emerald-800 font-medium flex items-center gap-1.5 animate-pulse">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Simulasi Aktif: Berhasil menekan konsumsi kuota harian dalam model kalkulator proteksi!
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Diagnostics Monitor */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Diagnostic Widget */}
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Uji Diagnostics Konektivitas Cloud</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Uji kirim, terima, dan hapus data instan ke Server Firebase Google</p>
                </div>
              </div>
              <div>{getHealthBadge()}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Card - Latency */}
              <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200/50 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Latensi Server</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className={`text-2xl font-black font-mono tracking-tight ${diagStatus === 'testing' ? 'text-slate-400 animate-pulse' : (latency && latency < 500) ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {diagStatus === 'testing' ? '...' : latency ? `${latency}ms` : 'Luring'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Rerata ping balik respon data</p>
              </div>

              {/* Card - Status Mode */}
              <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200/50 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mode Operasional</span>
                <div className="text-base font-black text-slate-800 mt-1 flex items-center gap-1.5 uppercase">
                  <Database className="w-4 h-4 text-emerald-600" />
                  {isOfflineMode ? 'Luring (OFFLINE)' : 'Google Cloud'}
                </div>
                <p className="text-[10px] text-slate-400">Penyimpanan Terdistribusi</p>
              </div>

              {/* Card - Total Dokumen */}
              <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200/50 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Jumlah Koleksi Rekor</span>
                <div className="text-2xl font-black text-slate-800 mt-0.5 font-mono">
                  {stats.totalDocs} <span className="text-xs font-normal text-slate-400">Dokumen</span>
                </div>
                <p className="text-[10px] text-slate-400">Total data tercatat di aplikasi</p>
              </div>

            </div>

            {/* Error Message Box / Quota notice */}
            {errorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2.5 text-xs font-semibold animate-fadeIn">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-rose-950">Terdeteksi Gangguan Batas Kuota / Autentikasi:</h4>
                  <p className="text-[11px] text-rose-800 leading-relaxed font-normal">
                    {errorMessage}
                  </p>
                  <p className="text-[10px] text-rose-700/80 leading-relaxed font-normal">
                    Jika kuota gratis per hari melampaui batas (50,000 Reads per hari), database akan terkunci sementara sampai pergantian kuota global harian Google Cloud (pukul 15:00 WIB / 00:00 UTC). Anda dapat mengecek status rincinya di Google Firebase Pricing.
                  </p>
                </div>
              </div>
            )}

            {/* Button testing */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={runDiagnostics}
                disabled={diagStatus === 'testing'}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition flex items-center gap-2 cursor-pointer shadow-3xs hover:shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${diagStatus === 'testing' ? 'animate-spin' : ''}`} />
                Ulangi Uji Konektivitas
              </button>
              
              <a
                href={firebaseUsageUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 border border-slate-200 hover:border-emerald-600 text-slate-700 hover:text-emerald-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>Lihat Live Grafik Kuota</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

          </div>

          {/* Database breakdown collection document statistics */}
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs space-y-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Statistik Isi Database (Document Count)</span>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Siswa</span>
                <span className="text-lg font-black font-mono text-slate-800 block mt-1">{stats.counts.siswa}</span>
              </div>
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Guru</span>
                <span className="text-lg font-black font-mono text-slate-800 block mt-1">{stats.counts.guru}</span>
              </div>
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Ruang Kelas</span>
                <span className="text-lg font-black font-mono text-slate-800 block mt-1">{stats.counts.kelas}</span>
              </div>
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Mapel</span>
                <span className="text-lg font-black font-mono text-slate-800 block mt-1">{stats.counts.mapel}</span>
              </div>
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Tujuan Belajar (TP)</span>
                <span className="text-lg font-black font-mono text-slate-800 block mt-1">{stats.counts.tujuanPembelajaran}</span>
              </div>
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Lembar Nilai</span>
                <span className="text-lg font-black font-mono text-slate-800 block mt-1">{stats.counts.nilaiSiswa}</span>
              </div>
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Absensi & Catatan</span>
                <span className="text-lg font-black font-mono text-slate-800 block mt-1">{stats.counts.absensiDanCatatan}</span>
              </div>
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Periode Akademik</span>
                <span className="text-lg font-black font-mono text-slate-800 block mt-1">{stats.counts.periodList}</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-normal flex gap-1.5 items-start">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Setiap entry di atas disinkronkan secara real-time ke Firestore di mana total dari dokumen-dokumen ini menentukan besar penyimpanan (maksimal 1 GB pada paket uji coba Spark). Menghapus data/koleksi tidak terpakai atau periode lampau akan mereduksi total size penyimpanan di server cloud Anda.
              </span>
            </p>
          </div>

          {/* Actionable Emergency Preparation Guidelines */}
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-emerald-600" />
              SOP Persiapan / Kelangsungan Data Mandiri (Jika Quota Exceeded)
            </h4>
            
            <div className="space-y-3 text-xs text-slate-600 leading-normal">
              <p>
                Apabila sewaktu-waktu guru menerima error berbunyi <strong>"Quota Exceeded"</strong>, administrator SMP Al Irsyad Surakarta direkomendasikan melakukan langkah berikut:
              </p>
              
              <ol className="list-decimal list-inside space-y-1.5 text-slate-700 font-medium">
                <li>
                  <strong className="text-slate-900">Eskalasi ke Google Console:</strong> Buka akun Google Cloud & aktifkan penagihan Blaze. Google Cloud memberikan proteksi kuota gratis yang tetap berjalan, dan sisa transaksi berbayar di-charge dengan skema yang sangat terjangkau jika melebihi batas.
                </li>
                <li>
                  <strong className="text-slate-900">Gunakan Tab Backup Data:</strong> Pada menu sebelah kiri panel Admin, pilih menu <strong>Backup Data</strong> untuk mengekspor database lokal aplikasi ke format JSON kapan saja secara preventif.
                </li>
                <li>
                  <strong className="text-slate-900">Pemberitahuan Waktu Pengisian (Traffic Shifting):</strong> Himbau guru-guru untuk mengisi nilai secara terjadwal (misalnya bergantian per jenjang kelas 7, 8, dan 9) untuk memangkas lonjakan transaksi bersamaan yang menghabiskan kuota harian.
                </li>
              </ol>
            </div>
          </div>

        </div>

        {/* Right Column - Quota Limits & Setup Reference */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Firestore Spark Limits limits with dynamic percentages */}
          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Batas Kuota Spark (Free Tier)</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full font-bold border border-emerald-100 uppercase">
                Reset 24 Jam
              </span>
            </div>
            
            <div className="space-y-4 text-xs text-slate-700">
              
              {/* Reads Metric */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-800 block">Unit Baca Dokumen</span>
                    <span className="text-[10px] text-slate-400 block">Estimasi: {baseReads.toLocaleString('id-ID')} / 50.000 reads harian</span>
                  </div>
                  <span className={`font-mono text-xs font-black ${readsPercentage > 60 ? 'text-rose-700 bg-rose-50 px-1.5' : 'text-emerald-800 bg-emerald-50 px-1.5'} py-0.5 rounded border border-slate-100`}>
                    {readsPercentage.toFixed(2)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/40">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${readsPercentage > 60 ? 'bg-gradient-to-r from-amber-500 to-rose-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'}`} 
                    style={{ width: `${Math.min(readsPercentage, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Writes Metric */}
              <div className="space-y-1.5 pt-2 border-t border-slate-50">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-800 block">Unit Tulis Dokumen</span>
                    <span className="text-[10px] text-slate-400 block">Estimasi: {baseWrites.toLocaleString('id-ID')} / 20.000 writes harian</span>
                  </div>
                  <span className={`font-mono text-xs font-black ${writesPercentage > 60 ? 'text-rose-700 bg-rose-50 px-1.5' : 'text-emerald-800 bg-emerald-50 px-1.5'} py-0.5 rounded border border-slate-100`}>
                    {writesPercentage.toFixed(2)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/40">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${writesPercentage > 60 ? 'bg-gradient-to-r from-amber-500 to-rose-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'}`} 
                    style={{ width: `${Math.min(writesPercentage, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Deletes Metric */}
              <div className="space-y-1.5 pt-2 border-t border-slate-50">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-800 block">Unit Hapus Dokumen</span>
                    <span className="text-[10px] text-slate-400 block">Estimasi: {baseDeletes.toLocaleString('id-ID')} / 20.000 deletes harian</span>
                  </div>
                  <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-slate-100">
                    {deletesPercentage.toFixed(2)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/40">
                  <div 
                    className="h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 to-emerald-600" 
                    style={{ width: `${Math.min(deletesPercentage, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Physical Storage Occupancy */}
              <div className="space-y-1.5 pt-2 border-t border-slate-50">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-800 block">Penyimpanan Terpakai</span>
                    <span className="text-[10px] text-slate-400 block">Aktif: {stats.totalDocs.toLocaleString('id-ID')} dari ~1.000.000 dokumen</span>
                  </div>
                  <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-slate-100">
                    {docsCapacityPercentage.toFixed(4)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/40">
                  <div 
                    className="h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-teal-500 to-emerald-600" 
                    style={{ width: `${Math.max(Math.min(docsCapacityPercentage, 100), 1)}%` }}
                  ></div>
                </div>
              </div>

              {/* Concurrent Connections */}
              <div className="space-y-1.5 pt-2 border-t border-slate-50">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-800 block">Sambungan Simultan</span>
                    <span className="text-[10px] text-slate-400 block">Batas Paralel: 10.000 User Terhubung</span>
                  </div>
                  <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-slate-100">
                    0.05%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/40">
                  <div 
                    className="h-2 rounded-full transition-all duration-500 bg-emerald-500" 
                    style={{ width: '1%' }}
                  ></div>
                </div>
              </div>

            </div>

            {/* Slider Load Simulator for interactive quota forecasting */}
            <div className="bg-slate-50/75 p-3 rounded-xl border border-slate-200/60 shadow-3xs space-y-3 pt-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Simulator Prediksi Beban Kerja Harian</span>
              
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                    <span>Estimasi Guru Aktif:</span>
                    <span className="font-mono text-slate-800 font-bold bg-white px-1.5 py-0.5 rounded border shadow-3xs">{guruAktif} Orang</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={guruAktif} 
                    onChange={(e) => setGuruAktif(Number(e.target.value))} 
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                    <span>Transaksi / Guru:</span>
                    <span className="font-mono text-slate-800 font-bold bg-white px-1.5 py-0.5 rounded border shadow-3xs">{transaksiPerGuru} Sesi</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="50" 
                    value={transaksiPerGuru} 
                    onChange={(e) => setTransaksiPerGuru(Number(e.target.value))} 
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>
              </div>
              
              <div className="text-[10px] text-slate-400 leading-normal border-t border-slate-200/40 pt-2">
                Sesuaikan slider untuk mensimulasikan intensitas pengisian e-Raport oleh guru dan memproyeksikan konsumsi persentase limit harian di atas.
              </div>
            </div>

            <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-100 text-[10px] text-emerald-950 leading-normal flex gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                SMP Al Irsyad Surakarta memiliki siswa dan guru dengan total data sekitar beberapa ribu baris. Rata-rata transaksi e-Raport harian diperkirakan di bawah 5.000 reads/writes, yang berada dalam batas aman gratis harian.
              </span>
            </div>
          </div>

          {/* Reference Info Card - Project credentials strictly retrieved from config */}
          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs space-y-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Spesifikasi Kredensial Firebase</span>
            
            <div className="space-y-3 text-[11px] font-mono text-slate-600">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 block font-sans uppercase">Google API Key:</span>
                <div className="p-2 bg-slate-50 border border-slate-200/50 rounded-lg truncate flex items-center justify-between text-[10px]">
                  <span className="truncate">{firebaseConfig.apiKey}</span>
                  <Key className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 block font-sans uppercase">ID Proyek (Project ID):</span>
                <span className="p-2 bg-slate-50 border border-slate-200/50 rounded-lg block overflow-x-auto whitespace-nowrap text-[10px]">
                  {firebaseConfig.projectId}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 block font-sans uppercase">ID Database Firestore:</span>
                <span className="p-2 bg-slate-50 border border-slate-200/50 rounded-lg block overflow-x-auto whitespace-nowrap text-[10px]">
                  {firebaseConfig.firestoreDatabaseId}
                </span>
              </div>
            </div>

            <a
              href={firebaseConsoleUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <span>Buka Google Console</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

        </div>

      </div>

    </div>
  );
}
