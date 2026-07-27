# Complete Whole-Module Agent Prompts

## Universal execution contract

Every stream agent must follow these rules:

1. Read `docs/README.md`, `docs/execution/README.md`, `docs/execution/03-agent-board.json`, `docs/execution/04-progress-tracker.md`, `docs/execution/05-module-ownership-and-integration-contracts.md`, `docs/execution/06-open-source-clean-room-policy.md`, relevant architecture/domain documents and all applicable repository instruction files.
2. Verify exact branch, base SHA, worktree, owned paths and Neon branch before writing.
3. Do not overwrite, discard, reset or reformat another owner’s changes.
4. Do not spawn or delegate to another agent. Internal milestones remain inside this execution stream.
5. Use test-first or characterization-first development for invariants, security and regressions.
6. After each meaningful milestone, run focused checks, checkpoint-commit owned changes, update stream evidence and continue automatically.
7. Never use real production student data in development or preview Neon branches.
8. Do not copy GPL/AGPL/no-license school-platform source or translate it line-by-line. Use only approved internal specifications, public standards and approved dependencies.
9. Do not deploy production, run destructive migrations, enable production features or alter real customer data without separate authorization.
10. Stop only at a documented hard stop, context limit after a safe checkpoint, or complete stream boundary.

Every completion/context report includes stream ID, branch, worktree, Neon branch, starting base, final HEAD, milestones completed/remaining, checkpoint SHAs, changed paths, tests, gates, next action, cleanup retained and confirmation of no unauthorized production mutation.

---

## FND-01 — Platform Foundation

**Role:** Own the entire technical and product foundation. No other implementation stream may run until this stream is reviewed and `GATE-FOUNDATION-READY` passes.

**Branch:** `program/foundation-neon-platform`
**Worktree:** `.worktrees/fnd-01-foundation`
**Neon branch:** `agent/fnd-01-foundation` after Neon project creation
**Starting state:** public GitHub repository `rahmatullahboss/international-school-management-platform`; canonical base `main`; resolve and record latest reviewed `origin/main` HEAD before branch creation or resume.

### Objective

Produce a production-shaped Cloudflare/TypeScript/Neon modular-monolith foundation that freezes the shared contracts needed by every module agent.

### Ordered milestones

1. **Repository and engineering bootstrap**
   - Preserve current docs and repository policy, verify remote/default branch/base SHA, create or resume the fixed foundation worktree, choose package manager, establish TypeScript monorepo, lint/format/typecheck/test/build commands, CI, environment conventions and contribution rules.
   - Define proposed stack: Cloudflare Workers, TypeScript, Hono-compatible HTTP layer, React web applications, Drizzle-compatible PostgreSQL access, Vitest and Playwright; record deviations through ADRs.
   - Checkpoint: clean repository with reproducible baseline commands.

2. **Direct Neon data platform**
   - Implement database adapter for Neon HTTP queries and request-scoped WebSocket transactions, pooled endpoint configuration, migration framework, standard PostgreSQL extensions policy, test database lifecycle and branch automation.
   - Add tenant-context/RLS proof, pool-context leak tests, transaction tests, branch-based migration rehearsal and restore evidence.
   - Checkpoint: Worker-to-Neon tests pass without Hyperdrive.

3. **Tenancy, organization and regional routing**
   - Implement tenant directory, legal entity, campus, home region, custom-domain routing, deployment profile, entitlement and tenant-scoped database conventions.
   - Add cross-tenant negative tests, cache/object namespace contracts and tenant provisioning workflow.
   - Checkpoint: tenant isolation gate passes.

4. **Identity, policy and privileged access**
   - Implement identity adapter, account/person link contract, membership, roles, permissions, scopes, contextual policy interface, MFA/session hooks, support access and break-glass foundations.
   - Provide stable policy test kit for module agents.
   - Checkpoint: deny-by-default and privileged-access tests pass.

5. **Shared transactional infrastructure**
   - Implement audit envelope, read/disclosure events, transactional outbox, idempotency records, optimistic concurrency contract, queue/workflow adapters, stable error model and correlation IDs.
   - Checkpoint: commit/event atomicity and duplicate-delivery tests pass.

6. **Localization, documents, notifications and workflow primitives**
   - Implement country-pack registry/version contract, locale/RTL primitives, custom forms contract, object metadata/secure file contract, notification provider interface, document template interface and approval workflow foundation.
   - Checkpoint: sample pack and synthetic end-to-end workflow pass.

7. **Shared experience and module boundaries**
   - Establish design tokens/components, accessibility test baseline, application shells, module registration, route/navigation capability model and architecture boundary tests.
   - Publish exact module-owned paths and public contracts.
   - Checkpoint: shared UI and boundary tests pass.

8. **Foundation verification and freeze**
   - Run full typecheck, lint, unit/integration/browser tests, tenant-isolation suite, migration-from-zero, restore rehearsal, build and documentation validator.
   - Record exact reviewed HEAD, Neon parent branch and contract versions in tracker.
   - Mark `GATE-FOUNDATION-READY` passed only with evidence; otherwise report blocked verdict.

### Completion boundary

Git repository, application baseline, Neon direct connectivity, tenancy, identity/policy, shared infrastructure, localization primitives, shared UI, architecture tests and agent ownership contracts are integrated and reproducible. Do not implement complete business modules inside this stream.

---

## SIS-01 — Core SIS and Admissions

**Branch:** `module/core-sis-admissions`
**Worktree:** `.worktrees/sis-01-core-sis`
**Neon branch:** `agent/sis-01-core-sis`
**Entry gate:** exact reviewed foundation SHA recorded and `GATE-FOUNDATION-READY` passed.

### Objective

Deliver the complete people, household, admissions and student-lifecycle module end-to-end.

### Ordered milestones

1. Characterize approved requirements and publish module schema/event/API contract without changing frozen foundation contracts.
2. Implement person, names, identifiers, contacts, addresses, household, relationships, guardian authority, emergency/pickup permissions, consent, duplicate detection and merge with RLS/audit.
3. Implement student/staff profiles, status histories, documents, identifiers and lifecycle access effects.
4. Implement enquiries, applicants, versioned forms/responses, checklist/documents, reviews, interviews, decisions, offers, contracts, deposits reference and idempotent applicant conversion.
5. Implement enrollments, program/campus/year placement, transfers, withdrawals, promotion/re-enrollment foundations, previous-school history and alumni transition.
6. Deliver admin/admissions interfaces, guardian-facing application/status surfaces, imports/exports, reconciliation, standard reports and data-quality dashboards.
7. Run domain, tenant/guardian authorization, migration, browser, accessibility, performance and restore tests; publish runbook and module completion report.

### Completion boundary

A school can create/import people and families, process an application, accept an offer, create and manage a historically correct enrollment, and export/reconcile the records through permission-aware UI and APIs.

---

## FIN-01 — Billing and Accounting

**Branch:** `module/finance-ledger`
**Worktree:** `.worktrees/fin-01-finance`
**Neon branch:** `agent/fin-01-finance`
**Entry gate:** reviewed foundation base and frozen legal-entity/person reference contracts.

### Objective

Deliver finance-grade billing, payments, receivables and immutable double-entry accounting end-to-end.

### Ordered milestones

1. Publish finance domain, money/precision, source-document, sequence, permission and event contracts.
2. Implement accounting books, fiscal periods, chart of accounts, dimensions, posting-rule versions, balanced immutable journals, reversals, close/reopen controls and database-enforced invariants.
3. Implement billing accounts, financial responsibility, fee catalog/schedules/assignments, invoices, installments, discounts, scholarships, waivers, taxes and statements.
4. Implement payments, provider-event verification contract, allocations, credits, overpayments, refunds, receipts, cashier/deposit and bank reconciliation.
5. Implement receivable subledger/control-account reconciliation, aging, trial balance, ledger, financial statements and traceable dashboard read models.
6. Deliver finance/cashier/admin UI, approval/separation-of-duty workflows, imports/exports and payment-provider adapter test harness.
7. Run property tests, duplicate/replay tests, tenant isolation, period close, currency/rounding, high-volume invoice/payment, restore/replay and browser tests; publish runbook and completion report.

### Completion boundary

Every charge, payment, discount, credit and refund is idempotent, balanced, traceable and reconcilable from user-facing document to ledger and back.

---

## INT-01 — Internationalization and Integration Platform

**Branch:** `module/international-integrations`
**Worktree:** `.worktrees/int-01-integrations`
**Neon branch:** `agent/int-01-integrations`
**Entry gate:** reviewed foundation base and country-pack/integration primitives frozen.

### Objective

Deliver configurable international packs, public integration infrastructure, migration tooling and initial education-standard adapters.

### Ordered milestones

1. Implement versioned country/curriculum pack manifests, validation, activation, overrides, upgrade diff and regression harness; produce one launch-country sample and one materially different validation pack using synthetic configuration.
2. Implement versioned OpenAPI, scoped integration credentials, external IDs, signed webhooks, inbound deduplication, retry/dead-letter/replay, connection health and disclosure audit.
3. Implement secure CSV/XLSX import/export foundation, mapping, staging, dry-run, row errors, domain-command execution and reconciliation reports.
4. Implement migration studio project/version model, repeatable source templates, file checksums and cutover evidence.
5. Implement OneRoster CSV profile and contract tests; establish REST extension path.
6. Implement LTI 1.3 registration/launch security foundation and SSO adapters for OIDC/SAML; add SCIM contract without overbuilding unsupported country providers.
7. Deliver tenant integration/country-pack administration UI, sandbox/test experience, observability, privacy/subprocessor metadata, conformance/security/performance tests and runbook.

### Completion boundary

A tenant can activate a country/curriculum pack, configure a scoped connector, import/export with reconciliation, receive/deliver replay-safe events and use the initial OneRoster/LTI/SSO profiles without core-domain forks.

---

## ACAD-01 — Academics, Attendance and Records

**Branch:** `module/academics-attendance-records`
**Worktree:** `.worktrees/acad-01-academics`
**Neon branch:** `agent/acad-01-academics`
**Entry gate:** Wave 1 reviewed integration base with stable student/enrollment, finance-reference and country-pack contracts.

### Objective

Deliver the complete academic operations chain from calendars and courses through attendance, gradebook, report cards and transcripts.

### Ordered milestones

1. Implement academic years, terms, instructional calendars, bell schedules, curriculum/program/course versions, standards, class sections, staff assignments and rosters.
2. Implement timetable versions, meetings, rooms, conflicts, substitutions, publish/unpublish and student/teacher schedule views.
3. Implement daily/session attendance, codes, late/early events, absence notices, correction/finalization, offline idempotent sync, alerts and attendance reports.
4. Implement grading policies/scales/categories, assessments, rubrics, results, exemptions/missing states, calculation snapshots, moderation, locks and publication.
5. Implement report-card runs, transcripts, credits/GPA, grade amendments, promotion/completion outputs and version-stable academic history.
6. Deliver coordinator/teacher/office interfaces, imports/exports, guardian/student publication read models and operational dashboards.
7. Run timetable conflict, morning burst, offline duplicate, teacher-scope, grading property, historical-policy, browser/accessibility, restore and report-generation tests; publish runbook.

### Completion boundary

A school can configure and publish its academic structure, take reliable attendance, calculate/publish explainable grades and issue historically stable report cards/transcripts.

---

## OPS-01 — School Operations ERP

**Branch:** `module/school-operations`
**Worktree:** `.worktrees/ops-01-operations`
**Neon branch:** `agent/ops-01-operations`
**Entry gate:** Wave 1 reviewed integration base with stable person, finance posting and integration contracts.

### Objective

Deliver the broad school-operations suite as one coherent module stream. Internal operational areas remain milestones under the same agent, not separate agent assignments.

### Ordered milestones

1. Implement staff employment, positions, assignments, contracts, qualifications, checks, leave and workload links; provide payroll-input adapter rather than universal payroll calculation.
2. Implement suppliers, requisitions, approvals, purchase orders, receipts, vendor invoices, payables references, budgets and finance posting integration.
3. Implement item/location inventory, stock movement, assets, assignment, maintenance and disposal.
4. Implement library catalog/copies/members/loans/reservations/fines with billing integration.
5. Implement transport routes/stops/vehicles/drivers/student assignments/trips/attendance and transport charging.
6. Implement hostel buildings/rooms/beds/allocations/leave and cafeteria meal plans/accounts/transactions/provider adapter.
7. Implement activities, clubs and trips with capacity, registration, consent, medical-reference minimization, risk assessment, attendance and charging.
8. Deliver unified operations UI, imports/exports, approvals, reports, dashboards, authorization/audit, finance reconciliation, performance/browser/accessibility tests and runbooks.

### Completion boundary

The operational domains work through shared people, billing, ledger, workflow and document contracts without directly editing another module’s tables.

---

## CARE-01 — Health, Wellbeing and Safeguarding

**Branch:** `module/student-support`
**Worktree:** `.worktrees/care-01-student-support`
**Neon branch:** `agent/care-01-student-support`
**Entry gate:** Wave 1 reviewed integration base plus approved high-risk data threat model.

### Objective

Deliver student-support capabilities under stricter authorization, read logging, disclosure and retention controls than ordinary school administration.

### Ordered milestones

1. Publish sensitive-data classifications, case membership, purpose, masking, break-glass, read-audit, export and retention contracts; pass threat-model gate.
2. Implement health profiles, conditions, allergies, medications, care plans, immunizations, clinic visits, dispositions, emergency summaries and restricted documents.
3. Implement behavior incidents, participants, actions, restorative follow-up and publication restrictions.
4. Implement pastoral/wellbeing notes, referrals, support plans, counselor workflows and case review.
5. Implement safeguarding concerns, cases, explicit members, actions, disclosures, external reports, legal hold and emergency access review.
6. Implement learning-support needs, accommodations, plans, goals, review cycles and authorized academic integration.
7. Deliver restricted interfaces, safe notifications, approved aggregate reports, disclosure evidence, negative authorization/read-log/export tests, browser/accessibility tests, incident runbooks and completion evidence.

### Completion boundary

Authorized staff can manage health and support cases while broad administrators, teachers, report builders, exports and integrations remain denied or masked by default.

---

## EXP-01 — Portals, Communications and Reporting Experience

**Branch:** `module/experience-portals-reporting`
**Worktree:** `.worktrees/exp-01-experience`
**Neon branch:** `agent/exp-01-experience`
**Entry gate:** Wave 2 reviewed integration base and stable domain query/command contracts.

### Objective

Deliver coherent admin, teacher, guardian and student experiences plus communication, documents, governed reporting and resilient PWA behavior without bypassing domain ownership.

### Ordered milestones

1. Build persona navigation, session/device experience, shared layouts, responsive/RTL/accessibility behavior and capability-aware empty/error states.
2. Deliver school-admin workflows that compose module APIs without direct table access.
3. Deliver teacher workflows for classes, attendance, gradebook, communication and permitted student context.
4. Deliver guardian household/multi-child portal for applications, attendance, grades, fees, forms, consent, documents and communication.
5. Deliver student portal for timetable, attendance, published results, documents, resources and requests.
6. Implement announcements, secure messaging, email/SMS/push adapters, preferences, multilingual templates, forms/surveys/acknowledgements and delivery status.
7. Implement document generation/download authorization, dashboards with metric definitions/drill-down, standard report catalog, asynchronous report jobs and permission-aware exports.
8. Implement PWA shell, low-bandwidth mode, offline-safe approved workflows, browser/mobile/accessibility/RTL/localization/performance tests, telemetry and support runbooks.

### Completion boundary

All principal personas can complete their daily cross-module journeys through accessible, permission-aware, traceable interfaces with no direct domain-table coupling.

---

## INTEG-01 — Serial Integration and Release Verification

**Branch:** `integration/international-school-platform-v1`
**Worktree:** `.worktrees/integ-01-release`
**Neon branch:** `integration/international-school-platform-v1`
**Entry gate:** exact reviewed SHAs and completion reports for the wave being integrated.

### Objective

Integrate all streams serially into one coherent modular monolith, verify cross-module correctness and produce release evidence. Do not rewrite modules casually to make merges easier; route substantive changes back through ownership/contract review.

### Ordered milestones

1. **Foundation integration:** verify repository baseline, foundation tests, shared contracts, Neon parent branch and tracker.
2. **Wave 1 integration:** review and integrate `SIS-01`, `FIN-01`, `INT-01` in dependency-safe order; resolve migration/event/API conflicts; run cross-module applicant-deposit-enrollment-billing and export/reconciliation journeys.
3. **Wave 2 integration:** integrate `ACAD-01`, `OPS-01`, `CARE-01`; run roster/attendance/fees, staff/finance, activity charges and restricted-record boundary journeys.
4. **Wave 3 integration:** integrate `EXP-01`; verify every persona journey, report drill-down, notifications, document access, offline behavior and accessibility.
5. **Database and recovery verification:** rehearse migrations from zero and prior integration checkpoints on an integration Neon branch, validate RLS, restore/time-travel procedure, outbox continuity and financial/academic reconciliation.
6. **System verification:** run lint/typecheck/build, unit/integration/browser suites, architecture boundaries, tenant isolation, security, finance properties, import/export round trips, performance workloads and documentation validator.
7. **Release evidence:** reconcile documentation, SBOM/notices, known risks, runbooks, SLO measurements, pilot-readiness gates and exact final HEAD. Do not deploy production without separate authorization.
8. **Safe cleanup:** only after reviewed integration reachability, list worktrees/branches/Neon branches eligible for deletion; never force-delete and retain anything dirty, active, unmerged or unreachable.

### Completion boundary

All planned modules are integrated, migrations and contracts are coherent, critical tests and recovery exercises pass, evidence is recorded and the program has an explicit pilot-ready or blocked verdict.
