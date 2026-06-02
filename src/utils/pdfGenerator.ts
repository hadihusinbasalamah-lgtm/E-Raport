/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SchemaDatabase, Siswa, PeriodeAkademik } from '../types';

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
  if (text.length > 200) return 6.5;
  if (text.length > 130) return 7.2;
  return 8;
};

export function generateSiswaPDF(student: Siswa, db: SchemaDatabase, activePeriod: PeriodeAkademik): jsPDF {
  // Initialize A4 PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Load classroom and wali info
  const targetKelas = activePeriod.snapshotKelas.find(k => k.id === student.kelasId) || db.kelas.find(k => k.id === student.kelasId);
  const classTeacher = activePeriod.snapshotGuru.find(g => g.id === targetKelas?.waliKelasId) || db.guru.find(g => g.id === targetKelas?.waliKelasId);

  // Collect grades
  const results: { mapelNama: string; nilaiAkhir: number; capaian: string }[] = [];
  activePeriod.snapshotMapel.forEach(mapel => {
    const gradeId = `${activePeriod.id}_${student.id}_${mapel.id}`;
    const gradeRecord = db.nilaiSiswa.find(n => n.id === gradeId);
    
    if (gradeRecord) {
      results.push({
        mapelNama: mapel.nama,
        nilaiAkhir: gradeRecord.nilaiAkhir,
        capaian: gradeRecord.capaianKompetensi || 'Telah mengikuti pembelajaran dengan baik.'
      });
    }
  });

  const attendance = db.absensiDanCatatan.find(
    a => a.periodeId === activePeriod.id && a.siswaId === student.id
  );

  // Group and sort subjects
  const unfilteredUmum = results.filter(r => !isYayasanSubject(r.mapelNama));
  const yayasanList = results.filter(r => isYayasanSubject(r.mapelNama));
  const sortedUmum = [...unfilteredUmum].sort((a, b) => {
    const aAgama = a.mapelNama.toLowerCase().includes('pendidikan agama islam') || a.mapelNama.toLowerCase().includes('agama islam');
    const bAgama = b.mapelNama.toLowerCase().includes('pendidikan agama islam') || b.mapelNama.toLowerCase().includes('agama islam');
    if (aAgama && !bAgama) return -1;
    if (!aAgama && bAgama) return 1;
    return 0;
  });

  // Distribute subjects to 3 pages exactly as in GuruCetak
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

  // Helper to draw header metadata on raport pages (Only drawn on Page 2 / Halaman 1)
  const drawRaportHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('PENCAPAIAN KOMPETENSI PESERTA DIDIK', pageWidth / 2, 16, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    
    const leftColX = 15;
    const rightColX = pageWidth - 75;
    
    // Rows
    const row1Y = 24;
    const row2Y = 29;
    const row3Y = 34;
    const row4Y = 39;
    
    // Left Column
    doc.text('Nama Sekolah', leftColX, row1Y);
    doc.text(':', leftColX + 30, row1Y);
    doc.setFont('helvetica', 'bold');
    doc.text('SMP Al-Irsyad Surakarta', leftColX + 32, row1Y);
    doc.setFont('helvetica', 'normal');
    
    doc.text('Alamat', leftColX, row2Y);
    doc.text(':', leftColX + 30, row2Y);
    doc.text('Jl. Kapten Mulyadi No. 117 Surakarta', leftColX + 32, row2Y);
    
    doc.text('Nama Peserta Didik', leftColX, row3Y);
    doc.text(':', leftColX + 30, row3Y);
    doc.setFont('helvetica', 'bold');
    doc.text(student.nama, leftColX + 32, row3Y);
    doc.setFont('helvetica', 'normal');
    
    doc.text('Nomor Induk', leftColX, row4Y);
    doc.text(':', leftColX + 30, row4Y);
    doc.text(student.nis || '-', leftColX + 32, row4Y);
    
    // Right Column
    doc.text('Kelas', rightColX, row1Y);
    doc.text(':', rightColX + 22, row1Y);
    doc.setFont('helvetica', 'bold');
    doc.text(targetKelas?.nama || '-', rightColX + 24, row1Y);
    doc.setFont('helvetica', 'normal');
    
    doc.text('Fase', rightColX, row2Y);
    doc.text(':', rightColX + 22, row2Y);
    doc.text('D', rightColX + 24, row2Y);
    
    doc.text('Semester', rightColX, row3Y);
    doc.text(':', rightColX + 22, row3Y);
    doc.text(formattedSemester(activePeriod.semester), rightColX + 24, row3Y);
    
    doc.text('Tahun Ajaran', rightColX, row4Y);
    doc.text(':', rightColX + 22, row4Y);
    doc.text(activePeriod.tahunAjaran, rightColX + 24, row4Y);

    // Hard line separator
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(15, 43, pageWidth - 15, 43);
  };

  // Helper to draw footer on raport pages
  const drawRaportFooter = (pageNum: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);
    
    doc.text(`SMP Al-Irsyad Surakarta  •  ${student.nama.toUpperCase()}`, 15, pageHeight - 8);
    doc.text(`Halaman ${pageNum} dari 3`, pageWidth - 40, pageHeight - 8);
    doc.setTextColor(0, 0, 0); // Reset
  };

  // ==========================================
  // PAGE 1: COVER / MAIN ID SHEET
  // ==========================================
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  
  doc.text('LAPORAN HASIL BELAJAR SISWA', pageWidth / 2, 45, { align: 'center' });
  doc.text('SMP AL IRSYAD SURAKARTA', pageWidth / 2, 53, { align: 'center' });
  
  const boxWidth = 140;
  const boxHeight = 16;
  const startBoxX = (pageWidth - boxWidth) / 2;
  
  doc.setFontSize(14);
  doc.text('NAMA PESERTA DIDIK', pageWidth / 2, 110, { align: 'center' });
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(startBoxX, 114, boxWidth, boxHeight);
  
  doc.setFont('times', 'normal');
  doc.setFontSize(13);
  doc.text(student.nama.toUpperCase(), pageWidth / 2, 124, { align: 'center' });
  
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('NISN', pageWidth / 2, 145, { align: 'center' });
  
  doc.rect(startBoxX, 149, boxWidth, boxHeight);
  
  doc.setFont('times', 'normal');
  doc.setFontSize(13);
  doc.text(student.nisn || student.nis || '-', pageWidth / 2, 159, { align: 'center' });

  // Elegant border on cover page
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // ==========================================
  // PAGE 2: RAPORT PAGE 1 (Halaman 1)
  // ==========================================
  doc.addPage();
  drawRaportHeader();

  doc.setFont('helvetica', 'normal');

  const page1BodyRows: any[] = [];
  // Section Header row
  page1BodyRows.push([
    {
      content: 'Mata Pelajaran Umum',
      colSpan: 4,
      styles: {
        fillColor: [245, 245, 245],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'left',
        textColor: [0, 0, 0]
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
      { content: split.master, styles: { fontSize: fsMaster, halign: 'justify', cellPadding: 2 } }
    ]);
    page1BodyRows.push([
      { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'justify', cellPadding: 2 } }
    ]);
  });

  autoTable(doc, {
    startY: 47,
    margin: { left: 15, right: 15 },
    theme: 'grid',
    head: [['No', 'Mata Pelajaran', 'Nilai\nAkhir', 'Capaian Kompetensi']],
    body: page1BodyRows,
    headStyles: {
      fillColor: [245, 245, 245],
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

  // ==========================================
  // PAGE 3: RAPORT PAGE 2 (Halaman 2)
  // ==========================================
  doc.addPage();
  doc.setFont('helvetica', 'normal');

  const page2BodyRows: any[] = [];
  page2Umum.forEach((r, idx) => {
    const split = splitCapaian(r.capaian);
    const globalIdx = 5 + idx + 1; // 6, 7, 8 etc.
    const fsMaster = getCpFontSize(split.master);
    const fsNeeds = getCpFontSize(split.needsImprovement);
    
    page2BodyRows.push([
      { content: globalIdx.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 8.5 } },
      { content: r.mapelNama, rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5 } },
      { content: r.nilaiAkhir.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5 } },
      { content: split.master, styles: { fontSize: fsMaster, halign: 'justify', cellPadding: 2 } }
    ]);
    page2BodyRows.push([
      { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'justify', cellPadding: 2 } }
    ]);
  });

  if (page2Yayasan.length > 0) {
    // Add banner: "YAYASAN" in uppercase
    page2BodyRows.push([
      {
        content: 'YAYASAN',
        colSpan: 4,
        styles: {
          fillColor: [245, 245, 245],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'left',
          textColor: [0, 0, 0]
        }
      }
    ]);

    page2Yayasan.forEach((r, idx) => {
      const split = splitCapaian(r.capaian);
      const globalIdx = 11 + idx + 1; // 12
      const fsMaster = getCpFontSize(split.master);
      const fsNeeds = getCpFontSize(split.needsImprovement);
      
      page2BodyRows.push([
        { content: globalIdx.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 8.5 } },
        { content: r.mapelNama, rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5 } },
        { content: r.nilaiAkhir.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5 } },
        { content: split.master, styles: { fontSize: fsMaster, halign: 'justify', cellPadding: 2 } }
      ]);
      page2BodyRows.push([
        { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'justify', cellPadding: 2 } }
      ]);
    });
  }

  autoTable(doc, {
    startY: 15, // No header, start high to match print
    margin: { left: 15, right: 15 },
    theme: 'grid',
    head: [['No', 'Mata Pelajaran', 'Nilai\nAkhir', 'Capaian Kompetensi']],
    body: page2BodyRows,
    headStyles: {
      fillColor: [245, 245, 245],
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

  // ==========================================
  // PAGE 4: RAPORT PAGE 3 (Halaman 3)
  // ==========================================
  doc.addPage();
  doc.setFont('helvetica', 'normal');

  const page3BodyRows: any[] = [];
  page3Yayasan.forEach((r, idx) => {
    const split = splitCapaian(r.capaian);
    const globalIdx = 12 + idx + 1; // 13, 14, etc.
    const fsMaster = getCpFontSize(split.master);
    const fsNeeds = getCpFontSize(split.needsImprovement);
    
    page3BodyRows.push([
      { content: globalIdx.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 8.5 } },
      { content: r.mapelNama, rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5 } },
      { content: r.nilaiAkhir.toString(), rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 8.5 } },
      { content: split.master, styles: { fontSize: fsMaster, halign: 'justify', cellPadding: 2 } }
    ]);
    page3BodyRows.push([
      { content: split.needsImprovement, styles: { fontSize: fsNeeds, halign: 'justify', cellPadding: 2 } }
    ]);
  });

  // Render Yayasan list on page 3 if any
  let tableYayasanEndY = 15;
  if (page3BodyRows.length > 0) {
    autoTable(doc, {
      startY: 15,
      margin: { left: 15, right: 15 },
      theme: 'grid',
      head: [['No', 'Mata Pelajaran', 'Nilai\nAkhir', 'Capaian Kompetensi']],
      body: page3BodyRows,
      headStyles: {
        fillColor: [245, 245, 245],
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

  // Draw Headings for C. EKSTRAKURIKULER and D. KETIDAKHADIRAN in uppercase
  const sectionsStartY = tableYayasanEndY + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('C. EKSTRAKURIKULER', 15, sectionsStartY);
  doc.text('D. KETIDAKHADIRAN', 121, sectionsStartY);

  // Compile Ekstrakurikuler
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

  // Place left table (Ekstrakurikuler)
  autoTable(doc, {
    startY: sectionsStartY + 3,
    margin: { left: 15 },
    tableWidth: 98,
    theme: 'grid',
    head: [['No', 'Kegiatan Ekstrakurikuler', 'Predikat']],
    body: ekskulRows,
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      font: 'helvetica'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 70, fontStyle: 'bold' },
      2: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }
    }
  });

  // Compile Attendance
  const attendanceRows = [
    ['Sakit', ':', `${attendance?.sakit || 0} Hari`],
    ['Izin', ':', `${attendance?.izin || 0} Hari`],
    ['Tanpa Keterangan', ':', `${attendance?.alfa || 0} Hari`]
  ];

  // Place right table (Ketidakhadiran)
  autoTable(doc, {
    startY: sectionsStartY + 3,
    margin: { left: 121 },
    tableWidth: 74,
    theme: 'grid',
    head: [],
    body: attendanceRows,
    styles: {
      fontSize: 8.5,
      cellPadding: 3.2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      font: 'helvetica'
    },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'bold' },
      1: { cellWidth: 6, halign: 'center' },
      2: { cellWidth: 33, halign: 'center', fontStyle: 'bold' }
    }
  });

  // Signatures Area
  const sigY = sectionsStartY + 35;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);

  // Orang tua left & Wali Kelas right
  doc.text('Mengetahui,', 40, sigY, { align: 'center' });
  doc.text('Orangtua/ Wali', 40, sigY + 5, { align: 'center' });

  doc.text(`Surakarta, ${formattedReportDate}`, pageWidth - 42, sigY, { align: 'center' });
  doc.text('Mengetahui,', pageWidth - 42, sigY + 5, { align: 'center' });
  doc.text('Wali Kelas', pageWidth - 42, sigY + 10, { align: 'center' });

  // Signature lines & Names below
  doc.text('.....................................................', 40, sigY + 32, { align: 'center' });

  const teacherName = classTeacher?.nama || '___________________';
  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, pageWidth - 42, sigY + 32, { align: 'center' });
  
  // Underline class teacher's name
  const teacherNameWidth = doc.getTextWidth(teacherName);
  const teacherXStart = (pageWidth - 42) - (teacherNameWidth / 2);
  doc.setLineWidth(0.25);
  doc.line(teacherXStart, sigY + 33, teacherXStart + teacherNameWidth, sigY + 33);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`NIK. ${classTeacher?.username || '-'}`, pageWidth - 42, sigY + 36, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Center bottom: Kepala Sekolah
  const principalY = sigY + 45;
  doc.setFontSize(9.5);
  doc.text('Mengetahui,', pageWidth / 2, principalY, { align: 'center' });
  doc.text('Kepala Sekolah', pageWidth / 2, principalY + 5, { align: 'center' });

  const principalName = 'Andreas Raymonda, S.Pd, M.Hum';
  doc.setFont('helvetica', 'bold');
  doc.text(principalName, pageWidth / 2, principalY + 28, { align: 'center' });
  
  // Underline principal's name
  const principalNameWidth = doc.getTextWidth(principalName);
  const principalXStart = (pageWidth / 2) - (principalNameWidth / 2);
  doc.line(principalXStart, principalY + 29, principalXStart + principalNameWidth, principalY + 29);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('NIK. 103.244.0072', pageWidth / 2, principalY + 32, { align: 'center' });

  // Draw final page footer
  drawRaportFooter(3);

  return doc;
}
