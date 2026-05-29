/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  getDocs,
  collection, 
  onSnapshot, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { SchemaDatabase } from '../types';
import { getDatabase } from '../data';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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
 * Synchronizes any local changes made to e-Raport SchemaDatabase collections directly to Firestore.
 */
export async function syncDatabaseChange(oldDb: SchemaDatabase, newDb: SchemaDatabase) {
  try {
    // 1. Sync global config parameters
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
          activePeriodId: newDb.activePeriodId || 'p1'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
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
            await setDoc(doc(db, colName, item.id), item);
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

    await Promise.all([
      syncCollection('kelas', oldDb.kelas || [], newDb.kelas || []),
      syncCollection('mapel', oldDb.mapel || [], newDb.mapel || []),
      syncCollection('siswa', oldDb.siswa || [], newDb.siswa || []),
      syncCollection('guru', oldDb.guru || [], newDb.guru || []),
      syncCollection('periodList', oldDb.periodList || [], newDb.periodList || []),
      syncCollection('tujuanPembelajaran', oldDb.tujuanPembelajaran || [], newDb.tujuanPembelajaran || []),
      syncCollection('nilaiSiswa', oldDb.nilaiSiswa || [], newDb.nilaiSiswa || []),
      syncCollection('absensiDanCatatan', oldDb.absensiDanCatatan || [], newDb.absensiDanCatatan || []),
    ]);

  } catch (error) {
    console.error("General Sync Failure:", error);
  }
}

/**
 * Subscribes to real-time changes of all school e-Raport entities.
 * Automatically seeds the database with INITIAL state if Firestore is empty.
 */
export function subscribeToDatabase(onSync: (db: SchemaDatabase) => void) {
  const defaultDb = getDatabase();
  let currentDb: SchemaDatabase = { ...defaultDb };

  const unsubscribes: (() => void)[] = [];
  let isInitializedColRegistered = false;
  let isDbAlreadyInitialized = false;

  const handleEntityUpdate = (entityKey: keyof SchemaDatabase, data: any) => {
    currentDb = { ...currentDb, [entityKey]: data };
    onSync({ ...currentDb });
  };

  // Helper function to listen to each separate collection
  const listenCol = (colName: string, entityKey: keyof SchemaDatabase) => {
    unsubscribes.push(
      onSnapshot(collection(db, colName), (snap) => {
        if (snap.empty) {
          // Sync seed data to remote only if the database hasn't been initialized yet
          if (!isDbAlreadyInitialized) {
            const initialItems = defaultDb[entityKey];
            if (Array.isArray(initialItems) && initialItems.length > 0) {
              initialItems.forEach(item => {
                const itemPath = `${colName}/${item.id}`;
                try {
                  setDoc(doc(db, colName, item.id), item);
                } catch (err) {
                  handleFirestoreError(err, OperationType.WRITE, itemPath);
                }
              });
            }
            handleEntityUpdate(entityKey, initialItems);
          } else {
            // Database is already initialized, empty means empty! The user wants it empty.
            handleEntityUpdate(entityKey, []);
          }
        } else {
          const list: any[] = [];
          snap.forEach(docSnap => {
            list.push(docSnap.data());
          });
          handleEntityUpdate(entityKey, list);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, colName);
      })
    );
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
  };
}
