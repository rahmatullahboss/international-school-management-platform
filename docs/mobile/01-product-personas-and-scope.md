# 01 — Mobile Product, Personas and Scope

## 1. Product outcome

The native mobile initiative extends the International School Management Platform to daily, portable and weak-network workflows. It does not reproduce the full ERP on a small screen.

Success means:

- guardians can safely manage multiple children and household obligations;
- students receive an age-appropriate view of authorized school information;
- teachers can complete time-critical daily work, especially attendance, on unreliable networks;
- every mobile action is traceable to the same server-owned business rule and evidence used by the web platform;
- a lost, shared or revoked device does not create standing access to child data.

## 2. Application decision

### School Family

One app shell supports guardian and student personas. A person may have both personas and can switch only through a server-authorized session context.

Guardian context includes household and linked-child selection. Child selection is a resource scope under the guardian persona, not a new role.

Student context is age-appropriate, publication-aware and privacy-minimized. It must not expose guardian-only finance, custody or household controls.

### School Staff

A separate app shell starts with teachers. Additional roles may be added only when their mobile workflow, device risk, offline need and authorization matrix are approved.

The first release does not place full administration, finance, HR, procurement or safeguarding case management in the staff app.

## 3. Persona jobs

### Guardian

P0 mobile journeys:

- view linked children and relationship status;
- read announcements and notification inbox;
- view timetable, attendance and published results;
- view invoices, balances, receipts and authorized payment links;
- submit absence notices and evidence;
- complete forms, consent and acknowledgements;
- access authorized documents;
- use secure messaging;
- request contact/profile corrections.

P1 journeys:

- parent-teacher meeting booking;
- application/re-enrollment continuation;
- activity/trip registration and consent;
- transport and cafeteria summaries;
- delegated household access where policy allows.

### Student

P0 mobile journeys:

- today view and timetable;
- attendance history;
- published grades, report cards and transcript documents;
- announcements and permitted communication;
- assigned resource links and due-date metadata;
- forms, acknowledgements and permitted requests;
- authorized document wallet.

The student experience uses direct language, limited metrics, clear publication state and no manipulative engagement mechanics.

### Teacher

P0 mobile journeys:

- today timetable and current/next class;
- assigned roster;
- offline-safe attendance capture and reconciliation;
- grade-entry drafts where the backend contract permits;
- class announcements and secure communication;
- selected student alerts minimized to the teaching purpose;
- camera upload or QR scan for approved workflows;
- visible session, campus, class and sync state.

P1 journeys:

- substitution and room-change acknowledgement;
- pastoral referral initiation without broad case access;
- activity/trip attendance;
- selected staff requests and approvals.

## 4. Explicitly web-first

The following remain web/PWA-first until separately approved:

- tenant/campus configuration;
- admissions review and duplicate-person merge;
- chart of accounts, journals, reconciliation and period close;
- complex grade policy and timetable configuration;
- HR contracts, procurement, inventory administration and report building;
- broad student search and mass export;
- safeguarding, counselling and highly restricted case narratives;
- platform support and impersonation workflows.

## 5. Feature acceptance template

Every proposed mobile feature must specify:

1. persona and business outcome;
2. tenant/campus/relationship/class scope;
3. server command/query/read-model owner;
4. required capability and assurance level;
5. data classification and offline eligibility;
6. idempotency/concurrency/conflict behavior;
7. empty, loading, stale, offline, denied, masked, partial-success and error states;
8. notification and deep-link behavior;
9. accessibility/localization requirements;
10. audit, telemetry, support and test evidence;
11. fallback web route when the workflow is not safe or practical on mobile.

A screen mockup without these fields is not an implementation specification.

## 6. Context model

```text
Account
├── Tenant membership A
│   ├── Guardian persona
│   │   ├── Household 1
│   │   │   ├── Child A
│   │   │   └── Child B
│   │   └── Household 2
│   └── Teacher persona
│       ├── Campus X
│       └── Assigned classes
└── Tenant membership B
    └── Guardian persona
```

Changing tenant or persona is a security boundary. The app must cancel in-flight requests, clear scoped in-memory state, close or switch encrypted local namespaces, re-fetch capabilities and reject stale deep links.

Changing child within a guardian persona changes resource scope. It must not reuse a response authorized for another child.

## 7. Navigation principles

Navigation is generated from:

- active tenant and home region;
- active membership and persona;
- effective capabilities and entitlements;
- campus, class, student and relationship scopes;
- assurance level and step-up requirement;
- publication/finalization state;
- network and synchronization state;
- app-shell policy.

Client-side route hiding improves usability but never replaces server authorization.

## 8. Product metrics

Privacy-safe mobile product metrics may include:

- successful activation by persona;
- attendance capture duration and sync delay;
- duplicate/conflict/reconciliation rate;
- notification delivery/open outcome by event type, without message content;
- crash-free sessions and startup latency;
- form completion and recoverable draft rate;
- low-bandwidth payload size and cache hit rate;
- accessibility defects and localization overflow defects;
- support incidents per app version/device class.

Do not collect unrelated student behavior, advertising identifiers or engagement metrics designed to maximize screen time.

## 9. Release boundaries

### Family MVP

Guardian and student published-read journeys, forms/consent, secure messaging, documents, notification inbox and payment handoff.

### Staff MVP

Teacher timetable, roster, offline attendance, reconciliation, limited grade drafts, communication and selected alerts.

### Deferred

Full staff ERP, broad analytics, live location tracking, facial recognition, autonomous AI decisions, full LMS content authoring and unrestricted sensitive-case access.
