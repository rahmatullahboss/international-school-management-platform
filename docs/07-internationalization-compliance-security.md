# 07 — Internationalization, Privacy, Compliance and Security

## 1. International-first design principle

International support is not translation alone. The platform must separate:

- Universal school concepts
- Tenant policy
- Country law/regulation
- Curriculum rules
- Payment/tax/accounting adapters
- Local document/report formats

The core product remains country-neutral. A **country pack** and related adapters configure local behavior without forking the application.

## 2. Country-pack architecture

A versioned country pack may define:

- Supported locales and fallback language
- Default time zones, currency and number/date formats
- Address, phone and identifier formats
- School year and term templates
- Grade/year-level terminology
- Attendance codes and required calculations
- Grading, credits, GPA and promotion defaults
- Local tax/invoice fields
- Payment-provider adapters
- Regulatory export/report mappings
- Required student/staff fields
- Consent/privacy notice templates
- Data-retention defaults
- Localized report cards, certificates, invoices and receipts
- Payroll/HR integration adapters

### Pack rules

- Packs are immutable and versioned after release.
- Tenant activation records the exact pack version.
- Overrides are explicit and validated.
- Upgrades provide a diff, migration preview and rollback-safe plan.
- A country pack cannot bypass core security or accounting invariants.
- Legal wording must be approved locally before being represented as compliant.

## 3. Locale and language requirements

- Unicode throughout
- CLDR/ICU-compatible locale behavior
- Translation keys, not source-language text embedded in code
- Pluralization, grammatical gender and locale-specific interpolation
- Right-to-left layout and mirrored navigation support
- Native-script, legal, preferred and transliterated names
- Locale-aware collation/search with explicit normalization rules
- User-level language preference with tenant fallback
- Multilingual document and communication templates
- Content translation status and reviewer workflow
- Avoid flags as language selectors
- No assumption that first/last name or postal address follows Western structure

## 4. Date, time, calendar and academic terminology

- Store time zones using IANA identifiers.
- Display times in the relevant campus/user context.
- Distinguish instant, local date and academic period.
- Support differing weekends, instructional weeks and holidays.
- Academic years can cross calendar years and vary by campus.
- Grade levels are configurable labels/codes, not hard-coded `Grade 1–12`.
- Curriculum and transcript terminology is tenant/country configurable.
- Alternative calendar display may be added through presentation adapters; authoritative internal date handling remains consistent.

## 5. Currency, tax and finance localization

- ISO currency codes and configurable decimal/minor-unit handling
- One functional ledger currency per accounting book
- Foreign-currency transactions with stored exchange-rate evidence
- Local invoice/tax registration fields
- Configurable tax-inclusive/exclusive pricing
- Local receipt/invoice number formats without using them as primary keys
- Payment adapters selected by country and tenant
- Bank reconciliation formats and settlement references
- Tax reports implemented as versioned adapters, not hard-coded universal logic
- Payroll is country-module/integration based, not one global calculation engine

## 6. Curriculum and academic localization

The model must support:

- National, international and school-defined curricula
- More than one curriculum for one tenant or student
- Traditional percentage/letter grades
- Standards/outcomes-based grading
- Credits and non-credit progression
- GPA and non-GPA programs
- External examinations and predicted grades
- Competency/mastery models
- Different promotion, completion and graduation rules
- Localized report-card narratives and transcript formats

Historical records always reference the policy/curriculum version used at the time.

## 7. Accessibility and inclusive design

Target **WCAG 2.2 AA** for web experiences.

Required practices:

- Keyboard-operable workflows
- Visible focus states
- Correct semantic HTML and accessible names
- Sufficient contrast
- Responsive zoom and reflow
- Screen-reader tested forms, tables, dialogs and errors
- Accessible charts with text/table alternatives
- Captions/transcripts for product-created media
- Avoid color-only status communication
- Reduced-motion support
- Error summaries and field-level guidance
- Accessible authentication and MFA
- Localization testing with long strings and RTL

Native mobile applications should apply the same functional accessibility intent using platform accessibility APIs.

## 8. Privacy operating model

For most deployments, the school is expected to act as data controller/owner and the platform provider as processor/service provider, subject to contract and local law. The product must support, but cannot itself determine, the correct legal basis.

### Privacy principles embedded in product design

- Lawfulness, fairness and transparency
- Purpose limitation
- Data minimization
- Accuracy and correction
- Storage limitation
- Security/confidentiality
- Accountability and demonstrable controls
- Privacy by design and default

### Product capabilities

- Data inventory and field classification
- Purpose/legal-basis metadata for sensitive processing
- Configurable privacy notices and acceptance versions
- Guardian/student consent records where legally appropriate
- Data subject access/export workflow
- Correction and restriction workflow
- Deletion/anonymization workflow with legal-retention exceptions
- Processing/disclosure history
- Subprocessor and integration inventory
- Tenant-level retention schedules
- Legal hold
- Breach/incident evidence export
- Support-access approval and history

## 9. Child-data rules

The platform is designed for children’s data and therefore applies stricter defaults:

- No behavioral advertising
- No sale of student data
- No unrelated commercial reuse
- No AI/model training on tenant data by default
- No dark patterns or unnecessary engagement mechanics
- Minimum necessary data collection
- Age-appropriate notices and explanations
- School/guardian authorization flows configurable by jurisdiction
- Separate controls for school-authorized educational use versus direct consumer use
- Deletion schedules for inactive accounts and unneeded content
- Public profiles and directory sharing disabled by default

U.S. deployments must account for FERPA and, where applicable, COPPA. UK-facing child-accessible services should consider the Children’s Code. EU/EEA deployments need GDPR-oriented controller/processor, legal-basis, rights and transfer controls. Each launch country requires local review.

## 10. Data classification

Recommended classes:

| Class | Examples | Default controls |
|---|---|---|
| Public | Public school website content | Cacheable, integrity protected |
| Internal | General staff procedures | Authenticated tenant access |
| Confidential | Student profile, attendance, grades, finance | Tenant-scoped, encrypted, audited exports |
| Highly restricted | Health, safeguarding, custody, national IDs, credentials | Explicit role/case membership, field encryption, read logging, break-glass controls |
| Regulated financial | Journal, payment evidence, tax documents | Immutable history, separation of duties, retention and reconciliation |

Every field/document/event type declares a classification and allowed export/search/report behavior.

## 11. Authorization model

Use RBAC plus contextual ABAC/scopes.

Examples:

- A teacher can view students currently assigned to their classes, not every student in the campus.
- A guardian can view a child only while a valid authority/portal relationship exists.
- A finance officer may view billing contacts but not safeguarding notes.
- A counselor sees only assigned/referral cases unless a policy grants broader scope.
- A platform support engineer sees no tenant data without time-bound approved support access.

### Separation of duties

Critical financial and security operations may require distinct roles:

- Create versus approve refund
- Prepare versus post manual journal
- Create versus approve vendor/payment
- Request versus approve support access
- Modify role versus review access
- Reopen period versus post adjustment

## 12. Authentication and account security

- MFA required for privileged roles
- Passkeys supported where feasible
- OIDC and SAML federation for organizations
- SCIM provisioning in enterprise tier
- Session inventory and remote revocation
- Risk-based step-up authentication for sensitive operations
- Secure recovery that does not rely solely on knowledge questions
- Brute-force and credential-stuffing protection
- Password hashing through a proven identity provider/library
- Account linking verification to prevent guardian/staff identity takeover
- Separate service accounts with scoped credentials and rotation

## 13. Encryption and secrets

- TLS for all network communication
- Provider-managed encryption at rest as baseline
- Application/field-level encryption for selected identifiers, health and custody data
- Envelope encryption with key references rather than keys in database rows
- Keys/secrets stored in managed secret systems/bindings
- Key rotation procedure and impact testing
- Signed URLs are short lived and authorization is checked before issuance
- Backups and exports encrypted with managed access
- Avoid sensitive values in environment output, logs and support tooling

## 14. Audit, access and disclosure logging

Record:

- Actor and effective role
- Tenant, campus and region
- Action and resource
- Timestamp and request/correlation ID
- Before/after or change summary where appropriate
- Purpose/reason for high-risk access
- Support/break-glass approval reference
- Export/download/disclosure recipient and scope
- Integration destination
- Outcome and error code

Audit events are append-only and tamper-evident through restricted write roles, sequence/hash mechanisms where justified, retention and independent export. Access logging must include reads of highly restricted records, not only changes.

## 15. Secure development standard

Use **OWASP ASVS 5.0** as the application-security verification baseline and NIST CSF 2.0 as an organizational risk-management reference.

Minimum engineering controls:

- Threat modeling for every major domain and integration
- Security acceptance criteria in stories/specs
- Dependency and license scanning
- Secret scanning
- Static analysis and linting
- Software Bill of Materials
- Secure code review
- Unit/integration tests for authorization
- Tenant-isolation tests
- Dynamic application and API testing
- File upload scanning and content restrictions
- Infrastructure-as-code review
- Penetration testing before major production launches
- Vulnerability response SLA by severity
- Coordinated disclosure/security contact

## 16. Common security threats and design responses

| Threat | Design response |
|---|---|
| Cross-tenant data leak | Tenant context, RLS, scoped IDs, negative tests, no unscoped admin queries |
| Broken guardian/teacher authorization | Relationship/assignment-aware policy checks and expiry |
| Payment replay/duplicate | Signature validation, provider event uniqueness, idempotency and reconciliation |
| Malicious file upload | Size/type limits, isolated object storage, malware scan, safe download headers |
| CSV/formula injection | Escape exported cells and validate imports |
| Mass data export | Permission, step-up auth, reason, asynchronous generation, watermark/audit |
| Support abuse | No standing access, customer-approved time-bound support session |
| Queue duplicate/out-of-order | Idempotent consumer, version checks and deduplication |
| SQL injection | Parameterized queries and bounded query builders |
| XSS/content injection | Contextual output encoding, sanitization and CSP |
| Session theft | Secure cookies/tokens, rotation, device/session view and revocation |
| Sensitive logs | Structured allowlist logging, redaction and automated tests |
| Insider access | Least privilege, separation of duties, audit review and anomaly alerts |

## 17. Data residency and international transfers

- Tenant contract states the home region and relevant subprocessors.
- Database, files, backups, logs and support pathways are assessed together.
- Cross-border transfers are not inferred from database location alone.
- Regional deployment profiles document where each data class is processed.
- Cross-region operational metrics use minimized or pseudonymized data.
- Exact-country claims are made only when every relevant service supports them contractually.
- EU object-storage requirements can use an appropriate jurisdiction-controlled bucket/provider; other country-specific needs may require non-R2 storage.
- Regional support access is restricted and logged.

## 18. Retention and deletion

Retention is a policy engine, not one global period.

A rule includes:

- Record/document category
- Jurisdiction and tenant policy
- Trigger event: withdrawal, graduation, contract end, financial year close, case closure
- Retention duration
- Archive restrictions
- Legal hold behavior
- Destruction/anonymization action
- Approval and evidence requirements

Financial and academic records may need longer retention than messages or unsuccessful application documents. Deletion must preserve referential/accounting integrity and produce a destruction report.

## 19. Incident response and breach readiness

Runbooks cover:

- Account compromise
- Cross-tenant exposure
- Payment incident
- Malware/file incident
- Lost/stolen staff device
- Provider outage or compromise
- Database corruption or region failure
- Unauthorized support access

Capabilities:

- Rapid session/credential revocation
- Tenant/integration isolation switches
- Evidence preservation
- Affected-record and disclosure-scope queries
- Customer communication workflow
- Regulatory clock tracking by jurisdiction
- Restore and reconciliation
- Post-incident corrective action record

## 20. Compliance roadmap

### Foundation

- Data processing agreement and subprocessor inventory
- Privacy/security documentation
- OWASP ASVS-based controls
- Backup/restore evidence
- Access reviews and incident process
- FERPA/COPPA/GDPR/Children’s Code feature mapping where applicable

### Growth

- Independent penetration tests
- Formal security risk register
- Vendor risk process
- Business continuity exercises
- SOC 2 Type I readiness, then Type II if commercially required

### Enterprise

- ISO/IEC 27001 certification program if justified
- Region/customer-specific assurance reports
- Customer-managed keys/dedicated deployment where viable
- Formal privacy impact assessments for high-risk features

Do not claim certification before an accredited audit/certification is complete.

## 21. AI governance

Future AI capabilities are optional and isolated from transactional decisions.

Rules:

- No tenant data used to train shared models by default
- Explicit feature and data-processing configuration
- Minimum necessary prompts and redaction
- Provider and region disclosure
- Human review for grades, discipline, admissions, safeguarding or financial decisions
- Model/prompt/version audit
- Output uncertainty and source evidence where possible
- Bias and quality evaluation
- Easy disable/export/delete path
- No autonomous adverse action against a student

## 22. Launch-country checklist

Before declaring a country supported:

1. Local education terminology and workflows validated by real schools
2. Privacy and child-data legal review
3. Data region and subprocessor review
4. Required records and retention mapped
5. Tax/invoice/accounting behavior reviewed
6. Payments and refunds tested
7. Academic calendars, grading and reporting validated
8. Language/RTL and accessibility tested
9. Local document templates approved
10. Migration templates and sample data validated
11. Support hours/escalation defined
12. Country pack versioned and regression-tested

## 23. Research basis

See [99-references.md](99-references.md), references `P01–P12`, `S01–S05` and `C08–C12`.
