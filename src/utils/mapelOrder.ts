/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Mapel } from '../types';

/**
 * Standard priority ordering matching SMP Al-Irsyad Surakarta official curriculum
 */
export const DEFAULT_UMUM_PRIORITY: { name: string; aliases: string[]; defaultOrder: number }[] = [
  { name: 'Matematika', aliases: ['matematika'], defaultOrder: 1 },
  { name: 'Ilmu Pengetahuan Sosial (IPS)', aliases: ['sosial', 'ips'], defaultOrder: 2 },
  { name: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)', aliases: ['jasmani', 'pjok', 'penjas', 'olahraga'], defaultOrder: 3 },
  { name: 'Ilmu Pengetahuan Alam (IPA)', aliases: ['alam', 'ipa'], defaultOrder: 4 },
  { name: 'Informatika', aliases: ['informatika', 'tik', 'komputer'], defaultOrder: 5 },
  { name: 'Seni Budaya', aliases: ['seni', 'budaya', 'prakarya'], defaultOrder: 6 },
  { name: 'Pendidikan Pancasila (PPKn)', aliases: ['pancasila', 'kewarganegaraan', 'ppkn'], defaultOrder: 7 },
  { name: 'Bahasa Inggris', aliases: ['inggris'], defaultOrder: 8 },
  { name: 'Bahasa Indonesia', aliases: ['indonesia'], defaultOrder: 9 },
  { name: 'Bahasa Jawa', aliases: ['jawa'], defaultOrder: 10 },
  { name: 'Pendidikan Agama Islam (PAI)', aliases: ['agama', 'budi pekerti', 'pai'], defaultOrder: 11 },
];

export const DEFAULT_YAYASAN_PRIORITY: { name: string; aliases: string[]; defaultOrder: number }[] = [
  { name: 'Fiqih', aliases: ['fiqih', 'fikih'], defaultOrder: 1 }, // Halaman 2 paling bawah
  { name: 'Bahasa Arab', aliases: ['bahasa arab', 'arab'], defaultOrder: 2 }, // Halaman 3
  { name: 'Sejarah Kebudayaan Islam (SKI)', aliases: ['ski', 'sejarah kebudayaan islam'], defaultOrder: 3 }, // Halaman 3
  { name: 'Tahfidz Al-Qur\'an', aliases: ['tahfidz', 'tahfid', 'qur\'an', 'quran', 'al-qur', 'hadist', 'hadits', 'ulumul quran'], defaultOrder: 4 }, // Halaman 3
  { name: 'Aqidah / Akidah Akhlak', aliases: ['aqidah', 'akidah'], defaultOrder: 5 }, // Halaman 3
];

/**
 * Checks whether a subject belongs to Yayasan / Ciri Khusus or Umum
 */
export function isYayasanSubject(mapelOrName: Mapel | string | undefined | null): boolean {
  if (!mapelOrName) return false;

  if (typeof mapelOrName === 'object') {
    if (mapelOrName.kategori === 'yayasan') return true;
    if (mapelOrName.kategori === 'umum') return false;
    return isYayasanSubject(mapelOrName.nama);
  }

  const lowercaseName = (mapelOrName || '').toLowerCase().trim();
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
}

/**
 * Calculates priority score for sorting within Umum or Yayasan group.
 * If mapel has an explicit `urutan` set by Admin, that takes top precedence.
 */
export function getSubjectPriority(
  mapelOrName: Mapel | string, 
  isYayasan: boolean, 
  allMapels?: Mapel[]
): number {
  let mapelObj: Mapel | undefined;
  let nameStr = '';

  if (typeof mapelOrName === 'object') {
    mapelObj = mapelOrName;
    nameStr = mapelOrName.nama || '';
  } else {
    nameStr = mapelOrName || '';
    if (allMapels && allMapels.length > 0) {
      const cleanTarget = nameStr.toLowerCase().trim();
      mapelObj = allMapels.find(m => m.id === mapelOrName || m.nama.toLowerCase().trim() === cleanTarget);
    }
  }

  // If user-defined urutan is explicitly saved on the mapel object, respect it!
  if (mapelObj && typeof mapelObj.urutan === 'number' && mapelObj.urutan > 0) {
    return mapelObj.urutan;
  }

  // Fallback to official SMP Al-Irsyad standard priority
  const n = nameStr.toLowerCase().trim();
  if (!isYayasan) {
    for (const item of DEFAULT_UMUM_PRIORITY) {
      if (item.aliases.some(alias => n.includes(alias))) {
        return item.defaultOrder;
      }
    }
    return 50;
  } else {
    for (const item of DEFAULT_YAYASAN_PRIORITY) {
      if (item.aliases.some(alias => n.includes(alias))) {
        return item.defaultOrder;
      }
    }
    return 50;
  }
}

/**
 * Sorts subjects into Umum and Yayasan and provides page distribution mapping
 */
export function sortAndDistributeMapel<T extends { mapelNama?: string; nama?: string; mapelId?: string; id?: string; urutan?: number; kategori?: 'umum' | 'yayasan' }>(
  items: T[], 
  allMapels?: Mapel[]
) {
  const getSubjectName = (item: T) => item.mapelNama || item.nama || '';
  const getSubjectObj = (item: T): Mapel | undefined => {
    const id = item.mapelId || item.id;
    const name = getSubjectName(item).toLowerCase().trim();
    if (allMapels) {
      return allMapels.find(m => (id && m.id === id) || m.nama.toLowerCase().trim() === name);
    }
    return undefined;
  };

  const isYayasan = (item: T) => {
    const obj = getSubjectObj(item);
    if (obj) return isYayasanSubject(obj);
    if (item.kategori) return item.kategori === 'yayasan';
    return isYayasanSubject(getSubjectName(item));
  };

  const unfilteredUmum = items.filter(r => !isYayasan(r));
  const unfilteredYayasan = items.filter(r => isYayasan(r));

  const sortedUmum = [...unfilteredUmum].sort((a, b) => {
    const objA = getSubjectObj(a) || (a as any);
    const objB = getSubjectObj(b) || (b as any);
    const pA = getSubjectPriority(objA, false, allMapels);
    const pB = getSubjectPriority(objB, false, allMapels);
    if (pA !== pB) return pA - pB;
    return getSubjectName(a).localeCompare(getSubjectName(b));
  });

  const sortedYayasan = [...unfilteredYayasan].sort((a, b) => {
    const objA = getSubjectObj(a) || (a as any);
    const objB = getSubjectObj(b) || (b as any);
    const pA = getSubjectPriority(objA, true, allMapels);
    const pB = getSubjectPriority(objB, true, allMapels);
    if (pA !== pB) return pA - pB;
    return getSubjectName(a).localeCompare(getSubjectName(b));
  });

  // Report Pages Distribution (matches SMP Al-Irsyad 3-page layout)
  const page1Umum = sortedUmum.slice(0, 5); // Subjects 1 to 5 (Umum)
  const page2Umum = sortedUmum.slice(5, 11); // Subjects 6 to 11 (Umum)
  const page2Yayasan = sortedYayasan.slice(0, 1); // Subject 12 (Yayasan - Fiqih)
  const page3Yayasan = sortedYayasan.slice(1); // Subjects 13 to 16+ (Yayasan)

  return {
    sortedUmum,
    sortedYayasan,
    page1Umum,
    page2Umum,
    page2Yayasan,
    page3Yayasan,
  };
}

/**
 * Resets a list of mapel back to default SMP Al-Irsyad standard order
 */
export function applyDefaultAlIrsyadOrder(mapels: Mapel[]): Mapel[] {
  const umumList: Mapel[] = [];
  const yayasanList: Mapel[] = [];

  mapels.forEach(m => {
    if (isYayasanSubject(m)) {
      yayasanList.push({ ...m, kategori: 'yayasan' });
    } else {
      umumList.push({ ...m, kategori: 'umum' });
    }
  });

  // Sort Umum
  umumList.sort((a, b) => {
    const pA = getSubjectPriority(a.nama, false);
    const pB = getSubjectPriority(b.nama, false);
    if (pA !== pB) return pA - pB;
    return a.nama.localeCompare(b.nama);
  });

  // Sort Yayasan
  yayasanList.sort((a, b) => {
    const pA = getSubjectPriority(a.nama, true);
    const pB = getSubjectPriority(b.nama, true);
    if (pA !== pB) return pA - pB;
    return a.nama.localeCompare(b.nama);
  });

  // Re-assign sequential urutan (1 to N)
  let orderCounter = 1;
  const orderedUmum = umumList.map(m => ({
    ...m,
    urutan: orderCounter++,
    kategori: 'umum' as const
  }));

  const orderedYayasan = yayasanList.map(m => ({
    ...m,
    urutan: orderCounter++,
    kategori: 'yayasan' as const
  }));

  return [...orderedUmum, ...orderedYayasan];
}
