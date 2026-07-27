# 09 — Delivery Roadmap and Release Strategy

## 1. Delivery principle

এই platform একবারে “সব module” বানিয়ে release করা যাবে না। Product foundation, SIS core, finance correctness এবং international configuration আগে স্থিতিশীল করতে হবে। তারপর operational modules যোগ হবে।

Recommended delivery model:

- Outcome-based increments
- One integrated modular monolith
- Continuous migration and automated verification
- Design/specification before implementation
- Pilot schools before broad general availability
- One fully supported launch country before adding many partially supported countries

## 2. Program structure

```text
Program 0 — Product discovery and foundation
Program 1 — Identity, tenancy and platform controls
Program 2 — People, admissions and student lifecycle
Program 3 — Academic structure, timetable and attendance
Program 4 — Billing, payments and accounting
Program 5 — Gradebook, records and portals
Program 6 — International packs and interoperability
Program 7 — Operational ERP modules
Program 8 — Enterprise scale, analytics and assurance
```

Programs can overlap only after their dependencies and acceptance contracts are stable.

Implementation-agent ownership follows the large-stream system in [`docs/execution/`](execution/README.md). A module’s internal milestones are not separate agent assignments. One agent remains responsible for the complete module on one branch/worktree, checkpoint-commits meaningful milestones and automatically continues until the whole stream completion boundary or a documented hard stop.

## 3. Program 0 — Product discovery and engineering foundation

### Outcomes

- Confirm initial customer segment and launch country
- Validate workflows with real school users
- Establish repository, architecture and quality standards
- Select PostgreSQL provider and Cloudflare integration through benchmarks
- Build a realistic synthetic school dataset

### Deliverables

- Product glossary and domain map
- Interview/research notes from admissions, academic, finance, teacher and guardian personas
- Launch-country requirements pack
- Architecture proof of concept: Worker → `@neondatabase/serverless` → Neon PostgreSQL
- Direct HTTP, WebSocket transaction and pooled-endpoint benchmarks
- Neon branch lifecycle for local, module, pull-request preview and migration-test environments
- Database migration pipeline
- CI quality gates
- Threat model and data classification
- Design system and accessibility baseline
- Observability and environment strategy
- Vendor/license register

### Exit criteria

- At least two target schools validate core workflow maps
- Database provider benchmark and restore test complete
- Tenant isolation proof of concept passes negative tests
- First country pack scope is approved
- No unresolved architecture blocker for P0 modules

## 4. Program 1 — Tenancy, identity and platform controls

### Scope

- Tenant, legal entity, campus and home region
- Custom domains and tenant routing
- Identity provider integration
- User/person linking
- Membership, roles, permissions and scopes
- MFA/passkeys and session management
- Audit, support access and break-glass
- Localization/catalog framework
- Feature entitlements
- Documents, object metadata and secure downloads
- Notifications foundation
- Workflow/approval foundation
- Outbox, idempotency and background jobs

### Exit criteria

- Cross-tenant access tests fail closed
- Privileged access requires MFA
- Every high-risk support action is time-bound and audited
- New tenant can be provisioned reproducibly in a selected region
- Country/locale packs can be installed without core code changes

## 5. Program 2 — People, admissions and student lifecycle

### Scope

- Person, names, contacts and addresses
- Household and guardian authority
- Student and staff profiles
- Duplicate detection and merge
- Enquiries, applications, forms and document checklist
- Review, interview, offers, contracts and deposits
- Applicant-to-student conversion
- Enrollment, transfers, withdrawals and year-level placement
- Re-enrollment and promotion foundations
- Imports and migration reconciliation

### Exit criteria

- One family can manage multiple children and households correctly
- Guardian access follows effective authority rules
- Applicant conversion is idempotent and preserves evidence
- Historical enrollment is not overwritten by status changes
- Admissions funnel and data-quality reports reconcile to source records

## 6. Program 3 — Academic structure, timetable and attendance

### Scope

- Academic years, terms, calendars and bell schedules
- Curriculum/program/course/class structure
- Teacher/class assignment
- Manual timetable and conflict detection
- Student rosters
- Daily/session attendance
- Arrival, departure, absence notice and correction
- Offline attendance capture
- Attendance alerts and reports

### Exit criteria

- Morning attendance load passes target concurrency tests
- Offline retries cannot create duplicate records
- Teacher sees only assigned/current students
- Finalized attendance changes preserve old values and reasons
- Timetable publication and version history are reproducible

## 7. Program 4 — Billing, payments and accounting

### Scope

- Billing accounts and financial responsibility
- Fee catalog, schedules and assignments
- Invoices, installments, discounts, scholarships and waivers
- Payments, allocations, credits, refunds and receipts
- Payment-provider adapter framework
- Chart of accounts and fiscal periods
- Automated posting rules
- Double-entry journals
- Receivable reconciliation
- Statements, aging and core financial reports
- Period close and reversal

### Exit criteria

- Every invoice/payment/refund produces balanced, traceable journal entries
- Duplicate provider callbacks are harmless
- Subledger equals receivable control account
- Closed periods reject unauthorized postings
- Restore/replay reproduces balances
- Finance users can trace every dashboard total to source documents

## 8. Program 5 — Gradebook, records and role portals

### Scope

- Grading policy, scale and category versioning
- Assessments, rubrics, results and comments
- Grade calculations and moderation
- Publication controls
- Report cards, transcript and credits/GPA
- Teacher portal
- Guardian portal
- Student portal
- Forms, consent and communication preferences
- Standard dashboards with drill-down

### Exit criteria

- Historical grades are stable after policy changes
- Grade calculation is explainable from a stored snapshot
- Published changes require authorized amendment
- Portal permissions follow relationships/enrollment status
- Accessibility and multilingual acceptance suites pass

## 9. Program 6 — International packs and interoperability

### Scope

- First production country pack
- Second launch-region proof to validate extensibility
- Multi-currency and localized documents
- OneRoster CSV, then REST
- LTI 1.3/LTI Advantage
- OIDC/SAML enterprise integrations
- Webhooks and public API
- Data export and migration studio
- Country-specific payment/tax/report adapters

### Exit criteria

- A second country/curriculum can be configured without changing core domains
- Standards conformance/contract tests pass
- Full tenant export is documented and usable
- Integration failures are observable, replayable and reconcilable
- Residency and subprocessor records are accurate for each profile

## 10. Program 7 — Operational ERP modules

Deliver as separate increments after core adoption data shows demand:

- HR and payroll inputs/adapters
- Procurement, payables and budgets
- Inventory and assets
- Library
- Transport
- Hostel
- Cafeteria/POS
- Activities, trips and clubs
- Health, wellbeing, behavior, safeguarding and learning support

Health/safeguarding can be commercially important but requires a separate security/privacy readiness gate.

## 11. Program 8 — Enterprise scale and assurance

### Scope

- Dedicated tenant database/deployment
- School-group consolidation
- Read replicas/warehouse and advanced analytics
- SCIM and enterprise policy controls
- Advanced support/security center
- Formal DR and regional migration automation
- Partner marketplace governance
- SOC 2/ISO readiness program if commercially justified

## 12. Release stages

### Internal alpha

- Synthetic data only
- Core workflows and architecture validation
- No real student data

### Design partner pilot

- One or two schools
- Contracted limited scope
- Controlled migration
- High-touch support
- Explicit feature limitations
- Weekly data-quality, reliability and usability review

### Limited availability

- Multiple schools in one launch country/region
- Standard onboarding and migration process
- Published service targets
- Security review and penetration test complete

### General availability

- Proven onboarding, support, billing, backups and incident response
- No unresolved critical data-integrity findings
- At least one successful disaster-recovery exercise
- Country pack and provider contracts production-ready
- Tenant export and offboarding proven

## 13. Recommended team shape

Minimum effective cross-functional team for the core program:

- Product/domain lead
- Technical/architecture lead
- 2–4 full-stack/domain engineers
- Product designer with accessibility experience
- QA/automation engineer
- Part-time security/privacy specialist
- School operations/accounting subject-matter experts
- Customer implementation/migration owner before pilots

Specialists can be shared initially, but accounting and privacy expertise cannot be replaced by developer assumptions.

## 14. Workstream dependencies

| Workstream | Depends on |
|---|---|
| Admissions | Person/household, forms, documents, workflow, billing for fees |
| Enrollment | Person, organization, academic year, programs |
| Attendance | Enrollment, class roster, timetable, authorization |
| Gradebook | Class roster, grading policy, reporting periods |
| Billing | Legal entity, person/household, sequences, ledger |
| Ledger | Legal entity, fiscal periods, chart, posting engine |
| Portals | Identity, relationships, policy, read models |
| Country packs | Localization, configuration registry, document/report adapters |
| Integrations | Identity, external IDs, outbox, idempotency, audit |
| Analytics | Stable events/metrics and data classification |

## 15. Backlog hierarchy

Use:

```text
Program
  Capability
    Domain outcome
      User journey / workflow
        Vertical slice
          Engineering task
```

A vertical slice should include UI/API/domain/database/policy/audit/tests for one useful outcome. Avoid separate months-long “backend complete” and “frontend complete” phases.

## 16. Prioritization model

Score each capability on:

- Customer value
- Regulatory/financial necessity
- Dependency leverage
- Revenue/retention impact
- Data-integrity risk
- Delivery complexity
- Support burden
- Country specificity

Priority order:

1. Foundations and irreversible architecture decisions
2. Core record correctness
3. Daily high-frequency workflows
4. Money movement and reconciliation
5. Family/teacher experience
6. Integrations and country expansion
7. Long-tail operational modules
8. Advanced analytics/AI

## 17. Pilot-school selection

Choose design partners with:

- Decision-maker access
- Staff willing to test workflows
- Manageable migration complexity
- Representative admissions/attendance/fee needs
- Clear legal authority to provide data
- Commitment to feedback and reconciliation
- No expectation that every requested customization becomes core product

Avoid beginning with the largest, most regulated, most customized school group.

## 18. Data migration release gate

Before importing a real school:

- Data processing agreement signed
- Region and retention configured
- Source extract archived securely
- Mapping and dry-run approved
- Duplicate and relationship review complete
- Opening balances reconciled
- Rollback/cutover plan documented
- Support and incident contacts confirmed
- Post-import validation signed by school owners

## 19. Product analytics for roadmap decisions

Collect privacy-safe product metrics:

- Time to complete attendance
- Error/correction rate
- Admissions stage duration
- Payment success and reconciliation lag
- Report generation time
- Portal activation by persona
- Support tickets per workflow
- Import error categories
- Feature usage by tenant/module

Do not collect student-behavior analytics unrelated to service delivery.

## 20. Change management

For schools:

- Role-based training
- Sandbox/demo tenant
- Process mapping before configuration
- Data-cleanup plan
- Cutover calendar
- Champion users
- Hypercare and daily reconciliation after launch
- Release notes and in-product guidance

For engineering:

- Architecture decision records
- Migration review
- Feature flag and rollback plan
- Operational runbook
- Customer-impact assessment

## 21. Indicative sequencing, not a promise

A capable team should plan in multi-month product increments rather than promising an entire international ERP in a few weeks. Exact timelines depend on team size, launch-country rules, integration scope, migration quality and pilot feedback.

A reasonable planning model is:

- Foundation and proof of architecture: 1 increment
- Core SIS/admissions/attendance: 2–3 increments
- Finance/ledger and portals/gradebook: 2–3 increments
- First country production hardening and integrations: 1–2 increments
- Operational modules: ongoing independent increments

Each increment should be releasable and measurable; do not wait for every module before getting validated pilot feedback.

## 22. Implementation start gate

Code implementation should begin only after these documents are reviewed and the following are explicitly selected:

- First target customer segment
- First launch country and currency
- First curriculum types
- Neon project/region, autoscaling, pooled endpoint and restore configuration
- Identity provider approach
- Payment integration scope
- Pilot-school data volume assumptions
- Commercial open-source licensing posture

Recommended defaults are already present in this documentation, so these decisions can be confirmed rather than redesigned from zero.
