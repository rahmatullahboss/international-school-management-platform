# 01 — Executive Summary

## 1. Product vision

একটি international, configurable এবং finance-grade school operating platform তৈরি করা হবে, যেখানে student lifecycle, academic operations, attendance, assessment, fee collection, accounting, staff operations, family communication, compliance এবং analytics একই trusted data model-এর উপর চলবে।

এটি কোনো single-country “school app” হবে না। Product-এর core থাকবে country-neutral; country-specific behavior আসবে versioned **country packs**, **curriculum packs**, **payment/tax adapters**, **document templates** এবং **policy configuration** থেকে।

## 2. Target customers

প্রথম লক্ষ্য K–12 segment:

- Independent/private schools
- International schools
- School groups and multi-campus chains
- Small and mid-sized public/charter operators where local reporting adapters are available
- Online or blended schools

প্রথম release-এ university/college-specific registrar, research, degree audit এবং complex higher-education finance scope অন্তর্ভুক্ত করা হবে না। Data model এমন থাকবে যাতে ভবিষ্যতে extension সম্ভব হয়।

## 3. Market conclusion

বড় school platforms থেকে চারটি পরিষ্কার product pattern পাওয়া যায়:

1. **District/public-school systems** শক্তিশালী scheduling, attendance, grading, compliance reporting, parent/student portals এবং interoperability-তে এগিয়ে।
2. **Private/international-school suites** admissions, tuition, billing, family experience, multi-curriculum, multi-language, wellbeing এবং school-group reporting-এ শক্তিশালী।
3. **ERP-oriented platforms** accounting, HR, payroll, inventory, procurement এবং operational control দেয়; কিন্তু student/teacher experience প্রায়ই দুর্বল।
4. **Open-source systems** domain workflow ও দ্রুত bootstrap-এর জন্য মূল্যবান; তবে international SaaS-grade tenancy, security, UI consistency, observability এবং upgrade governance সাধারণত নতুন করে শক্ত করতে হয়।

আমাদের product-এর সুযোগ হলো এই চারটি শক্তিকে এক architecture-এ আনা, কিন্তু সব feature একসঙ্গে implement না করা।

## 4. Final architecture recommendation

### Recommended: Cloudflare-centric hybrid

- **Cloudflare Workers**: edge/API/application runtime
- **Cloudflare WAF, DDoS, Bot controls, Turnstile**: perimeter security
- **Regional Neon Serverless PostgreSQL**: authoritative transactional data
- **`@neondatabase/serverless`**: direct HTTP/WebSocket connectivity from Cloudflare Workers
- **Neon pooled endpoints**: serverless connection pooling for burst concurrency
- **R2 or jurisdiction-compatible object storage**: documents, images, exports and backups
- **KV**: non-authoritative configuration/cache/localization artifacts
- **Queues**: notifications, imports, exports, integrations and event delivery
- **Workflows**: long-running, retryable business processes
- **Durable Objects**: narrowly scoped real-time coordination or strict per-entity sequencing
- **Analytics store/lake**: reporting workloads separated from the core OLTP database

### Why not 100% D1 for the main system?

Cloudflare D1 is attractive for lightweight and read-heavy workloads, but a paid D1 database currently has a 10 GB maximum and each individual database executes queries on a single thread. A school ERP has finance transactions, attendance bursts, grading, audit history, large imports and complex reporting. D1-per-tenant can support a limited starter product, but it is not the safest default for the platform’s authoritative global SIS/ERP database.

PostgreSQL provides the mature constraints, transaction semantics, query ecosystem, partitioning, row-level security, JSONB support, migration tooling and reporting compatibility required by this domain. Neon is the initial managed PostgreSQL provider. Cloudflare remains highly valuable around it. Hyperdrive is not required in the baseline because Workers can connect directly through Neon’s serverless driver; it remains an optional performance experiment only if production measurements justify it.

## 5. Product architecture decision

Start with a **domain-oriented modular monolith**, not microservices.

Why:

- Student, enrollment, attendance, timetable, grading and finance are deeply related.
- Cross-module transactions and invariants are common.
- A small team can deploy, test and observe one application more reliably.
- Modules can still have explicit APIs, separate ownership, events and database boundaries.
- High-volume or independently scaling functions can be extracted later from measured evidence.

## 6. Product differentiators

The platform should compete on:

- International country/curriculum configuration rather than hard-coded local assumptions
- Finance-grade receivables and double-entry accounting
- Excellent family, teacher and student experience
- Multi-campus and school-group operations from the beginning
- Strong data residency and privacy controls per tenant
- Open interoperability and migration tooling
- Low-bandwidth and mobile-first workflows
- Configurable reporting and document generation
- Auditable workflows and immutable history
- Transparent modular pricing instead of forcing every school to buy every module

## 7. Initial commercial release boundary

The first commercially usable release should include:

- Tenant, campus, academic year, locale and policy setup
- Identity, roles, permissions, MFA and audit
- Student, guardian, household and staff master records
- Admissions and enrollment
- Programs, subjects, classes, sections and basic timetable
- Daily/session attendance
- Fee structures, invoices, payments, allocations, discounts and refunds
- Double-entry accounting foundation and receivables ledger
- Teacher, parent and student portals
- Notifications and document templates
- Basic gradebook, report cards and transcripts
- Imports, exports, dashboards and standard operational reports
- Country pack framework and at least one fully supported launch country

Library, transport, hostel, cafeteria, HR/payroll, advanced LMS, fundraising, AI and predictive analytics should follow as separate product increments.

## 8. International operating model

Each tenant receives:

- A chosen **home data region**
- Default language, fallback languages and right-to-left support where needed
- Time zone, currency, number/date formats and academic calendar
- Configurable grading, credit, GPA, attendance and promotion rules
- Local identifiers, address formats, tax rules and payment adapters
- Retention, consent and privacy policies
- Localized report cards, invoices, certificates and regulatory exports

Core records remain portable. Country behavior must not be scattered as `if country == ...` conditions throughout the codebase.

## 9. Open-source strategy

Recommended approach:

- Study Frappe Education/ERPNext for education workflows, accounting and ERP concepts, but treat their GPL code as reference-only for the proprietary core unless a written GPL product decision is made.
- Study Gibbon for teacher-oriented planning, student profiles and community-oriented extensibility; its GPL code is also reference-only by default.
- Study OpenEduCat for broad module coverage. Its Community Edition is LGPL-licensed, but each reusable module/library still needs file-level dependency and Odoo-combination review.
- Treat openSIS Classic as reference-only until its exact repository version, license, activity and security posture are approved.
- Reuse permissively licensed code only with required copyright/license notices; isolate and review LGPL components; do not copy GPL/AGPL/no-license source into the proprietary core by default.
- Preserve copyright and notices; maintain a Software Bill of Materials and third-party attribution file.
- Never copy proprietary vendor code, screens or confidential materials.

Because the recommended target stack is TypeScript/Cloudflare/Neon PostgreSQL, wholesale adoption of a Python/Odoo/PHP open-source system would create architectural and licensing lock-in. The default is clean-room, domain-informed implementation: a research/specification pass may document publicly observable workflows and concepts, while implementation agents write original code from approved internal specifications rather than translating source line-by-line.

## 10. Success criteria

The architecture and product should be considered successful when:

- A new school can be configured without source-code changes.
- A tenant cannot access another tenant’s data even if an application authorization bug occurs.
- Financial balances always reconcile to immutable journal entries.
- Academic history remains reproducible after policy or grading-rule changes.
- Attendance entry works reliably during simultaneous morning load.
- Every sensitive read/write and data disclosure is attributable to an actor and reason.
- A school can import its data, export it in usable form and leave the platform without vendor lock-in.
- New country packs and integrations can be added without changing core domain logic.

## 11. Immediate next step after document approval

Implementation should begin with a foundation program, not UI screens:

1. Repository and engineering standards
2. Tenant/region model
3. Identity and authorization model
4. PostgreSQL schema conventions and migration pipeline
5. Audit/outbox/idempotency foundations
6. Localization/country-pack framework
7. Student and guardian master data

Feature development should not begin before these foundations have executable acceptance tests.

After the foundation contracts are frozen, development is organized as large module execution streams. Each stream has one agent, one branch, one fixed worktree and one Neon database branch. The agent completes all internal module milestones—schema, domain rules, APIs, UI, authorization, audit, imports/exports, reporting, tests and documentation—without delegating small tasks to other agents.
