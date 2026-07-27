# 11 — Risks, Decisions and Product Guardrails

## 1. Purpose

এই নথি scope expansion, architecture drift এবং irreversible mistakes ঠেকানোর জন্য। Risks শুধু তালিকা নয়; প্রতিটির mitigation, trigger এবং ownership implementation planning-এ যুক্ত হবে।

## 2. Confirmed product decisions

| Decision | Chosen direction | Reason |
|---|---|---|
| Primary market | International K–12 schools | Clear common domain with strong private/international demand |
| Product category | SIS + School ERP | Student and financial operations require one governed platform |
| Initial architecture | Domain-oriented modular monolith | Lower distributed complexity with explicit module boundaries |
| Edge/application platform | Cloudflare-centric | Global delivery, security and managed async primitives |
| Authoritative database | Regional Neon Serverless PostgreSQL | Finance-grade transactions plus serverless branching/autoscaling and direct Workers connectivity |
| Database connection | Neon serverless driver and pooled endpoint | Direct edge connectivity; Hyperdrive remains optional only after measurement |
| D1 role | Optional/lightweight, not core default | Capacity/concurrency and ecosystem trade-offs |
| Tenancy | Regional pooled by default; dedicated option | Cost efficiency plus enterprise isolation path |
| International model | Country/curriculum packs | Prevent hard-coded forks |
| Accounting | Immutable double-entry ledger | Auditable financial correctness |
| LMS strategy | Integrate first | Avoid excessive scope and use standards ecosystem |
| Payroll strategy | Country adapters/integrations | Law changes too much for one universal early engine |
| Open source | Selective licensed reuse | Avoid stack/license/security lock-in |
| AI | Deferred and opt-in | Core data quality/privacy first |

## 3. Major risk register

### R1 — Scope explosion

**Risk:** Trying to build admissions, SIS, LMS, accounting, HR, payroll, library, transport, hostel, mobile, analytics and AI simultaneously.

**Impact:** Slow delivery, inconsistent data model, unfinished modules and no sellable product.

**Mitigation:** P0/P1/P2 catalog, program gates, integration-first LMS/payroll, one launch country, vertical slices.

**Trigger:** More than two foundational programs active before shared dependencies stabilize.

### R2 — Building for every country before proving one

**Risk:** Generic configuration becomes theoretical and untested.

**Impact:** Large abstraction cost with no production-quality country support.

**Mitigation:** Fully implement one launch country, then validate architecture with a materially different second country/curriculum.

**Trigger:** Country-specific feature requests enter core code without a pack/adapter decision.

### R3 — Incorrect tenant isolation

**Risk:** One school accesses another school’s records.

**Impact:** Critical child-data breach and existential trust/legal damage.

**Mitigation:** Tenant context, PostgreSQL RLS, scoped authorization, storage/cache namespace controls, negative tests and support-access restrictions.

**Trigger:** Any unscoped query, shared cache key or background job without explicit tenant context.

### R4 — Finance modeled as editable balances

**Risk:** Fees/payments/refunds do not reconcile or history can be overwritten.

**Impact:** Financial loss, audit failure and customer rejection.

**Mitigation:** Double-entry ledger, immutable postings, source-document links, idempotency, period close and reconciliation tests.

**Trigger:** A feature proposes directly changing `balance` rather than posting a transaction.

### R5 — Historical academic data changes unexpectedly

**Risk:** Updating grade scales/policies modifies past transcripts/report cards.

**Impact:** Invalid academic records and loss of credibility.

**Mitigation:** Versioned policies, calculation snapshots, immutable publication and amendment workflow.

**Trigger:** Queries calculate historical grade from current configuration.

### R6 — PostgreSQL provider or regional mismatch

**Risk:** Neon lacks a required region, contractual residency profile, restore window, capacity characteristic or enterprise term for a target market.

**Impact:** Migration/rearchitecture or inability to sell in target markets.

**Mitigation:** Benchmark at least two providers, use standard PostgreSQL, infrastructure adapters and restore/export testing.

**Trigger:** Provider-only features enter core schema or a launch country lacks compliant region coverage.

### R6A — Parallel module agents damage shared foundations

**Risk:** Multiple module agents edit shared contracts, migrations or platform files simultaneously and create semantic merge conflicts.

**Impact:** Broken module boundaries, migration-order failures and expensive integration rewrites.

**Mitigation:** Foundation-first gate, frozen shared contracts, exact path ownership, one branch/worktree/Neon branch per module, contract-change requests and one serial integration stream.

**Trigger:** A module agent needs to edit a path outside its board-defined ownership or changes a shared contract without an approved versioned extension.

### R7 — Cloudflare object/storage residency gap

**Risk:** Database region is compliant but files, logs, backups or support pathways are not.

**Impact:** False residency claims and contract breach.

**Mitigation:** Deployment profile evaluates all data paths; use alternative regional object store where necessary.

**Trigger:** Sales claims “data stays in country” based only on PostgreSQL location.

### R8 — Morning and publication burst load

**Risk:** Attendance, grade publication or billing creates concentrated traffic.

**Impact:** School operations stop at the most visible times.

**Mitigation:** Bounded APIs, indexed queries, async reports/notifications, load tests, tenant capacity profiles and offline attendance.

**Trigger:** Synchronous bulk work or unpaginated queries in critical workflows.

### R9 — Queue duplicates and event inconsistency

**Risk:** At-least-once delivery creates duplicate messages, charges or notifications.

**Impact:** Financial and communication errors.

**Mitigation:** Transactional outbox, idempotent consumers, provider event uniqueness, version checks, dead-letter/replay.

**Trigger:** Consumer performs side effect without persisted deduplication/idempotency.

### R10 — Overuse of microservices

**Risk:** Early module separation creates distributed transactions and operational burden.

**Impact:** Slow development, hard debugging and inconsistent records.

**Mitigation:** Modular monolith, extraction criteria and internal contracts.

**Trigger:** Service extraction proposed only for “clean architecture” without measured scaling/security/team need.

### R11 — Open-source license violation

**Risk:** Strong-copyleft or commercially restricted code is copied into proprietary SaaS without compliance.

**Impact:** Legal obligations, forced disclosure, rewrite or commercial dispute.

**Mitigation:** SPDX/SBOM, legal review, exact commit/version register, third-party notices and approved reuse policy.

**Trigger:** Engineer copies code because it is visible on GitHub without a license decision.

### R12 — Data migration failure

**Risk:** Incorrect guardian relationships, balances, grades or histories are imported.

**Impact:** Immediate customer distrust and operational disruption.

**Mitigation:** Migration studio, staging, dry-run, domain commands, reconciliation and customer sign-off.

**Trigger:** Direct SQL import into production core tables.

### R13 — Privacy/compliance overclaim

**Risk:** Marketing says “FERPA/GDPR compliant” without customer context, contracts or independent evidence.

**Impact:** Legal/sales risk and loss of trust.

**Mitigation:** Control mapping, legal review by launch country, precise contractual language and no certification claims without audit.

**Trigger:** Compliance badge/claim added before documented evidence and counsel review.

### R14 — Sensitive health/safeguarding exposure

**Risk:** General admin/teacher roles inherit access to highly restricted cases.

**Impact:** Severe child-safety/privacy harm.

**Mitigation:** Separate module policies, case membership, read logging, break-glass and restricted reporting/export.

**Trigger:** “School admin can see everything” role template.

### R15 — Reporting harms transactional performance

**Risk:** Arbitrary dashboards/reports run expensive joins against OLTP.

**Impact:** Slow attendance, payment and grade workflows.

**Mitigation:** Governed projections, async report generation, warehouse/lake and query budgets.

**Trigger:** User-controlled report joins or long queries in synchronous requests.

### R16 — Customization forks

**Risk:** Every school receives bespoke code.

**Impact:** Upgrade impossibility and high support cost.

**Mitigation:** Config, country packs, workflow/form/template engine, extension APIs and product governance.

**Trigger:** Tenant name/country logic added directly to core module.

### R17 — Weak product usability

**Risk:** Technically complete ERP is too complex for teachers/parents.

**Impact:** Low adoption and support burden.

**Mitigation:** Persona workflows, design partners, accessibility, low-bandwidth/mobile testing and task-completion metrics.

**Trigger:** Screens expose database/module structure instead of user tasks.

### R18 — AI introduced before governance

**Risk:** Sensitive data goes to external models or automated outputs affect students.

**Impact:** Privacy, bias and safety failures.

**Mitigation:** Deferred AI, opt-in processing, provider/region disclosure, human review and no adverse autonomous decisions.

**Trigger:** AI feature proposed without data-flow, model, retention and review design.

## 4. Non-negotiable architecture guardrails

- Core student/finance truth lives in PostgreSQL, not cache/KV.
- Every tenant-owned query/write has tenant context.
- RLS is enabled for pooled tenant data, with a normal app role unable to bypass it.
- Highly restricted domains have additional policy boundaries.
- Every external side effect is idempotent or reconciled.
- Domain events use a transactional outbox.
- Posted financial records are immutable and balanced.
- Historical academic records reference policy versions.
- Files remain in object storage with checksums and metadata.
- Heavy reports/imports/exports are asynchronous.
- Country behavior uses packs/adapters.
- Core modules do not import provider-specific infrastructure APIs directly.
- No production data in development or ordinary issue trackers.

## 5. Product guardrails

- One supported launch country is better than ten incomplete country claims.
- “All features” is not a release criterion; reliable daily workflows are.
- Every dashboard number must drill down or explain source/definition.
- A parent account supports multiple children and complex guardianship.
- Health/safeguarding data is never broadly inherited.
- A school can export its data in usable formats.
- No advertising or sale of student data.
- No biometric feature without explicit business, privacy and legal approval.
- No custom school fork without an approved extension/configuration analysis.

## 6. Commercial packaging recommendation

Suggested modular packages:

### Core SIS

- Organization, people, student lifecycle, academic structure, attendance, basic gradebook and portals

### Admissions

- Enquiry, applications, review, contracts and enrollment conversion

### Finance

- Billing, payments, receivables and accounting

### Operations

- HR, procurement, inventory/assets, library, transport, hostel, cafeteria and activities

### Student support

- Health, wellbeing, behavior, safeguarding and learning support

### Enterprise

- Dedicated deployment/database, SSO/SCIM, advanced analytics, regional controls and premium support

Country-specific payment, tax, payroll and regulatory adapters may have separate implementation/support fees.

## 7. Product-owner defaults to confirm

The documentation recommends these defaults:

- Initial segment: private/international K–12 schools
- Initial tenancy: regional pooled SaaS
- First product language: English plus launch-country language
- Accounting: included in finance foundation, not deferred indefinitely
- Initial mobile strategy: responsive PWA; native apps after workflows stabilize
- LMS: OneRoster/LTI integration with limited LMS-lite features
- Payroll: integration/adapters
- Open-source: reference/selective reuse, not wholesale fork
- AI: disabled in initial core

Changing one of these defaults should create an explicit decision record and impact review.

## 8. Architecture review cadence

Review decisions:

- Before implementation starts
- Before first real-data pilot
- Before adding a new country/region
- Before extracting a service
- Before adopting strong-copyleft code
- Before introducing health/safeguarding/biometric/AI capability
- Before promising dedicated/exact-country data residency
- When production measurements invalidate capacity assumptions

## 9. Definition of an acceptable exception

A guardrail exception must document:

- Business/customer need
- Affected tenants/regions/modules
- Security/privacy/data-integrity impact
- Alternatives considered
- Compensating controls
- Expiry/review date
- Owner and approver
- Rollback/removal plan

Permanent undocumented exceptions are prohibited.

## 10. Final recommendation

Proceed with the Cloudflare-centric hybrid architecture and an international K–12 modular product, but begin implementation only with the platform foundation and core student/person model. The highest-value risk reduction is not adding more features; it is proving tenant isolation, regional data routing, database correctness, migration safety and accounting invariants early.
