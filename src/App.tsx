/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SchemaDatabase, SessionState, formatTipeUjian } from './types';
import { getDatabase, saveDatabase } from './data';
import { LoginScreen } from './components/LoginScreen';
import { AdminKelas } from './components/AdminKelas';
import { AdminMapel } from './components/AdminMapel';
import { AdminSiswa } from './components/AdminSiswa';
import { AdminGuru } from './components/AdminGuru';
import { AdminTahunAjaran } from './components/AdminTahunAjaran';
import { AdminProfile } from './components/AdminProfile';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminBackup } from './components/AdminBackup';
import { GuruTP } from './components/GuruTP';
import { GuruNilai } from './components/GuruNilai';
import { GuruCetak } from './components/GuruCetak';
import { GuruProfile } from './components/GuruProfile';
import { GuruLeger } from './components/GuruLeger';
import { subscribeToDatabase, syncDatabaseChange } from './lib/firebase';

import { 
  Users, BookOpen, UserCheck, GraduationCap, Calendar, User, LogOut, 
  LayoutDashboard, Award, FileText, CheckCircle2, ListChecks, Edit3, Printer, Menu, X, Loader2,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [db, setDb] = useState<SchemaDatabase>(getDatabase());
  const [isDbLoading, setIsDbLoading] = useState(true);

  // Keep a ref to the absolute latest db state to prevent stale state closure issues during async updates
  const dbRef = React.useRef(db);
  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  // Login Session state (loaded and kept in sessionStorage)
  const [session, setSession] = useState<SessionState>(() => {
    const saved = sessionStorage.getItem('e_raport_session');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { role: null, userId: '', name: '' };
  });

  // Subscribe to real-time changes in Firebase, factoring in current role/user ID for query optimization
  useEffect(() => {
    const unsubscribe = subscribeToDatabase(
      (syncedDb) => {
        setDb(syncedDb);
        setIsDbLoading(false);
      },
      session.role,
      session.userId
    );
    return () => unsubscribe();
  }, [session.role, session.userId]);

  // Sidebar toggle for mobile layouts
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Custom non-blocking logout modal state
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Active Menu tabs
  const [activeTab, setActiveTab] = useState<string>(() => {
    return session.role === 'admin' ? 'dashboard' : 'tp';
  });

  // Handle db update
  const handleUpdateDb = (updatedDb: SchemaDatabase) => {
    // Keep active period snapshots in sync with master data to avoid discrepancies in real-time dashboards
    if (updatedDb.activePeriodId) {
      updatedDb.periodList = updatedDb.periodList.map(p => {
        if (p.id === updatedDb.activePeriodId) {
          // Sync Guru Snapshot
          let newSnapshotGuru = p.snapshotGuru.map(sg => {
            const liveG = updatedDb.guru.find(g => g.id === sg.id);
            return liveG ? { ...liveG } : sg;
          });
          updatedDb.guru.forEach(liveG => {
            if (!newSnapshotGuru.some(sg => sg.id === liveG.id)) {
              newSnapshotGuru.push({ ...liveG });
            }
          });
          newSnapshotGuru = newSnapshotGuru.filter(sg => updatedDb.guru.some(g => g.id === sg.id));

          // Sync Kelas Snapshot
          let newSnapshotKelas = p.snapshotKelas.map(sk => {
            const liveK = updatedDb.kelas.find(k => k.id === sk.id);
            return liveK ? { ...liveK } : sk;
          });
          updatedDb.kelas.forEach(liveK => {
            if (!newSnapshotKelas.some(sk => sk.id === liveK.id)) {
              newSnapshotKelas.push({ ...liveK });
            }
          });
          newSnapshotKelas = newSnapshotKelas.filter(sk => updatedDb.kelas.some(k => k.id === sk.id));

          // Sync Mapel Snapshot
          let newSnapshotMapel = p.snapshotMapel.map(sm => {
            const liveM = updatedDb.mapel.find(m => m.id === sm.id);
            return liveM ? { ...liveM } : sm;
          });
          updatedDb.mapel.forEach(liveM => {
            if (!newSnapshotMapel.some(sm => sm.id === liveM.id)) {
              newSnapshotMapel.push({ ...liveM });
            }
          });
          newSnapshotMapel = newSnapshotMapel.filter(sm => updatedDb.mapel.some(m => m.id === sm.id));

          // Sync Siswa Snapshot
          let newSnapshotSiswa = p.snapshotSiswa.map(ss => {
            const liveS = updatedDb.siswa.find(s => s.id === ss.id);
            return liveS ? { ...liveS } : ss;
          });
          updatedDb.siswa.forEach(liveS => {
            if (!newSnapshotSiswa.some(ss => ss.id === liveS.id)) {
              newSnapshotSiswa.push({ ...liveS });
            }
          });
          newSnapshotSiswa = newSnapshotSiswa.filter(ss => updatedDb.siswa.some(s => s.id === ss.id));

          return {
            ...p,
            snapshotGuru: newSnapshotGuru,
            snapshotKelas: newSnapshotKelas,
            snapshotMapel: newSnapshotMapel,
            snapshotSiswa: newSnapshotSiswa
          };
        }
        return p;
      });
    }

    // Call asynchronous Firebase storage write in background, passing roles for surgical, highly-efficient syncing
    syncDatabaseChange(dbRef.current, updatedDb, session.role, session.userId);

    setDb(updatedDb);
    saveDatabase(updatedDb);
  };

  const handleLoginSuccess = (userSession: SessionState) => {
    setSession(userSession);
    sessionStorage.setItem('e_raport_session', JSON.stringify(userSession));
    setActiveTab(userSession.role === 'admin' ? 'dashboard' : 'tp');
  };

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    const empty: SessionState = { role: null, userId: '', name: '' };
    setSession(empty);
    sessionStorage.removeItem('e_raport_session');
    setMobileMenuOpen(false);
    setIsLogoutModalOpen(false);
  };

  // Find active period details
  const activePeriod = db.periodList.find(p => p.id === db.activePeriodId);

  // Force Tab check when session changes
  useEffect(() => {
    if (session.role) {
      setActiveTab(session.role === 'admin' ? 'dashboard' : 'tp');
    }
  }, [session.role]);

  // Sidebar link details
  const adminLinks = [
    { id: 'dashboard', label: 'Dashboard Admin', icon: LayoutDashboard },
    { id: 'kelas', label: 'Data Kelas', icon: Users },
    { id: 'mapel', label: 'Data Mapel', icon: BookOpen },
    { id: 'guru', label: 'Data Guru', icon: GraduationCap },
    { id: 'siswa', label: 'Data Siswa', icon: UserCheck },
    { id: 'tahun-ajaran', label: 'Tahun Ajaran (Release)', icon: Calendar },
    { id: 'backup', label: 'Backup Data', icon: Database },
    { id: 'profile', label: 'Pengaturan Profil', icon: User },
  ];

  // For Guru, dynamically adjust based on homeroom status
  const currentTeacher = db.guru.find(g => g.id === session.userId);
  const isHomeroomTeacher = currentTeacher?.isWaliKelas;

  const guruLinks = [
    { id: 'tp', label: 'Input TP (Tujuan Belajar)', icon: ListChecks },
    { id: 'nilaiNav', label: 'Input Nilai Siswa', icon: Edit3 },
    { 
      id: 'cetakNav', 
      label: 'Cetak Raport', 
      icon: Printer,
      badge: isHomeroomTeacher ? 'Wali Kelas' : undefined 
    },
    ...(isHomeroomTeacher ? [{
      id: 'legerNav',
      label: 'Cetak Leger Raport',
      icon: FileText,
      badge: 'Wali Kelas'
    }] : []),
    { id: 'profile-guru', label: 'Pengaturan Profil', icon: User },
  ];

  if (isDbLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans p-6">
        <div className="flex flex-col items-center space-y-4 max-w-md text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
          <h3 className="text-lg font-black text-slate-100 tracking-tight">Menghubungkan Database...</h3>
          <p className="text-xs text-slate-400 leading-relaxed md:px-6">
            Mohon tunggu sejenak, sistem sedang sinkronisasi data e-Raport SMP Al Irsyad Surakarta dengan layanan Firebase Cloud Database.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      
      {/* If not logged in, showcase the login screen */}
      {session.role === null ? (
        <LoginScreen db={db} onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="flex-1 flex flex-col md:flex-row">
          
          {/* SIDEBAR FOR DESKTOP / TOP-NAV TOGGLE FOR MOBILE */}
          <header className="md:hidden bg-emerald-900 text-white p-4 flex justify-between items-center shadow-md shrink-0 sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white rounded-lg">
                <img 
                  src="https://www.alirsyad.or.id/wp-content/uploads/download/alirsyad-alislamiyyah.png" 
                  alt="Logo Al Irsyad" 
                  className="w-7 h-7 object-contain" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <div>
                <span className="text-xs text-amber-300 font-mono tracking-wider block font-bold">E-RAPORT MASTER</span>
                <span className="text-sm font-bold tracking-tight">SMP AL IRSYAD</span>
              </div>
            </div>
            
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 hover:bg-emerald-800/80 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </header>

          {/* SIDEBAR VIEW MAPPING */}
          <aside className={`w-full md:w-64 bg-emerald-900 text-white flex flex-col shrink-0 border-r border-emerald-800 z-30 transition-all ${
            mobileMenuOpen ? 'fixed inset-0 top-[60px] md:relative md:top-auto block' : 'hidden md:flex'
          }`}>
            
            {/* School identity brand at sidebar top */}
            <div className="p-6 border-b border-emerald-800 hidden md:block">
              <div className="flex items-center gap-2.5">
                <div className="p-1 bg-white rounded-xl">
                  <img 
                    src="https://www.alirsyad.or.id/wp-content/uploads/download/alirsyad-alislamiyyah.png" 
                    alt="Logo Al Irsyad" 
                    className="w-10 h-10 object-contain" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
                <div>
                  <h1 className="font-extrabold tracking-tight text-white text-[15px] font-sans uppercase">E-RAPORT</h1>
                  <p className="text-[10px] text-emerald-400 font-medium tracking-wide">SMP AL IRSYAD SURAKARTA</p>
                </div>
              </div>
            </div>

            {/* Sidebar navigation items */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {session.role === 'admin' ? (
                adminLinks.map(link => {
                  const IconComp = link.icon;
                  const isActive = activeTab === link.id;
                  return (
                    <button
                      key={link.id}
                      onClick={() => {
                        setActiveTab(link.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full py-2.5 px-3 rounded-lg flex items-center gap-3 text-xs md:text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-emerald-800 text-white shadow-sm font-semibold'
                          : 'text-emerald-100 hover:text-white hover:bg-emerald-800/60'
                      }`}
                    >
                      <IconComp className="w-4 h-4 shrink-0 opacity-70" />
                      {link.label}
                    </button>
                  );
                })
              ) : (
                guruLinks.map(link => {
                  const IconComp = link.icon;
                  const isActive = activeTab === link.id;
                  return (
                    <button
                      key={link.id}
                      onClick={() => {
                        setActiveTab(link.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full py-2.5 px-3 rounded-lg flex justify-between items-center text-xs md:text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-emerald-800 text-white shadow-sm font-semibold'
                          : 'text-emerald-100 hover:text-white hover:bg-emerald-800/60'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <IconComp className="w-4 h-4 shrink-0 opacity-70" />
                        {link.label}
                      </span>
                      {link.badge && (
                        <span className="text-[9px] bg-emerald-950/40 text-emerald-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider scale-95 border border-emerald-800">
                          {link.badge}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </nav>

            {/* Logged in entity credentials at footer */}
            <div className="p-4 border-t border-emerald-800">
              <div className="flex items-center space-x-3 p-2 rounded-lg bg-emerald-950/30">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-emerald-950 flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                  {session.name.charAt(0)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold truncate text-white">{session.name}</p>
                  <p className="text-[10px] text-emerald-400 capitalize">{session.role === 'admin' ? 'Administrator' : 'Guru Pengajar'}</p>
                </div>
              </div>
            </div>

            {/* Logout section */}
            <div className="p-4 border-t border-emerald-800">
              <button
                onClick={handleLogout}
                className="w-full py-2.5 px-3 bg-emerald-950/40 hover:bg-rose-950/30 text-emerald-200 hover:text-rose-200 border border-emerald-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-2.5 transition-all text-left"
              >
                <LogOut className="w-4 h-4 text-emerald-400 shrink-0" />
                Keluar Aplikasi
              </button>
            </div>
          </aside>

          {/* MAIN PAGE FRAMES */}
          <main className="flex-1 flex flex-col min-w-0">
            
            {/* TOP HEADER */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sm:px-8 shrink-0">
              <div className="flex flex-col">
                <h2 className="text-sm sm:text-base font-bold text-slate-800">
                  {session.role === 'admin' 
                    ? adminLinks.find(l => l.id === activeTab)?.label || 'Admin Panel'
                    : guruLinks.find(l => l.id === activeTab)?.label || 'Guru Panel'
                  }
                </h2>
                <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                  {activePeriod 
                    ? `Status: Semester ${activePeriod.semester} ${activePeriod.tahunAjaran}` 
                    : 'Status: Belum Ada Periode Aktif'
                  }
                </p>
              </div>
              <div className="flex items-center space-x-3 sm:space-x-4">
                {activePeriod ? (
                  <div className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded text-amber-700 text-[10px] sm:text-xs font-medium uppercase tracking-tight">
                    Rilis: {formatTipeUjian(activePeriod.tipeUjian)} Ready
                  </div>
                ) : (
                  <div className="px-2.5 py-1 bg-rose-50 border border-rose-250 rounded text-rose-700 text-[10px] sm:text-xs font-medium uppercase">
                    Rilis: None
                  </div>
                )}
                <button 
                  onClick={handleLogout}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] sm:text-xs font-bold transition-colors underline decoration-2 decoration-emerald-500 underline-offset-4"
                >
                  Logout System
                </button>
              </div>
            </header>

            {/* View Containers mapped by tabs */}
            <div className="flex-1 p-6 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  
                  {/* ADMIN VIEW SWITCHES */}
                  {session.role === 'admin' && (
                    <>
                      {activeTab === 'dashboard' && (
                        <div className="space-y-6">
                          <div className="border-b border-slate-100 pb-2">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                              <LayoutDashboard className="w-5 h-5 text-emerald-600" />
                              Ringkasan Kontrol E-Raport
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">Status database master SMP Al Irsyad Surakarta.</p>
                          </div>

                          {/* Quick Stats Grid */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white p-5 border border-slate-150 rounded-2xl shadow-xs">
                              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Jumlah Guru</div>
                              <div className="text-2xl font-black text-slate-800 mt-1">{db.guru.length}</div>
                              <div className="text-[10px] text-emerald-600 font-semibold mt-1">Tercatat Master</div>
                            </div>
                            <div className="bg-white p-5 border border-slate-150 rounded-2xl shadow-xs">
                              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Jumlah Siswa</div>
                              <div className="text-2xl font-black text-slate-800 mt-1">{db.siswa.length}</div>
                              <div className="text-[10px] text-emerald-600 font-semibold mt-1">Berdasarkan Kelas</div>
                            </div>
                            <div className="bg-white p-5 border border-slate-150 rounded-2xl shadow-xs">
                              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Ruang Kelas</div>
                              <div className="text-2xl font-black text-slate-800 mt-1">{db.kelas.length}</div>
                              <div className="text-[10px] text-emerald-600 font-semibold mt-1">Tingkat 7 Sampai 9</div>
                            </div>
                            <div className="bg-white p-5 border border-slate-150 rounded-2xl shadow-xs">
                              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mata Pelajaran</div>
                              <div className="text-2xl font-black text-slate-800 mt-1">{db.mapel.length}</div>
                              <div className="text-[10px] text-emerald-600 font-semibold mt-1">Kurikulum Merdeka</div>
                            </div>
                          </div>

                          {/* Interactive Subject-wise Grade Progress Chart */}
                          <AdminDashboard db={db} onNavigateToTab={(tab) => {
                            setActiveTab(tab);
                            setMobileMenuOpen(false);
                          }} />

                          {/* Snapshot and publish notice board */}
                          <div className="bg-gradient-to-r from-emerald-50 to-amber-50/40 p-5 rounded-2xl border border-emerald-100/50 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                            <div className="space-y-1">
                              <h4 className="font-bold text-xs text-emerald-950 flex items-center gap-1">
                                <Award className="w-4.5 h-4.5 text-emerald-600" />
                                Publikasi Periode Ujian Aktif
                              </h4>
                              <p className="text-[11px] text-emerald-900 leading-relaxed max-w-2xl">
                                Melakukan update/edit master data siswa atau guru tidak akan mempengaruhi grades/nilai yang sedang diinput oleh guru jika Anda tidak mempublikasi ulang periode tersebut. Gunakan modul "Rilis" untuk menyalin database master sewaktu-waktu.
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setActiveTab('tahun-ajaran');
                                setMobileMenuOpen(false);
                              }}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
                            >
                              Kelola Rilis
                            </button>
                          </div>
                        </div>
                      )}

                      {activeTab === 'kelas' && (
                        <AdminKelas db={db} onUpdate={handleUpdateDb} />
                      )}

                      {activeTab === 'mapel' && (
                        <AdminMapel db={db} onUpdate={handleUpdateDb} />
                      )}

                      {activeTab === 'guru' && (
                        <AdminGuru db={db} onUpdate={handleUpdateDb} />
                      )}

                      {activeTab === 'siswa' && (
                        <AdminSiswa db={db} onUpdate={handleUpdateDb} />
                      )}

                      {activeTab === 'tahun-ajaran' && (
                        <AdminTahunAjaran db={db} onUpdate={handleUpdateDb} />
                      )}

                      {activeTab === 'backup' && (
                        <AdminBackup db={db} />
                      )}

                      {activeTab === 'profile' && (
                        <AdminProfile db={db} onUpdate={handleUpdateDb} />
                      )}
                    </>
                  )}

                  {/* GURU VIEW SWITCHES */}
                  {session.role === 'guru' && (
                    <>
                      {activeTab === 'tp' && (
                        <GuruTP db={db} guruId={session.userId} onUpdate={handleUpdateDb} />
                      )}

                      {activeTab === 'nilaiNav' && (
                        <GuruNilai db={db} guruId={session.userId} onUpdate={handleUpdateDb} />
                      )}

                      {activeTab === 'cetakNav' && (
                        <GuruCetak db={db} guruId={session.userId} onUpdate={handleUpdateDb} />
                      )}

                      {activeTab === 'legerNav' && isHomeroomTeacher && (
                        <GuruLeger db={db} guruId={session.userId} onUpdate={handleUpdateDb} />
                      )}

                      {activeTab === 'profile-guru' && (
                        <GuruProfile db={db} guruId={session.userId} onUpdate={handleUpdateDb} />
                      )}
                    </>
                  )}

                </motion.div>
              </AnimatePresence>
            </div>

            <footer className="py-4 text-center text-[10px] text-slate-400 border-t border-slate-100 bg-white font-mono shrink-0">
              SMP AL IRSYAD SURAKARTA • Kurikulum Merdeka E-Raport • Logged in as {session.name}
            </footer>
          </main>

        </div>
      )}

      {/* CUSTOM LOGOUT CONFIRMATION MODAL */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4 border border-rose-100">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-sans">Konfirmasi Keluar</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Apakah Anda yakin ingin keluar (Log Out) dari sistem E-Raport SMP Al Irsyad Surakarta?
            </p>
            <div className="flex gap-3 w-full mt-6">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition duration-150"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow-md transition duration-150"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
