# Large Module Stream — Short Command Catalog

Use these commands only in the documented order and only after the corresponding entry gate is passed. Each command represents one complete large execution stream, not one internal milestone.

## FND-01 — Foundation

`@School Management FND-01 করো; GitHub repo rahmatullahboss/international-school-management-platform-এর latest reviewed origin/main থেকে target branch program/foundation-neon-platform, fixed worktree .worktrees/fnd-01-foundation এবং Neon branch agent/fnd-01-foundation create/verify/resume করো; docs/execution/FND-01-ONE-SHOT-PROMPT.md ও সেখানে উল্লেখিত documents পুরোটা পড়ে Cloudflare/TypeScript application foundation, direct Neon driver/database platform, tenancy, identity/policy, audit/outbox/idempotency, localization, shared UI/contracts এবং verification milestones serially execute করো; প্রতিটি meaningful milestone শেষে tests, checkpoint commit ও push করে automatically next milestone-এ যাবে; normal milestone শেষে থামবে না; documented hard stop/context limit/whole-stream completion-এ exact resume বা completion report দিয়ে STOP।`

## SIS-01 — Core SIS

`@School Management SIS-01 করো; target branch module/core-sis-admissions, fixed worktree .worktrees/sis-01-core-sis এবং Neon branch agent/sis-01-core-sis create/verify করো; foundation tracker-এ recorded reviewed base SHA ব্যবহার করো; docs/execution/02-module-stream-full-prompts.md-এর “SIS-01 — Core SIS and Admissions” পুরোটা পড়ে people, household, guardian authority, student/staff profiles, admissions, enrollment, transfer/withdrawal, migration, UI, reports ও testsসহ পুরো ordered module chain একাই execute করো; checkpoint commit-এর পর automatically continue করবে; hard stop/context limit/whole-module completion ছাড়া থামবে না।`

## FIN-01 — Finance

`@School Management FIN-01 করো; target branch module/finance-ledger, fixed worktree .worktrees/fin-01-finance এবং Neon branch agent/fin-01-finance create/verify করো; foundation tracker-এর exact reviewed base ব্যবহার করো; docs/execution/02-module-stream-full-prompts.md-এর “FIN-01 — Billing and Accounting” পুরোটা পড়ে billing accounts, fees, invoices, payments, allocations, refunds, double-entry ledger, reconciliation, finance UI/reports, authorization এবং tests end-to-end একাই execute করো; প্রতিটি checkpoint commit-এর পরে next milestone-এ automatically যাবে; hard stop/context limit/whole-module completion-এ STOP।`

## INT-01 — International and Integrations

`@School Management INT-01 করো; target branch module/international-integrations, fixed worktree .worktrees/int-01-integrations এবং Neon branch agent/int-01-integrations create/verify করো; foundation reviewed base ব্যবহার করো; docs/execution/02-module-stream-full-prompts.md-এর “INT-01 — Internationalization and Integration Platform” পুরোটা পড়ে country packs, OpenAPI/webhooks, external IDs, import/export, migration studio, OneRoster, LTI, SSO, connector governance এবং testsসহ সম্পূর্ণ module stream একাই execute করো; checkpoint commit শেষে automatically continue করবে; hard stop/context limit/whole-module completion ছাড়া থামবে না।`

## ACAD-01 — Academics

`@School Management ACAD-01 করো; target branch module/academics-attendance-records, fixed worktree .worktrees/acad-01-academics এবং Neon branch agent/acad-01-academics create/verify করো; Wave 1 integrated reviewed base ব্যবহার করো; docs/execution/02-module-stream-full-prompts.md-এর “ACAD-01 — Academics, Attendance and Records” পুরোটা পড়ে calendars, curriculum, courses/classes, timetable, attendance/offline sync, assessments, gradebook, report cards/transcripts, academic UI/reports এবং tests end-to-end একাই execute করো; checkpoint commit-এর পরে automatically continue করবে; hard stop/context limit/whole-module completion-এ STOP।`

## OPS-01 — School Operations

`@School Management OPS-01 করো; target branch module/school-operations, fixed worktree .worktrees/ops-01-operations এবং Neon branch agent/ops-01-operations create/verify করো; Wave 1 integrated reviewed base ব্যবহার করো; docs/execution/02-module-stream-full-prompts.md-এর “OPS-01 — School Operations ERP” পুরোটা পড়ে HR/staff, procurement/payables/budgets, inventory/assets, library, transport, hostel, cafeteria এবং activities/trips-এর schema-to-UI, finance integration, reports এবং tests সম্পূর্ণ একাই execute করো; internal areas নতুন agent-এ ভাগ করবে না; checkpoint-এর পরে automatically continue করবে; hard stop/context limit/whole-module completion-এ STOP।`

## CARE-01 — Student Support

`@School Management CARE-01 করো; target branch module/student-support, fixed worktree .worktrees/care-01-student-support এবং Neon branch agent/care-01-student-support create/verify করো; Wave 1 integrated reviewed base ব্যবহার করো; docs/execution/02-module-stream-full-prompts.md-এর “CARE-01 — Health, Wellbeing and Safeguarding” পুরোটা পড়ে health, clinic, behavior, pastoral, safeguarding, learning support, restricted authorization/read logging, workflows, reports এবং tests end-to-end একাই execute করো; checkpoint commit শেষে automatically continue করবে; hard stop/context limit/whole-module completion-এ STOP।`

## EXP-01 — Experiences and Reporting

`@School Management EXP-01 করো; target branch module/experience-portals-reporting, fixed worktree .worktrees/exp-01-experience এবং Neon branch agent/exp-01-experience create/verify করো; Wave 2 integrated reviewed base ব্যবহার করো; docs/execution/02-module-stream-full-prompts.md-এর “EXP-01 — Portals, Communications and Reporting Experience” পুরোটা পড়ে admin, teacher, guardian, student portals, communications, forms, documents, dashboards, governed reporting, PWA/low-bandwidth/accessibility এবং tests end-to-end একাই execute করো; checkpoint-এর পরে automatically continue করবে; hard stop/context limit/whole-module completion-এ STOP।`

## INTEG-01 — Serial Integration and Release Verification

`@School Management INTEG-01 করো; target branch integration/international-school-platform-v1 এবং fixed worktree .worktrees/integ-01-release create/verify করো; docs/execution/03-agent-board.json ও docs/execution/02-module-stream-full-prompts.md-এর “INTEG-01 — Serial Integration and Release Verification” পুরোটা পড়ো; only reviewed stream SHAs গ্রহণ করে dependency-wave order-এ modules integrate, migrations order/rehearse, boundary/security/tenant/finance/regression/performance verification, documentation reconciliation এবং release evidence serially execute করো; প্রতিটি wave checkpoint commit-এর পরে available next wave-এ automatically যাবে; required SHA gate, unresolved safety failure, context limit বা final program completion-এ report দিয়ে STOP; force cleanup বা production deployment করবে না।`
