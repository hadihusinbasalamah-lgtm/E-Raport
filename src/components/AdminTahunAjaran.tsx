/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase, TipeUjian, PeriodeAkademik, formatTipeUjian } from '../types';
import { Calendar, CheckCircle2, Award, Zap, History, Globe, Trash2, Edit, RefreshCw, X } from 'lucide-react';

interface AdminTahunAjaranProps {
  db: SchemaDatabase;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function AdminTahunAjaran({ db, onUpdate }: AdminTahunAjaranProps) {
  const [inputTahun, setInputTahun] = useState('2025/2026');
  const [inputSemester, setInputSemester] = useState<'Ganjil' | 'Genap'>('Ganjil');
  const [inputTipeUjian, setInputTipeUjian] = useState<TipeUjian>('PSTS1');
  const [inputTanggalRaport, setInputTanggalRaport] = useState(new Date().toISOString().split('T')[0]);

  const [editingPeriod, setEditingPeriod] = useState<PeriodeAkademik | null>(null);
  const [editTanggalRaport, setEditTanggalRaport] = useState('');
  const [redeploySnapshot, setRedeploySnapshot] = useState(false);

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();

    // Generate unique key
    const generatedId = `${inputTahun.replace(/\//g, '-')}_${inputSemester}_${inputTipeUjian}`;

    // Verify if already exists
    if (db.periodList.some(p => p.id === generatedId)) {
      if (!confirm("Periode Akademik ini sudah pernah dirilis sebelumnya. Apakah Anda yakin ingin mempublish ulang? Ini akan menyalin data master baru untuk periode ini.")) {
        return;
      }
    }

    // Safety check: ensure we have at least some master data to snapshot
    if (db.kelas.length === 0 || db.siswa.length === 0 || db.guru.length === 0) {
      alert("Error: Anda tidak dapat merilis periode baru saat master Data Kelas, Data Siswa, atau Data Guru masih kosong!");
      return;
    }

    // Capture Snapshots
    const newPeriod: PeriodeAkademik = {
      id: generatedId,
      tahunAjaran: inputTahun.trim(),
      semester: inputSemester,
      tipeUjian: inputTipeUjian,
      isPublished: true,
      publishedAt: new Date().toISOString(),
      tanggalRaport: inputTanggalRaport,
      
      // Perform deep/cloned snapshots
      snapshotKelas: JSON.parse(JSON.stringify(db.kelas)),
      snapshotSiswa: JSON.parse(JSON.stringify(db.siswa)),
      snapshotGuru: JSON.parse(JSON.stringify(db.guru)),
      snapshotMapel: JSON.parse(JSON.stringify(db.mapel))
    };

    // Append to periodList, filtering out any existing with same id to overwrite
    const filteredPeriods = db.periodList.filter(p => p.id !== generatedId);
    const updatedPeriods = [newPeriod, ...filteredPeriods];

    onUpdate({
      ...db,
      periodList: updatedPeriods,
      activePeriodId: generatedId
    });

    alert(`Sukses! Periode ${inputTahun} - Semester ${inputSemester} - Jenis Ujian ${inputTipeUjian} telah BERHASIL Dirilis & Diaktifkan.`);
  };

  const handleSetActive = (id: string) => {
    onUpdate({
      ...db,
      activePeriodId: id
    });
  };

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDeletePeriod = () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    const updatedPeriodList = db.periodList.filter(p => p.id !== id);
    let nextActiveId = db.activePeriodId;
    if (db.activePeriodId === id) {
      nextActiveId = updatedPeriodList[0]?.id || '';
    }
    onUpdate({
      ...db,
      periodList: updatedPeriodList,
      activePeriodId: nextActiveId
    });
    setDeleteTargetId(null);
  };

  const handleOpenEdit = (period: PeriodeAkademik) => {
    setEditingPeriod(period);
    setEditTanggalRaport(period.tanggalRaport || '');
    setRedeploySnapshot(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeriod) return;

    let updatedPeriod = {
      ...editingPeriod,
      tanggalRaport: editTanggalRaport,
    };

    if (redeploySnapshot) {
      if (db.kelas.length === 0 || db.siswa.length === 0 || db.guru.length === 0) {
        alert("Error: Tidak dapat melakukan redeploy karena master database kosong!");
        return;
      }
      updatedPeriod = {
        ...updatedPeriod,
        snapshotKelas: JSON.parse(JSON.stringify(db.kelas)),
        snapshotSiswa: JSON.parse(JSON.stringify(db.siswa)),
        snapshotGuru: JSON.parse(JSON.stringify(db.guru)),
        snapshotMapel: JSON.parse(JSON.stringify(db.mapel)),
        publishedAt: new Date().toISOString()
      };
    }

    const updatedPeriodList = db.periodList.map(p => p.id === editingPeriod.id ? updatedPeriod : p);
    
    onUpdate({
      ...db,
      periodList: updatedPeriodList
    });

    setEditingPeriod(null);
  };

  const activePeriod = db.periodList.find(p => p.id === db.activePeriodId);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Overview Title */}
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-600" />
          Rilis Tahun Ajaran & Ujian
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Rilis target Tahun Ajaran aktif dan ambil snapshot data siswa & kelas agar guru dapat menginput nilai dengan aman.
        </p>
      </div>

      {/* Grid with Current Active & Publish Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Publish Form */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-2">
            <Zap className="w-4 h-4 text-emerald-600 animate-pulse" />
            Rilis Periode Penilaian Baru
          </div>

          <form onSubmit={handlePublish} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tahun Ajaran</label>
              <input
                type="text"
                required
                value={inputTahun}
                onChange={e => setInputTahun(e.target.value)}
                placeholder="Contoh: 2025/2026, 2026/2027"
                className="w-full px-3, py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Tuliskan format standar Tahun Ajaran (e.g. 2025/2026)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Semester</label>
                <select
                  value={inputSemester}
                  onChange={e => setInputSemester(e.target.value as 'Ganjil' | 'Genap')}
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis Penilaian / Ujian</label>
                <select
                  value={inputTipeUjian}
                  onChange={e => setInputTipeUjian(e.target.value as TipeUjian)}
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none"
                >
                  <option value="PSTS1">PSTS 1 (Sumatif Tengah Semester 1)</option>
                  <option value="PSAS1">PSAS 1 (Sumatif Akhir Semester 1)</option>
                  <option value="PSTS2">PSTS 2 (Sumatif Tengah Semester 2)</option>
                  <option value="PSAT">PSAT (Penilaian Sumatif Akhir Tahun)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal Pembagian Raport (Tanggal Raportan)</label>
              <input
                type="date"
                required
                value={inputTanggalRaport}
                onChange={e => setInputTanggalRaport(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Tanggal ini akan otomatis dicetak pada lembar raport siswa.</p>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Publish & Aktifkan Periode Akademik
            </button>
          </form>
        </div>

        {/* Right Side: Displaying Current Active State */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Active indicator box */}
          <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-emerald-50 p-6 rounded-2xl shadow-md border border-emerald-700/50 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="px-2.5 py-1 bg-emerald-700/50 text-emerald-300 rounded-lg text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
                  <Globe className="w-3 h-3 text-emerald-400" />
                  Status: LIVE / AKTIF
                </span>
                <Award className="w-5 h-5 text-amber-400" />
              </div>

              {activePeriod ? (
                <div>
                  <h3 className="text-lg font-bold">E-Raport Periode Aktif</h3>
                  <div className="text-3xl font-extrabold text-amber-300 tracking-tight mt-1">
                    {activePeriod.tahunAjaran}
                  </div>
                  <div className="text-xs text-emerald-250 font-semibold font-sans mt-1.5 space-y-1">
                    <p>• Semester: <span className="text-white">{activePeriod.semester}</span></p>
                    <p>• Jenis Penilaian: <span className="text-white">{formatTipeUjian(activePeriod.tipeUjian)}</span></p>
                    <p>• Tanggal Raportan: <span className="text-amber-350 font-semibold">{activePeriod.tanggalRaport ? new Date(activePeriod.tanggalRaport).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span></p>
                    <p>• Rilis Pada: <span className="text-white">{activePeriod.publishedAt ? new Date(activePeriod.publishedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}</span></p>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold text-rose-300">Belum Ada Periode Aktif rilis</h3>
                  <p className="text-xs text-white/75 mt-1">Silakan buat dan rilis periode akademik baru di form sebelah kiri.</p>
                </div>
              )}
            </div>

            {activePeriod && (
              <div className="mt-6 pt-4 border-t border-emerald-800/60 grid grid-cols-2 gap-2 text-[10px] text-emerald-200">
                <div className="bg-emerald-900/40 p-2 rounded-lg">
                  <div className="font-bold text-white text-xs">{activePeriod.snapshotSiswa.length}</div>
                  <div>Siswa Ke-lock</div>
                </div>
                <div className="bg-emerald-900/40 p-2 rounded-lg">
                  <div className="font-bold text-white text-xs">{activePeriod.snapshotKelas.length}</div>
                  <div>Kelas Ke-lock</div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Historical Published list */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-2">
          <History className="w-4 h-4 text-slate-500" />
          Riwayat Penerbitan Periode E-Raport
        </h3>

        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-bold tracking-wider uppercase">
                <th className="py-3 px-4">Tahun Ajaran</th>
                <th className="py-3 px-4">Semester</th>
                <th className="py-3 px-4">Ujian</th>
                <th className="py-3 px-4">Tanggal Raport</th>
                <th className="py-3 px-4">Tanggal Rilis</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {db.periodList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                    Belum ada riwayat rilis.
                  </td>
                </tr>
              ) : (
                db.periodList.map(p => (
                  <tr key={p.id} className={`hover:bg-slate-50/50 transition-colors ${db.activePeriodId === p.id ? 'bg-emerald-50/20' : ''}`}>
                    <td className="py-3 px-4 font-bold text-slate-800">{p.tahunAjaran}</td>
                    <td className="py-3 px-4 font-medium">{p.semester}</td>
                    <td className="py-3 px-4 font-mono text-emerald-700">{formatTipeUjian(p.tipeUjian)}</td>
                    <td className="py-3 px-4 text-slate-700 font-semibold text-[10px]">
                      {p.tanggalRaport ? new Date(p.tanggalRaport).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[10px]">
                      {p.publishedAt ? new Date(p.publishedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {db.activePeriodId === p.id ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-[10px] font-bold border border-emerald-150 mr-1">
                            Aktif Sekarang
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSetActive(p.id)}
                            className="px-2.5 py-1 border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-all rounded-lg text-[10px] font-semibold mr-1"
                          >
                            Aktifkan
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleOpenEdit(p)}
                          title="Edit & Redeploy"
                          className="p-1.5 border border-slate-200 hover:border-amber-500 hover:bg-amber-50 text-slate-500 hover:text-amber-700 transition-all rounded-lg inline-flex items-center gap-1"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-medium hidden sm:inline">Edit</span>
                        </button>

                        <button
                          onClick={() => handleDeleteClick(p.id)}
                          title="Hapus Rilis"
                          className="p-1.5 border border-slate-200 hover:border-rose-500 hover:bg-rose-50 text-slate-500 hover:text-rose-700 transition-all rounded-lg inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-medium hidden sm:inline">Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit & Redeploy Modal Overlay */}
      {editingPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 text-left">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-500" />
                <div>
                  <h4 className="font-bold text-slate-900 text-[14px]">Edit & Redeploy Rilis</h4>
                  <p className="text-[10px] text-slate-500">ID: {editingPeriod.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingPeriod(null)}
                className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <div className="text-[13px] text-slate-400 font-semibold uppercase tracking-wider">Periode Terpilih</div>
                <div className="text-[13px] font-bold text-slate-800">
                  {editingPeriod.tahunAjaran} - Semester {editingPeriod.semester}
                </div>
                <div className="text-[13px] text-emerald-700 font-mono font-semibold">
                  Sistem Penilaian: {formatTipeUjian(editingPeriod.tipeUjian)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal Pembagian Raport (Tanggal Raportan)</label>
                <input
                  type="date"
                  required
                  value={editTanggalRaport}
                  onChange={e => setEditTanggalRaport(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Tanggal ini akan dicetak pada lembar raport siswa.</p>
              </div>

              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={redeploySnapshot}
                    onChange={e => setRedeploySnapshot(e.target.checked)}
                    className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-800">
                      <RefreshCw className={`w-3.5 h-3.5 ${redeploySnapshot ? 'animate-spin' : ''}`} />
                      Redeploy / Update Snapshot Database
                    </span>
                    <span className="block text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                      Centang ini untuk menyalin ulang data master terbaru (Kelas, Siswa, Guru, Mapel) ke rilis periode ini. Gunakan jika ada siswa, kelas atau guru baru ditambahkan di master.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPeriod(null)}
                  className="flex-1 py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-fadeIn">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4 border border-rose-100">
              <Trash2 className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-sans">Hapus Periode Akademik</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus rilis periode akademik ini? Semua data snapshot nilai & siswa untuk periode ini akan terhapus secara permanen.
            </p>
            <div className="flex gap-3 w-full mt-6">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition duration-150 font-sans"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeletePeriod}
                className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow-md transition duration-150 font-sans"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
