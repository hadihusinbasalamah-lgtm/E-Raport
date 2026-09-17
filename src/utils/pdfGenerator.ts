/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SchemaDatabase, Siswa, PeriodeAkademik, Mapel } from '../types';

// Helper to identify Yayasan religious subjects (exact same as GuruCetak.tsx)
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

// Helper to split competency descriptions into Mastery vs Needed support (exact same as GuruCetak.tsx)
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

// Helper to get active font size for Capaian Kompetensi based on text length (proportional to GuruCetak.tsx)
const getCpFontSize = (text: string) => {
  if (!text) return 8;
  if (text.length > 200) return 6.8;
  if (text.length > 130) return 7.4;
  return 8;
};

export function generateSiswaPDF(student: Siswa, db: SchemaDatabase, activePeriod: PeriodeAkademik): jsPDF {
  // Initialize standard A4 PDF (210mm x 297mm)
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

  // Group and sort subjects identically to GuruCetak.tsx
  const unfilteredUmum = results.filter(r => !isYayasanSubject(r.mapelNama));
  const yayasanList = results.filter(r => isYayasanSubject(r.mapelNama));

  // Sort umumList to put "Pendidikan Agama Islam" at position 1 (index 0)
  const sortedUmum = [...unfilteredUmum].sort((a, b) => {
    const aAgama = a.mapelNama.toLowerCase().includes('pendidikan agama islam') || a.mapelNama.toLowerCase().includes('agama islam');
    const bAgama = b.mapelNama.toLowerCase().includes('pendidikan agama islam') || b.mapelNama.toLowerCase().includes('agama islam');
    if (aAgama && !bAgama) return -1;
    if (!aAgama && bAgama) return 1;
    return 0;
  });

  // Distribute subjects to 3 pages exactly as in GuruCetak.tsx
  const page1Umum = sortedUmum.slice(0, 5); // Subjects 1 to 5 (Mata Pelajaran Umum)
  const page2Umum = sortedUmum.slice(5, 11); // Subjects 6 to 11 (Mata Pelajaran Umum)
  const page2Yayasan = yayasanList.slice(0, 1); // Subject 12 (Aqidah - YAYASAN)
  const page3Yayasan = yayasanList.slice(1); // Subjects 13 to 16 (Fiqih, SKI, Arab, Tahfidz)

  const formattedSemester = (sem: string) => {
    if (sem.toLowerCase().includes('ganjil') || sem === '1' || sem.toLowerCase() === 'i') {
      return 'I (Satu)';
    }
    return 'II (Dua)';
  };

  const formattedReportDate = activePeriod.tanggalRaport 
    ? new Date(activePeriod.tanggalRaport).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) 
    : new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'});

  // Helper to draw footer on raport pages (Halaman 1 dari 3, etc.) exactly like GuruCetak.tsx
  const drawRaportFooter = (pageNum: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);
    
    doc.text(`SMP Al-Irsyad Surakarta  •  ${student.nama.toUpperCase()}`, 15, pageHeight - 7.5);
    doc.text(`Halaman ${pageNum} dari 3`, pageWidth - 15, pageHeight - 7.5, { align: 'right' });
    doc.setTextColor(0, 0, 0); // Reset
  };

  // =========================================================================
  // PAGE 1: COVER PAGE (Identical layout to GuruCetak.tsx raport-cover)
  // =========================================================================
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.text('LAPORAN HASIL BELAJAR SISWA', pageWidth / 2, 40, { align: 'center' });
  doc.text('SMP AL IRSYAD SURAKARTA', pageWidth / 2, 48, { align: 'center' });

  // Center boxes for NAMA PESERTA DIDIK and NISN (balanced in the middle)
  const boxWidth = 127;
  const boxHeight = 15;
  const boxX = (pageWidth - boxWidth) / 2;

  // Box 1: NAMA PESERTA DIDIK
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('NAMA PESERTA DIDIK', pageWidth / 2, 138, { align: 'center' });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(boxX, 143, boxWidth, boxHeight);

  doc.setFont('times', 'normal');
  doc.setFontSize(13);
  doc.text(student.nama.toUpperCase(), pageWidth / 2, 153, { align: 'center' });

  // Box 2: NISN
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('NISN', pageWidth / 2, 172, { align: 'center' });

  doc.rect(boxX, 177, boxWidth, boxHeight);

  doc.setFont('times', 'normal');
  doc.setFontSize(13);
  doc.text(student.nisn || student.nis || '-', pageWidth / 2, 187, { align: 'center' });

  // =========================================================================
  // PAGE 2: RAPORT PAGE 1 (Halaman 1 dari 3)
  // =========================================================================
  doc.addPage();

  // Title (identical to GuruCetak.tsx)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PENCAPAIAN KOMPETENSI PESERTA DIDIK', pageWidth / 2, 16, { align: 'center' });

  // Student & School Metadata (border-none table matching GuruCetak.tsx layout)
  autoTable(doc, {
    startY: 21,
    margin: { left: 15, right: 15 },
    theme: 'plain',
    body: [
      [
        { content: 'Nama Sekolah', styles: { cellWidth: 32 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: 'SMP Al-Irsyad Surakarta', styles: { cellWidth: 70, fontStyle: 'bold' } },
        { content: 'Kelas', styles: { cellWidth: 26 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: targetKelas?.nama || '-', styles: { cellWidth: 44, fontStyle: 'bold' } },
      ],
      [
        { content: 'Alamat', styles: { cellWidth: 32 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: 'Jl. Kapten Mulyadi No. 117 Surakarta', styles: { cellWidth: 70 } },
        { content: 'Fase', styles: { cellWidth: 26 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: 'D', styles: { cellWidth: 44, fontStyle: 'bold' } },
      ],
      [
        { content: 'Nama Peserta Didik', styles: { cellWidth: 32 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: student.nama.toUpperCase(), styles: { cellWidth: 70, fontStyle: 'bold' } },
        { content: 'Semester', styles: { cellWidth: 26 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: formattedSemester(activePeriod.semester), styles: { cellWidth: 44, fontStyle: 'bold' } },
      ],
      [
        { content: 'Nomor Induk', styles: { cellWidth: 32 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: student.nis || '-', styles: { cellWidth: 70, fontStyle: 'bold' } },
        { content: 'Tahun Ajaran', styles: { cellWidth: 26 } },
        { content: ':', styles: { cellWidth: 4, halign: 'center' } },
        { content: activePeriod.tahunAjaran, styles: { cellWidth: 44, fontStyle: 'bold' } },
      ],
    ],
    styles: {
      fontSize: 8.5,
      cellPadding: 1,
      textColor: [0, 0, 0],
      font: 'helvetica'
    }
  });

  const metadataEndY = (doc as any).lastAutoTable?.finalY || 42;

  // Build Page 1 Grades Rows (Subjects 1 to 5)
  const page1BodyRows: any[] = [];
  page1BodyRows.push([
    {
      content: 'Mata Pelajaran Umum',
      colSpan: 4,
      styles: {
        fillColor: [241, 245, 249],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
        textColor: [0, 0, 0],
        cellPadding: 2.2
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
      { content: split.master, styles: { fontSize: fsMaster, halign: 'justify', cellPadding: 2.2 } }
    ]);
    page1BodyRows.push([
      { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'justify', cellPadding: 2.2 } }
    ]);
  });

  autoTable(doc, {
    startY: metadataEndY + 4,
    margin: { left: 15, right: 15 },
    theme: 'grid',
    head: [['No', 'Mata Pelajaran', 'Nilai\nAkhir', 'Capaian Kompetensi']],
    body: page1BodyRows,
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2
    },
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      font: 'helvetica'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 49 },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 103 }
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
      { content: split.master, styles: { fontSize: fsMaster, halign: 'justify', cellPadding: 2.2 } }
    ]);
    page2BodyRows.push([
      { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'justify', cellPadding: 2.2 } }
    ]);
  });

  if (page2Yayasan.length > 0) {
    // Banner header: "YAYASAN" in uppercase
    page2BodyRows.push([
      {
        content: 'YAYASAN',
        colSpan: 4,
        styles: {
          fillColor: [241, 245, 249],
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'left',
          textColor: [0, 0, 0],
          cellPadding: 2.2
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
        { content: split.master, styles: { fontSize: fsMaster, halign: 'justify', cellPadding: 2.2 } }
      ]);
      page2BodyRows.push([
        { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'justify', cellPadding: 2.2 } }
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
      fillColor: [248, 250, 252],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2
    },
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      font: 'helvetica'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 49 },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 103 }
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
      { content: split.master, styles: { fontSize: fsMaster, halign: 'justify', cellPadding: 2.2 } }
    ]);
    page3BodyRows.push([
      { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'justify', cellPadding: 2.2 } }
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
        fillColor: [248, 250, 252],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 8.5,
        lineColor: [0, 0, 0],
        lineWidth: 0.2
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
        font: 'helvetica'
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 49 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 103 }
      }
    });
    tableYayasanEndY = (doc as any).lastAutoTable?.finalY || 15;
  }

  // Headings C and D (identical to GuruCetak.tsx)
  const sectionsStartY = tableYayasanEndY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('C. Ekstrakurikuler', 15, sectionsStartY);
  doc.text('D. Ketidakhadiran', 122, sectionsStartY);

  // Compile Ekstrakurikuler (col-span-7: 102mm width)
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
    startY: sectionsStartY + 2.5,
    margin: { left: 15 },
    tableWidth: 102,
    theme: 'grid',
    head: [['No', 'Kegiatan Ekstrakurikuler', 'Predikat']],
    body: ekskulRows,
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2
    },
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      font: 'helvetica'
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 70, fontStyle: 'bold' },
      2: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }
    }
  });

  // Compile Ketidakhadiran (col-span-5: 73mm width)
  const attendanceRows = [
    ['Sakit', ':', `${attendance?.sakit || 0} Hari`],
    ['Izin', ':', `${attendance?.izin || 0} Hari`],
    ['Tanpa Keterangan', ':', `${attendance?.alfa || 0} Hari`]
  ];

  autoTable(doc, {
    startY: sectionsStartY + 2.5,
    margin: { left: 122 },
    tableWidth: 73,
    theme: 'grid',
    head: [],
    body: attendanceRows,
    styles: {
      fontSize: 8.5,
      cellPadding: 2.8,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      font: 'helvetica'
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      1: { cellWidth: 7, halign: 'center' },
      2: { cellWidth: 28, halign: 'center', fontStyle: 'bold' }
    }
  });

  const sectionsEndY = Math.max(
    (doc as any).lastAutoTable?.finalY || 0,
    sectionsStartY + 22
  );

  // =========================================================================
  // SIGNATURES SECTION (Identical 2-column layout to GuruCetak.tsx)
  // Left column center: X = 60mm | Right column center: X = 150mm
  // =========================================================================
  const sigY = Math.max(sectionsEndY + 8, 120);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);

  // Left: Orangtua / Wali (line 1 blank to align with date on right)
  doc.text('Mengetahui,', 60, sigY + 4, { align: 'center' });
  doc.text('Orangtua/ Wali', 60, sigY + 8.5, { align: 'center' });
  doc.text('.....................................................', 60, sigY + 34, { align: 'center' });

  // Right: Wali Kelas
  doc.text(`Surakarta, ${formattedReportDate}`, 150, sigY, { align: 'center' });
  doc.text('Mengetahui,', 150, sigY + 4, { align: 'center' });
  doc.text('Wali Kelas', 150, sigY + 8.5, { align: 'center' });

  const teacherName = classTeacher?.nama || '___________________';
  const teacherNik = classTeacher?.username || '-';

  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, 150, sigY + 34, { align: 'center' });
  
  // Underline teacher name
  const teacherNameWidth = doc.getTextWidth(teacherName);
  const teacherXStart = 150 - (teacherNameWidth / 2);
  doc.setLineWidth(0.25);
  doc.line(teacherXStart, sigY + 35, teacherXStart + teacherNameWidth, sigY + 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`NIK. ${teacherNik}`, 150, sigY + 39, { align: 'center' });
  doc.setTextColor(0, 0, 0);

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
  doc.setTextColor(80, 80, 80);
  doc.text('NIK. 103.244.0072', 105, principalY + 33, { align: 'center' });

  // Draw final page footer
  drawRaportFooter(3);

  return doc;
}
