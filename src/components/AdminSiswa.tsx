/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchemaDatabase, Siswa } from '../types';
import { UserCheck, Plus, Edit2, Trash2, Check, Search, Filter, Save, Upload, Download, CheckCircle, HelpCircle, ArrowUp, ArrowDown, ListChecks, RefreshCw, X } from 'lucide-react';

interface AdminSiswaProps {
  db: SchemaDatabase;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function AdminSiswa({ db, onUpdate }: AdminSiswaProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // States for search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKelasId, setFilterKelasId] = useState('all');

  // Multi select & Import states
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [parsedImportData, setParsedImportData] = useState<any[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // States for sorting mode
  const [isSortingMode, setIsSortingMode] = useState(false);
  const [sortingSiswaList, setSortingSiswaList] = useState<Siswa[]>([]);

  // Input states
  const [inputNama, setInputNama] = useState('');
  const [inputNISN, setInputNISN] = useState('');
  const [inputNIS, setInputNIS] = useState('');
  const [inputJK, setInputJK] = useState<'L' | 'P'>('L');
  const [inputKelasId, setInputKelasId] = useState('');
  const [inputNoAbsen, setInputNoAbsen] = useState<string>('');

  const handleStartAdd = () => {
    setInputNama('');
    setInputNISN('');
    setInputNIS('');
    setInputJK('L');
    setInputKelasId(db.kelas[0]?.id || '');
    setInputNoAbsen('');
    setIsAdding(true);
    setIsSubmitting(false);
  };

  const handleStartEdit = (s: Siswa) => {
    setEditingId(s.id);
    setInputNama(s.nama);
    setInputNISN(s.nisn);
    setInputNIS(s.nis);
    setInputJK(s.jenisKelamin);
    setInputKelasId(s.kelasId);
    setInputNoAbsen(s.noAbsen !== undefined ? s.noAbsen.toString() : '');
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!inputNama.trim()) {
      alert("Error: Nama lengkap siswa tidak boleh kosong!");
      return;
    }
    if (!inputNISN.trim()) {
      alert("Error: NISN tidak boleh kosong!");
      return;
    }
    if (!inputNIS.trim()) {
      alert("Error: NIS tidak boleh kosong!");
      return;
    }
    if (!inputKelasId) {
      alert("Error: Silakan pilih kelas siswa!");
      return;
    }

    // Check unique Nis / Nisn
    if (db.siswa.some(s => s.nisn === inputNISN.trim())) {
      alert("Error: NISN sudah pernah terdaftar!");
      return;
    }

    if (db.siswa.some(s => s.nis === inputNIS.trim())) {
      alert("Error: NIS sudah pernah terdaftar!");
      return;
    }

    setIsSubmitting(true);

    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const parsedNoAbsen = inputNoAbsen.trim() === '' ? undefined : parseInt(inputNoAbsen, 10);
    const newSiswa: Siswa = {
      id: 's_' + Date.now() + '_' + randomSuffix,
      nama: inputNama.trim(),
      nisn: inputNISN.trim(),
      nis: inputNIS.trim(),
      jenisKelamin: inputJK,
      kelasId: inputKelasId,
      noAbsen: isNaN(parsedNoAbsen as number) ? undefined : parsedNoAbsen
    };

    onUpdate({
      ...db,
      siswa: [...db.siswa, newSiswa]
    });

    setIsAdding(false);
    setIsSubmitting(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!editingId) return;

    if (!inputNama.trim()) {
      alert("Error: Nama siswa tidak boleh kosong!");
      return;
    }
    if (!inputNISN.trim()) {
      alert("Error: NISN tidak boleh kosong!");
      return;
    }
    if (!inputNIS.trim()) {
      alert("Error: NIS tidak boleh kosong!");
      return;
    }
    if (!inputKelasId) {
      alert("Error: Silakan pilih kelas!");
      return;
    }

    // Check unique Nis / Nisn for other student
    if (db.siswa.some(s => s.nisn === inputNISN.trim() && s.id !== editingId)) {
      alert("Error: NISN sudah pernah terdaftar pada siswa lain!");
      return;
    }

    if (db.siswa.some(s => s.nis === inputNIS.trim() && s.id !== editingId)) {
      alert("Error: NIS sudah pernah terdaftar pada siswa lain!");
      return;
    }

    setIsSubmitting(true);

    const parsedNoAbsen = inputNoAbsen.trim() === '' ? undefined : parseInt(inputNoAbsen, 10);
    const updated = db.siswa.map(s => {
      if (s.id === editingId) {
        return {
          ...s,
          nama: inputNama.trim(),
          nisn: inputNISN.trim(),
          nis: inputNIS.trim(),
          jenisKelamin: inputJK,
          kelasId: inputKelasId,
          noAbsen: isNaN(parsedNoAbsen as number) ? undefined : parsedNoAbsen
        };
      }
      return s;
    });

    onUpdate({
      ...db,
      siswa: updated
    });

    setEditingId(null);
    setIsSubmitting(false);
  };

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    const updatedSiswa = db.siswa.filter(s => s.id !== id);
    // Clean grades as well to avoid inconsistency
    const updatedNilai = db.nilaiSiswa.filter(n => n.siswaId !== id);
    const updatedAbsen = db.absensiDanCatatan.filter(a => a.siswaId !== id);

    onUpdate({
      ...db,
      siswa: updatedSiswa,
      nilaiSiswa: updatedNilai,
      absensiDanCatatan: updatedAbsen
    });
    setDeleteTargetId(null);
  };

  // Filter students
  const filteredSiswa = db.siswa.filter(s => {
    const matchesSearch = s.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.nis.includes(searchQuery) ||
                          s.nisn.includes(searchQuery);
    const matchesKelas = filterKelasId === 'all' || s.kelasId === filterKelasId;
    return matchesSearch && matchesKelas;
  });

  // Sort helper: sorts by Class name, then noAbsen, then name alphabetically
  const getSortedSiswa = (siswaList: Siswa[]) => {
    return [...siswaList].sort((a, b) => {
      if (a.kelasId !== b.kelasId) {
        const kelasA = db.kelas.find(k => k.id === a.kelasId)?.nama || '';
        const kelasB = db.kelas.find(k => k.id === b.kelasId)?.nama || '';
        return kelasA.localeCompare(kelasB);
      }
      const noA = a.noAbsen !== undefined && a.noAbsen !== null ? a.noAbsen : 999999;
      const noB = b.noAbsen !== undefined && b.noAbsen !== null ? b.noAbsen : 999999;
      if (noA !== noB) return noA - noB;
      return a.nama.localeCompare(b.nama);
    });
  };

  const sortedAndFilteredSiswa = getSortedSiswa(filteredSiswa);

  // Sorting management actions
  const handleOpenSorting = () => {
    if (filterKelasId === 'all') {
      alert("Silakan pilih salah satu kelas terlebih dahulu pada penyaringan kelas!");
      return;
    }
    const classSiswa = db.siswa.filter(s => s.kelasId === filterKelasId);
    const sorted = [...classSiswa].sort((a, b) => {
      const noA = a.noAbsen !== undefined && a.noAbsen !== null ? a.noAbsen : 999999;
      const noB = b.noAbsen !== undefined && b.noAbsen !== null ? b.noAbsen : 999999;
      if (noA !== noB) return noA - noB;
      return a.nama.localeCompare(b.nama);
    });
    setSortingSiswaList(sorted);
    setIsSortingMode(true);
  };

  const handleAutoSortAlphabetical = () => {
    const sortedAlphabetically = [...sortingSiswaList].sort((a, b) => a.nama.localeCompare(b.nama));
    const withAbsen = sortedAlphabetically.map((s, index) => ({
      ...s,
      noAbsen: index + 1
    }));
    setSortingSiswaList(withAbsen);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newList = [...sortingSiswaList];
    const temp = newList[index];
    newList[index] = newList[index - 1];
    newList[index - 1] = temp;
    
    const reassigned = newList.map((s, idx) => ({
      ...s,
      noAbsen: idx + 1
    }));
    setSortingSiswaList(reassigned);
  };

  const handleMoveDown = (index: number) => {
    if (index === sortingSiswaList.length - 1) return;
    const newList = [...sortingSiswaList];
    const temp = newList[index];
    newList[index] = newList[index + 1];
    newList[index + 1] = temp;
    
    const reassigned = newList.map((s, idx) => ({
      ...s,
      noAbsen: idx + 1
    }));
    setSortingSiswaList(reassigned);
  };

  const handleNoAbsenChange = (id: string, value: string) => {
    const val = value === '' ? undefined : parseInt(value, 10);
    setSortingSiswaList(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, noAbsen: isNaN(val as number) ? undefined : val };
      }
      return s;
    }));
  };

  const handleSaveSorting = () => {
    const updatedSiswaMap = new Map<string, number | undefined>();
    sortingSiswaList.forEach(s => {
      updatedSiswaMap.set(s.id, s.noAbsen);
    });

    const updatedSiswa = db.siswa.map(s => {
      if (updatedSiswaMap.has(s.id)) {
        return {
          ...s,
          noAbsen: updatedSiswaMap.get(s.id)
        };
      }
      return s;
    });

    onUpdate({
      ...db,
      siswa: updatedSiswa
    });
    setIsSortingMode(false);
  };

  const downloadTemplate = () => {
    const headers = ["Nama Lengkap", "NISN", "NIS", "Jenis Kelamin (L/P)", "Nama Kelas"];
    const classExamples = db.kelas.slice(0, 3).map(k => k.nama);
    const classEx1 = classExamples[0] || "7A";
    const classEx2 = classExamples[1] || "7B";
    const classEx3 = classExamples[2] || "8A";

    const data = [
      headers,
      ["Ahmad Rifqi", "0091234561", "2324001", "L", classEx1],
      ["Aisyah Humaira", "0109876543", "2324002", "P", classEx2],
      ["Hadi Husin", "0112233445", "2324003", "L", classEx3]
    ];

    const csvContent = data.map(e => e.join(",")).join("\n");
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_siswa_alirsyad.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleParseImport = (text: string) => {
    setImportFileError(null);
    if (!text.trim()) {
      setParsedImportData([]);
      return;
    }

    const lines = text.split(/\r?\n/);
    const result: any[] = [];
    
    let startIndex = 0;
    const firstLine = lines[0] || '';
    
    const lowerFirst = firstLine.toLowerCase();
    const isHeader = lowerFirst.includes('nama') || lowerFirst.includes('nisn') || lowerFirst.includes('nis') || lowerFirst.includes('kelas') || lowerFirst.includes('kelamin');
    
    if (isHeader) {
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let cols: string[] = [];
      if (line.includes('\t')) {
        cols = line.split('\t');
      } else if (line.includes(';')) {
        cols = line.split(';');
      } else {
        cols = line.split(',');
      }

      let nama = (cols[0] || '').trim();
      let nisn = (cols[1] || '').trim().replace(/\D/g, '');
      let nis = (cols[2] || '').trim().replace(/\D/g, '');
      let jkRaw = (cols[3] || '').trim().toUpperCase();
      let kelasRaw = (cols[4] || '').trim();

      if (!nama && !nisn && !nis) continue;

      let jk: 'L' | 'P' = 'L';
      if (jkRaw === 'P' || jkRaw.startsWith('PEREMPUAN') || jkRaw.startsWith('WANI') || jkRaw === 'FEMALE') {
        jk = 'P';
      }

      const matchedKelas = db.kelas.find(k => 
        k.nama.toLowerCase().replace(/\s+/g, '') === kelasRaw.toLowerCase().replace(/\s+/g, '')
      );

      let status: 'ok' | 'warning' | 'error' = 'ok';
      let errorMsg = '';
      let targetKelasId = matchedKelas?.id || '';

      if (!nama) {
        status = 'error';
        errorMsg = 'Nama lengkap kosong';
      } else if (!nisn || nisn.length !== 10) {
        status = 'error';
        errorMsg = `NISN harus 10 digit (Ditemukan: ${nisn})`;
      } else if (!nis) {
        status = 'error';
        errorMsg = 'NIS tidak boleh kosong';
      } else if (!matchedKelas) {
        status = 'error';
        errorMsg = `Kelas "${kelasRaw}" tidak ada di DB`;
      } else {
        const dupNisnDb = db.siswa.find(s => s.nisn === nisn);
        const dupNisDb = db.siswa.find(s => s.nis === nis);
        
        if (dupNisnDb) {
          status = 'warning';
          errorMsg = `NISN duplikat dengan ${dupNisnDb.nama}`;
        } else if (dupNisDb) {
          status = 'warning';
          errorMsg = `NIS duplikat dengan ${dupNisDb.nama}`;
        }
      }

      result.push({
        nama,
        nisn,
        nis,
        jenisKelamin: jk,
        kelasRaw,
        kelasId: targetKelasId,
        status,
        error: errorMsg
      });
    }

    for (let i = 0; i < result.length; i++) {
      if (result[i].status === 'error') continue;
      const cur = result[i];
      const isDupInList = result.some((item, idx) => 
        idx !== i && (item.nisn === cur.nisn || item.nis === cur.nis)
      );
      if (isDupInList) {
        result[i].status = 'error';
        result[i].error = 'Duplikasi NISN/NIS dalam baris import ini';
      }
    }

    setParsedImportData(result);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
      handleParseImport(text);
    };
    reader.onerror = () => {
      setImportFileError("Gagal membaca file tersebut.");
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = () => {
    const validRows = parsedImportData.filter(r => r.status === 'ok');
    if (validRows.length === 0) {
      alert("Tidak ada data dengan status hijau (Valid) untuk diimport!");
      return;
    }

    const newSiswaList: Siswa[] = validRows.map(r => {
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      return {
        id: 's_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '_' + randomSuffix,
        nama: r.nama,
        nisn: r.nisn,
        nis: r.nis,
        jenisKelamin: r.jenisKelamin,
        kelasId: r.kelasId
      };
    });

    onUpdate({
      ...db,
      siswa: [...db.siswa, ...newSiswaList]
    });

    alert(`Sukses mengimpor ${newSiswaList.length} data siswa baru!`);
    setIsImporting(false);
    setImportText('');
    setParsedImportData([]);
  };

  const handleBulkDelete = () => {
    if (selectedSiswaIds.length === 0) return;
    
    const updatedSiswa = db.siswa.filter(s => !selectedSiswaIds.includes(s.id));
    const updatedNilai = db.nilaiSiswa.filter(n => !selectedSiswaIds.includes(n.siswaId));
    const updatedAbsen = db.absensiDanCatatan.filter(a => !selectedSiswaIds.includes(a.siswaId));

    onUpdate({
      ...db,
      siswa: updatedSiswa,
      nilaiSiswa: updatedNilai,
      absensiDanCatatan: updatedAbsen
    });

    setSelectedSiswaIds([]);
    setShowBulkDeleteConfirm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            Data Siswa
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola data biodata, NISN, NIS, jenis kelamin dan pemisahan kelas siswa SMP Al Irsyad Surakarta.
          </p>
        </div>
        {!isAdding && !editingId && !isImporting ? (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleStartAdd}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              Tambah Siswa
            </button>
            <button
              onClick={() => {
                setIsImporting(true);
                setImportText('');
                setParsedImportData([]);
              }}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-indigo-100 shadow-sm active:scale-95 transition-all"
            >
              <Upload className="w-4 h-4" />
              Import Data Massal
            </button>
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-slate-200 shadow-sm active:scale-95 transition-all"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Template CSV
            </button>
          </div>
        ) : isImporting ? (
          <button
            onClick={() => setIsImporting(false)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl active:scale-95 transition-all"
          >
            Kembali ke Daftar
          </button>
        ) : null}
      </div>

      {isImporting ? (
        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-6 animate-fadeIn">
          <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                Upload / Import Siswa Massal
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Gunakan file CSV atau copas spreadsheet untuk mengunggah daftar siswa sekaligus ke database.
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-205 border-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer transition active:scale-95 font-sans"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Download Template CSV
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Metode 1: Unggah File CSV
                </label>
                <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-white rounded-xl p-5 text-center transition relative cursor-pointer group">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="space-y-2">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 group-hover:scale-110 transition duration-150">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-slate-700">Pilih file CSV dari komputer Anda</div>
                    <div className="text-[10px] text-slate-400">Pastikan file memakai pemisah koma (,) sesuai template</div>
                  </div>
                </div>
                {importFileError && (
                  <div className="text-[11px] text-rose-600 font-semibold mt-1.5">{importFileError}</div>
                )}
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-bold uppercase tracking-wide bg-slate-50 px-2 font-mono">atau</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Metode 2: Copas Langsung Dari Excel / Spreadsheet
                </label>
                <p className="text-[11px] text-slate-500 mb-1.5">
                  Salin kolom data di Excel Anda (tanpa baris judul), lalu tempelkan ke dalam kotak di bawah ini:
                </p>
                <textarea
                  rows={6}
                  value={importText}
                  onChange={e => {
                    setImportText(e.target.value);
                    handleParseImport(e.target.value);
                  }}
                  placeholder="Format kolom: Nama Lengkap [Tab/Koma] NISN [Tab/Koma] NIS [Tab/Koma] JK (L/P) [Tab/Koma] Nama Kelas&#10;&#10;Contoh:&#10;Muhammad Ali	0109283741	2324021	L	7A&#10;Siti Aisyah	0112938472	2324022	P	7B"
                  className="w-full p-3 font-mono text-xs border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-normal"
                />
              </div>
            </div>

            <div className="bg-indigo-50/40 border border-indigo-100 p-5 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-indigo-600" />
                Panduan Nama Kelas yang Valid
              </h4>
              <p className="text-[11px] text-indigo-950 mt-1.5 leading-relaxed">
                Supaya sistem dapat mengenali kelas dengan benar, pastikan kolom <strong>Nama Kelas</strong> di Excel / CSV Anda sama persis dengan nama kelas terdaftar berikut (besar kecil huruf dan spasi akan disinkronasikan otomatis):
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {db.kelas.map(k => (
                  <div key={k.id} className="bg-white border border-indigo-100/60 p-2 rounded-lg text-center shadow-2xs">
                    <div className="text-xs font-bold text-slate-800">{k.nama}</div>
                    <div className="text-[9px] text-slate-400 font-mono">ID: {k.id}</div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-indigo-800 space-y-1 bg-white border border-indigo-100 p-3 rounded-lg leading-relaxed mt-4">
                <p><strong>💡 Kriteria Validasi Siswa Baru:</strong></p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Nama tidak boleh kosong.</li>
                  <li>NISN wajib berisi 10 digit angka saja.</li>
                  <li>Nama Kelas wajib cocok dengan kotak di atas.</li>
                  <li>Jika NISN / NIS sudah ada di sistem, maka akan muncul peringatan warna kuning (data akan dilewati demi keamanan).</li>
                </ul>
              </div>
            </div>
          </div>

          {parsedImportData.length > 0 && (
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Hasil Pratinjau Analisis Data ({parsedImportData.length} baris terdeteksi)
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Silakan tinjau status kesiapan data berikut sebelum menyimpannya ke database.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-medium font-sans">
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold">
                    Valid: {parsedImportData.filter(x => x.status === 'ok').length}
                  </span>
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-bold">
                    Duplikat: {parsedImportData.filter(x => x.status === 'warning').length}
                  </span>
                  <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold">
                    Error: {parsedImportData.filter(x => x.status === 'error').length}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold tracking-wider uppercase sticky top-0 z-10">
                      <th className="py-2.5 px-4 w-10 text-center">No</th>
                      <th className="py-2.5 px-4">Nama</th>
                      <th className="py-2.5 px-4">NISN</th>
                      <th className="py-2.5 px-4">NIS</th>
                      <th className="py-2.5 px-4">JK</th>
                      <th className="py-2.5 px-4">Kelas Tujuan</th>
                      <th className="py-2.5 px-4">Status & Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {parsedImportData.map((item, index) => (
                      <tr key={index} className={`hover:bg-slate-50/50 transition-colors ${
                        item.status === 'error' ? 'bg-rose-50/20' : item.status === 'warning' ? 'bg-amber-50/10' : ''
                      }`}>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400 text-center">{index + 1}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{item.nama}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{item.nisn}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{item.nis}</td>
                        <td className="py-2.5 px-4">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-sans">
                            {item.jenisKelamin}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium">
                          {item.kelasId ? (
                            <span className="text-slate-800 font-bold">{item.kelasRaw}</span>
                          ) : (
                            <span className="text-rose-600 font-bold decoration-dotted underline">{item.kelasRaw || '?'}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {item.status === 'ok' && (
                              <>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                <span className="text-emerald-700 font-bold text-[11px]">Siap Import</span>
                              </>
                            )}
                            {item.status === 'warning' && (
                              <>
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                <span className="text-amber-700 font-semibold text-[11px]">{item.error}</span>
                              </>
                            )}
                            {item.status === 'error' && (
                              <>
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                <span className="text-rose-700 font-semibold text-[11px]">{item.error}</span>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setImportText('');
                    setParsedImportData([]);
                  }}
                  className="px-4 py-2 border border-slate-205 border-slate-250 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition active:scale-95 font-sans"
                >
                  Reset Form
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={parsedImportData.filter(x => x.status === 'ok').length === 0}
                  className={`px-5 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95 font-sans ${
                    parsedImportData.filter(x => x.status === 'ok').length > 0
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  Konfirmasi Import ({parsedImportData.filter(x => x.status === 'ok').length} Siswa)
                </button>
              </div>
            </div>
          )}
        </div>
      ) : isSortingMode ? (
        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-6 animate-fadeIn">
          <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-indigo-600" />
                Atur Urutan Absen Kelas: {db.kelas.find(k => k.id === filterKelasId)?.nama}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Urutkan urutan absen siswa untuk kelas ini. Gunakan tombol "Urutkan Otomatis (A-Z)" untuk mengurusi sesuai alfabet nama, atau gunakan tombol panah (🔼/🔽) serta kolom edit untuk menyesuaikan secara manual.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAutoSortAlphabetical}
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-emerald-200 shadow-2xs cursor-pointer transition active:scale-95 font-sans"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Urutkan Otomatis (A-Z)
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm max-h-[500px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold tracking-wider uppercase sticky top-0 z-10">
                  <th className="py-3 px-4 w-12 text-center">Urutan</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-6">NISN / NIS</th>
                  <th className="py-3 px-4 text-center w-28">No. Absen</th>
                  <th className="py-3 px-4 text-center w-28">Pindahkan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {sortingSiswaList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                      Tidak ada data siswa di kelas ini.
                    </td>
                  </tr>
                ) : (
                  sortingSiswaList.map((s, index) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 text-center font-bold">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {s.nama}
                      </td>
                      <td className="py-3 px-6 font-mono text-slate-500 text-[11px] leading-relaxed">
                        <div>NISN: {s.nisn}</div>
                        <div>NIS: {s.nis}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          min={1}
                          value={s.noAbsen !== undefined ? s.noAbsen : ''}
                          onChange={e => handleNoAbsenChange(s.id, e.target.value)}
                          placeholder="Absen"
                          className="w-20 px-2 py-1 text-center font-mono border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveUp(index)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer"
                            title="Pindah ke Atas"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === sortingSiswaList.length - 1}
                            onClick={() => handleMoveDown(index)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer"
                            title="Pindah ke Bawah"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsSortingMode(false)}
              className="px-4 py-2 border border-slate-250 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer hover:bg-slate-50 transition active:scale-95 font-sans"
            >
              Batal & Kembali
            </button>
            <button
              type="button"
              onClick={handleSaveSorting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-indigo-100 cursor-pointer font-sans"
            >
              <Check className="w-4 h-4" />
              Simpan Urutan Absen
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Add Form */}
          {isAdding && (
        <form onSubmit={handleSaveAdd} className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl space-y-4">
          <div className="text-sm font-semibold text-emerald-800">Tambah Identitas Siswa Baru</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap Siswa</label>
              <input
                type="text"
                required
                value={inputNama}
                onChange={e => setInputNama(e.target.value)}
                placeholder="Contoh: Muhammad Ali"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">NISN (10 Digit)</label>
              <input
                type="text"
                required
                maxLength={10}
                value={inputNISN}
                onChange={e => setInputNISN(e.target.value.replace(/\D/g, ''))}
                placeholder="Contoh: 0101234567"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">NIS (Lokal)</label>
              <input
                type="text"
                required
                value={inputNIS}
                onChange={e => setInputNIS(e.target.value.replace(/\D/g, ''))}
                placeholder="Contoh: 2324001"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis Kelamin</label>
              <select
                value={inputJK}
                onChange={e => setInputJK(e.target.value as 'L' | 'P')}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Kelas</label>
              <select
                required
                value={inputKelasId}
                onChange={e => setInputKelasId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="" disabled>-- Pilih Kelas --</option>
                {db.kelas.map(k => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">No. Urut Absen (Opsional)</label>
              <input
                type="number"
                min={1}
                value={inputNoAbsen}
                onChange={e => setInputNoAbsen(e.target.value)}
                placeholder="Contoh: 1 (Kosongkan bila otomatis)"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              disabled={isSubmitting}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {isSubmitting ? "Menyimpan..." : "Simpan Siswa"}
            </button>
          </div>
        </form>
      )}

      {/* Edit Form */}
      {editingId && (
        <form onSubmit={handleSaveEdit} className="bg-amber-50/40 border border-amber-200/60 p-5 rounded-2xl space-y-4">
          <div className="text-sm font-semibold text-amber-800">Edit Identitas Siswa</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap Siswa</label>
              <input
                type="text"
                required
                value={inputNama}
                onChange={e => setInputNama(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">NISN</label>
              <input
                type="text"
                required
                maxLength={10}
                value={inputNISN}
                onChange={e => setInputNISN(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">NIS</label>
              <input
                type="text"
                required
                value={inputNIS}
                onChange={e => setInputNIS(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis Kelamin</label>
              <select
                value={inputJK}
                onChange={e => setInputJK(e.target.value as 'L' | 'P')}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kelas</label>
              <select
                required
                value={inputKelasId}
                onChange={e => setInputKelasId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {db.kelas.map(k => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">No. Urut Absen (Opsional)</label>
              <input
                type="number"
                min={1}
                value={inputNoAbsen}
                onChange={e => setInputNoAbsen(e.target.value)}
                placeholder="Contoh: 1 (Kosongkan bila otomatis)"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              disabled={isSubmitting}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {isSubmitting ? "Menyimpan..." : "Selesai Edit"}
            </button>
          </div>
        </form>
      )}

      {/* Search and Filters toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari Siswa Berdasarkan Nama, NISN, atau NIS..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterKelasId}
            onChange={e => setFilterKelasId(e.target.value)}
            className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">Semua Kelas</option>
            {db.kelas.map(k => (
              <option key={k.id} value={k.id}>{k.nama}</option>
            ))}
          </select>
          {filterKelasId !== 'all' && (
            <button
              onClick={handleOpenSorting}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <ListChecks className="w-4 h-4" />
              Urutkan Absen Kelas
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Ribbon */}
      {selectedSiswaIds.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200/60 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-fadeIn">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
            Terpilih <strong className="text-sm font-extrabold text-emerald-950 bg-emerald-155 bg-emerald-200/50 rounded px-2 py-0.5">{selectedSiswaIds.length}</strong> siswa untuk aksi massal.
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setSelectedSiswaIds([])}
              className="flex-1 sm:flex-initial px-3 py-1.5 border border-slate-250 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-xs transition active:scale-95 shadow-2xs font-sans"
            >
              Batal Pilihan
            </button>
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="flex-1 sm:flex-initial px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition active:scale-95 shadow-sm flex items-center justify-center gap-1.5 font-sans"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Massal
            </button>
          </div>
        </div>
      )}

      {/* Students List */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-bold tracking-wider uppercase">
              <th className="py-3.5 px-3 text-center w-12">
                <input
                  type="checkbox"
                  checked={filteredSiswa.length > 0 && filteredSiswa.every(s => selectedSiswaIds.includes(s.id))}
                  onChange={e => {
                    if (e.target.checked) {
                      const toAdd = filteredSiswa.map(s => s.id);
                      setSelectedSiswaIds(prev => Array.from(new Set([...prev, ...toAdd])));
                    } else {
                      const toRemove = filteredSiswa.map(s => s.id);
                      setSelectedSiswaIds(prev => prev.filter(id => !toRemove.includes(id)));
                    }
                  }}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer align-middle"
                />
              </th>
              <th className="py-3.5 px-3 text-center w-16">No. Absen</th>
              <th className="py-3.5 px-4">Identitas Siswa</th>
              <th className="py-3.5 px-6">NISN / NIS</th>
              <th className="py-3.5 px-6">JK</th>
              <th className="py-3.5 px-6">Kelas</th>
              <th className="py-3.5 px-6 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {sortedAndFilteredSiswa.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                  Tidak ditemukan data siswa yang cocok dengan pencarian / penyaringan.
                </td>
              </tr>
            ) : (
              sortedAndFilteredSiswa.map((s) => {
                const targetKelas = db.kelas.find(k => k.id === s.kelasId);
                const isSelected = selectedSiswaIds.includes(s.id);
                return (
                  <tr key={s.id} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-emerald-50/20' : ''}`}>
                    <td className="py-4 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedSiswaIds(prev => [...prev, s.id]);
                          } else {
                            setSelectedSiswaIds(prev => prev.filter(id => id !== s.id));
                          }
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer align-middle"
                      />
                    </td>
                    <td className="py-4 px-3 text-center">
                      {s.noAbsen !== undefined ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700">
                          {s.noAbsen}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">{s.nama}</div>
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-500 text-[11px] leading-relaxed">
                      <div>NISN: {s.nisn}</div>
                      <div>NIS: {s.nis}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.jenisKelamin === 'L' 
                          ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                          : 'bg-pink-50 text-pink-700 border border-pink-100'
                      }`}>
                        {s.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-medium text-slate-800">
                        {targetKelas ? targetKelas.nama : 'Pindah / Tidak Ada'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-1.5">
                      <button
                        onClick={() => handleStartEdit(s)}
                        disabled={!!isAdding || !!editingId}
                        className="p-1 px-2 text-slate-600 hover:bg-amber-50 hover:text-amber-700 rounded font-semibold text-[11px] transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(s.id)}
                        disabled={!!isAdding || !!editingId}
                        className="p-1 px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700 rounded font-semibold text-[11px] transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-fadeIn">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4 border border-rose-100">
              <Trash2 className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-sans">Hapus Data Siswa</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus data siswa ini? Ini akan membersihkan seluruh catatan nilai dan riwayat absensi bersangkutan secara permanen.
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
                onClick={confirmDelete}
                className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow-md transition duration-150 font-sans"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MASS BULK DELETE CONFIRMATION MODAL */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-fadeIn">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4 border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-sans">Hapus Massal Siswa ({selectedSiswaIds.length})</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus <strong className="text-rose-755 font-bold text-rose-700">{selectedSiswaIds.length} siswa</strong> sekaligus? Semua data nilai dan riwayat absensi mereka akan terhapus secara permanen.
            </p>
            <div className="flex gap-3 w-full mt-6">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition duration-150 font-sans"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow-md transition duration-150 font-sans"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )}

    </div>
  );
}
