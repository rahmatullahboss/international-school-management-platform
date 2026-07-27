# 08 — Integrations and Open-Source Reuse

## 1. Strategy

The product must be open enough to coexist with learning platforms, identity providers, payment systems, accounting tools, payroll providers, government systems and school hardware.

Two principles apply:

1. **Integration is a product capability**, with versioning, security, monitoring and replay—not one-off scripts.
2. **Open-source reuse must be license-compliant and security-reviewed**. “Copy” means lawful reuse or learning from public domain workflows, never copying proprietary code or designs.

## 2. Integration platform capabilities

### P0

- REST API documented through OpenAPI
- OAuth 2.0/OIDC authorization for user-facing integrations
- Scoped service credentials for machine integrations
- Signed outbound webhooks
- Idempotent inbound webhook/event handling
- CSV/XLSX import and export
- SFTP/file-drop adapter where needed
- External ID mapping
- Retry, dead-letter and replay
- Per-tenant rate limits and quotas
- Sandbox/test credentials
- Integration health and delivery history
- Secret rotation and revocation
- Data-minimization and disclosure audit

### P1

- Connector SDK and partner certification
- SCIM provisioning
- mTLS and IP allowlisting for enterprise
- Scheduled data synchronization
- Transformation/mapping studio
- Integration marketplace
- Tenant-managed webhook subscriptions
- Contract tests and schema registry

## 3. Standards roadmap

### 3.1 OneRoster 1.2

Use for roster, course, class, user, enrollment, grade/result and resource exchange with LMS and educational tools.

Implementation approach:

- Start with CSV import/export profile.
- Add REST profile after core identifiers and permission model are stable.
- Maintain external identifiers and source-system ownership.
- Validate full and delta synchronization behavior.
- Publish supported object/field profile and extensions.

### 3.2 LTI 1.3 and LTI Advantage

Use to launch external learning tools securely and exchange class/user/assignment/grade context.

Capabilities:

- Platform registration and key rotation
- Deep Linking
- Names and Role Provisioning Services
- Assignment and Grade Services
- Deployment/course-level configuration
- Privacy-aware claim minimization
- Audit of tool launches and grade returns

### 3.3 Ed-Fi

Use an Ed-Fi-oriented canonical mapping for public-school interoperability and data-standard exports where markets require it.

Do not force the internal database to copy the Ed-Fi schema. Maintain a versioned adapter between product domains and the current supported Ed-Fi Data Standard.

### 3.4 SIF

Support SIF through a market-specific adapter, especially where education ecosystems or national/state implementations still require it. Treat SIF as an integration profile rather than a core domain model.

### 3.5 Identity standards

- OpenID Connect
- SAML 2.0
- SCIM 2.0
- Passkeys/WebAuthn for platform authentication where supported

### 3.6 General API standards

- OpenAPI 3.x
- JSON Schema for event and configuration validation
- Stable resource IDs and cursor pagination
- RFC-compliant date/time and error formats
- Webhook signatures, timestamps and replay protection
- API deprecation policy and sunset notice

## 4. Connector categories

### Identity and productivity

- Google Workspace for Education
- Microsoft Entra ID / Microsoft 365 Education
- Generic OIDC/SAML providers
- Calendar and email providers

### Learning

- Canvas, Moodle, Google Classroom, Microsoft Teams for Education and other OneRoster/LTI-capable tools
- Content publishers and assessment systems
- Video/virtual classroom providers

### Finance and payments

- Country-specific payment gateways
- Bank transfer/direct debit adapters
- Accounting/ERP exports or synchronization
- Tax/e-invoicing systems
- POS/cafeteria providers

### Communication

- Transactional email
- SMS
- Push notifications
- WhatsApp/business messaging where contracts and local rules permit
- Emergency notification providers

### Operations

- RFID/QR/card systems
- Library barcode systems
- Transport/GPS systems
- Biometric systems only after a high-risk privacy assessment and explicit legal basis
- Document signing and identity verification

### Government/regulatory

- Country/state student-reporting systems
- Examination boards
- Funding/census systems
- Tax and payroll authorities through country adapters

## 5. Connector architecture

Every connector implements an adapter contract:

```text
ConnectorManifest
- connector_id
- version
- supported_regions
- data_categories
- authentication_modes
- required_scopes
- inbound_events
- outbound_commands
- rate_limit_policy
- retry_policy
- data_retention
- subprocessor_details

ConnectorRuntime
- validateConfiguration()
- testConnection()
- pullChanges(cursor)
- pushCommand(command)
- receiveWebhook(event)
- mapInbound(payload)
- mapOutbound(domainData)
- healthStatus()
```

The exact language/API may differ; the conceptual contract is mandatory.

### Isolation

- Connector credentials are tenant-specific.
- Provider code cannot query arbitrary domain tables.
- Connectors receive purpose-built application services and scoped data transfer objects.
- A connector failure cannot corrupt a core transaction.
- All data transfers are recorded with destination, category and status.

## 6. Synchronization rules

### Source of truth

For every field/object, define:

- Authoritative system
- Direction: inbound, outbound or bidirectional
- Matching key
- Conflict rule
- Deletion/disable behavior
- Frequency
- Reconciliation report

Bidirectional sync is avoided unless both sides have explicit conflict/version semantics.

### External identifiers

Use `external_identifier` records with:

- Tenant
- Integration connection
- Object type
- Internal ID
- External ID
- External version/etag
- Last synchronized time
- Ownership/status

Do not overload human-readable student numbers as universal integration identifiers.

### Idempotency and ordering

- Inbound provider event IDs are unique per connection.
- Duplicate deliveries return the stored result.
- Out-of-order updates use source version/time and policy.
- Full reconciliation can repair missed events.
- Delete/tombstone behavior is explicit.

## 7. Migration studio

Migration is a strategic feature, not a support script.

### Capabilities

- Source templates for common SIS products
- Column mapping and transformations
- Relationship matching
- Duplicate detection
- Reference-data mapping
- Dry run
- Row-level validation errors
- Staged domain import
- Balance, enrollment and count reconciliation
- File/document transfer with checksums
- Repeatable migration project versions
- Cutover checklist and sign-off report

### Minimum reconciliation

- People/students/guardians counts
- Relationship counts
- Active and historical enrollments
- Class rosters
- Attendance totals by period
- Grade/transcript records
- Invoice, payment, credit and outstanding balances
- General-ledger opening balances where migrated
- Files and checksum counts
- External IDs

## 8. Direct-copy decision for this product

The default answer is **no: do not directly copy the core source of the shortlisted school platforms into the proprietary TypeScript product**. Direct copying is allowed only after an exact repository, commit, file and dependency review proves that the license and architecture are acceptable.

### What can be used safely by default

- Publicly documented concepts, terminology, workflow stages and business rules
- Independently written requirements, test cases and data mappings derived from product research
- Public interoperability standards and schemas under their stated terms
- MIT, BSD or Apache-licensed libraries with notices and attribution
- Original implementation written from approved internal specifications

### What requires case-by-case approval

- LGPL libraries/components that remain replaceable and independently linked, with required source/notice/relinking compliance
- GPL applications operated as clearly separate, arms-length services without copying or combining their source into the core product
- Templates, assets, translations, fixtures or schemas whose individual license may differ from the repository-level license

### What is prohibited by default

- Copying GPL/AGPL source into proprietary core modules
- Translating GPL source line-by-line into TypeScript
- Copying database schemas wholesale when their expressive structure is copyrightable or inseparable from GPL implementation
- Copying UI layouts pixel-for-pixel, branding, icons, text or proprietary screenshots
- Copying from a public repository that has no license
- Asking the same implementation agent to study GPL source and reproduce it line-by-line

### Clean-room workflow

1. A research/specification owner records observable workflows, domain concepts, inputs, outputs, edge cases and acceptance tests without copying source text.
2. The research output receives a provenance and license review.
3. The implementation agent receives only the approved internal specification and public standards, not copied GPL code.
4. The implementation agent writes original TypeScript/SQL/UI code and records all third-party packages in the SBOM.
5. Review checks suspiciously similar structure, names, comments, assets and source fragments before merge.

This policy is a product-engineering default, not legal advice. Any deliberate GPL/LGPL adoption requires written legal and product approval.

## 9. Open-source candidates

### 9.1 Frappe Education

Observed strengths:

- Education domain workflows on the Frappe framework
- Student, instructor, program/course, admission, fee, scheduling and examination concepts
- Portal and ERP integration patterns

Potential use:

- Domain research and workflow comparison
- Data migration mappings
- Carefully selected code/configuration only after license review

Cautions:

- Its framework/database/runtime differ from the recommended Cloudflare/TypeScript/Neon PostgreSQL stack.
- The repository license is GPLv3. Ordinary hosted access and distribution are not identical legal events, but combined/derived code and future browser/mobile/on-premise distribution make direct copying unsuitable for the proprietary core by default.
- Do not port source, doctypes, client code or server code line-by-line without a written GPL product/legal decision.

### 9.2 ERPNext

Observed strengths:

- Double-entry accounting and broad ERP concepts
- Receivables, payables, inventory, assets, HR and workflow ideas
- Mature open-source ecosystem

Potential use:

- Accounting workflow and report reference
- Chart-of-account and posting-rule comparison
- Integration/export target for schools already using ERPNext

Cautions:

- License obligations and notices
- Different framework and data model
- School-specific finance rules still need product-owned design

### 9.3 Gibbon

Observed strengths:

- School-focused, teacher-friendly workflows
- Planning, attendance, student profiles, admissions and modular extensions
- Long-lived community product

Potential use:

- UX/workflow study
- Feature-gap checklist
- Migration connector/source template
- Licensed component reuse only after current repository/license/security review

Cautions:

- Verify current license, dependency state, security history and extension quality at adoption time.
- A traditional single-school deployment model is not automatically an international multi-tenant SaaS architecture.

### 9.4 OpenEduCat

Observed strengths:

- Broad education modules built on Odoo
- PostgreSQL-based ERP orientation
- Admissions, students, attendance, fees, exams, library, HR and finance coverage

Potential use:

- Module coverage benchmark
- ERP workflow/reference
- Integration/migration source

Cautions:

- Community and commercial editions/modules may have different terms.
- Odoo framework adoption would materially change the target architecture.
- Verify each module’s license and dependencies separately.

### 9.5 openSIS Classic

Potential use:

- Traditional SIS workflow and migration reference

Cautions:

- Before reuse, verify current canonical repository, license, activity, vulnerability/dependency state and maintainability.
- Treat as reference-only until that audit is complete.

## 10. Recommended reuse policy

### Allowed categories

- Permissively licensed libraries after review
- Standards schemas/specifications under their stated terms
- Copyleft components when isolated/deployed in a way approved by legal counsel and product strategy
- Algorithms or ideas independently reimplemented from public specifications
- Public sample data and templates with compatible terms

### Required process

1. Identify exact repository, version and commit.
2. Record SPDX license and copyright.
3. Check transitive dependencies and embedded assets.
4. Evaluate SaaS/network-copyleft and distribution obligations.
5. Run security, maintenance and code-quality review.
6. Decide: use, fork, isolate as service, reimplement from specification, or reject.
7. Add to SBOM and `THIRD_PARTY_NOTICES`.
8. Pin version and define upgrade ownership.
9. Maintain modifications and source-offer obligations where applicable.

### Prohibited behavior

- Copying proprietary competitors’ code, schema or design assets
- Removing notices
- Assuming GitHub availability means commercial permission
- Mixing strong-copyleft source into closed modules without approval
- Depending on an abandoned project without an ownership/fork plan
- Copying security/authentication code merely to save time

## 11. Build versus adopt decisions

| Capability | Default decision | Reason |
|---|---|---|
| Core tenant/identity/policy | Build | Product-specific security and residency foundation |
| Student/enrollment core | Build | Central domain and historical integrity |
| Billing/ledger | Build core; use proven libraries | Must fit source-document and school rules; correctness owned internally |
| Full LMS | Integrate first | Mature external ecosystem and excessive scope |
| Authentication primitives | Adopt managed/proven standards | Avoid custom crypto/password/auth implementation |
| Payment processing | Integrate | Country/provider compliance and settlement complexity |
| PDF/document engine | Adopt library/service behind adapter | Commodity capability, but templates/policies remain owned |
| Timetable solver | Adopt/evaluate optimization libraries later | Specialized algorithms; isolate as service |
| Analytics warehouse | Adopt managed/open technology | Avoid building database infrastructure |
| Open-source SIS wholesale | Do not adopt by default | Stack, tenancy, UX and licensing mismatch |
| Migration connectors | Build product capability | Strategic differentiator and data-quality control |

## 12. Partner and marketplace governance

A future partner application must provide:

- Business/legal identity
- Security contact
- Privacy policy and data purposes
- Requested scopes and justification
- Data retention/deletion behavior
- Regions/subprocessors
- Penetration/security evidence appropriate to risk
- Support and incident process
- Versioned integration contract

High-risk scopes—health, safeguarding, national IDs, finance exports—require additional review and tenant administrator approval.

## 13. Integration definition of done

An integration is complete only when it has:

- Versioned contract and mapping
- Authentication/authorization model
- Tenant configuration validation
- Idempotency and retry behavior
- Reconciliation mechanism
- Monitoring, alerts and replay
- Disclosure/audit events
- Privacy/subprocessor documentation
- Sandbox test path
- Contract and security tests
- Disable/revoke/export/delete behavior
- Support runbook

## 14. Research basis

See [99-references.md](99-references.md), references `I01–I08`, `O01–O09`, `L01–L04` and `M01–M16`.
