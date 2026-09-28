/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SchemaDatabase, TujuanPembelajaran, NilaiSiswa, Siswa, formatTipeUjian } from '../types';
import { 
  Edit3, CheckCircle, Save, Award, RefreshCw, Zap, Printer, X, AlertTriangle, 
  Copy, Users, FileSpreadsheet, Download, Upload, Check, FileText, ArrowRight, Info
} from 'lucide-react';
import { compareKelasNama, parseKelasInfo } from '../utils/kelasOrder';

// Helper function for custom conditional mapping & interpolation
const getInterpolatedValueForColumn = (
  valAsli: number | '',
  allAsliValues: (number | '')[]
): number | '' => {
  if (valAsli === '') return '';
  if (valAsli >= 96) return valAsli;

  const valid = allAsliValues.filter((v): v is number => typeof v === 'number');
  if (valid.length === 0) return valAsli;

  const minVal = Math.min(...valid);
  const maxVal = Math.max(...valid);

  if (maxVal === minVal) {
    return valAsli;
  }

  // If the minimum score entered in the class (per column) is 80 or greater, do not convert/interpolate.
  if (minVal >= 80) {
    return valAsli;
  }

  const result = (((valAsli - minVal) * (95 - 80)) / (maxVal - minVal)) + 80;
  return Math.round(result);
};

interface GuruNilaiProps {
  db: SchemaDatabase;
  guruId: string;
  onUpdate: (updatedDb: SchemaDatabase) => void;
}

export function GuruNilai({ db, guruId, onUpdate }: GuruNilaiProps) {
  const activePeriod = db.periodList.find(p => p.id === db.activePeriodId);
  const getFullTipeUjian = () => {
    const tipe = activePeriod?.tipeUjian;
    if (!tipe) return '';
    switch (tipe) {
      case 'PSTS1': return 'PENILAIAN SUMATIF TENGAH SEMESTER 1';
      case 'PSAS1': return 'PENILAIAN SUMATIF AKHIR SEMESTER 1';
      case 'PSTS2': return 'PENILAIAN SUMATIF TENGAH SEMESTER 2';
      case 'PSAT': return 'PENILAIAN SUMATIF AKHIR TAHUN';
      default: return (tipe as string).toUpperCase();
    }
  };
  const teacher = db.guru.find(g => g.id === guruId);
  const activeTeacher = activePeriod?.snapshotGuru.find(g => g.id === guruId) || teacher;

  const formattedReportDate = new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'});

  // Build assignments list
  const assignments: { key: string; mapelId: string; mapelNama: string; kelasId: string; kelasNama: string }[] = [];

  const mapel1Obj = activePeriod?.snapshotMapel?.find(m => m.id === activeTeacher?.mapel1Id);
  if (mapel1Obj && activePeriod && activeTeacher) {
    const classIds1 = activeTeacher.mapel1KelasIds && activeTeacher.mapel1KelasIds.length > 0
      ? activeTeacher.mapel1KelasIds
      : (activeTeacher.mapel1KelasId ? [activeTeacher.mapel1KelasId] : []);
    
    classIds1.forEach((cid, index) => {
      const kelasObj = activePeriod.snapshotKelas?.find(k => k.id === cid);
      if (kelasObj && activeTeacher.mapel1Id) {
        assignments.push({
          key: `as1_${index}_${cid}`,
          mapelId: activeTeacher.mapel1Id,
          mapelNama: mapel1Obj.nama,
          kelasId: cid,
          kelasNama: kelasObj.nama
        });
      }
    });
  }

  const mapel2Obj = activePeriod?.snapshotMapel?.find(m => m.id === activeTeacher?.mapel2Id);
  if (mapel2Obj && activePeriod && activeTeacher) {
    const classIds2 = activeTeacher.mapel2KelasIds && activeTeacher.mapel2KelasIds.length > 0
      ? activeTeacher.mapel2KelasIds
      : (activeTeacher.mapel2KelasId ? [activeTeacher.mapel2KelasId] : []);
    
    classIds2.forEach((cid, index) => {
      const kelasObj = activePeriod.snapshotKelas?.find(k => k.id === cid);
      if (kelasObj && activeTeacher.mapel2Id) {
        assignments.push({
          key: `as2_${index}_${cid}`,
          mapelId: activeTeacher.mapel2Id,
          mapelNama: mapel2Obj.nama,
          kelasId: cid,
          kelasNama: kelasObj.nama
        });
      }
    });
  }

  const mapel3Obj = activePeriod?.snapshotMapel?.find(m => m.id === activeTeacher?.mapel3Id);
  if (mapel3Obj && activePeriod && activeTeacher) {
    const classIds3 = activeTeacher.mapel3KelasIds && activeTeacher.mapel3KelasIds.length > 0
      ? activeTeacher.mapel3KelasIds
      : (activeTeacher.mapel3KelasId ? [activeTeacher.mapel3KelasId] : []);
    
    classIds3.forEach((cid, index) => {
      const kelasObj = activePeriod.snapshotKelas?.find(k => k.id === cid);
      if (kelasObj && activeTeacher.mapel3Id) {
        assignments.push({
          key: `as3_${index}_${cid}`,
          mapelId: activeTeacher.mapel3Id,
          mapelNama: mapel3Obj.nama,
          kelasId: cid,
          kelasNama: kelasObj.nama
        });
      }
    });
  }

  // Sort assignments strictly from VII A, VII B, VII C ... to IX C
  assignments.sort((a, b) => {
    const classComp = compareKelasNama(a.kelasNama, b.kelasNama);
    if (classComp !== 0) return classComp;
    return a.mapelNama.localeCompare(b.mapelNama);
  });

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [tempIdx, setTempIdx] = useState(0);
  const activeAssignment = assignments[selectedIdx] || assignments[0];

  // Local state representing the grades form grid
  // Keyed by studentId
  interface LocalNilaiSiswa {
    siswaId: string;
    siswaNama: string;
    tp1NilaiAsli: number | '';
    tp1Nilai: number | '';
    tp2NilaiAsli: number | '';
    tp2Nilai: number | '';
    tp3NilaiAsli?: number | '';
    tp3Nilai?: number | '';
    tp4NilaiAsli?: number | '';
    tp4Nilai?: number | '';
    nilaiUjianAsli: number | '';
    nilaiUjian: number | '';
    nilaiPsts?: number | '';
    capaianKompetensi: string;
  }

  interface ParsedBulkRow {
    no?: number;
    nis?: string;
    nama: string;
    tp1NilaiAsli: number | '';
    tp2NilaiAsli: number | '';
    tp3NilaiAsli?: number | '';
    tp4NilaiAsli?: number | '';
    nilaiPsts?: number | '';
    nilaiUjianAsli: number | '';
    capaianKompetensi?: string;
    matchedStudent?: LocalNilaiSiswa;
    status: 'matched' | 'unmatched';
  }

  const [grades, setGrades] = useState<LocalNilaiSiswa[]>([]);
  const [activeTPs, setActiveTPs] = useState<TujuanPembelajaran | null>(null);
  const [message, setMessage] = useState('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Bulk input modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkInputTab, setBulkInputTab] = useState<'upload' | 'paste'>('upload');
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [parsedBulkRows, setParsedBulkRows] = useState<ParsedBulkRow[]>([]);
  const [bulkError, setBulkError] = useState('');
  const [bulkFileName, setBulkFileName] = useState('');

  // Concurrency safeguards: prevent background sync from wiping unsaved teacher input
  const isDirtyRef = React.useRef(false);
  const lastLoadedAssignmentRef = React.useRef<string>('');

  const getJenjang = (kelasNama: string): string => {
    return parseKelasInfo(kelasNama).jenjangStr;
  };

  const activeAssignmentJenjang = activeAssignment ? getJenjang(activeAssignment.kelasNama) : '';

  // Check if peer teacher has already input TP for this same subject & jenjang
  const peerTpForActiveAssignment = (activeAssignment && activePeriod)
    ? db.tujuanPembelajaran.find(t => {
        if (activePeriod.id && t.periodeId && t.periodeId !== activePeriod.id) return false;
        if (t.guruId === guruId) return false;
        
        const isSameMapel = t.mapelId === activeAssignment.mapelId || (() => {
          const m1 = activePeriod.snapshotMapel?.find(m => m.id === t.mapelId) || db.mapel.find(m => m.id === t.mapelId);
          const m2 = activePeriod.snapshotMapel?.find(m => m.id === activeAssignment.mapelId) || db.mapel.find(m => m.id === activeAssignment.mapelId);
          return Boolean(m1 && m2 && m1.nama.trim().toLowerCase() === m2.nama.trim().toLowerCase());
        })();
        if (!isSameMapel) return false;

        const isSameJenjang = t.kelasId === activeAssignmentJenjang || getJenjang(t.kelasId) === activeAssignmentJenjang || (() => {
          const kl = activePeriod.snapshotKelas?.find(k => k.id === t.kelasId) || db.kelas.find(k => k.id === t.kelasId);
          return kl ? getJenjang(kl.nama) === activeAssignmentJenjang : false;
        })();
        return isSameJenjang && Boolean(t.tp1?.trim() || t.tp2?.trim());
      })
    : null;

  const peerTeacherForActiveAssignment = (peerTpForActiveAssignment && activePeriod)
    ? (db.guru.find(g => g.id === peerTpForActiveAssignment.guruId) || activePeriod.snapshotGuru?.find(g => g.id === peerTpForActiveAssignment.guruId))
    : null;

  const handleCopyPeerTpDirect = () => {
    if (!peerTpForActiveAssignment || !activeAssignment || !activePeriod) return;
    const targetJenjang = activeAssignmentJenjang;
    const tpKey = `${activePeriod.id}_${guruId}_${activeAssignment.mapelId}_${targetJenjang}`;
    const newTpEntry: TujuanPembelajaran = {
      id: tpKey,
      periodeId: activePeriod.id,
      guruId: guruId,
      mapelId: activeAssignment.mapelId,
      kelasId: targetJenjang,
      tp1: peerTpForActiveAssignment.tp1,
      tp2: peerTpForActiveAssignment.tp2,
      tp3: peerTpForActiveAssignment.tp3 || undefined,
      tp4: peerTpForActiveAssignment.tp4 || undefined
    };

    const filteredTp = db.tujuanPembelajaran.filter(
      t => !(
        t.periodeId === activePeriod.id &&
        t.guruId === guruId &&
        t.mapelId === activeAssignment.mapelId &&
        (t.kelasId === targetJenjang || t.kelasId === activeAssignment.kelasId)
      )
    );

    const updatedTpList = [...filteredTp, newTpEntry];
    setActiveTPs(newTpEntry);
    onUpdate({
      ...db,
      tujuanPembelajaran: updatedTpList
    });
    setMessage(`Berhasil menyalin & menerapkan Tujuan Pembelajaran dari ${peerTeacherForActiveAssignment?.nama || 'Rekan Sejawat'}!`);
  };

  // Fetch TujuanPembelajaran setting & Populate students currently enrolled
  useEffect(() => {
    if (!activeAssignment || !activePeriod) return;

    const currentAssignmentKey = `${activePeriod.id}_${activeAssignment.key}`;
    const isNewAssignment = lastLoadedAssignmentRef.current !== currentAssignmentKey;

    if (!isNewAssignment && isDirtyRef.current) {
      // User is actively editing this assignment, prevent background realtime sync from overwriting unsaved form data
      return;
    }

    lastLoadedAssignmentRef.current = currentAssignmentKey;
    isDirtyRef.current = false;

    const targetJenjang = getJenjang(activeAssignment.kelasNama);

    // 1. Get TPs defined (by level/jenjang OR specific class ID for legacy)
    const tpRef = db.tujuanPembelajaran.find(
      t => t.periodeId === activePeriod.id &&
           t.guruId === guruId &&
           t.mapelId === activeAssignment.mapelId &&
           (t.kelasId === targetJenjang || t.kelasId === activeAssignment.kelasId)
    );
    setActiveTPs(tpRef || null);

    // 2. Fetch roster of students in this class in the snapshotted period
    const roster = activePeriod.snapshotSiswa
      .filter(s => s.kelasId === activeAssignment.kelasId)
      .sort((a, b) => {
        const noA = a.noAbsen !== undefined && a.noAbsen !== null ? a.noAbsen : 999999;
        const noB = b.noAbsen !== undefined && b.noAbsen !== null ? b.noAbsen : 999999;
        if (noA !== noB) return noA - noB;
        return a.nama.localeCompare(b.nama);
      });

    // 3. For each student, find existing grades in Master Database if any
    const localGrades: LocalNilaiSiswa[] = roster.map(student => {
      const gradeLookupKey = `${activePeriod.id}_${student.id}_${activeAssignment.mapelId}`;
      const existingGrade = db.nilaiSiswa.find(n => n.id === gradeLookupKey);

      // Find PSTS grade if applicable
      let pstsVal: number | '' = '';
      if (activePeriod.tipeUjian === 'PSAS1' || activePeriod.tipeUjian === 'PSAT') {
        const targetTipe = activePeriod.tipeUjian === 'PSAS1' ? 'PSTS1' : 'PSTS2';
        const targetPeriod = db.periodList.find(p => 
          p.tahunAjaran === activePeriod.tahunAjaran && 
          p.semester === activePeriod.semester && 
          p.tipeUjian === targetTipe
        );
        if (targetPeriod) {
          const pstsLookupKey = `${targetPeriod.id}_${student.id}_${activeAssignment.mapelId}`;
          const pstsGradeRecord = db.nilaiSiswa.find(n => n.id === pstsLookupKey);
          if (pstsGradeRecord && typeof pstsGradeRecord.nilaiAkhir === 'number') {
            pstsVal = pstsGradeRecord.nilaiAkhir;
          }
        }
      }

      const tp1Asli = (existingGrade && existingGrade.tp1NilaiAsli !== undefined) ? existingGrade.tp1NilaiAsli : (existingGrade ? existingGrade.tp1Nilai : '');
      const tp2Asli = (existingGrade && existingGrade.tp2NilaiAsli !== undefined) ? existingGrade.tp2NilaiAsli : (existingGrade ? existingGrade.tp2Nilai : '');
      const tp3Asli = (existingGrade && existingGrade.tp3NilaiAsli !== undefined) ? existingGrade.tp3NilaiAsli : ((existingGrade && existingGrade.tp3Nilai !== undefined) ? existingGrade.tp3Nilai : (tpRef?.tp3 ? '' : undefined));
      const tp4Asli = (existingGrade && existingGrade.tp4NilaiAsli !== undefined) ? existingGrade.tp4NilaiAsli : ((existingGrade && existingGrade.tp4Nilai !== undefined) ? existingGrade.tp4Nilai : (tpRef?.tp4 ? '' : undefined));
      const ujianAsli = (existingGrade && existingGrade.nilaiUjianAsli !== undefined) ? existingGrade.nilaiUjianAsli : (existingGrade ? existingGrade.nilaiUjian : '');

      return {
        siswaId: student.id,
        siswaNama: student.nama,
        tp1NilaiAsli: tp1Asli,
        tp1Nilai: existingGrade ? existingGrade.tp1Nilai : '',
        tp2NilaiAsli: tp2Asli,
        tp2Nilai: existingGrade ? existingGrade.tp2Nilai : '',
        tp3NilaiAsli: tp3Asli,
        tp3Nilai: (existingGrade && existingGrade.tp3Nilai !== undefined) ? existingGrade.tp3Nilai : (tpRef?.tp3 ? '' : undefined),
        tp4NilaiAsli: tp4Asli,
        tp4Nilai: (existingGrade && existingGrade.tp4Nilai !== undefined) ? existingGrade.tp4Nilai : (tpRef?.tp4 ? '' : undefined),
        nilaiUjianAsli: ujianAsli,
        nilaiUjian: existingGrade ? existingGrade.nilaiUjian : '',
        nilaiPsts: pstsVal,
        capaianKompetensi: existingGrade?.capaianKompetensi || ''
      };
    });

    const tp1AsliVals = localGrades.map(g => g.tp1NilaiAsli);
    const tp2AsliVals = localGrades.map(g => g.tp2NilaiAsli);
    const tp3AsliVals = localGrades.map(g => g.tp3NilaiAsli !== undefined ? g.tp3NilaiAsli : '');
    const tp4AsliVals = localGrades.map(g => g.tp4NilaiAsli !== undefined ? g.tp4NilaiAsli : '');
    const ujianAsliVals = localGrades.map(g => g.nilaiUjianAsli);

    const withInterpolated = localGrades.map(g => {
      const tp1Nilai = getInterpolatedValueForColumn(g.tp1NilaiAsli, tp1AsliVals);
      const tp2Nilai = getInterpolatedValueForColumn(g.tp2NilaiAsli, tp2AsliVals);
      const tp3Nilai = g.tp3NilaiAsli !== undefined ? getInterpolatedValueForColumn(g.tp3NilaiAsli, tp3AsliVals) : undefined;
      const tp4Nilai = g.tp4NilaiAsli !== undefined ? getInterpolatedValueForColumn(g.tp4NilaiAsli, tp4AsliVals) : undefined;
      const nilaiUjian = getInterpolatedValueForColumn(g.nilaiUjianAsli, ujianAsliVals);

      return {
        ...g,
        tp1Nilai,
        tp2Nilai,
        tp3Nilai,
        tp4Nilai,
        nilaiUjian
      };
    });

    setGrades(withInterpolated);
    setMessage('');
  }, [selectedIdx, activePeriod?.id, guruId, db.nilaiSiswa, db.tujuanPembelajaran]);

  // Helper to recalculate column conversions (interpolations)
  const recalculateGradesWithInterpolation = (baseGrades: LocalNilaiSiswa[]): LocalNilaiSiswa[] => {
    const tp1AsliVals = baseGrades.map(g => g.tp1NilaiAsli);
    const tp2AsliVals = baseGrades.map(g => g.tp2NilaiAsli);
    const tp3AsliVals = baseGrades.map(g => g.tp3NilaiAsli !== undefined ? g.tp3NilaiAsli : '');
    const tp4AsliVals = baseGrades.map(g => g.tp4NilaiAsli !== undefined ? g.tp4NilaiAsli : '');
    const ujianAsliVals = baseGrades.map(g => g.nilaiUjianAsli);

    return baseGrades.map(g => ({
      ...g,
      tp1Nilai: getInterpolatedValueForColumn(g.tp1NilaiAsli, tp1AsliVals),
      tp2Nilai: getInterpolatedValueForColumn(g.tp2NilaiAsli, tp2AsliVals),
      tp3Nilai: g.tp3NilaiAsli !== undefined ? getInterpolatedValueForColumn(g.tp3NilaiAsli, tp3AsliVals) : undefined,
      tp4Nilai: g.tp4NilaiAsli !== undefined ? getInterpolatedValueForColumn(g.tp4NilaiAsli, tp4AsliVals) : undefined,
      nilaiUjian: getInterpolatedValueForColumn(g.nilaiUjianAsli, ujianAsliVals)
    }));
  };

  // Handle individual numeric inputs for original values and trigger reciprocal updates
  const handleNumChange = (studentId: string, field: 'tp1NilaiAsli' | 'tp2NilaiAsli' | 'tp3NilaiAsli' | 'tp4NilaiAsli' | 'nilaiUjianAsli' | 'nilaiPsts', value: string) => {
    isDirtyRef.current = true;
    const rawVal = value === '' ? '' : Math.min(100, Math.max(0, parseInt(value) || 0));
    setGrades(prev => {
      const nextGrades = prev.map(g => {
        if (g.siswaId === studentId) {
          return { ...g, [field]: rawVal };
        }
        return g;
      });
      return recalculateGradesWithInterpolation(nextGrades);
    });
  };

  // ========================================================================
  // BULK IMPORT & TEMPLATE EXCEL / CSV GENERATION
  // ========================================================================

  // Download template CSV tailored specifically to the active class & assignment
  const handleDownloadTemplate = () => {
    if (!activeAssignment || !activePeriod || grades.length === 0) {
      alert("Tidak ada siswa terdaftar dalam kelas ini.");
      return;
    }

    const headers = [
      "No",
      "NIS",
      "Nama Siswa",
      "Nilai Asli TP1",
      "Nilai Asli TP2"
    ];

    if (activeTPs?.tp3) {
      headers.push("Nilai Asli TP3");
    }
    if (activeTPs?.tp4) {
      headers.push("Nilai Asli TP4");
    }
    if (activePeriod.tipeUjian === 'PSAS1' || activePeriod.tipeUjian === 'PSAT') {
      headers.push(activePeriod.tipeUjian === 'PSAS1' ? "Nilai PSTS 1" : "Nilai PSTS 2");
    }
    headers.push("Nilai Asli Ujian");
    headers.push("Capaian Kompetensi (Opsional)");

    const rows = grades.map((g, idx) => {
      const studentObj = activePeriod.snapshotSiswa.find(s => s.id === g.siswaId);
      const nis = studentObj?.nis || "";
      const row = [
        String(idx + 1),
        `"${nis.replace(/"/g, '""')}"`,
        `"${g.siswaNama.replace(/"/g, '""')}"`,
        g.tp1NilaiAsli !== "" ? String(g.tp1NilaiAsli) : "",
        g.tp2NilaiAsli !== "" ? String(g.tp2NilaiAsli) : ""
      ];

      if (activeTPs?.tp3) {
        row.push(g.tp3NilaiAsli !== "" && g.tp3NilaiAsli !== undefined ? String(g.tp3NilaiAsli) : "");
      }
      if (activeTPs?.tp4) {
        row.push(g.tp4NilaiAsli !== "" && g.tp4NilaiAsli !== undefined ? String(g.tp4NilaiAsli) : "");
      }
      if (activePeriod.tipeUjian === 'PSAS1' || activePeriod.tipeUjian === 'PSAT') {
        row.push(g.nilaiPsts !== "" && g.nilaiPsts !== undefined ? String(g.nilaiPsts) : "");
      }
      row.push(g.nilaiUjianAsli !== "" ? String(g.nilaiUjianAsli) : "");
      row.push(`"${(g.capaianKompetensi || "").replace(/"/g, '""')}"`);

      return row.join(",");
    });

    const csvData = [headers.join(","), ...rows].join("\r\n");
    // UTF-8 BOM so Microsoft Excel correctly displays Indonesian characters and UTF-8 formatting
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const cleanKelas = activeAssignment.kelasNama.replace(/[^a-zA-Z0-9]/g, "_");
    const cleanMapel = activeAssignment.mapelNama.replace(/[^a-zA-Z0-9]/g, "_");
    link.download = `template_nilai_${cleanKelas}_${cleanMapel}_${activePeriod.tipeUjian}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper parser for CSV/TSV lines supporting quotes
  const parseCSVLine = (line: string): string[] => {
    if (line.includes('\t')) {
      return line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
    }
    const delimiter = line.includes(';') && !line.includes(',') ? ';' : ',';
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map(c => c.replace(/^"|"$/g, ''));
  };

  // Parse raw text (from file upload or textarea paste) into structured preview rows
  const handleParseBulkData = (rawText: string) => {
    setBulkError('');
    if (!rawText.trim()) {
      setParsedBulkRows([]);
      return;
    }

    const rawLines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (rawLines.length === 0) {
      setParsedBulkRows([]);
      return;
    }

    const firstCols = parseCSVLine(rawLines[0]);
    const lowerFirst = firstCols.map(c => c.toLowerCase());
    const hasHeader = lowerFirst.some(c => 
      c.includes('nis') || c.includes('nama') || c.includes('siswa') || c.includes('tp1') || c.includes('nilai') || c.includes('ujian')
    );

    let startIdx = 0;
    const colIdxMap = {
      nis: -1,
      nama: -1,
      tp1: -1,
      tp2: -1,
      tp3: -1,
      tp4: -1,
      psts: -1,
      ujian: -1,
      capaian: -1
    };

    if (hasHeader) {
      startIdx = 1;
      lowerFirst.forEach((col, idx) => {
        if (col.includes('nis') && !col.includes('nisn')) colIdxMap.nis = idx;
        else if (col.includes('nama') || col.includes('siswa')) colIdxMap.nama = idx;
        else if (col.includes('tp1') || col.includes('tp 1')) colIdxMap.tp1 = idx;
        else if (col.includes('tp2') || col.includes('tp 2')) colIdxMap.tp2 = idx;
        else if (col.includes('tp3') || col.includes('tp 3')) colIdxMap.tp3 = idx;
        else if (col.includes('tp4') || col.includes('tp 4')) colIdxMap.tp4 = idx;
        else if (col.includes('psts') || col.includes('pts')) colIdxMap.psts = idx;
        else if (col.includes('ujian') || col.includes('pas') || col.includes('pat') || col.includes('sas') || col.includes('sat')) colIdxMap.ujian = idx;
        else if (col.includes('capaian') || col.includes('deskripsi')) colIdxMap.capaian = idx;
      });
    }

    // Fallback defaults based on standard template order:
    // [No, NIS, Nama, TP1, TP2, (TP3), (TP4), (PSTS), Ujian, Capaian]
    let currentPos = 3;
    if (colIdxMap.tp1 === -1) colIdxMap.tp1 = currentPos;
    currentPos++;
    if (colIdxMap.tp2 === -1) colIdxMap.tp2 = currentPos;
    currentPos++;
    if (activeTPs?.tp3) {
      if (colIdxMap.tp3 === -1) colIdxMap.tp3 = currentPos;
      currentPos++;
    }
    if (activeTPs?.tp4) {
      if (colIdxMap.tp4 === -1) colIdxMap.tp4 = currentPos;
      currentPos++;
    }
    if (activePeriod?.tipeUjian === 'PSAS1' || activePeriod?.tipeUjian === 'PSAT') {
      if (colIdxMap.psts === -1) colIdxMap.psts = currentPos;
      currentPos++;
    }
    if (colIdxMap.ujian === -1) colIdxMap.ujian = currentPos;
    currentPos++;
    if (colIdxMap.capaian === -1) colIdxMap.capaian = currentPos;

    if (colIdxMap.nis === -1) colIdxMap.nis = 1;
    if (colIdxMap.nama === -1) colIdxMap.nama = 2;

    const parsed: ParsedBulkRow[] = [];

    for (let i = startIdx; i < rawLines.length; i++) {
      const cols = parseCSVLine(rawLines[i]);
      if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

      const rowNis = colIdxMap.nis >= 0 && colIdxMap.nis < cols.length ? cols[colIdxMap.nis].trim() : '';
      const rowNama = colIdxMap.nama >= 0 && colIdxMap.nama < cols.length ? cols[colIdxMap.nama].trim() : '';

      const parseNum = (idx: number): number | '' => {
        if (idx < 0 || idx >= cols.length) return '';
        const raw = cols[idx].trim().replace(',', '.');
        if (raw === '' || isNaN(Number(raw))) return '';
        const val = parseInt(raw, 10);
        return Math.min(100, Math.max(0, val));
      };

      const tp1 = parseNum(colIdxMap.tp1);
      const tp2 = parseNum(colIdxMap.tp2);
      const tp3 = activeTPs?.tp3 ? parseNum(colIdxMap.tp3) : undefined;
      const tp4 = activeTPs?.tp4 ? parseNum(colIdxMap.tp4) : undefined;
      const psts = (activePeriod?.tipeUjian === 'PSAS1' || activePeriod?.tipeUjian === 'PSAT') ? parseNum(colIdxMap.psts) : undefined;
      const ujian = parseNum(colIdxMap.ujian);
      const capaian = colIdxMap.capaian >= 0 && colIdxMap.capaian < cols.length ? cols[colIdxMap.capaian].trim() : '';

      let matchedStudent: LocalNilaiSiswa | undefined;

      // 1. Match by NIS
      if (rowNis) {
        const sObj = activePeriod?.snapshotSiswa.find(s => s.kelasId === activeAssignment?.kelasId && s.nis && s.nis.trim() === rowNis);
        if (sObj) {
          matchedStudent = grades.find(g => g.siswaId === sObj.id);
        }
      }

      // 2. Match by Nama Siswa
      if (!matchedStudent && rowNama) {
        const cleanRowNama = rowNama.toLowerCase().trim();
        matchedStudent = grades.find(g => g.siswaNama.toLowerCase().trim() === cleanRowNama);
        if (!matchedStudent) {
          matchedStudent = grades.find(g => g.siswaNama.toLowerCase().includes(cleanRowNama) || cleanRowNama.includes(g.siswaNama.toLowerCase()));
        }
      }

      // 3. Fallback matching by row index if count lines align
      const dataIndex = i - startIdx;
      if (!matchedStudent && dataIndex >= 0 && dataIndex < grades.length && !rowNis && !rowNama) {
        matchedStudent = grades[dataIndex];
      }

      parsed.push({
        no: dataIndex + 1,
        nis: rowNis || (matchedStudent ? activePeriod?.snapshotSiswa.find(s => s.id === matchedStudent?.siswaId)?.nis : ''),
        nama: rowNama || matchedStudent?.siswaNama || `Baris ${i + 1}`,
        tp1NilaiAsli: tp1,
        tp2NilaiAsli: tp2,
        tp3NilaiAsli: tp3,
        tp4NilaiAsli: tp4,
        nilaiPsts: psts,
        nilaiUjianAsli: ujian,
        capaianKompetensi: capaian,
        matchedStudent,
        status: matchedStudent ? 'matched' : 'unmatched'
      });
    }

    if (parsed.length === 0) {
      setBulkError("Tidak ada baris data yang dapat dibaca. Pastikan format kolom sesuai.");
    } else {
      const matchCount = parsed.filter(p => p.status === 'matched').length;
      if (matchCount === 0) {
        setBulkError("Data terbaca, namun tidak ada siswa yang cocok dengan kelas aktif. Pastikan NIS atau Nama Siswa sesuai dengan data kelas ini.");
      }
    }

    setParsedBulkRows(parsed);
  };

  // Handle file input upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        handleParseBulkData(text);
      }
    };
    reader.onerror = () => {
      setBulkError("Gagal membaca file. Pastikan file berformat .csv atau teks spreadsheet yang valid.");
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Apply parsed bulk rows to current active grades table
  const handleApplyBulkGrades = () => {
    const matched = parsedBulkRows.filter(r => r.status === 'matched' && r.matchedStudent);
    if (matched.length === 0) {
      alert("Tidak ada data siswa yang cocok untuk diterapkan.");
      return;
    }

    isDirtyRef.current = true;
    setGrades(prev => {
      const updated = prev.map(currentStudent => {
        const found = matched.find(r => r.matchedStudent?.siswaId === currentStudent.siswaId);
        if (!found) return currentStudent;

        return {
          ...currentStudent,
          tp1NilaiAsli: found.tp1NilaiAsli !== '' ? found.tp1NilaiAsli : currentStudent.tp1NilaiAsli,
          tp2NilaiAsli: found.tp2NilaiAsli !== '' ? found.tp2NilaiAsli : currentStudent.tp2NilaiAsli,
          tp3NilaiAsli: (activeTPs?.tp3 && found.tp3NilaiAsli !== '' && found.tp3NilaiAsli !== undefined) ? found.tp3NilaiAsli : currentStudent.tp3NilaiAsli,
          tp4NilaiAsli: (activeTPs?.tp4 && found.tp4NilaiAsli !== '' && found.tp4NilaiAsli !== undefined) ? found.tp4NilaiAsli : currentStudent.tp4NilaiAsli,
          nilaiPsts: (found.nilaiPsts !== '' && found.nilaiPsts !== undefined) ? found.nilaiPsts : currentStudent.nilaiPsts,
          nilaiUjianAsli: found.nilaiUjianAsli !== '' ? found.nilaiUjianAsli : currentStudent.nilaiUjianAsli,
          capaianKompetensi: found.capaianKompetensi?.trim() ? found.capaianKompetensi : currentStudent.capaianKompetensi
        };
      });

      return recalculateGradesWithInterpolation(updated);
    });

    setIsBulkModalOpen(false);
    setMessage(`Berhasil memuat nilai massal untuk ${matched.length} siswa ke formulir! Silakan periksa kembali nilai dan klik tombol "Simpan Semua Nilai" di pojok kanan atas untuk menyimpan ke database.`);
  };

  // Handle description change
  const handleDescChange = (studentId: string, value: string) => {
    isDirtyRef.current = true;
    setGrades(prev => prev.map(g => {
      if (g.siswaId === studentId) {
        return { ...g, capaianKompetensi: value };
      }
      return g;
    }));
  };

  // Helper calculation for display
  const calculateNilaiAkhirLocal = (g: LocalNilaiSiswa) => {
    const tp1 = g.tp1Nilai === '' ? 0 : g.tp1Nilai;
    const tp2 = g.tp2Nilai === '' ? 0 : g.tp2Nilai;
    let sumTP = tp1 + tp2;
    let countTP = 2;
    if (g.tp3Nilai !== undefined && g.tp3Nilai !== '' && activeTPs?.tp3) {
      sumTP += g.tp3Nilai;
      countTP++;
    }
    if (g.tp4Nilai !== undefined && g.tp4Nilai !== '' && activeTPs?.tp4) {
      sumTP += g.tp4Nilai;
      countTP++;
    }
    const avgTP = sumTP / countTP;
    const ujian = g.nilaiUjian === '' ? 0 : g.nilaiUjian;

    if (activePeriod.tipeUjian === 'PSAS1' || activePeriod.tipeUjian === 'PSAT') {
      if (typeof g.nilaiPsts === 'number') {
        return Math.round((avgTP + ujian + g.nilaiPsts) / 3);
      }
    }

    return Math.round((avgTP + ujian) / 2);
  };

  const getAvgTP = (g: LocalNilaiSiswa) => {
    const tp1 = g.tp1Nilai === '' ? 0 : g.tp1Nilai;
    const tp2 = g.tp2Nilai === '' ? 0 : g.tp2Nilai;
    let sumTP = tp1 + tp2;
    let countTP = 2;
    if (g.tp3Nilai !== undefined && g.tp3Nilai !== '' && activeTPs?.tp3) {
      sumTP += g.tp3Nilai;
      countTP++;
    }
    if (g.tp4Nilai !== undefined && g.tp4Nilai !== '' && activeTPs?.tp4) {
      sumTP += g.tp4Nilai;
      countTP++;
    }
    return Math.round((sumTP / countTP) * 10) / 10;
  };

  const getDuplicateTPFields = (g: LocalNilaiSiswa) => {
    const activeItems: { key: 'tp1' | 'tp2' | 'tp3' | 'tp4'; val: number | '' }[] = [
      { key: 'tp1', val: g.tp1NilaiAsli },
      { key: 'tp2', val: g.tp2NilaiAsli }
    ];
    if (g.tp3NilaiAsli !== undefined && activeTPs?.tp3) {
      activeItems.push({ key: 'tp3', val: g.tp3NilaiAsli });
    }
    if (g.tp4NilaiAsli !== undefined && activeTPs?.tp4) {
      activeItems.push({ key: 'tp4', val: g.tp4NilaiAsli });
    }

    const filled = activeItems.filter(item => item.val !== '' && item.val !== undefined && typeof item.val === 'number');

    const counts: Record<number, number> = {};
    filled.forEach(item => {
      const num = Number(item.val);
      counts[num] = (counts[num] || 0) + 1;
    });

    const duplicates = new Set<'tp1' | 'tp2' | 'tp3' | 'tp4'>();
    filled.forEach(item => {
      const num = Number(item.val);
      if (counts[num] > 1) {
        duplicates.add(item.key);
      }
    });

    return duplicates;
  };

  // Helper untuk menentukan deskripsi capaian kompetensi strictly berdasarkan Nilai Asli TP (Kurikulum Merdeka)
  const generateDescFromAsli = (record: LocalNilaiSiswa): string => {
    if (!activeTPs) return '';

    const activeScores: { label: string; score: number }[] = [];

    if (record.tp1NilaiAsli !== '' && typeof record.tp1NilaiAsli === 'number' && activeTPs.tp1) {
      activeScores.push({ label: activeTPs.tp1, score: record.tp1NilaiAsli });
    }
    if (record.tp2NilaiAsli !== '' && typeof record.tp2NilaiAsli === 'number' && activeTPs.tp2) {
      activeScores.push({ label: activeTPs.tp2, score: record.tp2NilaiAsli });
    }
    if (record.tp3NilaiAsli !== undefined && record.tp3NilaiAsli !== '' && typeof record.tp3NilaiAsli === 'number' && activeTPs.tp3) {
      activeScores.push({ label: activeTPs.tp3, score: record.tp3NilaiAsli });
    }
    if (record.tp4NilaiAsli !== undefined && record.tp4NilaiAsli !== '' && typeof record.tp4NilaiAsli === 'number' && activeTPs.tp4) {
      activeScores.push({ label: activeTPs.tp4, score: record.tp4NilaiAsli });
    }

    if (activeScores.length === 0) return '';

    // Sort descending berdasarkan Nilai Asli TP untuk mencari capaian tertinggi dan terendah
    const sorted = [...activeScores].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    const weakest = sorted[sorted.length - 1];

    let desc = '';
    if (best.score >= 80) {
      desc += `Menunjukkan penguasaan sangat baik dalam ${best.label.toLowerCase()}.`;
    } else {
      desc += `Menunjukkan penguasaan yang cukup baik dalam hal ${best.label.toLowerCase()}.`;
    }

    if (best !== weakest && best.label !== weakest.label && weakest.score < best.score) {
      desc += ` Serta perlu bimbingan dalam ${weakest.label.toLowerCase()}.`;
    }

    return desc;
  };

  // Alias for backward compatibility
  const generateDescFromKonversi = generateDescFromAsli;

  // Auto Generate Deskripsi satuan berdasarkan Nilai Asli TP
  const handleAutoGenerateDesc = (studentId: string) => {
    const record = grades.find(g => g.siswaId === studentId);
    if (!record || !activeTPs) return;

    const desc = generateDescFromAsli(record);
    if (!desc) {
      alert("Harap isi nilai asli TP terlebih dahulu untuk men-generate deskripsi capaian.");
      return;
    }

    isDirtyRef.current = true;
    setGrades(prev => prev.map(g => {
      if (g.siswaId === studentId) {
        return { ...g, capaianKompetensi: desc };
      }
      return g;
    }));
  };

  // Auto Generate Deskripsi untuk seluruh siswa sekaligus berdasarkan Nilai Asli TP
  const handleAutoGenerateAllDesc = () => {
    if (!activeTPs) return;
    let count = 0;
    isDirtyRef.current = true;
    setGrades(prev => prev.map(g => {
      const desc = generateDescFromAsli(g);
      if (desc) count++;
      return {
        ...g,
        capaianKompetensi: desc || g.capaianKompetensi
      };
    }));
    setMessage(`Berhasil men-generate ${count} deskripsi capaian kompetensi siswa berdasarkan Nilai Asli TP!`);
  };

  const handleSaveAll = () => {
    if (!activeAssignment) return;

    // Check if any student has duplicate Nilai Asli TP values
    const duplicateList: string[] = [];
    for (const g of grades) {
      if (getDuplicateTPFields(g).size > 0) {
        duplicateList.push(g.siswaNama);
      }
    }

    if (duplicateList.length > 0) {
      alert(`Gagal Menyimpan!\n\nSiswa berikut memiliki Nilai Asli TP yang sama/duplikat:\n${duplicateList.map(name => `• ${name}`).join('\n')}\n\nKetentuan Kurikulum: Tiap siswa tidak boleh memiliki Nilai Asli TP yang sama. Sila sesuaikan Nilai Asli TP agar tidak sama/duplikat sebelum menyimpan.`);
      setMessage("Gagal menyimpan: Terdeteksi Nilai Asli TP sama/duplikat pada siswa!");
      return;
    }

    // Convert local grades to the schema's NilaiSiswa structures
    const updatedEntries: NilaiSiswa[] = grades.map(g => {
      const dbKey = `${activePeriod.id}_${g.siswaId}_${activeAssignment.mapelId}`;
      const finalVal = calculateNilaiAkhirLocal(g);
      const descVal = g.capaianKompetensi.trim() || generateDescFromAsli(g);
      
      return {
        id: dbKey,
        periodeId: activePeriod.id,
        siswaId: g.siswaId,
        mapelId: activeAssignment.mapelId,
        guruId: guruId,
        tp1NilaiAsli: g.tp1NilaiAsli === '' ? 0 : g.tp1NilaiAsli,
        tp1Nilai: g.tp1Nilai === '' ? 0 : g.tp1Nilai,
        tp2NilaiAsli: g.tp2NilaiAsli === '' ? 0 : g.tp2NilaiAsli,
        tp2Nilai: g.tp2Nilai === '' ? 0 : g.tp2Nilai,
        tp3NilaiAsli: g.tp3NilaiAsli === '' || g.tp3NilaiAsli === undefined ? undefined : g.tp3NilaiAsli,
        tp3Nilai: g.tp3Nilai === '' || g.tp3Nilai === undefined ? undefined : g.tp3Nilai,
        tp4NilaiAsli: g.tp4NilaiAsli === '' || g.tp4NilaiAsli === undefined ? undefined : g.tp4NilaiAsli,
        tp4Nilai: g.tp4Nilai === '' || g.tp4Nilai === undefined ? undefined : g.tp4Nilai,
        nilaiUjianAsli: g.nilaiUjianAsli === '' ? 0 : g.nilaiUjianAsli,
        nilaiUjian: g.nilaiUjian === '' ? 0 : g.nilaiUjian,
        nilaiAkhir: finalVal,
        capaianKompetensi: descVal
      };
    });

    // Also prepare database records for PSTS periods if user modified them
    let mergedPstsList: NilaiSiswa[] = [];
    if (activePeriod.tipeUjian === 'PSAS1' || activePeriod.tipeUjian === 'PSAT') {
      const targetTipe = activePeriod.tipeUjian === 'PSAS1' ? 'PSTS1' : 'PSTS2';
      const targetPeriod = db.periodList.find(p => 
        p.tahunAjaran === activePeriod.tahunAjaran && 
        p.semester === activePeriod.semester && 
        p.tipeUjian === targetTipe
      );
      if (targetPeriod) {
        grades.forEach(g => {
          if (typeof g.nilaiPsts === 'number') {
            const pstsKey = `${targetPeriod.id}_${g.siswaId}_${activeAssignment.mapelId}`;
            const existingPsts = db.nilaiSiswa.find(n => n.id === pstsKey);
            
            const basePsts: NilaiSiswa = existingPsts ? {
              ...existingPsts,
              nilaiAkhir: g.nilaiPsts,
              nilaiUjian: existingPsts.nilaiUjian === 0 ? g.nilaiPsts : existingPsts.nilaiUjian
            } : {
              id: pstsKey,
              periodeId: targetPeriod.id,
              siswaId: g.siswaId,
              mapelId: activeAssignment.mapelId,
              guruId: guruId,
              tp1Nilai: 0,
              tp2Nilai: 0,
              nilaiUjian: g.nilaiPsts,
              nilaiAkhir: g.nilaiPsts,
              capaianKompetensi: 'Telah mengikuti penilaian tengah semester dengan baik.'
            };
            
            mergedPstsList.push(basePsts);
          }
        });
      }
    }

    // Merge into db
    const updatedKeys = updatedEntries.map(e => e.id);
    const pstsKeys = mergedPstsList.map(e => e.id);
    
    const filteredMasterNilai = db.nilaiSiswa.filter(master => 
      !updatedKeys.includes(master.id) && !pstsKeys.includes(master.id)
    );
    const mergedNilaiList = [...filteredMasterNilai, ...updatedEntries, ...mergedPstsList];

    onUpdate({
      ...db,
      nilaiSiswa: mergedNilaiList
    });

    isDirtyRef.current = false;
    setMessage("Semua nilai siswa (termasuk kelengkapan Rerata PSTS) BERHASIL disimpan ke database master!");
  };

  // Calculation of summary statistics
  const getSummaryStats = () => {
    const metrics: {
      id: string;
      label: string;
      fieldAsli: 'tp1NilaiAsli' | 'tp2NilaiAsli' | 'tp3NilaiAsli' | 'tp4NilaiAsli' | 'nilaiUjianAsli';
      fieldKatrol: 'tp1Nilai' | 'tp2Nilai' | 'tp3Nilai' | 'tp4Nilai' | 'nilaiUjian';
      isActive: boolean;
    }[] = [
      { id: 'tp1', label: 'TP 1', fieldAsli: 'tp1NilaiAsli', fieldKatrol: 'tp1Nilai', isActive: true },
      { id: 'tp2', label: 'TP 2', fieldAsli: 'tp2NilaiAsli', fieldKatrol: 'tp2Nilai', isActive: true },
      { id: 'tp3', label: 'TP 3', fieldAsli: 'tp3NilaiAsli', fieldKatrol: 'tp3Nilai', isActive: !!(activeTPs?.tp3) },
      { id: 'tp4', label: 'TP 4', fieldAsli: 'tp4NilaiAsli', fieldKatrol: 'tp4Nilai', isActive: !!(activeTPs?.tp4) },
      { id: 'ujian', label: 'Nilai Ujian', fieldAsli: 'nilaiUjianAsli', fieldKatrol: 'nilaiUjian', isActive: true },
    ];

    const results = metrics.filter(m => m.isActive).map(m => {
      const validSubList = grades.filter(g => typeof g[m.fieldAsli] === 'number' && g[m.fieldAsli] !== '');
      
      let avgAsli = '-';
      let avgKatrol = '-';
      let minInfo: { val: number; valKatrol: number | '-'; students: string[] } | null = null;
      let maxInfo: { val: number; valKatrol: number | '-'; students: string[] } | null = null;

      if (validSubList.length > 0) {
        const sumAsli = validSubList.reduce((sum, g) => sum + (g[m.fieldAsli] as number), 0);
        avgAsli = (sumAsli / validSubList.length).toFixed(1);

        const sumKatrol = validSubList.reduce((sum, g) => {
          const kVal = g[m.fieldKatrol];
          return sum + (typeof kVal === 'number' ? kVal : 0);
        }, 0);
        avgKatrol = (sumKatrol / validSubList.length).toFixed(1);

        const asliVals = validSubList.map(g => g[m.fieldAsli] as number);
        const minVal = Math.min(...asliVals);
        const maxVal = Math.max(...asliVals);

        const minSts = validSubList.filter(g => g[m.fieldAsli] === minVal).map(g => g.siswaNama);
        const maxSts = validSubList.filter(g => g[m.fieldAsli] === maxVal).map(g => g.siswaNama);

        const minRowFirst = validSubList.find(g => g[m.fieldAsli] === minVal);
        const maxRowFirst = validSubList.find(g => g[m.fieldAsli] === maxVal);
        
        let minKatrolVal: number | '-' = '-';
        let maxKatrolVal: number | '-' = '-';
        if (minRowFirst && typeof minRowFirst[m.fieldKatrol] === 'number') {
          minKatrolVal = minRowFirst[m.fieldKatrol] as number;
        }
        if (maxRowFirst && typeof maxRowFirst[m.fieldKatrol] === 'number') {
          maxKatrolVal = maxRowFirst[m.fieldKatrol] as number;
        }

        minInfo = { val: minVal, valKatrol: minKatrolVal, students: minSts };
        maxInfo = { val: maxVal, valKatrol: maxKatrolVal, students: maxSts };
      }

      return {
        ...m,
        avgAsli,
        avgKatrol,
        min: minInfo,
        max: maxInfo
      };
    });

    let avgAkhir = '-';
    let minAkhirInfo: { val: number; students: string[] } | null = null;
    let maxAkhirInfo: { val: number; students: string[] } | null = null;

    if (grades.length > 0) {
      const akhirVals = grades.map(g => calculateNilaiAkhirLocal(g));
      const sumAkhir = akhirVals.reduce((sum, val) => sum + val, 0);
      avgAkhir = (sumAkhir / grades.length).toFixed(1);

      const minVal = Math.min(...akhirVals);
      const maxVal = Math.max(...akhirVals);

      const minSts = grades.filter(g => calculateNilaiAkhirLocal(g) === minVal).map(g => g.siswaNama);
      const maxSts = grades.filter(g => calculateNilaiAkhirLocal(g) === maxVal).map(g => g.siswaNama);

      minAkhirInfo = { val: minVal, students: minSts };
      maxAkhirInfo = { val: maxVal, students: maxSts };
    }

    return {
      metrics: results,
      akhir: {
        avg: avgAkhir,
        min: minAkhirInfo,
        max: maxAkhirInfo
      }
    };
  };

  if (!activePeriod) {
    return (
      <div className="p-8 text-center bg-amber-50 rounded-2xl border border-amber-200 text-amber-900">
        <h3 className="text-sm font-bold">Periode Akademik Aktif Belum Dirilis oleh Admin</h3>
        <p className="text-xs text-slate-500 mt-1">Lembaga Administrasi Akademik harus merilis Tahun Ajaran sebelum Guru dapat melakukan entri Nilai.</p>
      </div>
    );
  }

  if (!activeTeacher) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
        Profil Pengajar tidak terdeteksi dalam database rilis ini.
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="p-8 text-center bg-amber-50 rounded-2xl text-slate-500">
        Anda belum mengampu pengajaran apapun di semester ini.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-emerald-600" />
            Buku Nilai & Capaian (Sikap/Matriks)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Input Nilai Kertas Kerja TP & Ujian Sumatif Raport Akhis Semester SMP Al Irsyad Surakarta.
          </p>
        </div>
        {activeTPs && grades.length > 0 && (
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-center flex-wrap">
            <button
              onClick={() => {
                setIsBulkModalOpen(true);
                setBulkError('');
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all justify-center cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Input Nilai Massal
            </button>
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all justify-center cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Rekap Kelas
            </button>
            <button
              onClick={handleSaveAll}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all justify-center cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Simpan Semua Nilai
            </button>
          </div>
        )}
      </div>

      {/* Selector Assignment Dropdown with Tampilkan button */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-end gap-3 max-w-xl shadow-3xs">
        <div className="flex-1 w-full space-y-1.5">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            PILIH MATA PELAJARAN & KELAS
          </label>
          <select
            value={tempIdx}
            onChange={(e) => setTempIdx(parseInt(e.target.value) || 0)}
            className="w-full text-xs font-semibold py-2 px-3 bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded-xl text-slate-800 shadow-3xs"
          >
            {assignments.map((as, idx) => (
              <option key={as.key} value={idx}>
                {as.mapelNama} — Kelas {as.kelasNama}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            isDirtyRef.current = false;
            setSelectedIdx(tempIdx);
          }}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md active:scale-95 transition-all w-full sm:w-auto shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Tampilkan
        </button>
      </div>

      {/* Menu Input Nilai Massal & Download Template Sesuai Kelas Aktif */}
      {activeTPs && grades.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-sky-50/60 p-4 sm:p-5 rounded-2xl border border-emerald-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-3xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-sm shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                  Input Nilai Massal — Kelas {activeAssignment.kelasNama}
                </h4>
                <span className="text-[10px] bg-emerald-100/90 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                  {grades.length} Siswa Terdaftar
                </span>
                <span className="text-[10px] bg-sky-100 text-sky-800 border border-sky-300 px-2 py-0.5 rounded-full font-bold">
                  Mapel: {activeAssignment.mapelNama}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Unduh template Excel/CSV yang otomatis memuat nama & NIS siswa <strong>Kelas {activeAssignment.kelasNama}</strong>, atau tempel (*copy-paste*) nilai dari spreadsheet untuk input sekaligus tanpa repot mengetik satu per satu.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 self-stretch md:self-auto shrink-0 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-50 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
              title={`Download template Excel/CSV sesuai data Kelas ${activeAssignment.kelasNama}`}
            >
              <Download className="w-4 h-4 text-emerald-600" />
              Download Template Kelas
            </button>
            <button
              type="button"
              onClick={() => {
                setIsBulkModalOpen(true);
                setBulkError('');
              }}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Input Nilai Massal
            </button>
          </div>
        </div>
      )}

      {!activeTPs ? (
        <div className="p-6 text-center bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 space-y-3">
          <h3 className="text-sm font-bold">Harap Input Tujuan Pembelajaran (TP) Terlebih Dahulu</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Sebelum memasukkan nilai siswa untuk subjek <strong>{activeAssignment?.mapelNama} ({activeAssignment?.kelasNama})</strong>, Anda diwajibkan menyusun Tujuan Pembelajaran kurikulum di menu <b>Tujuan Pembelajaran</b> terlebih dahulu.
          </p>

          {/* If peer teacher has already input TP for this same subject & jenjang */}
          {peerTpForActiveAssignment && (
            <div className="pt-2 flex flex-col items-center gap-2">
              <div className="inline-flex items-center gap-2 bg-blue-100/70 border border-blue-200 text-blue-900 px-3 py-1.5 rounded-xl text-xs font-semibold">
                <Users className="w-3.5 h-3.5 text-blue-700" />
                <span>Rekan sejawat <strong>{peerTeacherForActiveAssignment?.nama || 'Rekan Sejawat'}</strong> telah menyusun TP untuk Jenjang {activeAssignmentJenjang}.</span>
              </div>
              <button
                type="button"
                id="btn-salin-tp-rekan-nilai"
                onClick={handleCopyPeerTpDirect}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 shadow-sm hover:shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                Salin / Gunakan TP Rekan Sejawat ({peerTeacherForActiveAssignment?.nama || 'Rekan Sejawat'})
              </button>
            </div>
          )}
        </div>
      ) : grades.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl text-slate-400 font-sans italic">
          Tidak ada siswa terdaftar dalam kelas {activeAssignment.kelasNama} di snapshot periode ini. Hubungi Admin.
        </div>
      ) : (
        <div className="space-y-4">
          
          {message && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-250 text-xs font-semibold rounded-xl flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              {message}
            </div>
          )}

          {/* Quick Info Box about current TPs */}
          <div className="bg-emerald-50/30 p-4 border border-emerald-100/40 rounded-xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider">Tujuan Pembelajaran Terdefinisi:</h4>
              {peerTpForActiveAssignment && (
                <button
                  type="button"
                  onClick={handleCopyPeerTpDirect}
                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800 border border-blue-200 text-[10px] font-bold rounded-lg flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  title="Sinkronkan atau salin ulang TP rekan sejawat"
                >
                  <Copy className="w-3 h-3 text-blue-600" />
                  Salin / Sinkronkan TP Rekan ({peerTeacherForActiveAssignment?.nama})
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-emerald-900 leading-relaxed font-sans font-medium">
              <div>• <strong>TP 1:</strong> {activeTPs.tp1}</div>
              <div>• <strong>TP 2:</strong> {activeTPs.tp2}</div>
              {activeTPs.tp3 && <div>• <strong>TP 3:</strong> {activeTPs.tp3}</div>}
              {activeTPs.tp4 && <div>• <strong>TP 4:</strong> {activeTPs.tp4}</div>}
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-emerald-100/50 text-[10px] text-slate-600 font-sans">
              <span className="font-bold text-emerald-800 shrink-0">Ketentuan Raport:</span>
              <span>Nilai <strong>Asli TP</strong> tiap siswa tidak boleh sama. Penentuan deskripsi capaian otomatis dihitung berdasarkan capaian <strong>Nilai Asli TP</strong> tertinggi dan terendah.</span>
            </div>
          </div>

          {/* Grid List for Students Grade Entry */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[9px] font-bold tracking-wider uppercase">
                    <th className="py-3 px-4 w-[16%]">Nama Siswa</th>
                    
                    <th className="py-3 px-1 text-center w-12 font-mono text-amber-900 bg-amber-50/40">Asli TP1</th>
                    <th className="py-3 px-1 text-center w-12 font-mono text-emerald-900 bg-emerald-50/30">Nilai TP1</th>
                    
                    <th className="py-3 px-1 text-center w-12 font-mono text-amber-900 bg-amber-50/40">Asli TP2</th>
                    <th className="py-3 px-1 text-center w-12 font-mono text-emerald-900 bg-emerald-50/30">Nilai TP2</th>
                    
                    {activeTPs.tp3 && (
                      <>
                        <th className="py-3 px-1 text-center w-12 font-mono text-amber-900 bg-amber-50/40">Asli TP3</th>
                        <th className="py-3 px-1 text-center w-12 font-mono text-emerald-900 bg-emerald-50/30">Nilai TP3</th>
                      </>
                    )}
                    {activeTPs.tp4 && (
                      <>
                        <th className="py-3 px-1 text-center w-12 font-mono text-amber-900 bg-amber-50/40">Asli TP4</th>
                        <th className="py-3 px-1 text-center w-12 font-mono text-emerald-900 bg-emerald-50/30">Nilai TP4</th>
                      </>
                    )}
                    {(activePeriod.tipeUjian === 'PSAS1' || activePeriod.tipeUjian === 'PSAT') && (
                      <th className="py-3 px-2 text-center w-16 font-mono text-emerald-850 bg-emerald-50/45 border-x border-emerald-100/30">
                        {activePeriod.tipeUjian === 'PSAS1' ? 'Nilai PSTS 1' : 'Nilai PSTS 2'}
                      </th>
                    )}
                    <th className="py-3 px-1 text-center w-12 font-mono text-amber-900 bg-amber-50/40">Asli Ujian</th>
                    <th className="py-3 px-1 text-center w-12 font-mono text-emerald-900 bg-emerald-50/30">Nilai Ujian</th>
                    <th className="py-3 px-2 text-center w-12 font-semibold text-emerald-700">Nilai Akhir</th>
                    <th className="py-3 px-4 w-[30%]">
                      <div className="flex items-center justify-between gap-2">
                        <span>Deskripsi Capaian (Kurikulum Merdeka)</span>
                        <button
                          type="button"
                          onClick={handleAutoGenerateAllDesc}
                          title="Generate otomatis seluruh deskripsi siswa berdasarkan Nilai Asli TP"
                          className="normal-case text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md px-2 py-0.5 flex items-center gap-1 font-bold shadow-2xs transition-all cursor-pointer"
                        >
                          <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                          Generate Semua
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {grades.map((g, idx) => {
                    const finalGrade = calculateNilaiAkhirLocal(g);
                    const dups = getDuplicateTPFields(g);
                    return (
                      <tr key={g.siswaId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 text-xs">{g.siswaNama}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex flex-col items-start gap-1">
                            <span>NIS: {activePeriod.snapshotSiswa.find(s => s.id === g.siswaId)?.nis || '-'}</span>
                            {dups.size > 0 && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded animate-pulse">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Nilai Asli TP Duplikat
                              </span>
                            )}
                          </div>
                        </td>
                        
                        {/* TP 1 */}
                        <td className="py-3 px-1 text-center bg-amber-50/5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={g.tp1NilaiAsli}
                            onChange={e => handleNumChange(g.siswaId, 'tp1NilaiAsli', e.target.value)}
                            placeholder="0"
                            title={dups.has('tp1') ? `Nilai Asli TP-1 (${g.tp1NilaiAsli}) sama/duplikat dengan TP lain! Ubah nilai asli agar nilai tiap TP berbeda.` : undefined}
                            className={`w-11 text-center py-1 rounded text-xs focus:outline-none focus:ring-1 ${
                              dups.has('tp1')
                                ? 'border-2 border-rose-500 bg-rose-50 text-rose-900 font-bold focus:ring-rose-500 shadow-xs'
                                : 'bg-white border border-amber-200 focus:ring-amber-500 text-slate-800'
                            }`}
                          />
                        </td>
                        <td 
                          className="py-3 px-1 text-center font-mono font-bold text-xs text-emerald-800 bg-emerald-50/10"
                        >
                          {g.tp1Nilai === '' ? '-' : g.tp1Nilai}
                        </td>

                        {/* TP 2 */}
                        <td className="py-3 px-1 text-center bg-amber-50/5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={g.tp2NilaiAsli}
                            onChange={e => handleNumChange(g.siswaId, 'tp2NilaiAsli', e.target.value)}
                            placeholder="0"
                            title={dups.has('tp2') ? `Nilai Asli TP-2 (${g.tp2NilaiAsli}) sama/duplikat dengan TP lain! Ubah nilai asli agar nilai tiap TP berbeda.` : undefined}
                            className={`w-11 text-center py-1 rounded text-xs focus:outline-none focus:ring-1 ${
                              dups.has('tp2')
                                ? 'border-2 border-rose-500 bg-rose-50 text-rose-900 font-bold focus:ring-rose-500 shadow-xs'
                                : 'bg-white border border-amber-200 focus:ring-amber-500 text-slate-800'
                            }`}
                          />
                        </td>
                        <td 
                          className="py-3 px-1 text-center font-mono font-bold text-xs text-emerald-800 bg-emerald-50/10"
                        >
                          {g.tp2Nilai === '' ? '-' : g.tp2Nilai}
                        </td>

                        {/* TP 3 if exists */}
                        {activeTPs.tp3 && (
                          <>
                            <td className="py-3 px-1 text-center bg-amber-50/5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={g.tp3NilaiAsli ?? ''}
                                onChange={e => handleNumChange(g.siswaId, 'tp3NilaiAsli', e.target.value)}
                                placeholder="0"
                                title={dups.has('tp3') ? `Nilai Asli TP-3 (${g.tp3NilaiAsli}) sama/duplikat dengan TP lain! Ubah nilai asli agar nilai tiap TP berbeda.` : undefined}
                                className={`w-11 text-center py-1 rounded text-xs focus:outline-none focus:ring-1 ${
                                  dups.has('tp3')
                                    ? 'border-2 border-rose-500 bg-rose-50 text-rose-900 font-bold focus:ring-rose-500 shadow-xs'
                                    : 'bg-white border border-amber-200 focus:ring-amber-500 text-slate-800'
                                }`}
                              />
                            </td>
                            <td 
                              className="py-3 px-1 text-center font-mono font-bold text-xs text-emerald-800 bg-emerald-50/10"
                            >
                              {g.tp3Nilai === '' || g.tp3Nilai === undefined ? '-' : g.tp3Nilai}
                            </td>
                          </>
                        )}

                        {/* TP 4 if exists */}
                        {activeTPs.tp4 && (
                          <>
                            <td className="py-3 px-1 text-center bg-amber-50/5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={g.tp4NilaiAsli ?? ''}
                                onChange={e => handleNumChange(g.siswaId, 'tp4NilaiAsli', e.target.value)}
                                placeholder="0"
                                title={dups.has('tp4') ? `Nilai Asli TP-4 (${g.tp4NilaiAsli}) sama/duplikat dengan TP lain! Ubah nilai asli agar nilai tiap TP berbeda.` : undefined}
                                className={`w-11 text-center py-1 rounded text-xs focus:outline-none focus:ring-1 ${
                                  dups.has('tp4')
                                    ? 'border-2 border-rose-500 bg-rose-50 text-rose-900 font-bold focus:ring-rose-500 shadow-xs'
                                    : 'bg-white border border-amber-200 focus:ring-amber-500 text-slate-800'
                                }`}
                              />
                            </td>
                            <td 
                              className="py-3 px-1 text-center font-mono font-bold text-xs text-emerald-800 bg-emerald-50/10"
                            >
                              {g.tp4Nilai === '' || g.tp4Nilai === undefined ? '-' : g.tp4Nilai}
                            </td>
                          </>
                        )}

                        {/* Nilai PSTS for averaging */}
                        {(activePeriod.tipeUjian === 'PSAS1' || activePeriod.tipeUjian === 'PSAT') && (
                          <td className="py-3 px-2 text-center bg-emerald-50/15 border-x border-emerald-100/30">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={g.nilaiPsts ?? ''}
                              onChange={e => handleNumChange(g.siswaId, 'nilaiPsts', e.target.value)}
                              placeholder="-"
                              title={activePeriod.tipeUjian === 'PSAS1' ? 'Nilai Raport PSTS Semester 1 (diambil otomatis & dirata-rata)' : 'Nilai Raport PSTS Semester 2 (diambil otomatis & dirata-rata)'}
                              className="w-11 text-center py-1 bg-white border border-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded text-xs font-semibold text-emerald-950 font-mono shadow-2xs"
                            />
                          </td>
                        )}

                        {/* Nilai Ujian */}
                        <td className="py-3 px-1 text-center bg-amber-50/5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={g.nilaiUjianAsli}
                            onChange={e => handleNumChange(g.siswaId, 'nilaiUjianAsli', e.target.value)}
                            placeholder="0"
                            className="w-11 text-center py-1 bg-white border border-amber-250 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded text-xs font-semibold"
                          />
                        </td>
                        <td className="py-3 px-1 text-center font-mono font-bold text-xs text-emerald-800 bg-emerald-50/10">
                          {g.nilaiUjian === '' ? '-' : g.nilaiUjian}
                        </td>

                        {/* Nilai Akhir */}
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block w-10 text-center py-1 font-bold rounded ${
                            finalGrade >= 75 
                              ? 'bg-emerald-50 text-emerald-800' 
                              : 'bg-rose-50 text-rose-700'
                          }`}>
                            {finalGrade}
                          </span>
                        </td>

                        {/* Capaian Deskripsi */}
                        <td className="py-3 px-4">
                          <div className="flex gap-1.5 items-start">
                            <textarea
                              rows={2}
                              value={g.capaianKompetensi}
                              onChange={e => handleDescChange(g.siswaId, e.target.value)}
                              placeholder="Tulis capaian atau klik generate otomatis berdasarkan nilai asli TP..."
                              className="flex-1 px-2.5 py-1 text-[11px] leading-snug border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 h-11"
                            />
                            <button
                              type="button"
                              onClick={() => handleAutoGenerateDesc(g.siswaId)}
                              title="Generate Otomatis Berdasarkan Nilai Asli TP"
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-55 border border-emerald-100 rounded-lg hover:border-emerald-300 transition-colors shrink-0 flex items-center h-8 my-auto self-center"
                            >
                              <Zap className="w-3.5 h-3.5 fill-emerald-100" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end items-center gap-3">
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-600/10 active:scale-95 transition-all inline-flex items-center gap-1.5 border border-sky-500/10"
              >
                <Printer className="w-4 h-4" />
                Cetak / Print Data Kelas
              </button>
              <button
                onClick={handleSaveAll}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/10 active:scale-95 transition-all inline-flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                Simpan Desk Kerja & Nilai Raport
              </button>
            </div>
          </div>

          {/* Rangkuman Hasil Penilaian */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200/60 p-5 sm:p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Rangkuman Hasil Penilaian Kelas</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Analisis nilai asli dan nilai katrol untuk mata pelajaran yang diajar</p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-150">
                Data Terhitung Otomatis
              </span>
            </div>

            {(() => {
              const stats = getSummaryStats();
              return (
                <div className="space-y-5">
                  {/* Row 1: Averages Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {stats.metrics.map(m => (
                      <div key={m.id} className="bg-white p-3 rounded-xl border border-slate-200/50 flex flex-col justify-between shadow-3xs">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{m.label}</span>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-baseline justify-between">
                            <span className="text-[9px] text-slate-500">Rerata Asli:</span>
                            <span className="text-xs font-mono font-bold text-amber-700">{m.avgAsli}</span>
                          </div>
                          <div className="flex items-baseline justify-between border-t border-slate-50 pt-1">
                            <span className="text-[9px] text-slate-500">Rerata Katrol:</span>
                            <span className="text-xs font-mono font-bold text-emerald-700">{m.avgKatrol}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Nilai Akhir Card */}
                    <div className="bg-emerald-50/30 p-3 rounded-xl border border-emerald-100/50 flex flex-col justify-between shadow-3xs">
                      <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider">Nilai Rapor</span>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[9px] text-emerald-800/80">Rerata Akhir:</span>
                          <span className="text-xs font-mono font-bold text-emerald-800">{stats.akhir.avg}</span>
                        </div>
                        <div className="text-[8px] text-emerald-600/70 leading-none">Rata-rata Raport Akhir</div>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Extreme Min / Max list */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Nilai Tertinggi Card */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-3xs space-y-3">
                      <div className="flex items-center gap-1.5 text-emerald-800 border-b border-slate-100 pb-1.5">
                        <Award className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-700">Nilai Tertinggi (Siswa Puncak)</span>
                      </div>
                      <div className="divide-y divide-slate-100 text-xs">
                        {stats.metrics.map(m => {
                          if (!m.max) return null;
                          return (
                            <div key={m.id} className="py-2 flex items-start gap-4 justify-between">
                              <span className="font-semibold text-slate-600 shrink-0 w-24">{m.label}</span>
                              <div className="text-right flex-1 min-w-0">
                                <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded mr-1 text-[11px]" title="Nilai Asli">
                                  {m.max.val}
                                </span>
                                <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded" title="Nilai Katrol">
                                  {m.max.valKatrol}
                                </span>
                                <div className="text-[10px] text-emerald-600 mt-1 truncate" title={m.max.students.join(', ')}>
                                  {m.max.students.join(', ')}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {stats.akhir.max && (
                          <div className="py-2 flex items-start gap-4 justify-between font-medium">
                            <span className="font-bold text-emerald-800 shrink-0 w-24">Nilai Rapor</span>
                            <div className="text-right flex-1 min-w-0">
                              <span className="font-mono font-bold text-white bg-emerald-600 px-1.5 py-0.2 rounded text-[11px]">
                                {stats.akhir.max.val}
                              </span>
                              <div className="text-[10px] text-emerald-700 mt-1 truncate animate-pulse font-semibold" title={stats.akhir.max.students.join(', ')}>
                                {stats.akhir.max.students.join(', ')}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Nilai Terendah Card */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-3xs space-y-3">
                      <div className="flex items-center gap-1.5 text-rose-800 border-b border-slate-100 pb-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        <span className="text-xs font-bold text-slate-700">Nilai Terendah (Siswa Bimbingan)</span>
                      </div>
                      <div className="divide-y divide-slate-100 text-xs">
                        {stats.metrics.map(m => {
                          if (!m.min) return null;
                          return (
                            <div key={m.id} className="py-2 flex items-start gap-4 justify-between">
                              <span className="font-semibold text-slate-600 shrink-0 w-24">{m.label}</span>
                              <div className="text-right flex-1 min-w-0">
                                <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded mr-1 text-[11px]" title="Nilai Asli">
                                  {m.min.val}
                                </span>
                                <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded" title="Nilai Katrol">
                                  {m.min.valKatrol}
                                </span>
                                <div className="text-[10px] text-slate-500 mt-1 truncate" title={m.min.students.join(', ')}>
                                  {m.min.students.join(', ')}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {stats.akhir.min && (
                          <div className="py-2 flex items-start gap-4 justify-between font-medium">
                            <span className="font-bold text-rose-800 shrink-0 w-24">Nilai Rapor</span>
                            <div className="text-right flex-1 min-w-0">
                              <span className="font-mono font-bold text-white bg-rose-500 px-1.5 py-0.2 rounded text-[11px]">
                                {stats.akhir.min.val}
                              </span>
                              <div className="text-[10px] text-rose-600 mt-1 truncate" title={stats.akhir.min.students.join(', ')}>
                                {stats.akhir.min.students.join(', ')}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

        </div>
      )}

      {/* Print Preview Modal for GuruNilai */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn print:bg-white print:p-0 print:static print:block overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl relative my-8 flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:my-0 print:rounded-none">
            
            {/* Modal Controls Bar */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0 bg-slate-50 rounded-t-2xl print:hidden">
              <div>
                <h3 className="font-bold text-xs text-slate-800">Pratinjau Cetak Nilai Kelas</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Mata Pelajaran: {activeAssignment?.mapelNama} — Kelas: {activeAssignment?.kelasNama}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const printContent = document.getElementById('print-guru-nilai-area');
                    if (!printContent) return;

                    const existing = document.getElementById('print-helper-area');
                    if (existing) {
                      existing.remove();
                    }

                    // Create a clean container outside of React root
                    const printHelper = document.createElement('div');
                    printHelper.id = 'print-helper-area';
                    
                    // Clone content
                    printHelper.innerHTML = printContent.innerHTML;
                    
                    // Apply CSS directly to the helper element during screen preview & printing
                    const helperStyle = document.createElement('style');
                    helperStyle.id = 'print-helper-styles';
                    helperStyle.innerHTML = `
                      @media print {
                        body {
                          background: #ffffff !important;
                          color: #000000 !important;
                          -webkit-print-color-adjust: exact !important;
                          print-color-adjust: exact !important;
                        }
                        /* Hide absolutely everything at body root level except the print area */
                        body > *:not(#print-helper-area) {
                          display: none !important;
                          height: 0 !important;
                          overflow: hidden !important;
                          visibility: hidden !important;
                        }
                        #print-helper-area, #print-helper-area * {
                          visibility: visible !important;
                        }
                        #print-helper-area {
                          display: block !important;
                          width: 100% !important;
                          max-width: 100% !important;
                          box-sizing: border-box !important;
                          background: #ffffff !important;
                          color: #000000 !important;
                          padding: 0 !important;
                          margin: 0 !important;
                        }
                        @page {
                          size: A4 portrait !important;
                          margin: 12mm 12mm 12mm 12mm !important;
                        }
                        .print-no-break {
                          break-inside: avoid !important;
                        }
                        table {
                          border-collapse: collapse !important;
                          width: 100% !important;
                        }
                        table, th, td {
                          border: 1px solid #000000 !important;
                        }
                        td, th {
                          color: #000000 !important;
                          font-size: 11px !important;
                          padding: 3px 5px !important;
                          line-height: 1.15 !important;
                        }
                        th {
                          font-weight: bold !important;
                          background-color: #f8fafc !important;
                          -webkit-print-color-adjust: exact !important;
                          print-color-adjust: exact !important;
                        }
                      }
                    `;

                    document.head.appendChild(helperStyle);
                    document.body.appendChild(printHelper);
                    document.body.classList.add('printing-active');

                    // Execute print
                    setTimeout(() => {
                      window.print();
                      
                      // Small delay after print trigger to restore normal look (cleanup)
                      setTimeout(() => {
                        printHelper.remove();
                        helperStyle.remove();
                        document.body.classList.remove('printing-active');
                      }, 500);
                    }, 100);
                  }}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak / Print PDF
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1 px-2.5 text-slate-450 hover:text-slate-800 rounded bg-slate-100 hover:bg-slate-200 font-bold transition-colors text-xs flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Tutup
                </button>
              </div>
            </div>

            {/* Scrollable Print Contents */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 text-black bg-slate-100/20 font-sans print:p-0 print:bg-white print:overflow-visible">
              <div id="print-guru-nilai-area" className="w-full bg-white border border-slate-200/50 p-6 sm:p-8 shadow-md rounded-lg text-[12px] leading-relaxed relative print:shadow-none print:border-none print:p-0 print:w-full">
                
                {/* Table Title */}
                <div className="text-center mb-4">
                  <h3 className="text-[16px] font-extrabold tracking-wider uppercase">
                    DAFTAR NILAI DAN CAPAIAN KOMPETENSI (NILAI GURU)
                  </h3>
                  <p className="text-[16px] font-bold tracking-wide uppercase mt-1">
                    {getFullTipeUjian()}
                  </p>
                  <p className="text-[16px] font-bold tracking-wide uppercase mt-1">
                    TAHUN AJARAN {activePeriod?.tahunAjaran}
                  </p>
                </div>

                {/* Info Metadata */}
                <div className="grid grid-cols-2 gap-4 mb-3 border border-black/10 p-3 rounded-lg bg-slate-50/50 text-[12px] font-medium print:bg-white print:border-black/20">
                  <div className="space-y-1">
                    <div>Mata Pelajaran : <span className="font-bold">{activeAssignment?.mapelNama}</span></div>
                    <div>Kelas/Semester : <span className="font-bold">{activeAssignment?.kelasNama} / {activePeriod?.semester}</span></div>
                    <div>Tahun Pelajaran : <span className="font-mono">{activePeriod?.tahunAjaran}</span></div>
                  </div>
                  <div className="space-y-1">
                    <div>Nama Guru Pengampu : <span className="font-semibold">{activeTeacher?.nama}</span></div>
                    <div>NIK Guru : <span className="font-mono">{activeTeacher?.username || '-'}</span></div>
                    <div>Jenis Penilaian : <span className="font-bold uppercase font-mono text-emerald-800 print:text-black">{formatTipeUjian(activePeriod?.tipeUjian)}</span></div>
                  </div>
                </div>

                {/* List of Tujuan Pembelajaran (TP) for printing reference */}
                <div className="mb-3 text-[11px] border border-dashed border-slate-200 p-2 rounded bg-slate-50/30 print:border-black/10">
                  <span className="font-bold block text-slate-800 mb-1 text-[11.5px]">DAFTAR TUJUAN PEMBELAJARAN (TP) :</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-slate-600">
                    <div>1. TP 1: {activeTPs?.tp1}</div>
                    <div>2. TP 2: {activeTPs?.tp2}</div>
                    {activeTPs?.tp3 && <div>3. TP 3: {activeTPs?.tp3}</div>}
                    {activeTPs?.tp4 && <div>4. TP 4: {activeTPs?.tp4}</div>}
                  </div>
                </div>

                {/* Main Print Data Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-black text-center text-[12px]">
                    <thead>
                      <tr className="bg-slate-100 uppercase font-bold text-slate-800 print:bg-white print:text-black">
                        <th className="border border-black py-1.5 px-1 w-10">No Urut</th>
                        <th className="border border-black py-1.5 px-2 w-20">No Induk</th>
                        <th className="border border-black py-1.5 px-1 w-8 font-sans">L/P</th>
                        <th className="border border-black py-1.5 px-2 text-left w-48">Nama Siswa</th>
                        <th className="border border-black py-1.5 px-1 w-16">Nilai TP 1</th>
                        <th className="border border-black py-1.5 px-1 w-16">Nilai TP 2</th>
                        {activeTPs?.tp3 && <th className="border border-black py-1.5 px-1 w-16">Nilai TP 3</th>}
                        {activeTPs?.tp4 && <th className="border border-black py-1.5 px-1 w-16">Nilai TP 4</th>}
                        {(activePeriod.tipeUjian === 'PSAS1' || activePeriod.tipeUjian === 'PSAT') && (
                          <th className="border border-black py-1.5 px-2 w-20 bg-emerald-50/20 text-emerald-950/90 font-bold">
                            {activePeriod.tipeUjian === 'PSAS1' ? 'Nilai PSTS 1' : 'Nilai PSTS 2'}
                          </th>
                        )}
                        <th className="border border-black py-1.5 px-2 w-20">Nilai {formatTipeUjian(activePeriod?.tipeUjian) || 'Ujian'}</th>
                        <th className="border border-black py-1.5 px-2 w-20 bg-emerald-50 text-emerald-950/90 print:bg-white print:text-black font-extrabold">Nilai Raport</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map((g, idx) => {
                        const studentDetails = activePeriod.snapshotSiswa.find(s => s.id === g.siswaId);
                        const noInduk = studentDetails?.nis || studentDetails?.nisn || '-';
                        const gender = studentDetails?.jenisKelamin || '-';

                        const tp1Val = g.tp1Nilai === '' ? '-' : g.tp1Nilai;
                        const tp2Val = g.tp2Nilai === '' ? '-' : g.tp2Nilai;
                        const tp3Val = g.tp3Nilai !== undefined ? (g.tp3Nilai === '' ? '-' : g.tp3Nilai) : null;
                        const tp4Val = g.tp4Nilai !== undefined ? (g.tp4Nilai === '' ? '-' : g.tp4Nilai) : null;
                        
                        const rerataTP = getAvgTP(g);
                        const wrapUjian = g.nilaiUjian === '' ? '-' : g.nilaiUjian;
                        const naVal = calculateNilaiAkhirLocal(g);
 
                        return (
                          <tr key={g.siswaId} className="hover:bg-slate-50/50 print:hover:bg-white">
                            <td className="border border-black py-1 px-1 font-mono">{idx + 1}</td>
                            <td className="border border-black py-1 px-2 font-mono">{noInduk}</td>
                            <td className="border border-black py-1 px-1 font-sans">{gender}</td>
                            <td className="border border-black py-1 px-2 text-left font-semibold uppercase">{g.siswaNama}</td>
                            <td className="border border-black py-1 px-1 font-mono">{tp1Val}</td>
                            <td className="border border-black py-1 px-1 font-mono">{tp2Val}</td>
                            {tp3Val !== null && <td className="border border-black py-1 px-1 font-mono">{tp3Val}</td>}
                            {tp4Val !== null && <td className="border border-black py-1 px-1 font-mono">{tp4Val}</td>}
                            {(activePeriod.tipeUjian === 'PSAS1' || activePeriod.tipeUjian === 'PSAT') && (
                              <td className="border border-black py-1 px-1 font-mono bg-emerald-50/10 text-emerald-950">
                                {g.nilaiPsts === '' || g.nilaiPsts === undefined ? '-' : g.nilaiPsts}
                              </td>
                            )}
                            <td className="border border-black py-1 px-1 font-mono">{wrapUjian}</td>
                            <td className="border border-black py-1 px-1 font-mono font-bold bg-emerald-50/40 text-emerald-900 print:bg-white print:text-black">{naVal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Signature */}
                <div className="mt-6 flex justify-between items-start text-[12px] px-8 print:mt-6 print:px-4">
                  <div className="text-center flex flex-col items-center w-64 print:w-72">
                    <p className="font-semibold text-[12px]">Mengetahui,</p>
                    <p className="font-semibold text-[12px]">Kepala Sekolah</p>
                    <div className="h-14 print:h-11" />
                    <p className="font-bold underline text-[12px]">Andreas Raymonda, S.Pd, M.Hum</p>
                    <p className="text-[10.5px] text-slate-500 font-mono mt-0.5">NIK. 103.244.0072</p>
                  </div>
                  <div className="text-center flex flex-col items-center w-64 print:w-72">
                    <p className="text-[12px]">Surakarta, {formattedReportDate}</p>
                    <p className="font-semibold text-[12px]">Guru Pengampu</p>
                    <div className="h-14 print:h-11" />
                    <p className="font-bold underline text-[12px]">{activeTeacher?.nama}</p>
                    <p className="text-[10.5px] text-slate-500 font-mono mt-0.5">NIK. {activeTeacher?.username || '-'}</p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* Bulk Input Modal for GuruNilai */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl relative my-6 flex flex-col max-h-[92vh] overflow-hidden border border-slate-100">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-emerald-50/70 to-teal-50/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-800 flex items-center gap-2">
                    Input Nilai Siswa Massal (Excel / CSV)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Kelas: <strong className="text-slate-700">{activeAssignment?.kelasNama}</strong> • Mapel: <strong className="text-slate-700">{activeAssignment?.mapelNama}</strong> • Periode: <strong className="text-slate-700">{activePeriod?.tahunAjaran} ({activePeriod?.tipeUjian})</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBulkModalOpen(false);
                  setParsedBulkRows([]);
                  setBulkPasteText('');
                  setBulkFileName('');
                  setBulkError('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* Step 1: Download Template Banner */}
              <div className="bg-emerald-50/60 border border-emerald-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-3xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl mt-0.5 shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">
                      Langkah 1: Unduh Format Template Excel / CSV
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Template ini otomatis memuat <strong>{grades.length} siswa</strong> kelas {activeAssignment?.kelasNama} beserta NIS dan nama lengkap sesuai urutan raport.
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-[10px] text-emerald-800 font-medium">
                      <span className="bg-white/90 border border-emerald-200 px-2 py-0.5 rounded-md">Kolom TP1 & TP2 (Wajib)</span>
                      {activeTPs?.tp3 && <span className="bg-white/90 border border-emerald-200 px-2 py-0.5 rounded-md">Kolom TP3</span>}
                      {activeTPs?.tp4 && <span className="bg-white/90 border border-emerald-200 px-2 py-0.5 rounded-md">Kolom TP4</span>}
                      {(activePeriod?.tipeUjian === 'PSAS1' || activePeriod?.tipeUjian === 'PSAT') && (
                        <span className="bg-white/90 border border-emerald-200 px-2 py-0.5 rounded-md">Kolom Nilai PSTS</span>
                      )}
                      <span className="bg-white/90 border border-emerald-200 px-2 py-0.5 rounded-md">Kolom Ujian Sumatif</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm hover:shadow-md active:scale-95 transition-all self-stretch sm:self-auto justify-center shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh Template (.CSV)
                </button>
              </div>

              {/* Step 2: Choose Method */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Langkah 2: Masukkan Nilai Siswa
                  </h4>
                  <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setBulkInputTab('upload')}
                      className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        bulkInputTab === 'upload' 
                          ? 'bg-white text-emerald-700 shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload File CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkInputTab('paste')}
                      className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        bulkInputTab === 'paste' 
                          ? 'bg-white text-emerald-700 shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Copy-Paste dari Spreadsheet
                    </button>
                  </div>
                </div>

                {bulkInputTab === 'upload' ? (
                  <div className="border-2 border-dashed border-slate-250 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-emerald-50/20 transition-all">
                    <input
                      type="file"
                      id="bulk-file-input"
                      accept=".csv, text/csv, text/plain, .tsv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label htmlFor="bulk-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                      <div className="p-3 bg-emerald-100 text-emerald-700 rounded-full">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-bold text-slate-700">
                        Klik untuk memilih file CSV template atau drag & drop ke sini
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Mendukung file hasil unduhan template (.csv) yang telah diisi nilai di Microsoft Excel / Google Sheets
                      </p>
                      {bulkFileName && (
                        <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-xl">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          File terpilih: {bulkFileName}
                        </div>
                      )}
                    </label>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500">
                      Buka file Excel atau Google Sheets Anda, blok tabel nilai (No, NIS, Nama, TP1, TP2, Ujian...), tekan <strong>Ctrl + C</strong>, lalu tempel (<strong>Ctrl + V</strong>) di kotak bawah ini:
                    </p>
                    <textarea
                      value={bulkPasteText}
                      onChange={(e) => {
                        setBulkPasteText(e.target.value);
                        handleParseBulkData(e.target.value);
                      }}
                      placeholder={`Contoh tempelan dari Excel:\n1\t2425001\tAhmad Rifqi\t85\t88\t90\t86\n2\t2425002\tAisyah Humaira\t90\t92\t88\t90`}
                      rows={6}
                      className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded-xl leading-relaxed"
                    />
                  </div>
                )}
              </div>

              {/* Error Box */}
              {bulkError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{bulkError}</span>
                </div>
              )}

              {/* Preview Table if rows parsed */}
              {parsedBulkRows.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-800">
                        Pratinjau Hasil Pembacaan Data
                      </h4>
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                        {parsedBulkRows.length} Baris Terbaca
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md text-[10px]">
                        <Check className="w-3 h-3 text-emerald-600" />
                        {parsedBulkRows.filter(r => r.status === 'matched').length} Cocok
                      </span>
                      {parsedBulkRows.some(r => r.status === 'unmatched') && (
                        <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-md text-[10px]">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          {parsedBulkRows.filter(r => r.status === 'unmatched').length} Tidak Cocok
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-3xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                        <tr>
                          <th className="py-2 px-3 w-8 text-center">Status</th>
                          <th className="py-2 px-2 w-20">NIS</th>
                          <th className="py-2 px-3">Nama Siswa</th>
                          <th className="py-2 px-2 text-center w-12 bg-amber-50/50">TP 1</th>
                          <th className="py-2 px-2 text-center w-12 bg-amber-50/50">TP 2</th>
                          {activeTPs?.tp3 && <th className="py-2 px-2 text-center w-12 bg-amber-50/50">TP 3</th>}
                          {activeTPs?.tp4 && <th className="py-2 px-2 text-center w-12 bg-amber-50/50">TP 4</th>}
                          {(activePeriod?.tipeUjian === 'PSAS1' || activePeriod?.tipeUjian === 'PSAT') && (
                            <th className="py-2 px-2 text-center w-14 bg-emerald-50/40">PSTS</th>
                          )}
                          <th className="py-2 px-2 text-center w-14 bg-amber-50/50">Ujian</th>
                          <th className="py-2 px-3">Capaian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {parsedBulkRows.map((r, i) => (
                          <tr key={i} className={r.status === 'matched' ? 'hover:bg-slate-50/80' : 'bg-rose-50/40 text-rose-800'}>
                            <td className="py-1.5 px-3 text-center">
                              {r.status === 'matched' ? (
                                <span className="inline-flex p-0.5 bg-emerald-100 text-emerald-700 rounded" title="Siswa Teridentifikasi">
                                  <Check className="w-3 h-3" />
                                </span>
                              ) : (
                                <span className="inline-flex p-0.5 bg-rose-100 text-rose-700 rounded" title="Siswa tidak cocok dengan data kelas">
                                  <AlertTriangle className="w-3 h-3" />
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 font-mono text-slate-500">{r.nis || '-'}</td>
                            <td className="py-1.5 px-3 font-medium text-slate-800">
                              {r.nama}
                              {r.matchedStudent && r.matchedStudent.siswaNama !== r.nama && (
                                <span className="text-[10px] text-slate-400 block font-normal">
                                  (Cocok ke: {r.matchedStudent.siswaNama})
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono font-bold text-amber-900 bg-amber-50/30">
                              {r.tp1NilaiAsli !== '' ? r.tp1NilaiAsli : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono font-bold text-amber-900 bg-amber-50/30">
                              {r.tp2NilaiAsli !== '' ? r.tp2NilaiAsli : '-'}
                            </td>
                            {activeTPs?.tp3 && (
                              <td className="py-1.5 px-2 text-center font-mono font-bold text-amber-900 bg-amber-50/30">
                                {r.tp3NilaiAsli !== '' && r.tp3NilaiAsli !== undefined ? r.tp3NilaiAsli : '-'}
                              </td>
                            )}
                            {activeTPs?.tp4 && (
                              <td className="py-1.5 px-2 text-center font-mono font-bold text-amber-900 bg-amber-50/30">
                                {r.tp4NilaiAsli !== '' && r.tp4NilaiAsli !== undefined ? r.tp4NilaiAsli : '-'}
                              </td>
                            )}
                            {(activePeriod?.tipeUjian === 'PSAS1' || activePeriod?.tipeUjian === 'PSAT') && (
                              <td className="py-1.5 px-2 text-center font-mono font-bold text-emerald-950 bg-emerald-50/30">
                                {r.nilaiPsts !== '' && r.nilaiPsts !== undefined ? r.nilaiPsts : '-'}
                              </td>
                            )}
                            <td className="py-1.5 px-2 text-center font-mono font-bold text-amber-900 bg-amber-50/30">
                              {r.nilaiUjianAsli !== '' ? r.nilaiUjianAsli : '-'}
                            </td>
                            <td className="py-1.5 px-3 truncate max-w-xs text-slate-500 font-sans">
                              {r.capaianKompetensi || <span className="italic text-slate-400">Auto-generate</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsBulkModalOpen(false);
                  setParsedBulkRows([]);
                  setBulkPasteText('');
                  setBulkFileName('');
                  setBulkError('');
                }}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Tutup / Batal
              </button>

              <button
                type="button"
                onClick={handleApplyBulkGrades}
                disabled={parsedBulkRows.filter(r => r.status === 'matched').length === 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm hover:shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Terapkan Nilai ({parsedBulkRows.filter(r => r.status === 'matched').length} Siswa) ke Formulir
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
