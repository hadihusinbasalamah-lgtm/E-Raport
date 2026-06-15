/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore, 
  doc, 
  getDocFromServer, 
  getDocs,
  collection, 
  onSnapshot, 
  setDoc, 
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { SchemaDatabase } from '../types';
import { getDatabase } from '../data';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with robust local disk cache (IndexedDB)
// This enables lightning-fast offline/cache reads, vastly reducing read billing/quota usage.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, firebaseConfig.firestoreDatabaseId);
} catch (error) {
  console.warn("Failed to initialize persistent local cache, falling back to memory cache:", error);
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;

/**
 * Firestore Custom Error Handler to conform with FirestoreErrorInfo specifications.
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Test basic connection to Firestore on initialization
 */
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'config', 'connection_test'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client appears to be offline. Verify credentials & network connection.");
    }
  }
}
testConnection();

/**
 * Recursively removes keys with undefined values from an object, which Firestore doesn't support.
 */
function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as any;
  }
  if (typeof obj === 'object') {
    const fresh: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        fresh[key] = sanitizeObject(val);
      }
    }
    return fresh;
  }
  return obj;
}

/**
 * Synchronizes any local changes made to e-Raport SchemaDatabase collections directly to Firestore.
 * Highly optimized to minimize CPU overhead, prevent unauthorized writes, and conserve Firebase quota.
 */
export async function syncDatabaseChange(
  oldDb: SchemaDatabase, 
  newDb: SchemaDatabase,
  userRole?: string | null,
  userId?: string | null
) {
  try {
    // 1. Role Authorization & Scope Assessment
    const collectionsToSync: string[] = [];
    
    if (userRole === 'admin') {
      collectionsToSync.push(
        'kelas',
        'mapel',
        'siswa',
        'guru',
        'periodList',
        'tujuanPembelajaran',
        'nilaiSiswa',
        'absensiDanCatatan'
      );
    } else if (userRole === 'guru' && userId) {
      collectionsToSync.push(
        'tujuanPembelajaran',
        'nilaiSiswa',
        'absensiDanCatatan'
      );
    } else {
      // Offline/unauthenticated users are forbidden from executing syncing calls
      return;
    }

    // 2. Sync global config parameters (Admin Only)
    if (userRole === 'admin') {
      if (
        oldDb.adminUsername !== newDb.adminUsername || 
        oldDb.adminPasswordKey !== newDb.adminPasswordKey || 
        oldDb.activePeriodId !== newDb.activePeriodId
      ) {
        const path = 'config/main';
        try {
          await setDoc(doc(db, 'config', 'main'), {
            adminUsername: newDb.adminUsername || 'admin',
            adminPasswordKey: newDb.adminPasswordKey || 'alirsyadsolo',
            activePeriodId: newDb.activePeriodId || 'p1',
            isSeedInitialized: true
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
      }
    }

    // Generic collection helper that diffs and writes differences
    const syncCollection = async <T extends { id: string }>(
      colName: string,
      oldArr: T[],
      newArr: T[]
    ) => {
      // Find modified or added items
      for (const item of newArr) {
        const oldItem = oldArr.find(x => x.id === item.id);
        if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(item)) {
          try {
            const sanitizedItem = sanitizeObject(item);
            await setDoc(doc(db, colName, item.id), sanitizedItem);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `${colName}/${item.id}`);
          }
        }
      }

      // Find deleted items
      for (const item of oldArr) {
        if (!newArr.some(x => x.id === item.id)) {
          try {
            await deleteDoc(doc(db, colName, item.id));
          } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, `${colName}/${item.id}`);
          }
        }
      }
    };

    const syncPromises: Promise<void>[] = [];
    
    if (collectionsToSync.includes('kelas')) syncPromises.push(syncCollection('kelas', oldDb.kelas || [], newDb.kelas || []));
    if (collectionsToSync.includes('mapel')) syncPromises.push(syncCollection('mapel', oldDb.mapel || [], newDb.mapel || []));
    if (collectionsToSync.includes('siswa')) syncPromises.push(syncCollection('siswa', oldDb.siswa || [], newDb.siswa || []));
    if (collectionsToSync.includes('guru')) syncPromises.push(syncCollection('guru', oldDb.guru || [], newDb.guru || []));
    if (collectionsToSync.includes('periodList')) syncPromises.push(syncCollection('periodList', oldDb.periodList || [], newDb.periodList || []));
    if (collectionsToSync.includes('tujuanPembelajaran')) syncPromises.push(syncCollection('tujuanPembelajaran', oldDb.tujuanPembelajaran || [], newDb.tujuanPembelajaran || []));
    if (collectionsToSync.includes('nilaiSiswa')) syncPromises.push(syncCollection('nilaiSiswa', oldDb.nilaiSiswa || [], newDb.nilaiSiswa || []));
    if (collectionsToSync.includes('absensiDanCatatan')) syncPromises.push(syncCollection('absensiDanCatatan', oldDb.absensiDanCatatan || [], newDb.absensiDanCatatan || []));

    await Promise.all(syncPromises);

  } catch (error) {
    console.error("General Sync Failure:", error);
  }
}

/**
 * Subscribes to real-time changes of all school e-Raport entities.
 * Automatically seeds the database with INITIAL state if Firestore is empty.
 * Optimizes Firebase Quota usage by applying role-aware single-field querying and offline caching.
 */
export function subscribeToDatabase(
  onSync: (db: SchemaDatabase) => void,
  userRole?: string | null,
  userId?: string | null
) {
  const defaultDb = getDatabase();
  let currentDb: SchemaDatabase = { ...defaultDb };

  const unsubscribes: (() => void)[] = [];
  let isInitializedColRegistered = false;
  let isDbAlreadyInitialized = false;

  let absensiUnsub: (() => void) | null = null;
  let currentWaliKelasKelasId: string | null = null;

  const handleEntityUpdate = (entityKey: keyof SchemaDatabase, data: any) => {
    currentDb = { ...currentDb, [entityKey]: data };
    onSync({ ...currentDb });
  };

  // Helper function to listen to each separate collection
  const listenCol = (colName: string, entityKey: keyof SchemaDatabase) => {
    // If the user is not authenticated yet, only load the 'guru' credentials list and skip other tables completely.
    // This saves enormous amount of Firestore reads when users load the application or stay on the login screen.
    if (!userRole && colName !== 'guru') {
      handleEntityUpdate(entityKey, []);
      return;
    }

    if (colName === 'absensiDanCatatan') {
      // AbsensiDanCatatan is handled dynamically based on waliKelasKelasId when user is a guru to avoid query leaks
      if (userRole === 'admin') {
        const queryRef = collection(db, colName);
        const unsub = onSnapshot(queryRef, (snap) => {
          const list: any[] = [];
          snap.forEach(docSnap => list.push(docSnap.data()));
          handleEntityUpdate(entityKey, list);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, colName);
        });
        unsubscribes.push(unsub);
      } else {
        // Initially empty, populated dynamically once the 'guru' master list resolves
        handleEntityUpdate(entityKey, []);
      }
      return;
    }

    let colRef: any = collection(db, colName);

    // Apply single-field filters only. Highly query-optimized, requires NO custom multi-field indices in Firestore dashboard!
    if (userRole === 'guru' && userId) {
      if (colName === 'nilaiSiswa') {
        colRef = query(collection(db, colName), where('guruId', '==', userId));
      } else if (colName === 'tujuanPembelajaran') {
        colRef = query(collection(db, colName), where('guruId', '==', userId));
      }
    }

    const unsub = onSnapshot(colRef, (snap) => {
      if (snap.empty) {
        // Sync seed data to remote only if the database hasn't been initialized yet
        if (!isDbAlreadyInitialized && colName !== 'nilaiSiswa' && colName !== 'tujuanPembelajaran') {
          const initialItems = defaultDb[entityKey];
          if (Array.isArray(initialItems) && initialItems.length > 0) {
            initialItems.forEach(item => {
              const itemPath = `${colName}/${item.id}`;
              try {
                const sanitizedItem = sanitizeObject(item);
                setDoc(doc(db, colName, item.id), sanitizedItem);
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, itemPath);
              }
            });
          }
          handleEntityUpdate(entityKey, initialItems);
        } else {
          // Database is initialized; empty results mean exactly that, or that this guru has no specific records yet
          handleEntityUpdate(entityKey, []);
        }
      } else {
        const list: any[] = [];
        snap.forEach(docSnap => {
          list.push(docSnap.data());
        });

        // Dynamic Wali Kelas (Homeroom) Attendance Listener Upgrade
        if (colName === 'guru' && userRole === 'guru' && userId) {
          const loggedGuru = list.find((g: any) => g.id === userId);
          if (loggedGuru && loggedGuru.isWaliKelas && loggedGuru.waliKelasKelasId) {
            const targetKelasId = loggedGuru.waliKelasKelasId;
            if (currentWaliKelasKelasId !== targetKelasId) {
              currentWaliKelasKelasId = targetKelasId;
              if (absensiUnsub) absensiUnsub();
              
              const absensiQuery = query(collection(db, 'absensiDanCatatan'), where('kelasId', '==', targetKelasId));
              absensiUnsub = onSnapshot(absensiQuery, (absSnap) => {
                const absList: any[] = [];
                absSnap.forEach(d => absList.push(d.data()));
                handleEntityUpdate('absensiDanCatatan', absList);
              }, (err) => {
                handleFirestoreError(err, OperationType.GET, 'absensiDanCatatan (filtered)');
              });
            }
          } else {
            if (currentWaliKelasKelasId !== null) {
              currentWaliKelasKelasId = null;
              if (absensiUnsub) {
                absensiUnsub();
                absensiUnsub = null;
              }
              handleEntityUpdate('absensiDanCatatan', []);
            }
          }
        }

        handleEntityUpdate(entityKey, list);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, colName);
    });

    unsubscribes.push(unsub);
  };

  // Subscribe to config main settings
  const configUnsub = onSnapshot(doc(db, 'config', 'main'), (snap) => {
    if (snap.exists()) {
      const val = snap.data();
      currentDb.adminUsername = val.adminUsername || defaultDb.adminUsername;
      currentDb.adminPasswordKey = val.adminPasswordKey || defaultDb.adminPasswordKey;
      currentDb.activePeriodId = val.activePeriodId || defaultDb.activePeriodId;
      isDbAlreadyInitialized = val.isSeedInitialized || false;

      // Migration: if config exists but isSeedInitialized is missing, set it to true
      if (!val.isSeedInitialized) {
        setDoc(doc(db, 'config', 'main'), {
          ...val,
          isSeedInitialized: true
        }, { merge: true }).catch(err => console.error(err));
        isDbAlreadyInitialized = true;
      }

      onSync({ ...currentDb });

      // Start listening to other collections once we know the config state
      if (!isInitializedColRegistered) {
        isInitializedColRegistered = true;
        listenCol('kelas', 'kelas');
        listenCol('mapel', 'mapel');
        listenCol('siswa', 'siswa');
        listenCol('guru', 'guru');
        listenCol('periodList', 'periodList');
        listenCol('tujuanPembelajaran', 'tujuanPembelajaran');
        listenCol('nilaiSiswa', 'nilaiSiswa');
        listenCol('absensiDanCatatan', 'absensiDanCatatan');
      }
    } else {
      // Config main does not exist in Firestore, which means it's a completely fresh Firestore DB.
      // We will perform seed initialization for config and all collections now.
      isDbAlreadyInitialized = false;

      const path = 'config/main';
      try {
        setDoc(doc(db, 'config', 'main'), {
          adminUsername: defaultDb.adminUsername,
          adminPasswordKey: defaultDb.adminPasswordKey,
          activePeriodId: defaultDb.activePeriodId,
          isSeedInitialized: true
        }).then(() => {
          isDbAlreadyInitialized = true;
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }

      if (!isInitializedColRegistered) {
        isInitializedColRegistered = true;
        listenCol('kelas', 'kelas');
        listenCol('mapel', 'mapel');
        listenCol('siswa', 'siswa');
        listenCol('guru', 'guru');
        listenCol('periodList', 'periodList');
        listenCol('tujuanPembelajaran', 'tujuanPembelajaran');
        listenCol('nilaiSiswa', 'nilaiSiswa');
        listenCol('absensiDanCatatan', 'absensiDanCatatan');
      }
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'config/main');
  });

  unsubscribes.push(configUnsub);

  return () => {
    unsubscribes.forEach(unsub => unsub());
    if (absensiUnsub) absensiUnsub();
  };
}

/**
 * Resets all application data fields to empty (0 records) in Firestore.
 * Keeps admin credentials intact so the current session remains active.
 */
export async function resetFirestoreToZero() {
  try {
    const collectionsToClear = [
      'kelas',
      'mapel',
      'siswa',
      'guru',
      'periodList',
      'tujuanPembelajaran',
      'nilaiSiswa',
      'absensiDanCatatan'
    ];

    // Delete in parallel
    await Promise.all(
      collectionsToClear.map(async (colName) => {
        const colRef = collection(db, colName);
        const snapshot = await getDocs(colRef);
        const deletePromises = snapshot.docs.map((docSnap) => 
          deleteDoc(doc(db, colName, docSnap.id))
        );
        await Promise.all(deletePromises);
      })
    );

    // Keep the admin settings but clear any active period info
    const configRef = doc(db, 'config', 'main');
    const configSnap = await getDocFromServer(configRef);
    let currentAdminUser = 'admin';
    let currentAdminPass = 'alirsyadsolo';

    if (configSnap.exists()) {
      const data = configSnap.data();
      currentAdminUser = data.adminUsername || 'admin';
      currentAdminPass = data.adminPasswordKey || 'alirsyadsolo';
    }

    // Rewrite config with activePeriodId empty and isSeedInitialized true
    await setDoc(configRef, {
      adminUsername: currentAdminUser,
      adminPasswordKey: currentAdminPass,
      activePeriodId: '',
      isSeedInitialized: true
    });

    console.log("Firestore reset to 0 finished successfully.");
  } catch (error) {
    console.error("Failed to reset Firestore to 0:", error);
    throw error;
  }
}

