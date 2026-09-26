/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utility to parse and sort Indonesian junior high & school classroom names
 * Ensuring strict sequential ordering:
 * VII A, VII B, VII C ... -> VIII A, VIII B, VIII C ... -> IX A, IX B, IX C ...
 */

export interface ParsedKelasInfo {
  jenjangNum: number;
  jenjangStr: string;
  sub: string;
}

export function parseKelasInfo(kelasNama: string = ''): ParsedKelasInfo {
  const clean = (kelasNama || '').trim();
  // Strip optional prefix like "Kelas", "Kls", or "Class"
  const withoutPrefix = clean.replace(/^(kelas|kls|class)\s+/i, '').trim();

  let jenjangNum = 999;
  let jenjangStr = 'Lainnya';
  let sub = withoutPrefix;

  // Check Roman Numerals in order of length / specificity
  if (/^VIII\b/i.test(withoutPrefix)) {
    jenjangNum = 8;
    jenjangStr = 'VIII';
    sub = withoutPrefix.replace(/^VIII\b/i, '').trim();
  } else if (/^VII\b/i.test(withoutPrefix)) {
    jenjangNum = 7;
    jenjangStr = 'VII';
    sub = withoutPrefix.replace(/^VII\b/i, '').trim();
  } else if (/^XII\b/i.test(withoutPrefix)) {
    jenjangNum = 12;
    jenjangStr = 'XII';
    sub = withoutPrefix.replace(/^XII\b/i, '').trim();
  } else if (/^XI\b/i.test(withoutPrefix)) {
    jenjangNum = 11;
    jenjangStr = 'XI';
    sub = withoutPrefix.replace(/^XI\b/i, '').trim();
  } else if (/^IX\b/i.test(withoutPrefix)) {
    jenjangNum = 9;
    jenjangStr = 'IX';
    sub = withoutPrefix.replace(/^IX\b/i, '').trim();
  } else if (/^X\b/i.test(withoutPrefix)) {
    jenjangNum = 10;
    jenjangStr = 'X';
    sub = withoutPrefix.replace(/^X\b/i, '').trim();
  } 
  // Check Arabic numbers
  else if (/^7\b/i.test(withoutPrefix) || /^7\s*[A-Za-z]/i.test(withoutPrefix)) {
    jenjangNum = 7;
    jenjangStr = 'VII';
    sub = withoutPrefix.replace(/^7\s*/i, '').trim();
  } else if (/^8\b/i.test(withoutPrefix) || /^8\s*[A-Za-z]/i.test(withoutPrefix)) {
    jenjangNum = 8;
    jenjangStr = 'VIII';
    sub = withoutPrefix.replace(/^8\s*/i, '').trim();
  } else if (/^9\b/i.test(withoutPrefix) || /^9\s*[A-Za-z]/i.test(withoutPrefix)) {
    jenjangNum = 9;
    jenjangStr = 'IX';
    sub = withoutPrefix.replace(/^9\s*/i, '').trim();
  } else if (/^10\b/i.test(withoutPrefix)) {
    jenjangNum = 10;
    jenjangStr = 'X';
    sub = withoutPrefix.replace(/^10\s*/i, '').trim();
  } else if (/^11\b/i.test(withoutPrefix)) {
    jenjangNum = 11;
    jenjangStr = 'XI';
    sub = withoutPrefix.replace(/^11\s*/i, '').trim();
  } else if (/^12\b/i.test(withoutPrefix)) {
    jenjangNum = 12;
    jenjangStr = 'XII';
    sub = withoutPrefix.replace(/^12\s*/i, '').trim();
  }

  return { jenjangNum, jenjangStr, sub };
}

/**
 * Standard comparator to sort class names strictly:
 * Grade 7 (VII A, VII B, VII C...) -> Grade 8 (VIII A, VIII B...) -> Grade 9 (IX A, IX B, IX C...)
 */
export function compareKelasNama(namaA: string = '', namaB: string = ''): number {
  const infoA = parseKelasInfo(namaA);
  const infoB = parseKelasInfo(namaB);

  // Compare grade level (7, 8, 9...)
  if (infoA.jenjangNum !== infoB.jenjangNum) {
    return infoA.jenjangNum - infoB.jenjangNum;
  }

  // If same grade level, compare section / sub-class name (e.g. "A", "B", "C", "C - Putra")
  const subDiff = infoA.sub.localeCompare(infoB.sub, undefined, { numeric: true, sensitivity: 'base' });
  if (subDiff !== 0) {
    return subDiff;
  }

  return (namaA || '').localeCompare(namaB || '', undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Helper to sort any array of objects containing class name or class ID
 */
export function sortKelasList<T extends { nama?: string; kelasNama?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const nameA = a.nama || a.kelasNama || '';
    const nameB = b.nama || b.kelasNama || '';
    return compareKelasNama(nameA, nameB);
  });
}
