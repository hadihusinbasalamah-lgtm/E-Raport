/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SchemaDatabase, Siswa, PeriodeAkademik, Mapel } from '../types';

// Helper to identify Yayasan religious subjects
const isYayasanSubject = (name: string): boolean => {
  const lowercaseName = name.toLowerCase();
  return (
    lowercaseName.includes('aqidah') ||
    lowercaseName.includes('akidah') ||
    lowercaseName.includes('fiqih') ||
    lowercaseName.includes('fikih') ||
    lowercaseName.includes('ski') ||
    lowercaseName.includes('sejarah kebudayaan islam') ||
    lowercaseName.includes('bahasa arab') ||
    lowercaseName.includes('tahfidz') ||
    lowercaseName.includes('qur\'an') ||
    lowercaseName.includes('quran') ||
    lowercaseName.includes('hadist') ||
    lowercaseName.includes('hadits') ||
    lowercaseName.includes('al-qur') ||
    lowercaseName.includes('ulumul quran')
  );
};

// Priority ordering matching SMP Al-Irsyad Surakarta official curriculum
const getSubjectPriority = (name: string, isYayasan: boolean): number => {
  const n = name.toLowerCase().trim();
  if (!isYayasan) {
    if (n.includes('matematika')) return 1;
    if (n.includes('sosial') || n.includes('ips')) return 2;
    if (n.includes('jasmani') || n.includes('pjok') || n.includes('penjas') || n.includes('olahraga')) return 3;
    if (n.includes('alam') || n.includes('ipa')) return 4;
    if (n.includes('informatika') || n.includes('tik') || n.includes('komputer')) return 5;
    if (n.includes('seni') || n.includes('budaya') || n.includes('prakarya')) return 6;
    if (n.includes('pancasila') || n.includes('kewarganegaraan') || n.includes('ppkn')) return 7;
    if (n.includes('inggris')) return 8;
    if (n.includes('indonesia')) return 9;
    if (n.includes('jawa')) return 10;
    if (n.includes('agama') || n.includes('budi pekerti') || n.includes('pai')) return 11;
    return 50;
  } else {
    if (n.includes('fiqih') || n.includes('fikih')) return 1;
    if (n.includes('arab')) return 2;
    if (n.includes('ski') || n.includes('sejarah kebudayaan islam')) return 3;
    if (n.includes('tahfidz') || n.includes('tahfid') || n.includes('qur\'an') || n.includes('quran') || n.includes('al-qur')) return 4;
    if (n.includes('aqidah') || n.includes('akidah')) return 5;
    return 50;
  }
};

// Helper to split competency descriptions into Mastery vs Needed support
const splitCapaian = (desc: string) => {
  const fallback = {
    master: 'Menunjukkan penguasaan sangat baik dalam keseluruhan tujuan pembelajaran yang ditempuh.',
    needsImprovement: 'Perlu bimbingan dan pembiasaan berkelanjutan dalam pemantapan materi.'
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
    'Perlu bimbingan dalam'
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

  return {
    master: desc.endsWith('.') ? desc : desc + '.',
    needsImprovement: 'Perlu bimbingan dalam pemantapan pemahaman keseluruhan materi.'
  };
};

// Helper to get active font size for Capaian Kompetensi based on text length
const getCpFontSize = (text: string) => {
  if (!text) return 8;
  if (text.length > 200) return 6.8;
  if (text.length > 130) return 7.4;
  return 8;
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
        mapelNama: mapel.nama,
        nilaiAkhir: gradeRecord.nilaiAkhir,
        capaian: gradeRecord.capaianKompetensi || 'Telah mengikuti pembelajaran dengan baik.'
      });
    }
  });

  const attendance = (db.absensiDanCatatan || []).find(
    a => a.periodeId === activePeriod.id && a.siswaId === student.id
  );

  // Group and sort subjects identically to SMP Al-Irsyad official curriculum
  const unfilteredUmum = results.filter(r => !isYayasanSubject(r.mapelNama));
  const unfilteredYayasan = results.filter(r => isYayasanSubject(r.mapelNama));

  // Sort Umum
  const sortedUmum = [...unfilteredUmum].sort((a, b) => {
    const pA = getSubjectPriority(a.mapelNama, false);
    const pB = getSubjectPriority(b.mapelNama, false);
    return pA - pB;
  });

  // Sort Yayasan
  const sortedYayasan = [...unfilteredYayasan].sort((a, b) => {
    const pA = getSubjectPriority(a.mapelNama, true);
    const pB = getSubjectPriority(b.mapelNama, true);
    return pA - pB;
  });

  // Distribute subjects to 3 pages exactly as in the official sample
  const page1Umum = sortedUmum.slice(0, 5); // Subjects 1 to 5 (Mata Pelajaran Umum)
  const page2Umum = sortedUmum.slice(5, 11); // Subjects 6 to 11 (Mata Pelajaran Umum)
  const page2Yayasan = sortedYayasan.slice(0, 1); // Subject 12 (Fiqih - YAYASAN)
  const page3Yayasan = sortedYayasan.slice(1); // Subjects 13 to 16 (Bahasa Arab, SKI, Tahfidz, Aqidah)

  const formattedSemester = (sem: string) => {
    if (sem.toLowerCase().includes('ganjil') || sem === '1' || sem.toLowerCase() === 'i') {
      return 'I (Satu)';
    }
    return 'II (Dua)';
  };

  const formattedReportDate = activePeriod.tanggalRaport 
    ? new Date(activePeriod.tanggalRaport).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) 
    : new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'});

  // Helper to draw footer on raport pages (clean, no divider line, exact match to screenshot)
  const drawRaportFooter = (pageNum: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    
    // Left: School & Student Name
    doc.text(`SMP Al-Irsyad Surakarta  •  ${student.nama.toUpperCase()}`, 15, pageHeight - 10);
    // Right: Page number
    doc.text(`Halaman ${pageNum} dari 3`, pageWidth - 15, pageHeight - 10, { align: 'right' });
    doc.setTextColor(0, 0, 0); // Reset
  };

  // =========================================================================
  // PAGE 1: COVER PAGE (Identical layout to sample: lower-third box positions)
  // =========================================================================
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.text('LAPORAN HASIL BELAJAR SISWA', pageWidth / 2, 42, { align: 'center' });
  doc.text('SMP AL IRSYAD SURAKARTA', pageWidth / 2, 50, { align: 'center' });

  // Center boxes for NAMA PESERTA DIDIK and NISN (placed in lower section)
  const boxWidth = 146;
  const boxHeight = 14;
  const boxX = (pageWidth - boxWidth) / 2; // 32mm

  // Box 1: NAMA PESERTA DIDIK
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text('NAMA PESERTA DIDIK', pageWidth / 2, 216, { align: 'center' });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(boxX, 221, boxWidth, boxHeight);

  doc.setFont('times', 'normal');
  doc.setFontSize(13);
  doc.text(student.nama.toUpperCase(), pageWidth / 2, 230, { align: 'center' });

  // Box 2: NISN
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text('NISN', pageWidth / 2, 247, { align: 'center' });

  doc.rect(boxX, 252, boxWidth, boxHeight);

  doc.setFont('times', 'normal');
  doc.setFontSize(13);
  doc.text(student.nisn || student.nis || '-', pageWidth / 2, 261, { align: 'center' });

  // =========================================================================
  // PAGE 2: RAPORT PAGE 1 (Halaman 1 dari 3)
  // =========================================================================
  doc.addPage();

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PENCAPAIAN KOMPETENSI PESERTA DIDIK', pageWidth / 2, 16, { align: 'center' });

  // Student & School Metadata (border-none table matching sample)
  autoTable(doc, {
    startY: 21,
    margin: { left: 15, right: 15 },
    theme: 'plain',
    body: [
      [
        { content: 'Nama Sekolah', styles: { cellWidth: 35 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: 'SMP Al-Irsyad Surakarta', styles: { cellWidth: 59 } },
        { content: 'Kelas', styles: { cellWidth: 24 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: targetKelas?.nama || '-', styles: { cellWidth: 54, fontStyle: 'bold' } },
      ],
      [
        { content: 'Alamat', styles: { cellWidth: 35 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: 'Jl. Kapten Mulyadi No. 117 Surakarta', styles: { cellWidth: 59 } },
        { content: 'Fase', styles: { cellWidth: 24 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: 'D', styles: { cellWidth: 54, fontStyle: 'bold' } },
      ],
      [
        { content: 'Nama Peserta Didik', styles: { cellWidth: 35 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: student.nama.toUpperCase(), styles: { cellWidth: 59, fontStyle: 'bold' } },
        { content: 'Semester', styles: { cellWidth: 24 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: formattedSemester(activePeriod.semester), styles: { cellWidth: 54, fontStyle: 'bold' } },
      ],
      [
        { content: 'Nomor Induk', styles: { cellWidth: 35 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: student.nis || '-', styles: { cellWidth: 59 } },
        { content: 'Tahun Ajaran', styles: { cellWidth: 24 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: activePeriod.tahunAjaran, styles: { cellWidth: 54, fontStyle: 'bold' } },
      ],
    ],
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
      textColor: [0, 0, 0],
      font: 'helvetica'
    }
  });

  const metadataEndY = (doc as any).lastAutoTable?.finalY || 39;

  // Build Page 1 Grades Rows (Subjects 1 to 5)
  const page1BodyRows: any[] = [];
  page1BodyRows.push([
    {
      content: 'MATA PELAJARAN UMUM',
      colSpan: 4,
      styles: {
        fillColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
        textColor: [0, 0, 0],
        cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 }
      }
    }
  ]);

  page1Umum.forEach((r, idx) => {
    const split = splitCapaian(r.capaian);
    const fsMaster = getCpFontSize(split.master);
    const fsNeeds = getCpFontSize(split.needsImprovement);
    
    page1BodyRows.push([
      { content: (idx + 1).toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 8.5 } },
      { content: r.mapelNama, rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5 } },
      { content: r.nilaiAkhir.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5 } },
      { content: split.master, styles: { fontSize: fsMaster, halign: 'left', cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } } }
    ]);
    page1BodyRows.push([
      { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'left', cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } } }
    ]);
  });

  autoTable(doc, {
    startY: metadataEndY + 3,
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
      fontSize: 8.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.25
    },
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      font: 'helvetica'
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
  // PAGE 3: RAPORT PAGE 2 (Halaman 2 dari 3)
  // =========================================================================
  doc.addPage();

  const page2BodyRows: any[] = [];
  page2Umum.forEach((r, idx) => {
    const split = splitCapaian(r.capaian);
    const globalIdx = 5 + idx + 1; // 6, 7, 8, 9, 10, 11
    const fsMaster = getCpFontSize(split.master);
    const fsNeeds = getCpFontSize(split.needsImprovement);
    
    page2BodyRows.push([
      { content: globalIdx.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 8.5 } },
      { content: r.mapelNama, rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5 } },
      { content: r.nilaiAkhir.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5 } },
      { content: split.master, styles: { fontSize: fsMaster, halign: 'left', cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } } }
    ]);
    page2BodyRows.push([
      { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'left', cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } } }
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
          fontSize: 8.5,
          halign: 'left',
          textColor: [0, 0, 0],
          cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 }
        }
      }
    ]);

    page2Yayasan.forEach((r, idx) => {
      const split = splitCapaian(r.capaian);
      const globalIdx = 11 + idx + 1; // Subject 12
      const fsMaster = getCpFontSize(split.master);
      const fsNeeds = getCpFontSize(split.needsImprovement);
      
      page2BodyRows.push([
        { content: globalIdx.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 8.5 } },
        { content: r.mapelNama, rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5 } },
        { content: r.nilaiAkhir.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5 } },
        { content: split.master, styles: { fontSize: fsMaster, halign: 'left', cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } } }
      ]);
      page2BodyRows.push([
        { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'left', cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } } }
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
      fontSize: 8.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.25
    },
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      font: 'helvetica'
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
  // PAGE 4: RAPORT PAGE 3 (Halaman 3 dari 3: Yayasan, Ekstra, Absen, Signatures)
  // =========================================================================
  doc.addPage();

  const page3BodyRows: any[] = [];
  page3Yayasan.forEach((r, idx) => {
    const split = splitCapaian(r.capaian);
    const globalIdx = 12 + idx + 1; // 13, 14, 15, 16
    const fsMaster = getCpFontSize(split.master);
    const fsNeeds = getCpFontSize(split.needsImprovement);
    
    page3BodyRows.push([
      { content: globalIdx.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 8.5 } },
      { content: r.mapelNama, rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5 } },
      { content: r.nilaiAkhir.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5 } },
      { content: split.master, styles: { fontSize: fsMaster, halign: 'left', cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } } }
    ]);
    page3BodyRows.push([
      { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'left', cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } } }
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
        fontSize: 8.5,
        lineColor: [0, 0, 0],
        lineWidth: 0.25
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        textColor: [0, 0, 0],
        font: 'helvetica'
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', valign: 'middle' },
        1: { cellWidth: 48, halign: 'center', valign: 'middle' },
        2: { cellWidth: 16, halign: 'center', valign: 'middle' },
        3: { cellWidth: 106, valign: 'middle' }
      }
    });
    tableYayasanEndY = (doc as any).lastAutoTable?.finalY || 15;
  }

  // Headings C and D (identical to sample)
  const sectionsStartY = tableYayasanEndY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
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

  autoTable(doc, {
    startY: sectionsStartY + 2,
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
      fontSize: 8.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.25
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      font: 'helvetica'
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', valign: 'middle' },
      1: { cellWidth: 66, fontStyle: 'bold', halign: 'left', valign: 'middle' },
      2: { cellWidth: 20, halign: 'center', fontStyle: 'bold', valign: 'middle' }
    }
  });

  // Compile Ketidakhadiran (75mm width)
  const attendanceRows = [
    ['Sakit', ':', `${attendance?.sakit || 0} Hari`],
    ['Izin', ':', `${attendance?.izin || 0} Hari`],
    ['Tanpa Keterangan', ':', `${attendance?.alfa || 0} Hari`]
  ];

  autoTable(doc, {
    startY: sectionsStartY + 2,
    margin: { left: 120 },
    tableWidth: 75,
    theme: 'grid',
    head: [],
    body: attendanceRows,
    styles: {
      fontSize: 8.5,
      cellPadding: 2.6,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      font: 'helvetica'
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold', halign: 'left', valign: 'middle' },
      1: { cellWidth: 7, halign: 'center', valign: 'middle' },
      2: { cellWidth: 30, halign: 'center', fontStyle: 'bold', valign: 'middle' }
    }
  });

  const sectionsEndY = Math.max(
    (doc as any).lastAutoTable?.finalY || 0,
    sectionsStartY + 22
  );

  // =========================================================================
  // SIGNATURES SECTION (Identical layout to sample)
  // Left column center: X = 55mm | Right column center: X = 155mm
  // =========================================================================
  const sigY = Math.max(sectionsEndY + 12, 130);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);

  // Left: Orangtua / Wali
  doc.text('Mengetahui,', 55, sigY + 4, { align: 'center' });
  doc.text('Orangtua/ Wali', 55, sigY + 8.5, { align: 'center' });
  doc.text('.....................................................', 55, sigY + 34, { align: 'center' });

  // Right: Wali Kelas
  doc.text(`Surakarta, ${formattedReportDate}`, 155, sigY, { align: 'center' });
  doc.text('Mengetahui,', 155, sigY + 4, { align: 'center' });
  doc.text('Wali Kelas', 155, sigY + 8.5, { align: 'center' });

  const teacherName = classTeacher?.nama || 'Hadi Husin, S.Kom.';
  const teacherNik = classTeacher?.username || '103.244.00264';

  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, 155, sigY + 34, { align: 'center' });
  
  // Underline teacher name
  const teacherNameWidth = doc.getTextWidth(teacherName);
  const teacherXStart = 155 - (teacherNameWidth / 2);
  doc.setLineWidth(0.25);
  doc.line(teacherXStart, sigY + 35, teacherXStart + teacherNameWidth, sigY + 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`NIK. ${teacherNik}`, 155, sigY + 38.5, { align: 'center' });

  // Center bottom: Kepala Sekolah (centered at pageWidth / 2 = 105mm)
  const principalY = sigY + 48;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Mengetahui,', 105, principalY, { align: 'center' });
  doc.text('Kepala Sekolah', 105, principalY + 4.5, { align: 'center' });

  const principalName = 'Andreas Raymonda, S.Pd, M.Hum';
  doc.setFont('helvetica', 'bold');
  doc.text(principalName, 105, principalY + 28, { align: 'center' });
  
  // Underline principal name
  const principalNameWidth = doc.getTextWidth(principalName);
  const principalXStart = 105 - (principalNameWidth / 2);
  doc.line(principalXStart, principalY + 29, principalXStart + principalNameWidth, principalY + 29);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('NIK. 103.244.0072', 105, principalY + 32.5, { align: 'center' });

  // Draw final page footer
  drawRaportFooter(3);

  return doc;
}
