# 10 — Testing, Operations, Observability and SLOs

## 1. Quality strategy

Because the platform stores child, academic and financial records, correctness and isolation matter more than feature count. Quality gates apply to every vertical slice, not only before a major release.

Testing layers:

- Domain/unit tests
- Database constraint and migration tests
- Application integration tests
- Authorization and tenant-isolation tests
- API/contract tests
- Browser/mobile workflow tests
- Accessibility and localization tests
- Performance/load tests
- Security verification
- Backup/restore and disaster-recovery exercises
- Migration/reconciliation tests

## 2. Domain and invariant tests

### People and enrollment

- A person can have multiple roles without duplicate identity records.
- Guardian access expires when authority/relationship ends.
- Enrollment history cannot overlap where policy disallows it.
- Applicant conversion cannot run twice.
- Withdrawal and transfer preserve historical records.

### Attendance

- Only one current result exists per student/session.
- Offline duplicate batches do not duplicate records.
- Finalized attendance requires amendment rather than overwrite.
- Teacher access follows current class assignment.
- Local-date and time-zone behavior remains correct around daylight-saving changes.

### Grading

- Weighting, rounding, exemptions and missing states follow policy versions.
- Published grades reference immutable calculation snapshots.
- Policy updates do not change old report cards/transcripts.
- Grade amendments preserve original result and approval reason.

### Billing and ledger

- Every posted journal balances.
- Invoice/payment/refund postings reconcile to source documents.
- Duplicate payment callbacks are idempotent.
- Payment allocations cannot exceed available amounts.
- Closed periods reject disallowed postings.
- Reversal restores expected subledger/control-account balances.
- Currency conversion uses stored rate/version and fixed precision.

Use property-based tests for finance calculations, grading formulas, date ranges and import transformations where many edge cases exist.

## 3. Tenant-isolation test program

This is a mandatory release gate.

Test categories:

- Every API query/command with tenant A token against tenant B IDs
- Background job with incorrect/missing tenant context
- Neon pooled endpoint/WebSocket connection tenant-context reuse
- RLS policies under normal app database role
- Search/report/export tenant filters
- Object-storage signed URL and key isolation
- Cache-key namespace isolation
- Webhook/integration credential isolation
- Platform support access expiration
- Dedicated versus pooled deployment behavior

Maintain generated test tenants with identical-looking IDs/data patterns to catch accidental global lookup behavior.

## 4. Authorization test matrix

For every capability define:

- Action
- Resource/classification
- Persona/role
- Scope/relationship
- Expected allow/deny/mask
- Required assurance level
- Audit requirement

Negative tests are first-class. At minimum test:

- Teacher outside assigned class
- Guardian without active authority
- Finance user requesting safeguarding record
- General admin requesting restricted health case
- Support user without approved session
- Suspended staff account
- Student requesting unpublished grade
- Integration using excessive scope

## 5. Database and migration tests

Every migration pipeline performs:

- Apply to empty database
- Upgrade from supported previous schema versions
- Rollback strategy validation where possible; otherwise forward-fix rehearsal
- Constraint and index verification
- RLS policy presence
- Query-plan regression for critical paths
- Backfill idempotency
- Bounded batch behavior
- Row-count/checksum/invariant reconciliation
- Compatibility with old and new application versions during rolling deploy

Production migrations must not hold long table locks during school operating hours without an approved maintenance plan.

## 6. API and integration contract tests

- OpenAPI schema validation
- Authentication and scope behavior
- Idempotency-key behavior
- Pagination and filters
- Error code stability
- Webhook signature/replay protection
- Duplicate and out-of-order provider events
- Provider timeout/rate-limit scenarios
- Dead-letter and replay
- OneRoster/LTI/Ed-Fi/SIF profile conformance as implemented
- Export/import round trips
- Backward compatibility and deprecation tests

Use provider sandboxes and recorded synthetic fixtures; never store real student payloads in tests.

## 7. End-to-end critical journeys

Automate at least:

1. Tenant/campus setup → invite staff → configure academic year
2. Guardian application → document/payment → offer → enrollment
3. Create class → roster students → teacher attendance → guardian notification
4. Configure assessment → enter results → moderation → publish report card
5. Assign fees → issue invoice → pay → allocate → receipt → reconcile ledger
6. Refund/credit and reversal flow
7. Student transfer/withdrawal and portal access change
8. Data export request and audited download
9. Support-access approval, use and expiry
10. Academic year rollover preview and execution

## 8. Accessibility and localization testing

### Automated

- Semantic and ARIA checks
- Color contrast checks where tool-supported
- Keyboard focus and form-label checks
- Missing translation key detection
- Pseudo-localization with expanded strings
- RTL visual regressions
- Locale/date/number/currency snapshots

### Manual

- Screen-reader journeys
- Keyboard-only administration and grade entry
- Zoom/reflow
- Error recovery
- Mobile touch target and orientation
- Arabic/Hebrew or another RTL pilot locale
- Native-script names and long addresses
- Mixed-language documents

Automated accessibility tools are not sufficient for WCAG 2.2 AA acceptance.

## 9. Performance testing

### Representative workloads

- Morning attendance burst
- Portal login after result publication
- Bulk invoice generation
- Payment callback burst
- Grade import and report-card generation
- Large admissions import
- School-group dashboard refresh
- End-of-day notification campaign
- Large tenant export

### Required dimensions

- Small, medium and large tenant profiles
- Pooled noisy-neighbor scenario
- Dedicated tenant profile
- Multiple regions/home-region distance
- Cold Worker/startup conditions
- Database failover/reconnection
- Queue backlog and provider throttling

### Performance rules

- Synchronous requests remain bounded.
- Exports, large imports and batch calculations are asynchronous.
- No unpaginated list endpoints.
- Critical queries have explicit indexes and explain-plan evidence.
- Cache improves performance but correctness never depends on it.

## 10. Initial service objectives

These are engineering targets, not contractual commitments until measured in production.

| Area | Initial target |
|---|---|
| Shared SaaS availability | 99.9% monthly for core interactive service |
| Enterprise target after maturity | 99.95% where regional provider profile supports it |
| Typical in-region read API | p95 under 300 ms excluding large reports/provider calls |
| Typical command API | p95 under 700 ms excluding payment/long workflow |
| Attendance batch | Accepted within 2 seconds for normal class size |
| Notification enqueue | Under 5 seconds after committed triggering event |
| Critical async event processing | 99% within 5 minutes under normal conditions |
| Standard report | Request accepted immediately; asynchronous completion target by report class |
| Point-in-time recovery objective | Under 5 minutes data loss target for supported production tier |
| Recovery time objective | Under 60 minutes target for core regional service after major incident |

SLOs must be split by region, service and customer tier after real data is available.

## 11. Error budget policy

- Availability/reliability SLOs have monthly error budgets.
- When a core SLO is exhausted, reliability work takes priority over feature release.
- Security incidents, cross-tenant leaks and ledger corruption have zero acceptable budget.
- Provider failures are measured separately but customer-visible outcomes remain owned by the platform.

## 12. Observability architecture

### Signals

- Metrics
- Structured logs
- Distributed traces/correlation IDs
- Audit/security events
- Synthetic checks
- Queue/workflow state
- Database health and query performance
- Provider integration health

### Required dimensions

- Environment
- Region
- Service/module
- Tenant deployment profile; use pseudonymized tenant dimension where exported globally
- Request/event type
- Outcome/error code
- Provider/connector
- Version/release

Never use student name, email, national ID, message content, health information or raw payment details as log labels or trace attributes.

## 13. Product-operational dashboards

### Platform

- Request rate, latency, error rate and saturation
- Worker CPU/subrequests and exceptions
- Database connections, transactions, locks, replication/failover status
- Queue depth, age, retries and dead letters
- Workflow failures/timeouts
- Object upload/scan/download failures

### Domain

- Attendance submission and correction failures
- Admissions conversion failures
- Invoice/posting imbalance attempts
- Payment webhook/reconciliation status
- Grade publication failures
- Import/export completion and error classes
- Tenant provisioning/region-routing failures

### Privacy/security

- Failed privilege checks by pattern
- Unusual mass exports/downloads
- Break-glass/support sessions
- Credential abuse/rate-limit events
- Malware upload detections
- Integration scope violations

## 14. Alerting principles

An alert must have:

- User/business impact
- Threshold or condition
- Severity
- Owner/on-call route
- Runbook
- Required evidence
- Suppression/deduplication behavior

Page humans only for actionable production impact. Use tickets/dashboards for trends that do not need immediate response.

Suggested critical alerts:

- Cross-tenant authorization/RLS anomaly
- Ledger posting invariant failure
- Sustained core API failure in a region
- Database failover or PITR/backup failure
- Payment event backlog or signature failures
- Dead-letter growth for critical domain events
- Support/break-glass anomaly
- Malware or credential compromise signal

## 15. Runbooks

Required before general availability:

- Regional API/database outage
- Database failover and restore
- Queue backlog/dead-letter replay
- Payment provider outage/reconciliation
- Email/SMS provider outage
- Bad migration rollback/forward fix
- Tenant routing/domain issue
- Cross-tenant incident containment
- Account compromise
- Object-storage/file incident
- Corrupt import and tenant restore
- Region migration
- Academic year rollover recovery

Runbooks use synthetic examples and do not expose real customer secrets.

## 16. Backup and disaster recovery tests

### Regular controls

- Automated backup completion monitoring
- Backup encryption and access review
- Point-in-time restore test
- Object checksum/inventory verification
- Tenant-level export validation
- Database schema/migration version verification

### Recovery exercise

1. Select a regional staging copy/synthetic tenant.
2. Restore database to a chosen point.
3. Restore/reconnect objects.
4. Verify counts, relationships and migrations.
5. Reconcile ledger trial balance and receivables.
6. Verify attendance and published academic records.
7. Resume outbox processing without duplicate side effects.
8. Record actual RPO/RTO and corrective actions.

## 17. Release quality gates

A production release requires:

- CI green for unit, integration and contract suites
- No unresolved critical/high security finding without approved exception
- Tenant-isolation suite pass
- Database migration rehearsal pass
- Critical journey smoke tests
- Accessibility/localization regression for changed surfaces
- Performance check for changed critical query/workflow
- Feature-flag/rollback plan
- Observability and runbook updates
- Privacy/data-processing review for new fields/integrations
- SBOM and dependency/license checks

## 18. Change and deployment strategy

- Small, frequent, backward-compatible deploys
- Canary by internal/synthetic tenants, then selected pilot tenants
- Feature flags by tenant/region
- Expand/migrate/contract database changes
- Queue/event schema compatibility
- No destructive migration in the same release that stops writing old format
- Automated smoke tests after deployment
- Rapid disable switch for integrations/features

## 19. Production data restrictions

- No production data in local development, screenshots, issue trackers or AI coding tools unless contractually approved and securely configured.
- Support tools display minimum necessary fields.
- Debug exports are encrypted, time-limited and audited.
- Synthetic data generators cover international names, households, curricula, currencies and sensitive-case edge conditions.

## 20. Operational readiness definition of done

A feature is production-ready only when:

- SLO/critical metrics are defined
- Logs/traces are privacy-safe
- Alerts and runbook exist for likely failure modes
- Backup/restore impact is understood
- Async replay is safe
- Support can identify status without database improvisation
- Tenant-facing status/error experience is defined
- Capacity and cost assumptions are measured
