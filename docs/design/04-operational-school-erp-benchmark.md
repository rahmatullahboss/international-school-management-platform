# Operational School ERP UX Benchmark and Rebuild Contract

## Why this exists

The current platform has strong domain, authorization, audit and runtime foundations, but several web routes still present those foundations through a pilot/evidence shell rather than a production school-management workflow. A polished page that cannot complete the user's school task is not a finished product surface.

The rebuild therefore separates **platform proof** from **operator work**:

- security, scope, assurance, audit and freshness remain visible when relevant;
- the primary viewport is reserved for the user's real records, controls and next actions;
- dashboard summaries are allowed at role/module homes, but task routes are lists, ledgers, schedules, forms and record views.

This document is subordinate to `PRODUCT.md`, `DESIGN.md`, domain contracts and `docs/execution/06-open-source-clean-room-policy.md`.

## Research references

### OpenEduCat Community

Useful public-product patterns:

- ERP-style module navigation that keeps school functions continuously reachable;
- list -> record -> action workflows rather than a new marketing-style dashboard for every route;
- admissions, students, timetable, attendance, assessment/gradebook and fees treated as working registers;
- forms place the current record and its editable state at the center of the page.

License note: the community repository is LGPL-3.0 at repository level. This project still treats direct reuse as conditional and requires file-level intake/provenance review. The default for this rebuild is behavioral/UX reference, not source or asset copying.

### Gibbon

Useful public-product patterns:

- school-office terminology is visible in the navigation;
- admissions and enrolment are progressive workflows with registers and record actions;
- timetable and attendance are first-class operational destinations;
- administration favors dense, scan-friendly school records over presentation-heavy landing pages.

License note: GPL application source is reference-only for this proprietary core.

### Frappe Education / ERP education workflows

Useful public-product patterns:

- familiar ERP list/detail/form conventions;
- strong global search/list filtering expectations;
- student, admission, course schedule, attendance and fee workflows are separate working destinations;
- state-changing actions are attached to the record or register where the user makes the decision.

License note: GPL application modules remain reference-only. Frappe Framework's separate license does not make Education application code permissive.

## Clean-room rule

This rebuild does not create a pixel clone and does not port third-party source, database schemas, templates, icons, translations or protected assets. External products are used to identify domain conventions, information architecture, workflow expectations, usability failures and acceptance criteria. Implementation remains original TypeScript/CSS against this repository's contracts.

## Current failure mode

`PilotModuleSurface` and the scoped operator shell repeat a generic composition:

1. large title/masthead;
2. generic navigation/action buttons;
3. three summary metrics;
4. a small priority queue;
5. pilot/audit explanation.

That composition is useful for staging proof, but it has leaked into the product experience. It produces three concrete problems:

- **false affordance:** a link such as “Review” can return to the same generic route without opening a real record;
- **task displacement:** security/pilot evidence can occupy more visual weight than the user's actual work;
- **role sameness:** Admissions, Finance, Teacher, Guardian and other roles inherit nearly identical page grammar even though their daily tasks are fundamentally different.

## Target application shell

### Persistent context

Every authenticated working surface keeps the following available without a large hero:

- school and campus;
- current role/persona;
- academic year/term when relevant;
- network/sync state where relevant;
- account/security actions;
- current destination.

### Navigation

Navigation names familiar school jobs. It is capability-aware and never exposes unauthorized counts or sensitive destination existence.

- Admin: Home, People & admissions, Academics, Attendance, Assessments & records, Finance, Staff & operations, Student support, Communications, Integrations, Reports, Settings.
- Admissions: Enquiries, Applications, Interviews & tours, Offers, Enrolment conversion, Reports.
- Finance: Invoices, Receipts/cashier, Payments, Reconciliation, Credits/refunds, Ledger, Statements, Reports.
- Teacher: Today, My classes, Attendance, Gradebook, Students, Messages, Resources.
- Guardian: Home, Children, Applications, Attendance, Results, Fees, Forms, Documents, Messages.
- Student: Today, Timetable, Attendance, Results, Resources, Requests, Documents, Messages.
- Support: Tenant scope, Deployment health, Diagnostics, Privileged access, Audit evidence.

### Page header

A task route gets a compact header with:

- breadcrumb/context;
- one task title;
- short state/context line only when useful;
- primary action aligned with the task;
- saved view/filter/search controls where relevant.

No 5–6rem display heading is used for routine operator work.

## Surface patterns

### Register / list

Default for people, applications, interviews, invoices, receipts, classes, attendance sessions, assessments, messages and most operational records.

Required capabilities when meaningful:

- search;
- filters and clear-filter state;
- sortable columns;
- pagination or bounded virtualisation;
- multi-select and bulk actions;
- status and ownership;
- row-level primary action;
- empty/loading/error/restricted/offline states;
- URL-addressable filters when users need to share/revisit a view.

### Record workspace

Default for application, student, invoice, support case and similar rich records.

Use:

- concise identity/status header;
- sections/tabs for logically separate record areas;
- timeline/audit evidence when decision history matters;
- action bar close to the decision context;
- explicit unsaved/saving/conflict state;
- no nested decorative cards.

### Schedule

Default for interviews, timetable, appointments/tours and room/resource scheduling.

Provide:

- date range and campus/context filters;
- list/day/week representation according to density;
- conflict state;
- reschedule/cancel/complete actions where permissions/API exist;
- keyboard-usable non-drag alternative.

### Ledger / reconciliation

Finance routes privilege tabular numeric alignment, source evidence, totals and discrepancy state. Mutation controls live beside the candidate being reconciled, not in a disconnected demo panel.

### Roster / gradebook

Teacher and academic workflows privilege fast row/column entry, sticky context, keyboard movement, draft/sync state and conflict recovery.

## Route-specific acceptance contract

### Admissions enquiries

A user must be able to find an enquiry by applicant/family/contact, filter by status/owner/intake, see last contact and next action, and open the enquiry record. A headline count alone is not completion.

### Admissions applications

The server-owned work queue is the source for eligible production review candidates. The UI must expose candidate identity/application number/version/readiness, allow the reviewed recommendation/score/notes command, surface conflict/replay outcomes, and refresh the queue after acceptance.

### Admissions interviews

The route is a schedule/register, not a metrics dashboard. It shows applicant, programme/intake, date/time, interview type/location, assigned interviewer, state and next action. Schedule/reschedule/outcome mutation controls are enabled only when backed by approved APIs; otherwise the route remains an honest read-only register rather than presenting a fake action.

### Finance reconciliation

The current server-owned reconciliation candidates appear as the primary working table. The user selects a candidate, sees amount/currency/date/source context, records the reason and submits the reviewed database command. Successful submission removes/updates the candidate without a full-page reset.

### Support privileged access

Purpose and duration are the primary form. AAL2 requirement, pending state, expiry and audit receipt are visible as security context, not a page-sized warning.

## Anti-patterns blocked by this contract

- A task route made only from three metric cards plus a generic queue.
- A primary link that points to the same route without changing task state or opening context.
- “Review”, “Open” or “Manage” labels without a concrete destination/action.
- Capability lists rendered as prominent cards; capability detail belongs in account/security context.
- Giant editorial headings on repetitive staff workflow pages.
- Synthetic/pilot disclaimers dominating production UX.
- Fake client-side success for a workflow that has no approved mutation API.
- Copying competitor screen structure pixel-for-pixel.

## Delivery order

1. Admissions / Finance / Support operator shell and existing real production command flows.
2. SIS and Admissions registers/record workspaces.
3. Academics, attendance, gradebook and records.
4. Admin operations, communications, integrations and reports.
5. Teacher working surfaces.
6. Guardian and Student mobile-first working surfaces.
7. Full cross-role E2E and manual-QA readiness gate.

## Manual QA readiness gate

For every published role and route, record one of:

- **working:** the user can complete the permitted outcome against the approved backend contract;
- **read-only by design:** the user can inspect real authorized data and the UI states why mutation is unavailable/not part of that role;
- **not publishable:** the route is incomplete and must not be represented as finished software.

Static pilot/evidence pages do not qualify as working routes.
