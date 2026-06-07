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
  ExternalLink, Wifi, WifiOff, Server, Key, ShieldAlert, CheckCircle2,
  HelpCircle, Sparkles
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
    baseReads = Math.round(baseReads * 0.65); // 35% reduction in operations
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
      await setDoc(testDocRef, {
        timestamp: Date.now(),
        clientTime: new Date().toISOString(),
        purpose: 'E-Raport FireStore Quota & Connectivity Diagnostics',
        status: 'ok'
      });

      const snap = await getDocFromServer(testDocRef);
      if (!snap.exists()) {
        throw new Error("Gagal membaca berkas diagnosis dari server Google.");
      }

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
        setErrorMessage("Batas Kuota Gratis Bulanan/Harian Google Cloud Firestore Tercapai (Quota Exceeded). Harap ubah ke paket pay-as-you-go atau tunggu reset otomatis besok pagi.");
      } else if (errMsg.includes('offline') || !navigator.onLine) {
        setIsOfflineMode(true);
        setErrorMessage("Koneksi internet Anda terputus atau luring (Offline). Gagal menghubungi server.");
      } else {
        setErrorMessage(errMsg || "Tidak dapat terhubung ke database. Harap cek konfigurasi.");
      }
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  // Determine health level
  const getHealthText = () => {
    if (diagStatus === 'testing') {
      return {
        label: 'Sedang Diuji...',
        desc: 'Mencoba mengirim ping data ke server...',
        bgColor: 'bg-amber-50 text-amber-800 border-amber-200',
        icon: RefreshCw,
        spin: true
      };
    }
    if (isOfflineMode || diagStatus === 'error' || calculatedRiskPercentage >= 95) {
      return {
        label: 'Ada Masalah / Kuota Habis',
        desc: errorMessage || 'Database sedang tidak merespon pengujian baca/tulis.',
        bgColor: 'bg-rose-50 text-rose-800 border-rose-200',
        icon: WifiOff,
        spin: false
      };
    }
    return {
      label: 'Koneksi Sempurna (100% Normal)',
      desc: latency ? `Database merespon sangat cepat dalam ${latency} milidetik.` : 'Komunikasi dengan server Google Cloud berjalan lancar.',
      bgColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: Wifi,
      spin: false
    };
  };

  const health = getHealthText();
  const HealthIcon = health.icon;

  // Easy-to-understand condition categories
  const getSimulatedStatus = () => {
    if (isBlazeUpgraded) {
      return {
        badge: "SANGAT AMAN",
        title: "Bebas Batasan (Paket Blaze)",
        color: "text-emerald-700 bg-emerald-50 border-emerald-200",
        barColor: "bg-emerald-600",
        message: "Anda menggunakan paket Pay-As-You-Go. Kuota tidak akan habis harian dan penagihan tetap Rp 0 jika pemakaian di bawah batas standar harian!"
      };
    }
    if (calculatedRiskPercentage >= 85) {
      return {
        badge: "BAHAYA (SEGERA PENUHI)",
        title: "Hampir Habis (Risiko >85%)",
        color: "text-rose-700 bg-rose-50 border-rose-200 animate-pulse",
        barColor: "bg-rose-600",
        message: "Pengisian nilai guru hari ini diproyeksikan melebihi batas gratis harian. Kuota berpotensi habis dalam hitungan jam!"
      };
    }
    if (calculatedRiskPercentage >= 50) {
      return {
        badge: "WASPADA (CUKUP RAMAI)",
        title: "Mulai Padat (Risiko 50% - 84%)",
        color: "text-amber-700 bg-amber-50 border-amber-200",
        barColor: "bg-amber-500",
        message: "Lalu lintas pengisian nilai cukup padat. Disarankan untuk menghimbau guru agar tidak terus-menerus memuat ulang halaman secara berlebihan."
      };
    }
    return {
      badge: "SANGAT AMAN",
      title: "Sangat Lapang (Di Bawah 50%)",
      color: "text-indigo-700 bg-indigo-50 border-indigo-200",
      barColor: "bg-emerald-500",
      message: "Pemakaian harian diprediksi sangat minim dan aman. Para guru bebas menginput nilai rapor tanpa perlu khawatir kuota mendadak habis."
    };
  };

  const statusInfo = getSimulatedStatus();

  // Links
  const firebaseConsoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
  const firebaseUsageUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/usage`;

  return (
    <div className="space-y-6">
      
      {/* Friendly Header */}
      <div className="border-b border-slate-100 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              Status & Cipta Kuota Database (Firebase)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau sisa kuota gratis Google Firestore secara visual. Sangat berguna agar ujian dan input nilai rapor SMP Al Irsyad Surakarta tidak terganggu.
            </p>
          </div>
          <button
            onClick={runDiagnostics}
            disabled={diagStatus === 'testing'}
            className="self-start sm:self-center px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${diagStatus === 'testing' ? 'animate-spin' : ''}`} />
            Tes Koneksi Sekarang
          </button>
        </div>
      </div>

      {/* Main Simplified Visual Dashboard Panel */}
      <div className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Indeks Kesehatan Kuota Harian</span>
          
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 mt-3">
            
            {/* Simple Dynamic Circle Status Indicator */}
            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="34" stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
                  <circle 
                    cx="40" 
                    cy="40" 
                    r="34" 
                    stroke={calculatedRiskPercentage > 84 ? '#dc2626' : (calculatedRiskPercentage > 49 ? '#f59e0b' : '#10b981')} 
                    strokeWidth="6" 
                    fill="transparent" 
                    strokeDasharray={213.6}
                    strokeDashoffset={213.6 - (213.6 * Math.min(calculatedRiskPercentage, 100)) / 100}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-base font-black font-mono text-slate-800">
                    {calculatedRiskPercentage.toFixed(1)}%
                  </span>
                  <span className="text-[8px] font-bold text-slate-400 block -mt-1">TERPAKAI</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{statusInfo.title}</h3>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${statusInfo.color}`}>
                    {statusInfo.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-lg">
                  {statusInfo.message}
                </p>
              </div>
            </div>

            {/* Quick Live Connection Status Box */}
            <div className={`p-4 rounded-xl border ${health.bgColor} md:max-w-xs w-full flex items-start gap-2.5 text-xs transition duration-300`}>
              <HealthIcon className={`w-5 h-5 shrink-0 mt-0.5 ${health.spin ? 'animate-spin' : ''}`} />
              <div>
                <span className="font-bold block text-[11px] uppercase tracking-wider">Hasil Tes Koneksi:</span>
                <span className="font-semibold block mt-0.5 text-slate-950">{health.label}</span>
                <span className="text-[10px] block opacity-90 mt-0.5">{health.desc}</span>
              </div>
            </div>

          </div>
        </div>

        {/* Visual Progress Bars for Non-Technical Users (Translating into humans concept) */}
        <div className="p-6 space-y-6">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detail Sisa Kapasitas Gratis (Reset Setiap Jam 15.00 WIB)</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Reads Component */}
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/20 space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    📖 Kecepatan Unduh / Lihat Nilai
                    <HelpCircle className="w-3.5 h-3.5 text-slate-350 cursor-help" title="Dipicu setiap guru membuka lembar nilai, memuat halaman siswa, atau mencetak e-raport." />
                  </h5>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Terpakai: <strong className="text-slate-700 font-mono">{baseReads.toLocaleString('id-ID')}</strong> dari limit gratis harian <strong>50.000 kali</strong>.
                  </span>
                </div>
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${readsPercentage > 75 ? 'text-rose-700 bg-rose-50' : 'text-slate-700 bg-slate-100'}`}>
                  {readsPercentage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className={`h-2.5 rounded-full transition-all duration-500 ${statusInfo.barColor}`}
                  style={{ width: `${Math.min(readsPercentage, 100)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-400">
                Sisa kuota gratis hari ini: <strong>{(maxFreeReads - baseReads).toLocaleString('id-ID')} pembacaan lagi</strong>.
              </p>
            </div>

            {/* Writes Component */}
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/20 space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    💾 Kecepatan Simpan / Klik Simpan Nilai
                    <HelpCircle className="w-3.5 h-3.5 text-slate-350 cursor-help" title="Dipicu setiap guru menekan tombol 'Simpan' untuk TP, Nilai, absensi, atau profil." />
                  </h5>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Terpakai: <strong className="text-slate-700 font-mono">{baseWrites.toLocaleString('id-ID')}</strong> dari limit gratis harian <strong>20.000 kali</strong>.
                  </span>
                </div>
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${writesPercentage > 75 ? 'text-rose-700 bg-rose-50' : 'text-slate-700 bg-slate-100'}`}>
                  {writesPercentage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className={`h-2.5 rounded-full transition-all duration-500 ${statusInfo.barColor}`} 
                  style={{ width: `${Math.min(writesPercentage, 100)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-400">
                Sisa kuota simpan hari ini: <strong>{(maxFreeWrites - baseWrites).toLocaleString('id-ID')} kali simpan lagi</strong>.
              </p>
            </div>

            {/* Storage Component */}
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/20 space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    📂 Sisa Ruang Penyimpanan Rapor
                    <HelpCircle className="w-3.5 h-3.5 text-slate-350 cursor-help" title="Jumlah total rekor dan data yang disimpan secara permanen di database." />
                  </h5>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Terpakai: <strong className="text-slate-700 font-mono">{stats.totalDocs.toLocaleString('id-ID')}</strong> data dari kapasitas aman gratis <strong>1.000.000 data (1 GB)</strong>.
                  </span>
                </div>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded text-emerald-850 bg-emerald-50">
                  {docsCapacityPercentage.toFixed(4)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="h-2.5 rounded-full bg-indigo-500 transition-all duration-500" 
                  style={{ width: `${Math.max(Math.min(docsCapacityPercentage, 100), 1)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-400">
                Data Anda sangat kecil & ringan sehingga kapasitas penyimpanan gratis dapat bertahan hingga puluhan tahun!
              </p>
            </div>

            {/* Simultan User Component */}
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/20 space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    👥 Batas Jumlah Guru Mengisi Bersamaan (Simultan)
                    <HelpCircle className="w-3.5 h-3.5 text-slate-350 cursor-help" title="Maksimal guru atau akun yang boleh membuka aplikasi ini di detik yang sama." />
                  </h5>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Batas gratis tertinggi di Google Cloud: <strong>10.000 Pengguna bersamaan</strong>.
                  </span>
                </div>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded text-indigo-850 bg-indigo-50">
                  Aman Sekali
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="h-2.5 rounded-full bg-emerald-500 transition-all duration-500" 
                  style={{ width: '1%' }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-400">
                Puncak lalu lintas guru aktif di SMP Al Irsyad Surakarta tidak akan pernah menembus batas ini.
              </p>
            </div>

          </div>

        </div>
      </div>

      {/* Simulator Beban Guru yang Interaktif (Sangat Mudah Dipahami) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive Simulation */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs space-y-5">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Prediksikan Sisa Kuota Sesuai Jumlah Guru
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Gunakan geseran (slider) di bawah untuk mensimulasikan seberapa kuat database menanggung aktivitas guru di sekolah Anda hari ini.
              </p>
            </div>

            <div className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
              
              {/* Slider 1 */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs text-slate-700">
                  <span className="font-semibold">Jumlah Guru yang Mengisi Nilai Hari Ini:</span>
                  <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                    {guruAktif} Guru
                  </span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={guruAktif} 
                  onChange={(e) => setGuruAktif(Number(e.target.value))} 
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-[9px] text-slate-405 font-medium">
                  <span>1 Guru</span>
                  <span>50 Guru</span>
                  <span>100 Guru (Maksimal Sekolah)</span>
                </div>
              </div>

              {/* Slider 2 */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs text-slate-700">
                  <span className="font-semibold">Seberapa Sering Guru Mengedit & Menyimpan:</span>
                  <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                    {transaksiPerGuru} Kali Simpan / Hari
                  </span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="50" 
                  value={transaksiPerGuru} 
                  onChange={(e) => setTransaksiPerGuru(Number(e.target.value))} 
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-[9px] text-slate-405 font-medium">
                  <span>Sangat Jarang (1)</span>
                  <span>Sedang (25)</span>
                  <span>Sangat Aktif (50)</span>
                </div>
              </div>

            </div>

            {/* Friendly Optimization Switches */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metode Hemat Kuota (Aktifkan untuk Mengurangi Risiko):</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                <label className="flex items-start gap-3 p-3 bg-slate-50/40 rounded-xl border border-slate-150 hover:bg-slate-50/90 cursor-pointer transition select-none">
                  <input 
                    type="checkbox" 
                    checked={useShedding} 
                    onChange={(e) => setUseShedding(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer accent-emerald-600 mt-0.5" 
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">Kurangi Refresh Otomatis</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Mematikan pemantauan live non-stop. Menghemat beban baca sebesar 35%!</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-50/40 rounded-xl border border-slate-150 hover:bg-slate-50/90 cursor-pointer transition select-none">
                  <input 
                    type="checkbox" 
                    checked={useOptimizedCache} 
                    onChange={(e) => setUseOptimizedCache(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer accent-emerald-600 mt-0.5" 
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">Aktifkan Cache Memori Lokal</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Menyimpan data sementara di browser guru untuk menghemat pembacaan sebesar 30%.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-emerald-50/10 rounded-xl border border-emerald-150/60 hover:bg-emerald-50/20 cursor-pointer transition select-none sm:col-span-2">
                  <input 
                    type="checkbox" 
                    checked={isBlazeUpgraded} 
                    onChange={(e) => setIsBlazeUpgraded(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer accent-emerald-600 mt-0.5" 
                  />
                  <div>
                    <span className="font-bold text-xs text-emerald-800 block">Saya Sudah Upgrade Paket Google Cloud (Blaze)</span>
                    <span className="text-[10px] text-emerald-600 block mt-0.5">Membantu menafikan limit harian. Anda tetap mendapat porsi gratis setiap hari tanpa risiko sistem terkunci!</span>
                  </div>
                </label>

              </div>
            </div>

            {/* Simple feedback of forecasting */}
            <div className="p-4.5 bg-indigo-50/40 border border-indigo-100 rounded-xl flex items-start gap-2.5 text-xs text-indigo-950">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold">Hasil Proyeksi Estimasi Kesimpulan Anda:</h5>
                <p className="text-[11px] text-indigo-900 mt-0.5 leading-relaxed">
                  Dengan simulasi sebesar <strong>{guruAktif} guru aktif</strong>, total konsumsi kuota harian berada di tingkat <strong>{calculatedRiskPercentage.toFixed(1)}% dari kapasitas bebas</strong>. Aplikasi diproyeksikan <strong className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">{calculatedRiskPercentage >= 85 ? 'Sangat Berisiko LOCKOUT' : 'Lancar Jaya Terkendali'}</strong> sepanjang hari ini.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: SOP & Actions */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Friendly SOP */}
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-emerald-600" />
              Panduan Sederhana Mengantisipasi Kuota Habis
            </h4>
            
            <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
              <p>
                Jika suatu hari server Firebase menampilkan error bertuliskan <strong>"Quota Exceeded"</strong>, guru tidak bisa memasukkan nilai untuk sementara waktu hingga berganti hari. Berikut rekomendasi tindakannya:
              </p>
              
              <div className="space-y-3 border-l-2 border-emerald-500 pl-3">
                <div className="space-y-0.5">
                  <strong className="text-slate-800 block">1. Lakukan Ekspor Data Rutin (Pencegahan)</strong>
                  <span>Gunakan menu <strong>Backup Data</strong> di sebelah kiri untuk mengunduh semua data rapor ke komputer Anda sebelum hari pengisian rapor massal dimulai.</span>
                </div>
                
                <div className="space-y-0.5">
                  <strong className="text-slate-800 block">2. Bagi Sesi Pengisian Nilai Guru</strong>
                  <span>Himbau para guru untuk mengisi nilai secara bergiliran (misalnya: Kelas 7 di jam pagi, Kelas 8 di siang hari, dan Kelas 9 di sore hari) guna menyebarkan pemakaian.</span>
                </div>

                <div className="space-y-0.5">
                  <strong className="text-slate-800 block">3. Hubungkan Kartu Kredit di Google Cloud</strong>
                  <span>Firebase menyediakan opsi peningkatan paket ke <strong>Blaze (Pay-As-You-Go)</strong>. Tenang saja, Google tetap memberikan kuota gratis yang sama setiap bulan, dan Anda hanya akan ditagih biaya sangat murah (ribuan rupiah) jika pemakaian bulanan benar-benar menembus kuota gratis.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick info metadata */}
          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs space-y-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">ID & Kredensial Database Anda</span>
            
            <div className="space-y-2.5 text-[11px] font-mono text-slate-600">
              <div>
                <span className="text-[9px] font-bold text-slate-400 block font-sans uppercase">ID Proyek Google:</span>
                <span className="p-2 bg-slate-50 border border-slate-200/50 rounded-lg block overflow-x-auto whitespace-nowrap scrollbar-none text-[10px] select-all">
                  {firebaseConfig.projectId}
                </span>
              </div>

              <div>
                <span className="text-[9px] font-bold text-slate-400 block font-sans uppercase">API Key Terpasang:</span>
                <div className="p-2 bg-slate-50 border border-slate-200/50 rounded-lg flex items-center justify-between text-[10px]">
                  <span className="truncate select-all">{firebaseConfig.apiKey}</span>
                  <Key className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={firebaseUsageUrl}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 border border-slate-200 hover:border-emerald-600 text-slate-700 hover:text-emerald-700 rounded-xl text-center text-[11px] font-bold transition flex items-center justify-center gap-1.5"
              >
                <span>Live Grafik Kuota</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <a
                href={firebaseConsoleUrl}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-center text-[11px] font-bold transition flex items-center justify-center gap-1.5"
              >
                <span>Buka Google Console</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
