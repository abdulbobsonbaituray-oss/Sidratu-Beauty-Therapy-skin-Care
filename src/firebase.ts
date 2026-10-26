import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot as required by firebase-integration-rpc
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export const BOOTSTRAPPED_ADMIN_EMAILS = [
  'abdulbobsonbaituray@gmail.com',
  'sidratu82sesay@gmail.com'
];

export function isFirebaseBootstrappedAdmin(user: User | null): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  return BOOTSTRAPPED_ADMIN_EMAILS.includes(user.email.trim().toLowerCase());
}

// Defensive payload sanitizers matching firebase-blueprint.json & firestore.rules
export function sanitizeStr(val: string | undefined | null, maxLength: number, fallback = ''): string {
  const raw = (val ?? fallback).trim();
  return raw.slice(0, maxLength);
}

export function sanitizeDocId(id: string | undefined | null, prefix = 'doc'): string {
  const cleaned = (id || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : `${prefix}_${Date.now()}`;
}

export interface SyncClientInput {
  id: string;
  ownerUid?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  allergies: string;
  dob?: string;
  quickNotes?: string;
  role?: 'Customer' | 'Owner' | 'Secretary' | 'Security';
}

export interface SyncAppointmentInput {
  id: string;
  clientId: string;
  ownerUid?: string;
  clientName: string;
  treatment: string;
  date: string;
  time: string;
  notes: string;
  consentSignedBy: string;
  status?: 'Confirmed' | 'Responded' | 'Completed';
  frequency?: 'None' | 'Weekly' | 'Monthly';
  adminResponse?: string;
  adminRespondedBy?: string;
  adminRespondedAt?: string;
}

export interface SyncHistoryInput {
  id: string;
  clientId: string;
  ownerUid?: string;
  clientName: string;
  dayDateTime: string;
  treatment: string;
  ratingOrPayment: string;
  specialist: string;
  notes: string;
  specialistNotes?: string;
  adminResponse?: string;
  adminRespondedBy?: string;
  adminRespondedAt?: string;
}

export async function syncClientProfileToFirestore(client: SyncClientInput): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const clientId = sanitizeDocId(client.id, 'client');
  const path = `clients/${clientId}`;
  const isAdminUser = isFirebaseBootstrappedAdmin(user);
  const docRef = doc(db, 'clients', clientId);

  try {
    const snap = await getDoc(docRef);
    const safeName = sanitizeStr(client.name, 120, 'Clinic Client') || 'Clinic Client';
    const safePhone = sanitizeStr(client.phone, 40, '');
    const safeEmail = sanitizeStr(client.email || user.email, 150, '');
    const safeAddress = sanitizeStr(client.address, 250, 'Freetown, Sierra Leone');
    const safeAllergies = sanitizeStr(client.allergies, 500, 'None');
    const safeDob = sanitizeStr(client.dob, 20, '');
    const safeQuickNotes = isAdminUser ? sanitizeStr(client.quickNotes, 2000, '') : '';
    const safeRole =
      isAdminUser && client.role && ['Customer', 'Owner', 'Secretary', 'Security'].includes(client.role)
        ? client.role
        : 'Customer';

    if (!snap.exists()) {
      const ownerUid = isAdminUser && client.ownerUid ? sanitizeDocId(client.ownerUid, 'uid') : user.uid;
      await setDoc(docRef, {
        ownerUid,
        name: safeName,
        phone: safePhone,
        email: safeEmail,
        address: safeAddress,
        allergies: safeAllergies,
        dob: safeDob,
        quickNotes: safeQuickNotes,
        role: safeRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      if (isAdminUser) {
        await updateDoc(docRef, {
          name: safeName,
          phone: safePhone,
          email: safeEmail,
          address: safeAddress,
          allergies: safeAllergies,
          dob: safeDob,
          quickNotes: sanitizeStr(client.quickNotes, 2000, snap.data().quickNotes || ''),
          role: safeRole,
          updatedAt: serverTimestamp()
        });
      } else if (snap.data().ownerUid === user.uid) {
        await updateDoc(docRef, {
          name: safeName,
          phone: safePhone,
          email: safeEmail,
          address: safeAddress,
          allergies: safeAllergies,
          dob: safeDob,
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveAppointmentToFirestore(
  client: SyncClientInput,
  appt: SyncAppointmentInput
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  await syncClientProfileToFirestore(client);

  const clientId = sanitizeDocId(client.id, 'client');
  const apptId = sanitizeDocId(appt.id, 'appt');
  const path = `appointments/${apptId}`;
  const isAdminUser = isFirebaseBootstrappedAdmin(user);

  const clientSnap = await getDoc(doc(db, 'clients', clientId));
  const ownerUid =
    clientSnap.exists() && clientSnap.data().ownerUid
      ? clientSnap.data().ownerUid
      : user.uid;

  try {
    await setDoc(doc(db, 'appointments', apptId), {
      clientId,
      ownerUid,
      clientName: sanitizeStr(appt.clientName || client.name, 120, 'Client') || 'Client',
      treatment: sanitizeStr(appt.treatment, 200, 'Clinic Consultation') || 'Clinic Consultation',
      date: sanitizeStr(appt.date, 30, new Date().toISOString().split('T')[0]) || '2026-10-25',
      time: sanitizeStr(appt.time, 30, '11:00') || '11:00',
      notes: sanitizeStr(appt.notes, 1000, ''),
      consentSignedBy: sanitizeStr(appt.consentSignedBy || client.name, 120, 'Client') || 'Client',
      status: isAdminUser && appt.status ? appt.status : 'Confirmed',
      frequency:
        appt.frequency && ['None', 'Weekly', 'Monthly'].includes(appt.frequency)
          ? appt.frequency
          : 'None',
      adminResponse: isAdminUser ? sanitizeStr(appt.adminResponse, 2000, '') : '',
      adminRespondedBy: isAdminUser ? sanitizeStr(appt.adminRespondedBy, 150, '') : '',
      adminRespondedAt: isAdminUser ? sanitizeStr(appt.adminRespondedAt, 60, '') : '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function respondToAppointmentInFirestore(
  apptId: string,
  adminResponse: string,
  adminRespondedBy: string,
  adminRespondedAt: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !isFirebaseBootstrappedAdmin(user)) return;

  const cleanApptId = sanitizeDocId(apptId, 'appt');
  const path = `appointments/${cleanApptId}`;
  const docRef = doc(db, 'appointments', cleanApptId);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    await updateDoc(docRef, {
      status: 'Responded',
      adminResponse: sanitizeStr(adminResponse, 2000, ''),
      adminRespondedBy: sanitizeStr(adminRespondedBy, 150, ''),
      adminRespondedAt: sanitizeStr(adminRespondedAt, 60, ''),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAppointmentFromFirestore(apptId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const cleanApptId = sanitizeDocId(apptId, 'appt');
  const path = `appointments/${cleanApptId}`;
  const docRef = doc(db, 'appointments', cleanApptId);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveHistoryToFirestore(
  client: SyncClientInput,
  entry: SyncHistoryInput
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  await syncClientProfileToFirestore(client);

  const clientId = sanitizeDocId(client.id, 'client');
  const histId = sanitizeDocId(entry.id, 'hist');
  const path = `treatmentHistory/${histId}`;
  const isAdminUser = isFirebaseBootstrappedAdmin(user);

  const clientSnap = await getDoc(doc(db, 'clients', clientId));
  const ownerUid =
    clientSnap.exists() && clientSnap.data().ownerUid
      ? clientSnap.data().ownerUid
      : user.uid;

  try {
    await setDoc(doc(db, 'treatmentHistory', histId), {
      clientId,
      ownerUid,
      clientName: sanitizeStr(entry.clientName || client.name, 120, 'Client') || 'Client',
      dayDateTime: sanitizeStr(entry.dayDateTime, 100, new Date().toISOString()) || 'Session',
      treatment: sanitizeStr(entry.treatment, 200, 'Clinic Treatment') || 'Clinic Treatment',
      ratingOrPayment: sanitizeStr(entry.ratingOrPayment, 150, 'Completed') || 'Completed',
      specialist: sanitizeStr(entry.specialist, 120, 'Clinic Specialist') || 'Clinic Specialist',
      notes: sanitizeStr(entry.notes, 2000, ''),
      specialistNotes: isAdminUser ? sanitizeStr(entry.specialistNotes, 2000, '') : '',
      adminResponse: isAdminUser ? sanitizeStr(entry.adminResponse, 2000, '') : '',
      adminRespondedBy: isAdminUser ? sanitizeStr(entry.adminRespondedBy, 150, '') : '',
      adminRespondedAt: isAdminUser ? sanitizeStr(entry.adminRespondedAt, 60, '') : '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function respondToHistoryInFirestore(
  histId: string,
  updates: {
    adminResponse?: string;
    adminRespondedBy?: string;
    adminRespondedAt?: string;
    specialistNotes?: string;
  }
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !isFirebaseBootstrappedAdmin(user)) return;

  const cleanHistId = sanitizeDocId(histId, 'hist');
  const path = `treatmentHistory/${cleanHistId}`;
  const docRef = doc(db, 'treatmentHistory', cleanHistId);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp()
    };
    if (updates.adminResponse !== undefined) {
      payload.adminResponse = sanitizeStr(updates.adminResponse, 2000, '');
    }
    if (updates.adminRespondedBy !== undefined) {
      payload.adminRespondedBy = sanitizeStr(updates.adminRespondedBy, 150, '');
    }
    if (updates.adminRespondedAt !== undefined) {
      payload.adminRespondedAt = sanitizeStr(updates.adminRespondedAt, 60, '');
    }
    if (updates.specialistNotes !== undefined) {
      payload.specialistNotes = sanitizeStr(updates.specialistNotes, 2000, '');
    }
    await updateDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteHistoryFromFirestore(histId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !isFirebaseBootstrappedAdmin(user)) return;

  const cleanHistId = sanitizeDocId(histId, 'hist');
  const path = `treatmentHistory/${cleanHistId}`;
  const docRef = doc(db, 'treatmentHistory', cleanHistId);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteClientFromFirestore(clientId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !isFirebaseBootstrappedAdmin(user)) return;

  const cleanClientId = sanitizeDocId(clientId, 'client');
  const path = `clients/${cleanClientId}`;
  const docRef = doc(db, 'clients', cleanClientId);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export {
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp
};
export type { User };
