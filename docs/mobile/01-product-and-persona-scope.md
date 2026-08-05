# 01 — Product and Persona Scope

## 1. Product boundary

Native mobile is an experience layer over the existing international K–12 platform. It does not create a separate school-management product, database, policy engine or reporting source.

The approved application portfolio is:

| Product | Personas | Primary purpose |
|---|---|---|
| School Family | Guardian, student | Household, child, published academic, fee, form, document and communication journeys |
| School Staff | Teacher first; later approved staff | Time-sensitive class, timetable, attendance, communication and restricted operational journeys |
| Web/PWA | Admin, admissions, finance, academic coordination, HR, operations, support | Dense configuration, approvals, reconciliation, audit and broad reporting |

One human may have more than one persona. Persona is selected after authentication and remains separate from tenant, campus, class, child and purpose context.

## 2. Why two installable applications

A single codebase is retained for engineering consistency, but two binaries are published because family and staff applications have different:

- information sensitivity and local-cache policy;
- device-management and session-assurance requirements;
- navigation and notification models;
- store listing, support, rollout and release cadence;
- low-end-device performance budgets;
- incident response and remote-wipe priorities.

Guardian and student remain in the same Family application because their journeys share household, timetable, publication, fee, document and communication surfaces. Student presentation remains age-appropriate and cannot expose guardian-only controls.

## 3. Persona context model

Every authenticated session resolves:

- actor/account identifier;
- tenant and home-region context;
- available personas;
- active persona;
- membership and campus scopes;
- guardian relationships or teacher assignments;
- feature entitlements;
- capability list;
- current assurance level;
- device/session status;
- localization and accessibility preferences.

Navigation is generated from capabilities and context. Role names are never treated as sufficient authorization.

## 4. Family application scope

### 4.1 Guardian P0 mobile scope

- household summary and authorized child switching;
- announcements and notification inbox;
- child timetable and calendar;
- attendance summary, detail and absence submission;
- published grades, results and report cards;
- fee invoices, statements, receipts and server-hosted payment initiation;
- forms, surveys, acknowledgements and consent;
- authorized documents and short-lived downloads;
- secure two-way messages;
- contact/profile change requests;
- application/admission status where the contract is available;
- network, cache freshness and sync state visibility.

### 4.2 Student P0 mobile scope

- age-appropriate home/today view;
- timetable and school calendar;
- own attendance;
- published results and report documents;
- approved resources and assignment metadata;
- announcements and permitted communication;
- authorized documents;
- permitted requests and acknowledgements.

### 4.3 Family deferred scope

- broad family financial administration;
- complex report builder;
- unrestricted student directory;
- offline payment execution;
- full learning-management authoring;
- hidden behavioral engagement mechanics;
- advertising or unrelated analytics.

## 5. Staff application scope

### 5.1 Teacher P0 mobile scope

- today timetable and assigned classes;
- permission-scoped class roster;
- offline-safe attendance draft capture and reconciliation;
- late/early and approved attendance reasons;
- limited grade-entry drafts where the server contract permits;
- announcements, acknowledgements and communication;
- approved student alerts with minimum necessary disclosure;
- camera/document upload where required;
- QR/barcode scanning only for reviewed workflows;
- visible network, sync, class, campus and assurance state.

### 5.2 Staff deferred scope

- full school administration;
- accounting journals, reconciliation and period close;
- procurement, HR and inventory administration;
- unrestricted health, counseling or safeguarding narratives;
- broad exports or mass downloads;
- high-risk support impersonation;
- grade publication or finalized-record correction while offline.

Any non-teacher staff persona requires a separate use-case review, data-classification review and navigation addition. The Staff application must not become a compressed copy of the administration web app.

## 6. Experience invariants

Every feature must preserve:

- tenant, relationship, assignment, purpose and capability scope;
- server-side authorization on every read and write;
- immutable or amendment-based financial and academic history;
- explicit published/draft/finalized state;
- local cache freshness and offline status;
- idempotent retry where duplicate submission is possible;
- stable errors without sensitive disclosure;
- localization, RTL and long-content support;
- accessibility semantics and large-text reflow;
- audit/disclosure events where required.

## 7. Product states

Each screen defines behavior for:

- first run;
- unauthenticated and expired session;
- persona unavailable or revoked;
- empty and loading;
- online, slow, offline and stale-cache;
- validation failure;
- server or provider failure;
- unauthorized, masked and not-found-as-denied;
- read-only or finalized;
- partial success;
- pending sync;
- conflict and reconciliation;
- duplicate submission;
- maintenance and forced upgrade.

A toast alone is not an acceptable representation of a durable state.

## 8. Non-goals

The mobile program will not:

- connect directly to PostgreSQL or object storage;
- copy domain calculations into Dart;
- infer access from cached roles;
- build a second notification, audit or document authority;
- cache all data because storage is available;
- depend on uninterrupted background execution;
- require proprietary hardware;
- expose sensitive data in push payloads, logs or analytics;
- launch before privacy, store, security and incident evidence is complete.

## 9. Acceptance rule

A mobile feature is complete only when its API contract, authorization, local-data policy, offline behavior, errors, localization, accessibility, audit behavior, telemetry, automated tests, support runbook and release evidence are complete together.
