/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SchemaDatabase, Siswa, PeriodeAkademik, Mapel } from '../types';
import { isYayasanSubject, getSubjectPriority } from './mapelOrder';

/**
 * Standardizes subject titles on the report card so they match official curriculum exactly
 */
export const formatMapelNamaForRaport = (rawName: string): string => {
  const norm = rawName.trim();
  const lower = norm.toLowerCase();
  if (lower.includes('agama') && (lower.includes('budi pekerti') || lower.includes('islam') || lower.includes('pai'))) {
    return 'Pendidikan Agama dan Budi Pekerti';
  }
  if (lower.includes('pancasila') || lower.includes('ppkn') || lower.includes('kewarganegaraan')) {
    return 'Pendidikan Pancasila dan Kewarganegaraan';
  }
  if (lower.includes('ipa') || (lower.includes('ilmu') && lower.includes('alam'))) {
    return 'Ilmu Pengetahuan Alam';
  }
  if (lower.includes('ips') || (lower.includes('ilmu') && lower.includes('sosial'))) {
    return 'Ilmu Pengetahuan Sosial';
  }
  if (lower.includes('jasmani') || lower.includes('pjok') || lower.includes('olahraga')) {
    return 'Pendidikan Jasmani, Olahraga dan Kesehatan';
  }
  if (lower === 'ski' || lower.includes('sejarah kebudayaan islam')) {
    return 'SKI';
  }
  if (lower.includes('tahfidz') || lower.includes('tahfid')) {
    return "Tahfidz Al Qur'an";
  }
  if (lower.includes('seni') && (lower.includes('budaya') || lower.includes('rupa'))) {
    return 'Seni Rupa';
  }
  if (lower.includes('aqidah') || lower.includes('akidah')) {
    return 'Aqidah';
  }
  if (lower.includes('fiqih') || lower.includes('fikih')) {
    return 'Fiqih';
  }
  // Strip trailing parenthetical abbreviations like " (IPA)" or " (PAI)"
  return norm.replace(/\s*\([A-Z0-9\s/+-]+\)$/i, '').trim() || norm;
};

// Helper to split competency descriptions into Mastery vs Needed support
const splitCapaian = (desc: string, mapelName?: string) => {
  const cleanMapel = mapelName ? mapelName.toLowerCase() : 'materi';
  const fallback = {
    master: `Menunjukkan penguasaan sangat baik dalam memahami konsep dasar dan materi pokok pembelajaran ${cleanMapel}.`,
    needsImprovement: `Perlu bimbingan dalam menyajikan laporan serta refleksi pembelajaran ${cleanMapel} secara kolaboratif.`
  };
  if (!desc || desc.trim() === '') return fallback;

  const separators = [
    ' Serta perlu bimbingan ',
    ' serta perlu bimbingan ',
    ' Serta perlu bimbingan dalam ',
    ' serta perlu bimbingan dalam ',
    '. Serta perlu bimbingan ',
    '. serta perlu bimbingan ',
    'perlu bimbingan dalam',
    'Perlu bimbingan dalam',
    'perlu bimbingan',
    'Perlu bimbingan'
  ];

  for (const sep of separators) {
    const idx = desc.toLowerCase().indexOf(sep.toLowerCase());
    if (idx !== -1) {
      let master = desc.substring(0, idx).trim();
      let needsImprovement = desc.substring(idx + sep.length).trim();

      if (!needsImprovement.toLowerCase().startsWith('perlu bimbingan')) {
        needsImprovement = 'Perlu bimbingan ' + needsImprovement;
      } else {
        needsImprovement = needsImprovement.charAt(0).toUpperCase() + needsImprovement.slice(1);
      }

      if (master && !master.endsWith('.')) master += '.';
      if (needsImprovement && !needsImprovement.endsWith('.')) needsImprovement += '.';

      return { master, needsImprovement };
    }
  }

  let master = desc.trim();
  if (!master.endsWith('.')) master += '.';

  return {
    master,
    needsImprovement: `Perlu bimbingan dalam menyajikan laporan serta refleksi pembelajaran ${cleanMapel} secara kolaboratif.`
  };
};

// Helper to get active font size for Capaian Kompetensi based on text length
const getCpFontSize = (text: string) => {
  if (!text) return 9.5;
  if (text.length > 210) return 8.5;
  if (text.length > 150) return 9;
  return 9.5;
};

export function generateSiswaPDF(student: Siswa, db: SchemaDatabase, activePeriod: PeriodeAkademik): jsPDF {
  // Standard A4 PDF (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

  // Load classroom and homeroom teacher info
  const targetKelas = activePeriod.snapshotKelas?.find(k => k.id === student.kelasId) || 
                      db.kelas?.find(k => k.id === student.kelasId);

  const classTeacher = activePeriod.snapshotGuru?.find(g => 
    (targetKelas?.waliKelasId && g.id === targetKelas.waliKelasId) || 
    (g.isWaliKelas && g.waliKelasKelasId === targetKelas?.id)
  ) || db.guru?.find(g => 
    (targetKelas?.waliKelasId && g.id === targetKelas.waliKelasId) || 
    (g.isWaliKelas && g.waliKelasKelasId === targetKelas?.id)
  );

  // Collect subjects
  const mapelList: Mapel[] = [];
  const seenMapelIds = new Set<string>();
  const seenMapelNames = new Set<string>();

  const addMapelIfNew = (m: Mapel) => {
    if (!m || !m.nama) return;
    const normName = m.nama.trim().toLowerCase();
    if (!seenMapelIds.has(m.id) && !seenMapelNames.has(normName)) {
      seenMapelIds.add(m.id);
      seenMapelNames.add(normName);
      mapelList.push(m);
    }
  };

  (activePeriod.snapshotMapel || []).forEach(addMapelIfNew);
  (db.mapel || []).forEach(addMapelIfNew);

  // Also include any subjects with grade records for this student in this period
  const studentGrades = (db.nilaiSiswa || []).filter(n => 
    n.siswaId === student.id && (n.periodeId === activePeriod.id || !n.periodeId)
  );

  studentGrades.forEach(n => {
    if (!seenMapelIds.has(n.mapelId)) {
      const found = (db.mapel || []).find(m => m.id === n.mapelId) || 
                    (activePeriod.snapshotMapel || []).find(m => m.id === n.mapelId);
      if (found) {
        addMapelIfNew(found);
      } else {
        addMapelIfNew({ id: n.mapelId, nama: (n as any).mapelNama || 'Mata Pelajaran' });
      }
    }
  });

  const results: { mapelNama: string; nilaiAkhir: number; capaian: string }[] = [];
  mapelList.forEach(mapel => {
    const gradeId = `${activePeriod.id}_${student.id}_${mapel.id}`;
    const gradeRecord = (db.nilaiSiswa || []).find(n => 
      n.id === gradeId ||
      (n.siswaId === student.id && 
       (n.periodeId === activePeriod.id || !n.periodeId) && 
       (n.mapelId === mapel.id || 
        (db.mapel || []).find(m => m.id === n.mapelId)?.nama.trim().toLowerCase() === mapel.nama.trim().toLowerCase() ||
        (activePeriod.snapshotMapel || []).find(m => m.id === n.mapelId)?.nama.trim().toLowerCase() === mapel.nama.trim().toLowerCase()
       )
      )
    );
    
    if (gradeRecord && typeof gradeRecord.nilaiAkhir === 'number') {
      results.push({
        mapelNama: formatMapelNamaForRaport(mapel.nama),
        nilaiAkhir: gradeRecord.nilaiAkhir,
        capaian: gradeRecord.capaianKompetensi || 'Telah mengikuti pembelajaran dengan baik.'
      });
    }
  });

  const attendance = (db.absensiDanCatatan || []).find(
    a => a.periodeId === activePeriod.id && a.siswaId === student.id
  );

  // Group and sort subjects identically to SMP Al-Irsyad official curriculum
  const unfilteredUmum = results.filter(r => !isYayasanSubject(r.mapelNama, mapelList));
  const unfilteredYayasan = results.filter(r => isYayasanSubject(r.mapelNama, mapelList));

  // Sort Umum
  const sortedUmum = [...unfilteredUmum].sort((a, b) => {
    const pA = getSubjectPriority(a.mapelNama, false, mapelList);
    const pB = getSubjectPriority(b.mapelNama, false, mapelList);
    if (pA !== pB) return pA - pB;
    return a.mapelNama.localeCompare(b.mapelNama);
  });

  // Sort Yayasan
  const sortedYayasan = [...unfilteredYayasan].sort((a, b) => {
    const pA = getSubjectPriority(a.mapelNama, true, mapelList);
    const pB = getSubjectPriority(b.mapelNama, true, mapelList);
    if (pA !== pB) return pA - pB;
    return a.mapelNama.localeCompare(b.mapelNama);
  });

  // Distribute subjects to 3 pages exactly as in the official sample
  // Page 1 of Report (Page 2 of doc): 5 Umum subjects (1 to 5)
  // Page 2 of Report (Page 3 of doc): 6 Umum subjects (6 to 11) + 1 Yayasan subject (12: Aqidah)
  // Page 3 of Report (Page 4 of doc): Remaining Yayasan subjects (13 to 16: SKI, Bahasa Arab, Fiqih, Tahfidz Al Qur'an)
  const page1Umum = sortedUmum.slice(0, 5);
  const page2Umum = sortedUmum.slice(5, 11);
  const page2Yayasan = sortedYayasan.slice(0, 1);
  const page3Yayasan = sortedYayasan.slice(1);

  const formattedSemester = (sem: string) => {
    if (sem.toLowerCase().includes('ganjil') || sem === '1' || sem.toLowerCase() === 'i') {
      return 'I (Satu)';
    }
    return 'II (Dua)';
  };

  const formattedReportDate = activePeriod.tanggalRaport 
    ? new Date(activePeriod.tanggalRaport).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) 
    : new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'});

  // Helper to draw footer on raport pages (clean, exact match to screenshot)
  const drawRaportFooter = (pageNum: number) => {
    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(90, 90, 90);
    
    // Left: School & Student Name
    doc.text(`SMP Al-Irsyad Surakarta  •  ${student.nama.toUpperCase()}`, 15, pageHeight - 10);
    // Right: Page number
    doc.text(`Halaman ${pageNum} dari 3`, pageWidth - 15, pageHeight - 10, { align: 'right' });
    doc.setTextColor(0, 0, 0); // Reset
  };

  // =========================================================================
  // PAGE 1: COVER PAGE (Font Times New Roman)
  // Exactly matching the attached cover page
  // =========================================================================
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.text('LAPORAN HASIL BELAJAR SISWA', pageWidth / 2, 32, { align: 'center' });
  doc.text('SMP AL IRSYAD SURAKARTA', pageWidth / 2, 40, { align: 'center' });

  // Center boxes for NAMA PESERTA DIDIK and NISN (placed in lower section)
  const boxWidth = 146;
  const boxHeight = 14;
  const boxX = (pageWidth - boxWidth) / 2; // 32mm

  // Box 1: NAMA PESERTA DIDIK
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('NAMA PESERTA DIDIK', pageWidth / 2, 200, { align: 'center' });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(boxX, 206, boxWidth, boxHeight);

  doc.setFont('times', 'normal');
  doc.setFontSize(14);
  doc.text(student.nama.toUpperCase(), pageWidth / 2, 215, { align: 'center' });

  // Box 2: NISN
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('NISN', pageWidth / 2, 230, { align: 'center' });

  doc.rect(boxX, 236, boxWidth, boxHeight);

  doc.setFont('times', 'normal');
  doc.setFontSize(14);
  doc.text(student.nisn || student.nis || '-', pageWidth / 2, 245, { align: 'center' });

  // =========================================================================
  // PAGE 2: RAPORT PAGE 1 (Halaman 1 dari 3: Font Times New Roman)
  // Subjects 1 to 5 (Mata Pelajaran Umum)
  // =========================================================================
  doc.addPage();

  // Title: Size 14 bold
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('PENCAPAIAN KOMPETENSI PESERTA DIDIK', pageWidth / 2, 16, { align: 'center' });

  // Student & School Metadata (size 10.5 font times)
  autoTable(doc, {
    startY: 20.5,
    margin: { left: 15, right: 15 },
    theme: 'plain',
    body: [
      [
        { content: 'Nama Sekolah', styles: { cellWidth: 35 } },
        { content: ':', styles: { cellWidth: 3, halign: 'center' } },
        { content: 'SMP Al-Irsyad Surakarta', styles: { cellWidth: 67 } },
        { content: 'Kelas', styles: { cellWidth: 25 } },
        { content: ':', styles: { cellWidth: 3, halign: 'center' } },
        { content: targetKelas?.nama || '-', styles: { cellWidth: 47, fontStyle: 'bold' } },
      ],
      [
        { content: 'Alamat', styles: { cellWidth: 35 } },
        { content: ':', styles: { cellWidth: 3, halign: 'center' } },
        { content: 'Jl. Kapten Mulyadi No. 117 Surakarta', styles: { cellWidth: 67 } },
        { content: 'Fase', styles: { cellWidth: 25 } },
        { content: ':', styles: { cellWidth: 3, halign: 'center' } },
        { content: 'D', styles: { cellWidth: 47, fontStyle: 'bold' } },
      ],
      [
        { content: 'Nama Peserta Didik', styles: { cellWidth: 35 } },
        { content: ':', styles: { cellWidth: 3, halign: 'center' } },
        { content: student.nama.toUpperCase(), styles: { cellWidth: 67, fontStyle: 'bold' } },
        { content: 'Semester', styles: { cellWidth: 25 } },
        { content: ':', styles: { cellWidth: 3, halign: 'center' } },
        { content: formattedSemester(activePeriod.semester), styles: { cellWidth: 47, fontStyle: 'bold' } },
      ],
      [
        { content: 'Nomor Induk', styles: { cellWidth: 35 } },
        { content: ':', styles: { cellWidth: 3, halign: 'center' } },
        { content: student.nis || student.nisn || '-', styles: { cellWidth: 67 } },
        { content: 'Tahun Ajaran', styles: { cellWidth: 25 } },
        { content: ':', styles: { cellWidth: 3, halign: 'center' } },
        { content: activePeriod.tahunAjaran, styles: { cellWidth: 47, fontStyle: 'bold' } },
      ],
    ],
    styles: {
      fontSize: 10.5,
      cellPadding: { top: 0.7, bottom: 0.7, left: 0, right: 0 },
      textColor: [0, 0, 0],
      font: 'times'
    }
  });

  const metadataEndY = (doc as any).lastAutoTable?.finalY || 38;

  // Build Page 1 Grades Rows (Subjects 1 to 5)
  const p1Count = page1Umum.length;
  // Sub-row height tailored to span the page cleanly (~21mm per sub-row)
  const p1SubRowHeight = p1Count > 0 ? Math.min(21.5, Math.max(14, Math.floor(212 / (p1Count * 2)))) : 21;

  const page1BodyRows: any[] = [];
  page1BodyRows.push([
    {
      content: 'MATA PELAJARAN UMUM',
      colSpan: 4,
      styles: {
        fillColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10.5,
        halign: 'left',
        valign: 'middle',
        textColor: [0, 0, 0],
        minCellHeight: 7.5,
        cellPadding: { top: 1.5, bottom: 1.5, left: 2.5, right: 2.5 }
      }
    }
  ]);

  page1Umum.forEach((r, idx) => {
    const split = splitCapaian(r.capaian, r.mapelNama);
    const fsMaster = getCpFontSize(split.master);
    const fsNeeds = getCpFontSize(split.needsImprovement);
    
    page1BodyRows.push([
      { content: (idx + 1).toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'normal', fontSize: 10.5, minCellHeight: p1SubRowHeight * 2 } },
      { content: r.mapelNama, rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 10.5, minCellHeight: p1SubRowHeight * 2 } },
      { content: r.nilaiAkhir.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'normal', fontSize: 10.5, minCellHeight: p1SubRowHeight * 2 } },
      { content: split.master, styles: { fontSize: fsMaster, halign: 'left', valign: 'middle', minCellHeight: p1SubRowHeight, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } } }
    ]);
    page1BodyRows.push([
      { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'left', valign: 'middle', minCellHeight: p1SubRowHeight, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } } }
    ]);
  });

  autoTable(doc, {
    startY: metadataEndY + 2.5,
    margin: { left: 15, right: 15 },
    theme: 'grid',
    head: [['No', 'Mata Pelajaran', 'Nilai\nAkhir', 'Capaian Kompetensi']],
    body: page1BodyRows,
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: 10.5,
      minCellHeight: 8.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      font: 'times'
    },
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      font: 'times',
      fontSize: 10.5
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', valign: 'middle' },
      1: { cellWidth: 48, halign: 'center', valign: 'middle' },
      2: { cellWidth: 16, halign: 'center', valign: 'middle' },
      3: { cellWidth: 106, valign: 'middle' }
    }
  });

  drawRaportFooter(1);

  // =========================================================================
  // PAGE 3: RAPORT PAGE 2 (Halaman 2 dari 3: Font Times New Roman)
  // Subjects 6 to 11 (Umum) + Banner YAYASAN + Subject 12 (Aqidah)
  // =========================================================================
  doc.addPage();

  const p2Count = page2Umum.length + page2Yayasan.length;
  // Sub-row height tailored to span the page cleanly (~16.5mm per sub-row)
  const p2SubRowHeight = p2Count > 0 ? Math.min(17, Math.max(12, Math.floor(232 / (p2Count * 2)))) : 16.5;

  const page2BodyRows: any[] = [];
  page2Umum.forEach((r, idx) => {
    const split = splitCapaian(r.capaian, r.mapelNama);
    const globalIdx = 5 + idx + 1; // 6, 7, 8, 9, 10, 11
    const fsMaster = getCpFontSize(split.master);
    const fsNeeds = getCpFontSize(split.needsImprovement);
    
    page2BodyRows.push([
      { content: globalIdx.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'normal', fontSize: 10.5, minCellHeight: p2SubRowHeight * 2 } },
      { content: r.mapelNama, rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 10.5, minCellHeight: p2SubRowHeight * 2 } },
      { content: r.nilaiAkhir.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'normal', fontSize: 10.5, minCellHeight: p2SubRowHeight * 2 } },
      { content: split.master, styles: { fontSize: fsMaster, halign: 'left', valign: 'middle', minCellHeight: p2SubRowHeight, cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } } }
    ]);
    page2BodyRows.push([
      { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'left', valign: 'middle', minCellHeight: p2SubRowHeight, cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } } }
    ]);
  });

  if (page2Yayasan.length > 0) {
    // Banner header: "YAYASAN" in uppercase
    page2BodyRows.push([
      {
        content: 'YAYASAN',
        colSpan: 4,
        styles: {
          fillColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10.5,
          halign: 'left',
          valign: 'middle',
          textColor: [0, 0, 0],
          minCellHeight: 7.5,
          cellPadding: { top: 1.5, bottom: 1.5, left: 2.5, right: 2.5 }
        }
      }
    ]);

    page2Yayasan.forEach((r, idx) => {
      const split = splitCapaian(r.capaian, r.mapelNama);
      const globalIdx = 11 + idx + 1; // Subject 12
      const fsMaster = getCpFontSize(split.master);
      const fsNeeds = getCpFontSize(split.needsImprovement);
      
      page2BodyRows.push([
        { content: globalIdx.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'normal', fontSize: 10.5, minCellHeight: p2SubRowHeight * 2 } },
        { content: r.mapelNama, rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 10.5, minCellHeight: p2SubRowHeight * 2 } },
        { content: r.nilaiAkhir.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'normal', fontSize: 10.5, minCellHeight: p2SubRowHeight * 2 } },
        { content: split.master, styles: { fontSize: fsMaster, halign: 'left', valign: 'middle', minCellHeight: p2SubRowHeight, cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } } }
      ]);
      page2BodyRows.push([
        { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'left', valign: 'middle', minCellHeight: p2SubRowHeight, cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } } }
      ]);
    });
  }

  autoTable(doc, {
    startY: 15,
    margin: { left: 15, right: 15 },
    theme: 'grid',
    head: [['No', 'Mata Pelajaran', 'Nilai\nAkhir', 'Capaian Kompetensi']],
    body: page2BodyRows,
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: 10.5,
      minCellHeight: 8.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      font: 'times'
    },
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      font: 'times',
      fontSize: 10.5
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', valign: 'middle' },
      1: { cellWidth: 48, halign: 'center', valign: 'middle' },
      2: { cellWidth: 16, halign: 'center', valign: 'middle' },
      3: { cellWidth: 106, valign: 'middle' }
    }
  });

  drawRaportFooter(2);

  // =========================================================================
  // PAGE 4: RAPORT PAGE 3 (Halaman 3 dari 3: Font Times New Roman)
  // Subjects 13 to 16 (Yayasan: SKI, Bahasa Arab, Fiqih, Tahfidz Al Qur'an)
  // + Ekstrakurikuler + Ketidakhadiran + Tanda Tangan
  // =========================================================================
  doc.addPage();

  const p3Count = page3Yayasan.length;
  // Sub-row height tailored to span the upper part cleanly (~11.5mm per sub-row)
  const p3SubRowHeight = p3Count > 0 ? Math.min(13, Math.max(9.5, Math.floor(92 / (p3Count * 2)))) : 11.5;

  const page3BodyRows: any[] = [];
  page3Yayasan.forEach((r, idx) => {
    const split = splitCapaian(r.capaian, r.mapelNama);
    const globalIdx = 12 + idx + 1; // 13, 14, 15, 16
    const fsMaster = getCpFontSize(split.master);
    const fsNeeds = getCpFontSize(split.needsImprovement);
    
    page3BodyRows.push([
      { content: globalIdx.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'normal', fontSize: 10.5, minCellHeight: p3SubRowHeight * 2 } },
      { content: r.mapelNama, rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 10.5, minCellHeight: p3SubRowHeight * 2 } },
      { content: r.nilaiAkhir.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'normal', fontSize: 10.5, minCellHeight: p3SubRowHeight * 2 } },
      { content: split.master, styles: { fontSize: fsMaster, halign: 'left', valign: 'middle', minCellHeight: p3SubRowHeight, cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } } }
    ]);
    page3BodyRows.push([
      { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'left', valign: 'middle', minCellHeight: p3SubRowHeight, cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } } }
    ]);
  });

  let tableYayasanEndY = 15;
  if (page3BodyRows.length > 0) {
    autoTable(doc, {
      startY: 15,
      margin: { left: 15, right: 15 },
      theme: 'grid',
      head: [['No', 'Mata Pelajaran', 'Nilai\nAkhir', 'Capaian Kompetensi']],
      body: page3BodyRows,
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        fontSize: 10.5,
        minCellHeight: 8.5,
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        font: 'times'
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        textColor: [0, 0, 0],
        font: 'times',
        fontSize: 10.5
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', valign: 'middle' },
        1: { cellWidth: 48, halign: 'center', valign: 'middle' },
        2: { cellWidth: 16, halign: 'center', valign: 'middle' },
        3: { cellWidth: 106, valign: 'middle' }
      }
    });
    tableYayasanEndY = (doc as any).lastAutoTable?.finalY || 115.5;
  }

  // Headings C and D (size 10.5 bold)
  const sectionsStartY = Math.max(tableYayasanEndY + 5.5, 121.5);
  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.text('C. EKSTRAKURIKULER', 15, sectionsStartY);
  doc.text('D. KETIDAKHADIRAN', 120, sectionsStartY);

  // Compile Ekstrakurikuler (98mm width)
  const ekskulItems = attendance?.ekstrakurikuler || [];
  const displayEkskul = [...ekskulItems];
  while (displayEkskul.length < 3) {
    displayEkskul.push({ nama: '', nilai: '' as any });
  }
  const ekskulRows = displayEkskul.map((item, idx) => [
    (idx + 1).toString(),
    item.nama || '',
    item.nilai || ''
  ]);

  const tablesStartY = sectionsStartY + 3.5;

  autoTable(doc, {
    startY: tablesStartY,
    margin: { left: 15 },
    tableWidth: 98,
    theme: 'grid',
    head: [['No', 'Kegiatan Ekstrakurikuler', 'Predikat']],
    body: ekskulRows,
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: 10.5,
      minCellHeight: 7.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      font: 'times'
    },
    styles: {
      fontSize: 10.5,
      cellPadding: 1.5,
      minCellHeight: 7.5,
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      font: 'times'
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', valign: 'middle', fontStyle: 'normal' },
      1: { cellWidth: 66, halign: 'left', valign: 'middle', fontStyle: 'normal' },
      2: { cellWidth: 20, halign: 'center', fontStyle: 'bold', valign: 'middle' }
    }
  });

  // Compile Ketidakhadiran (75mm width, from X = 120 to 195mm)
  const attendanceRows = [
    ['Sakit', ':', `${attendance?.sakit ?? 0} Hari`],
    ['Izin', ':', `${attendance?.izin ?? 0} Hari`],
    ['Tanpa Keterangan', ':', `${attendance?.alfa ?? 0} Hari`]
  ];

  autoTable(doc, {
    startY: tablesStartY,
    margin: { left: 120 },
    tableWidth: 75,
    theme: 'grid',
    head: [],
    body: attendanceRows,
    styles: {
      fontSize: 10.5,
      cellPadding: 1.5,
      minCellHeight: 10,
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      font: 'times'
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'normal', halign: 'left', valign: 'middle' },
      1: { cellWidth: 7, halign: 'center', valign: 'middle', fontStyle: 'normal' },
      2: { cellWidth: 30, halign: 'center', fontStyle: 'bold', valign: 'middle' }
    }
  });

  const sectionsEndY = Math.max(
    (doc as any).lastAutoTable?.finalY || 0,
    tablesStartY + 30
  );

  // =========================================================================
  // SIGNATURES SECTION (Font Times New Roman size 10.5)
  // Left column center: X = 55mm | Right column center: X = 157.5mm
  // =========================================================================
  const sigY = Math.max(sectionsEndY + 6.5, 162);

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);

  // Left: Orangtua / Wali
  doc.text('Mengetahui,', 55, sigY + 4.5, { align: 'center' });
  doc.text('Orangtua/ Wali', 55, sigY + 9, { align: 'center' });
  doc.text('.....................................................', 55, sigY + 34, { align: 'center' });

  // Right: Wali Kelas
  doc.text(`Surakarta, ${formattedReportDate}`, 157.5, sigY, { align: 'center' });
  doc.text('Mengetahui,', 157.5, sigY + 4.5, { align: 'center' });
  doc.text('Wali Kelas', 157.5, sigY + 9, { align: 'center' });

  const teacherName = classTeacher?.nama || 'Hadi Husin, S.Kom.';
  const teacherNik = classTeacher?.username || '103.244.00264';

  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.text(teacherName, 157.5, sigY + 34, { align: 'center' });
  
  // Underline teacher name
  const teacherNameWidth = doc.getTextWidth(teacherName);
  const teacherXStart = 157.5 - (teacherNameWidth / 2);
  doc.setLineWidth(0.25);
  doc.line(teacherXStart, sigY + 35, teacherXStart + teacherNameWidth, sigY + 35);

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`NIK. ${teacherNik}`, 157.5, sigY + 39.5, { align: 'center' });

  // Center bottom: Kepala Sekolah (centered at pageWidth / 2 = 105mm)
  const principalY = sigY + 47.5;
  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.text('Mengetahui,', 105, principalY, { align: 'center' });
  doc.text('Kepala Sekolah', 105, principalY + 4.5, { align: 'center' });

  const principalName = 'Andreas Raymonda, S.Pd, M.Hum';
  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.text(principalName, 105, principalY + 26.5, { align: 'center' });
  
  // Underline principal name
  const principalNameWidth = doc.getTextWidth(principalName);
  const principalXStart = 105 - (principalNameWidth / 2);
  doc.line(principalXStart, principalY + 27.5, principalXStart + principalNameWidth, principalY + 27.5);

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('NIK. 103.244.0072', 105, principalY + 32, { align: 'center' });

  // Draw final page footer
  drawRaportFooter(3);

  return doc;
}
