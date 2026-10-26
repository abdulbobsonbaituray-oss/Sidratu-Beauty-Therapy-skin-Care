/**
 * Firestore Security Rules Test Suite — Verifies all "Dirty Dozen" payloads
 * return PERMISSION_DENIED and valid RBAC operations succeed.
 */
export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TEST_CASES: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Self-Assigned Admin Role on Client Creation',
    collection: 'clients/client_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'client@example.com', email_verified: true },
    payload: {
      ownerUid: 'user_1',
      name: 'Attacker',
      phone: '+23277000000',
      email: 'client@example.com',
      address: 'Freetown',
      allergies: 'None',
      dob: '1995-01-01',
      quickNotes: '',
      role: 'Owner'
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Client Creation',
    collection: 'clients/client_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'client@example.com', email_verified: true },
    payload: {
      ownerUid: 'user_1',
      name: 'Client',
      phone: '+23277000000',
      email: 'client@example.com',
      address: 'Freetown',
      allergies: 'None',
      dob: '1995-01-01',
      quickNotes: '',
      role: 'Customer',
      isSuperAdmin: true
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 3,
    name: 'Identity Spoofing (ownerUid mismatch)',
    collection: 'clients/client_2',
    operation: 'create',
    auth: { uid: 'user_1', email: 'client@example.com', email_verified: true },
    payload: {
      ownerUid: 'user_2',
      name: 'Spoofed Client',
      phone: '+23277000000',
      email: 'client2@example.com',
      address: 'Freetown',
      allergies: 'None',
      dob: '1995-01-01',
      quickNotes: '',
      role: 'Customer'
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 4,
    name: 'Unverified Email Spoofing Admin',
    collection: 'clients/client_2',
    operation: 'get',
    auth: { uid: 'spoof_admin', email: 'Sidratu82sesay@gmail.com', email_verified: false },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 5,
    name: 'Cross-Tenant PII Read (get another client profile)',
    collection: 'clients/client_2',
    operation: 'get',
    auth: { uid: 'user_1', email: 'client1@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 6,
    name: 'Blanket List Scraping (list all appointments without ownerUid filter)',
    collection: 'appointments',
    operation: 'list',
    auth: { uid: 'user_1', email: 'client1@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 7,
    name: 'Orphaned Appointment Creation (Non-existent clientId)',
    collection: 'appointments/appt_orphan',
    operation: 'create',
    auth: { uid: 'user_1', email: 'client1@example.com', email_verified: true },
    payload: {
      clientId: 'non_existent_client',
      ownerUid: 'user_1',
      clientName: 'Client 1',
      treatment: 'HydraFacial Luxury Glow',
      date: '2026-11-01',
      time: '11:00',
      notes: '',
      consentSignedBy: 'Client 1',
      status: 'Confirmed',
      frequency: 'None',
      adminResponse: '',
      adminRespondedBy: '',
      adminRespondedAt: ''
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 8,
    name: 'Terminal State Unlocking (status == Completed modified by Client)',
    collection: 'appointments/appt_completed',
    operation: 'update',
    auth: { uid: 'user_1', email: 'client1@example.com', email_verified: true },
    payload: {
      notes: 'Trying to edit completed appointment'
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 9,
    name: 'System/Admin Field Tampering by Client on Appointment',
    collection: 'appointments/appt_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'client1@example.com', email_verified: true },
    payload: {
      adminResponse: 'Self-approved by client',
      status: 'Responded'
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 10,
    name: 'Value Poisoning / Oversized String Attack',
    collection: 'appointments/appt_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'client1@example.com', email_verified: true },
    payload: {
      notes: 'X'.repeat(5000)
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 11,
    name: 'Immutable Field Mutation (ownerUid changed on update)',
    collection: 'clients/client_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'client1@example.com', email_verified: true },
    payload: {
      ownerUid: 'user_2'
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 12,
    name: 'Unauthorized Self-Registration in /admins/{adminUid}',
    collection: 'admins/user_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'client1@example.com', email_verified: true },
    payload: {
      uid: 'user_1',
      email: 'client1@example.com',
      role: 'Owner'
    },
    expectedResult: 'PERMISSION_DENIED'
  }
];
