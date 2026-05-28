/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SchemaDatabase } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import { 
  Users, BookOpen, Clock, CheckCircle2, AlertTriangle, Search, Filter, 
  HelpCircle, RefreshCw, BarChart2, ListOrdered, ChevronRight, GraduationCap,
  LayoutGrid, BarChart3, PieChart as PieIcon
} from 'lucide-react';

interface AdminDashboardProps {
  db: SchemaDatabase;
  onNavigateToTab: (tabId: string) => void;
}

export function AdminDashboard({ db, onNavigateToTab }: AdminDashboardProps) {
  const activePeriod = db.periodList.find(p => p.id === db.activePeriodId);

  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL'); // ALL, 7, 8, 9
  const [metricType, setMetricType] = useState<'percentage' | 'numbers'>('percentage');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'column' | 'bar' | 'donut'>('column');

  // Active snapshots or live data as fallback
  const currentMapels = activePeriod?.snapshotMapel || db.mapel;
  const currentKelas = activePeriod?.snapshotKelas || db.kelas;
  const currentSiswa = activePeriod?.snapshotSiswa || db.siswa;
  const currentGurus = activePeriod?.snapshotGuru || db.guru;
  const allNilai = db.nilaiSiswa || [];

  // 1. Helper to extract year/level from Class Name (e.g. VII A -> 7, 8 B -> 8, 9 -> 9)
  const getClassLevel = (kelasNama: string): string => {
    const name = (kelasNama || '').trim().toUpperCase();
    if (name.startsWith('VII') || name.startsWith('7')) return '7';
    if (name.startsWith('VIII') || name.startsWith('8')) return '8';
    if (name.startsWith('IX') || name.startsWith('9')) return '9';
    return 'Other';
  };

  // 2. Main computation: subject-wise progress
  const progressData = useMemo(() => {
    return currentMapels.map(mapel => {
      // Find classes assigned to this subject via active teacher snapshots
      const classMap: Record<string, { kelasId: string; kelasNama: string; teacherName: string }> = {};

      currentGurus.forEach(guru => {
        // Mapel 1
        if (guru.mapel1Id === mapel.id) {
          const classIds1 = guru.mapel1KelasIds && guru.mapel1KelasIds.length > 0
            ? guru.mapel1KelasIds
            : (guru.mapel1KelasId ? [guru.mapel1KelasId] : []);
          
          classIds1.forEach(cid => {
            const kl = currentKelas.find(k => k.id === cid);
            if (kl) {
              classMap[cid] = { kelasId: cid, kelasNama: kl.nama, teacherName: guru.nama };
            }
          });
        }
        // Mapel 2
        if (guru.mapel2Id === mapel.id) {
          const classIds2 = guru.mapel2KelasIds && guru.mapel2KelasIds.length > 0
            ? guru.mapel2KelasIds
            : (guru.mapel2KelasId ? [guru.mapel2KelasId] : []);
          
          classIds2.forEach(cid => {
            const kl = currentKelas.find(k => k.id === cid);
            if (kl) {
              classMap[cid] = { kelasId: cid, kelasNama: kl.nama, teacherName: guru.nama };
            }
          });
        }
      });

      const assignedClasses = Object.values(classMap);

      // Determine students expected to have records
      let studentsExpected: { siswaId: string; siswaNama: string; kelasId: string; kelasNama: string; teacherName: string }[] = [];
      const classDetails: { 
        kelasId: string; 
        kelasNama: string; 
        teacherName: string; 
        totalSiswa: number; 
        siswaGraded: number; 
        percentage: number 
      }[] = [];

      assignedClasses.forEach(item => {
        const studentsInKlass = currentSiswa.filter(s => s.kelasId === item.kelasId);
        
        let gradedInKlass = 0;
        studentsInKlass.forEach(student => {
          studentsExpected.push({
            siswaId: student.id,
            siswaNama: student.nama,
            kelasId: item.kelasId,
            kelasNama: item.kelasNama,
            teacherName: item.teacherName
          });

          const hasGrade = allNilai.some(n => {
            const periMatch = activePeriod ? n.periodeId === activePeriod.id : true;
            return periMatch && n.siswaId === student.id && n.mapelId === mapel.id;
          });
          if (hasGrade) gradedInKlass++;
        });

        classDetails.push({
          kelasId: item.kelasId,
          kelasNama: item.kelasNama,
          teacherName: item.teacherName,
          totalSiswa: studentsInKlass.length,
          siswaGraded: gradedInKlass,
          percentage: studentsInKlass.length > 0 ? Math.round((gradedInKlass / studentsInKlass.length) * 100) : 0
        });
      });

      // Filter expected students by selected level
      let filteredExpected = studentsExpected;
      if (selectedLevel !== 'ALL') {
        filteredExpected = studentsExpected.filter(s => getClassLevel(s.kelasNama) === selectedLevel);
      }

      const totalExpected = filteredExpected.length;
      
      // Calculate how many of those filtered expected students are graded
      const totalGraded = filteredExpected.filter(student => {
        return allNilai.some(n => {
          const periMatch = activePeriod ? n.periodeId === activePeriod.id : true;
          return periMatch && n.siswaId === student.siswaId && n.mapelId === mapel.id;
        });
      }).length;

      const percentage = totalExpected > 0 ? Math.round((totalGraded / totalExpected) * 100) : 0;
      const totalRemaining = totalExpected - totalGraded;

      return {
        id: mapel.id,
        nama: mapel.nama,
        percentage,
        graded: totalGraded,
        expected: totalExpected,
        remaining: totalRemaining,
        classDetails: classDetails.filter(c => selectedLevel === 'ALL' || getClassLevel(c.kelasNama) === selectedLevel)
      };
    }).filter(item => {
      // Apply Search Filter
      const matchesSearch = item.nama.toLowerCase().includes(searchTerm.toLowerCase());
      // Show only subjects that have student obligations
      const hasStudents = item.expected > 0;
      return matchesSearch && hasStudents;
    });
  }, [currentMapels, currentSiswa, currentKelas, currentGurus, allNilai, activePeriod, searchTerm, selectedLevel]);

  // Selected subject's computed class detail roster
  const activeSubjectDetails = useMemo(() => {
    if (!selectedSubjectId) return null;
    return progressData.find(item => item.id === selectedSubjectId) || null;
  }, [selectedSubjectId, progressData]);

  // Overall database progress recap
  const summaryStats = useMemo(() => {
    let totalAllExpected = 0;
    let totalAllGraded = 0;

    // Use computed progress dataset
    progressData.forEach(item => {
      totalAllExpected += item.expected;
      totalAllGraded += item.graded;
    });

    const averageProgress = totalAllExpected > 0 ? Math.round((totalAllGraded / totalAllExpected) * 100) : 0;

    // Subject completions count
    const completedSubjects = progressData.filter(item => item.percentage === 100).length;
    const inProgressSubjects = progressData.filter(item => item.percentage > 0 && item.percentage < 100).length;
    const zeroProgressSubjects = progressData.filter(item => item.percentage === 0).length;

    return {
      totalAllExpected,
      totalAllGraded,
      averageProgress,
      completedSubjects,
      inProgressSubjects,
      zeroProgressSubjects,
      totalRemaining: totalAllExpected - totalAllGraded
    };
  }, [progressData]);

  const donutData = useMemo(() => {
    let completed = 0;
    let high = 0;
    let medium = 0;
    let zero = 0;

    progressData.forEach(item => {
      if (item.percentage === 100) completed++;
      else if (item.percentage >= 80) high++;
      else if (item.percentage > 0) medium++;
      else zero++;
    });

    const data = [];
    if (completed > 0) data.push({ name: 'Selesai (100%)', value: completed, color: '#059669' });
    if (high > 0) data.push({ name: 'Hampir Selesai (80-99%)', value: high, color: '#10b981' });
    if (medium > 0) data.push({ name: 'Sedang Proses (1-79%)', value: medium, color: '#f59e0b' });
    if (zero > 0) data.push({ name: 'Belum Mulai (0%)', value: zero, color: '#ef4444' });

    return data;
  }, [progressData]);

  return (
    <div className="space-y-6">
      
      {/* Visual Header Panel with metadata */}
      <div className="bg-white p-6 border border-slate-150 rounded-2xl shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                <BarChart2 className="w-5 h-5" />
              </span>
              <h3 className="text-base font-bold text-slate-800">Progres Penginputan Nilai per Mata Pelajaran</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
              Memantau penyelesaian input nilai guru untuk setiap mata pelajaran secara realtime pada periode ujian aktif: <span className="font-semibold text-emerald-700">{activePeriod ? `${activePeriod.tahunAjaran} - Semester ${activePeriod.semester} (${activePeriod.tipeUjian})` : 'Belum Ada Rilis'}</span>.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedLevel('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedLevel === 'ALL' 
                  ? 'bg-emerald-950 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Kelas
            </button>
            <button
              onClick={() => setSelectedLevel('7')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedLevel === '7' 
                  ? 'bg-emerald-950 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tingkat VII
            </button>
            <button
              onClick={() => setSelectedLevel('8')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedLevel === '8' 
                  ? 'bg-emerald-950 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tingkat VIII
            </button>
            <button
              onClick={() => setSelectedLevel('9')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedLevel === '9' 
                  ? 'bg-emerald-950 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tingkat IX
            </button>
          </div>
        </div>

        {/* Dashboard Grid mini items */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
            <div className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Rata-Rata Progres
            </div>
            <div className="text-2xl font-black text-emerald-950 mt-1">{summaryStats.averageProgress}%</div>
            <div className="w-full bg-emerald-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: `${summaryStats.averageProgress}%` }} />
            </div>
          </div>

          <div className="p-4 bg-slate-50/50 border border-slate-150 rounded-xl">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-450" /> Total Data Nilai
            </div>
            <div className="text-2xl font-black text-slate-800 mt-1">
              {summaryStats.totalAllGraded} <span className="text-xs text-slate-400 font-medium">/ {summaryStats.totalAllExpected}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Siswa - mata pelajaran terinput</p>
          </div>

          <div className="p-4 bg-amber-50/40 border border-amber-100 rounded-xl">
            <div className="text-[10px] uppercase font-bold text-amber-800 tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" /> Sisa Antrean Input
            </div>
            <div className="text-2xl font-black text-amber-950 mt-1">{summaryStats.totalRemaining}</div>
            <p className="text-[10px] text-amber-700/80 mt-1">Siswa belum memiliki nilai</p>
          </div>

          <div className="p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl">
            <div className="text-[10px] uppercase font-bold text-indigo-800 tracking-wider flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" /> Status Mapel ({progressData.length})
            </div>
            <div className="text-lg font-black text-slate-800 mt-1">
              {summaryStats.completedSubjects} Selesai
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">{summaryStats.inProgressSubjects} Proses • {summaryStats.zeroProgressSubjects} Belum Mulai</p>
          </div>
        </div>
      </div>

      {/* Main Graph Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
               {/* CHART BAR SECTION */}
        <div className="xl:col-span-2 bg-white p-6 border border-slate-150 rounded-2xl shadow-xs flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full animate-ping" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Visualisasi Progres Input</h4>
            </div>

            {/* Chart mode selection & metric selection */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Chart Format Switcher */}
              <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-50 shrink-0">
                <button
                  type="button"
                  onClick={() => setChartType('column')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 ${
                    chartType === 'column' 
                      ? 'bg-white text-slate-800 shadow-xs border border-slate-200/50' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Grafik Batang Tegak"
                >
                  <BarChart3 className="w-3 h-3 text-emerald-600" />
                  <span>Kolom</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('bar')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 ${
                    chartType === 'bar' 
                      ? 'bg-white text-slate-800 shadow-xs border border-slate-200/50' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Grafik Batang Mendatar"
                >
                  <BarChart2 className="w-3 h-3 text-blue-600" />
                  <span>Bar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('donut')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 ${
                    chartType === 'donut' 
                      ? 'bg-white text-slate-800 shadow-xs border border-slate-200/50' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Grafik Lingkaran"
                >
                  <PieIcon className="w-3 h-3 text-violet-600" />
                  <span>Donut</span>
                </button>
              </div>

              {/* Metric Switcher & Search (Disabled for Donut chart as it represents global meta status) */}
              {chartType !== 'donut' && (
                <>
                  <div className="relative">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari mapel..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded-lg text-[11px] placeholder-slate-400 w-28 sm:w-36 transition-all"
                    />
                  </div>

                  <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-slate-55 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMetricType('percentage')}
                      className={`px-2.5 py-1 text-[10px] font-bold ${
                        metricType === 'percentage' 
                          ? 'bg-slate-800 text-white' 
                          : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetricType('numbers')}
                      className={`px-2.5 py-1 text-[10px] font-bold ${
                        metricType === 'numbers' 
                          ? 'bg-slate-800 text-white' 
                          : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Siswa
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Empty state if mapels list is empty */}
          {progressData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center">
              <AlertTriangle className="w-10 h-10 text-amber-500 mb-2" />
              <h5 className="text-sm font-bold text-slate-700">Tidak ada data untuk ditampilkan</h5>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Silakan ubah filter tingkat kelas atau kata kunci pencarian mata pelajaran Anda.
              </p>
            </div>
          ) : (
            <>
              {/* Responsive container for Recharts */}
              <div className="h-80 w-full text-xs flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'column' ? (
                    <BarChart
                      data={progressData}
                      layout="horizontal"
                      margin={{ top: 15, right: 10, left: -20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="nama" 
                        stroke="#94a3b8" 
                        fontSize={8}
                        interval={0}
                        tickFormatter={(v) => v.length > 11 ? v.slice(0, 9) + '..' : v}
                        angle={-20}
                        textAnchor="end"
                        height={45}
                      />
                      <YAxis 
                        type="number" 
                        domain={metricType === 'percentage' ? [0, 100] : [0, 'dataMax']} 
                        stroke="#94a3b8" 
                        fontSize={10} 
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(239, 246, 255, 0.4)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 space-y-1 z-50">
                                <p className="font-bold text-xs">{data.nama}</p>
                                <div className="space-y-0.5 text-[10px] text-slate-300 font-mono">
                                  <p>Progres: <span className="text-emerald-400 font-bold">{data.percentage}%</span></p>
                                  <p>Siswa Dinilai: {data.graded} / {data.expected}</p>
                                  <p>Belum Dinilai: {data.remaining} siswa</p>
                                </div>
                                <p className="text-[8px] text-slate-400 italic mt-1.5 leading-none">Klik bar untuk melihat detail kelas</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey={metricType === 'percentage' ? 'percentage' : 'graded'} 
                        radius={[4, 4, 0, 0]}
                        barSize={20}
                        className="cursor-pointer"
                      >
                        {progressData.map((entry, index) => {
                          let barColor = "#0284c7";
                          if (entry.percentage === 0) barColor = "#cbd5e1";
                          else if (entry.percentage === 100) barColor = "#059669";
                          else if (entry.percentage > 70) barColor = "#10b981";
                          else if (entry.percentage < 40) barColor = "#f59e0b";

                          return (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={barColor}
                              stroke={selectedSubjectId === entry.id ? '#0f172a' : undefined}
                              strokeWidth={selectedSubjectId === entry.id ? 2 : 0}
                              onClick={() => setSelectedSubjectId(entry.id)}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  ) : chartType === 'bar' ? (
                    <BarChart
                      data={progressData}
                      layout="vertical"
                      margin={{ top: 10, right: 15, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} stroke="#f1f5f9" />
                      <XAxis 
                        type="number" 
                        domain={metricType === 'percentage' ? [0, 100] : [0, 'dataMax']} 
                        stroke="#94a3b8" 
                        fontSize={10}
                      />
                      <YAxis 
                        dataKey="nama" 
                        type="category" 
                        stroke="#94a3b8" 
                        fontSize={9} 
                        width={90}
                        tickFormatter={(v) => v.length > 12 ? v.slice(0, 10) + '..' : v}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(239, 246, 255, 0.5)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 space-y-1 z-50">
                                <p className="font-bold text-xs">{data.nama}</p>
                                <div className="space-y-0.5 text-[10px] text-slate-300 font-mono">
                                  <p>Progres: <span className="text-emerald-400 font-bold">{data.percentage}%</span></p>
                                  <p>Siswa Dinilai: {data.graded} / {data.expected}</p>
                                  <p>Belum Dinilai: {data.remaining} siswa</p>
                                </div>
                                <p className="text-[8px] text-slate-400 italic mt-1.5 leading-none">Klik bar untuk melihat detail kelas</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey={metricType === 'percentage' ? 'percentage' : 'graded'} 
                        radius={[0, 4, 4, 0]}
                        barSize={12}
                        className="cursor-pointer"
                      >
                        {progressData.map((entry, index) => {
                          let barColor = "#0284c7";
                          if (entry.percentage === 0) barColor = "#cbd5e1";
                          else if (entry.percentage === 100) barColor = "#059669";
                          else if (entry.percentage > 70) barColor = "#10b981";
                          else if (entry.percentage < 40) barColor = "#f59e0b";

                          return (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={barColor}
                              stroke={selectedSubjectId === entry.id ? '#0f172a' : undefined}
                              strokeWidth={selectedSubjectId === entry.id ? 2 : 0}
                              onClick={() => setSelectedSubjectId(entry.id)}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  ) : (
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-xl border border-slate-800 text-[11px] font-sans">
                                <span className="font-bold">{payload[0].name}</span>: <span className="font-bold text-emerald-400">{data.value} Mapel</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={40} 
                        iconType="circle" 
                        iconSize={7}
                        formatter={(value) => <span className="text-[10px] font-semibold text-slate-650 ml-1">{value}</span>}
                      />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Informative Help Text */}
              <div className="flex items-center gap-2 mt-4 bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-500">
                <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <p>
                  {chartType === 'donut' ? (
                    <span><strong>Info Donut:</strong> Diagram ini menunjukkan seberapa banyak mata pelajaran yang telah diinput 100% penuh oleh masing-masing guru, dibandingkan porsi input tertunda.</span>
                  ) : (
                    <span><strong>Klik Bar/Kolom:</strong> Anda dapat menekan warna grafik di atas untuk memfilter info guru pengampu, daftar siswa ter-input, dan sisa rincian per kelas.</span>
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        {/* DETAILS SIDEBAR LIST */}
        <div className="bg-white p-6 border border-slate-150 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-800">
                <ListOrdered className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Perincian Progres</h4>
              </div>
              
              {selectedSubjectId && (
                <button 
                  onClick={() => setSelectedSubjectId(null)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 focus:outline-none underline"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* If a subject bar is selected, show details. Otherwise, render leaderboard rank */}
            {activeSubjectDetails ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-1">
                  <span className="text-[10px] font-mono uppercase bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.5 rounded">Selected Subject</span>
                  <p className="text-xs font-bold text-slate-800 mt-1">{activeSubjectDetails.nama}</p>
                  <p className="text-[11px] text-slate-500">Progres gabungan kelas: <span className="font-bold text-emerald-700">{activeSubjectDetails.percentage}%</span></p>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  <h5 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Metrik Kelas & Guru Pengampu:</h5>
                  {activeSubjectDetails.classDetails.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Belum ada pemetaan guru pengampu atau kelas rilis untuk mata pelajaran ini.</p>
                  ) : (
                    activeSubjectDetails.classDetails.map((klass, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800">Kelas {klass.kelasNama}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            klass.percentage === 100 
                              ? 'bg-emerald-100 text-emerald-800'
                              : (klass.percentage === 0 ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-800')
                          }`}>
                            {klass.percentage}%
                          </span>
                        </div>
                        <div className="space-y-1 text-[10px] text-slate-500 font-medium">
                          <p className="flex items-center gap-1"><GraduationCap className="w-3 h-3 text-slate-400" /> Guru: {klass.teacherName || '-'}</p>
                          <p className="flex items-center gap-1"><Users className="w-3 h-3 text-slate-400" /> Progress: {klass.siswaGraded} dari {klass.totalSiswa} Siswa dinilai</p>
                        </div>
                        {/* Custom sub bar indicator */}
                        <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${klass.percentage === 100 ? 'bg-emerald-600' : 'bg-emerald-500'}`} 
                            style={{ width: `${klass.percentage}%` }} 
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Berikut adalah urutan progres penginputan nilai untuk mata pelajaran rilis saat ini:
                </p>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {[...progressData]
                    .sort((a, b) => b.percentage - a.percentage)
                    .map((item, idx) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedSubjectId(item.id)}
                        className="w-full text-left p-2.5 hover:bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between group transition-all"
                      >
                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                          <span className="text-xs font-bold text-slate-400 w-4 font-mono">{idx + 1}.</span>
                          <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-emerald-700">{item.nama}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 font-mono text-xs">
                          <span className={`font-bold ${item.percentage === 100 ? 'text-emerald-600' : (item.percentage === 0 ? 'text-slate-400' : 'text-slate-700')}`}>
                            {item.percentage}%
                          </span>
                          <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex justify-between items-center text-[10px] text-slate-400 font-mono font-medium">
            <span>TERAKHIR SYNC: REALTIME</span>
            <button 
              onClick={() => onNavigateToTab('tahun-ajaran')} 
              className="text-emerald-600 hover:text-emerald-700 font-bold uppercase transition"
            >
              KUNJUNGI RILIS &rarr;
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
