# Security Specification (`security_spec.md`) — Sidratu Beauty Therapy Skin Care

## 1. Data Invariants
1. **Default-Deny Catch-All**: All unmatched paths in Firestore are unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity**: Every write operation requires an authenticated user with `request.auth.token.email_verified == true`.
3. **PII Isolation & Query Enforcement**:
   - `/clients/{clientId}`, `/appointments/{appointmentId}`, and `/treatmentHistory/{historyId}` contain PII (`name`, `phone`, `email`, `address`, `allergies`, `dob`).
   - Regular clients (`Customer`) can only `get` or `list` documents where `resource.data.ownerUid == request.auth.uid`.
   - Administrators (`isAdmin()` / `isBootstrappedAdmin()`) can read and manage all client records, appointments, and treatment history.
   - `allow list` rules never invoke `get()` or `exists()` to prevent O(n) read cost explosions.
4. **Privilege Escalation Prevention**:
   - Regular clients creating a `/clients/{clientId}` document must set `ownerUid == request.auth.uid` and `role == 'Customer'`. Self-assigning `Owner`, `Secretary`, or `Security` is blocked.
   - Regular clients updating `/clients/{clientId}` cannot modify `role`, `ownerUid`, `quickNotes`, or `createdAt`.
5. **Relational Consistency**:
   - Creating an `/appointments/{appointmentId}` or `/treatmentHistory/{historyId}` document requires that `/clients/{incoming().clientId}` exists (`exists(...)`) and, for non-admin users, belongs to `request.auth.uid`.
6. **Terminal State Locking**:
   - Once an appointment in `/appointments/{appointmentId}` reaches `status == 'Completed'`, regular clients cannot modify it; only `isAdmin()` can override a completed state.
7. **Temporal Integrity & Immutability**:
   - `createdAt` and `updatedAt` must equal `request.time` on creation.
   - `createdAt`, `ownerUid`, and `clientId` are strictly immutable on update, and `updatedAt` must equal `request.time`.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 — Self-Assigned Admin Role on Client Creation**:
   `{ ownerUid: "user_1", name: "Attacker", phone: "123", email: "a@b.com", address: "Freetown", allergies: "None", dob: "1995-01-01", quickNotes: "", role: "Owner", createdAt: SERVER_TIME, updatedAt: SERVER_TIME }` by non-admin `user_1`. -> `PERMISSION_DENIED`
2. **Payload 2 — Shadow Field Injection on Client Creation**:
   Includes valid `ClientProfile` keys plus `"isSuperAdmin": true`. -> `PERMISSION_DENIED`
3. **Payload 3 — Identity Spoofing (`ownerUid` mismatch)**:
   Authenticated as `user_1`, creating a `ClientProfile` with `ownerUid: "user_2"`. -> `PERMISSION_DENIED`
4. **Payload 4 — Unverified Email Spoofing Admin**:
   Authenticated with `email: "Sidratu82sesay@gmail.com"` but `email_verified: false`, attempting to read or write another user's client record. -> `PERMISSION_DENIED`
5. **Payload 5 — Cross-Tenant PII Read (`get` another client's profile)**:
   Authenticated as `user_1`, attempting `get(/clients/client_user_2)` where `ownerUid == "user_2"`. -> `PERMISSION_DENIED`
6. **Payload 6 — Blanket List Scraping (`list` all appointments without ownerUid filter)**:
   Authenticated as `user_1`, attempting to list `/appointments` belonging to `user_2`. -> `PERMISSION_DENIED`
7. **Payload 7 — Orphaned Appointment Creation (Non-existent `clientId`)**:
   Creating `/appointments/appt_999` referencing `clientId: "non_existent_client"`. -> `PERMISSION_DENIED`
8. **Payload 8 — Terminal State Unlocking (`status == 'Completed'` modified by Client)**:
   Client `user_1` attempting to update their appointment after `status` is already `'Completed'`. -> `PERMISSION_DENIED`
9. **Payload 9 — System/Admin Field Tampering by Client on Appointment**:
   Client `user_1` attempting to update `adminResponse` or `status` on `/appointments/appt_1`. -> `PERMISSION_DENIED`
10. **Payload 10 — Value Poisoning / Oversized String Attack**:
    Client `user_1` updating `notes` on `/appointments/appt_1` with a 5,000-character string (exceeding `maxLength: 1000`). -> `PERMISSION_DENIED`
11. **Payload 11 — Immutable Field Mutation (`createdAt` or `ownerUid` changed on update)**:
    Client `user_1` attempting to change `ownerUid` or `createdAt` during an allowed profile update. -> `PERMISSION_DENIED`
12. **Payload 12 — Unauthorized Self-Registration in `/admins/{adminUid}`**:
    Regular client `user_1` attempting to create `/admins/user_1` with `role: "Owner"`. -> `PERMISSION_DENIED`
