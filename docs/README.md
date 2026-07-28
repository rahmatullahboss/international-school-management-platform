# International School Management Platform — Documentation Index

**Project status:** Research and architecture documentation baseline
**Prepared on:** 2026-07-28
**Target product:** International, multi-tenant K–12 Student Information System (SIS) and School ERP
**Primary deployment recommendation:** Cloudflare Workers with direct Neon Serverless PostgreSQL connections

## Purpose

এই ডকুমেন্টেশন সেটটি implementation শুরু করার আগের product, domain, architecture, database, security, internationalization, integration এবং delivery baseline। লক্ষ্য হলো এমন একটি school management platform ডিজাইন করা যা ছোট private school থেকে multi-campus international school group পর্যন্ত ব্যবহার করতে পারে এবং country-specific configuration দিয়ে বিভিন্ন দেশে চালানো যায়।

## Recommended reading order

1. [Executive summary](01-executive-summary.md)
2. [Market and competitor research](02-market-research.md)
3. [Product requirements and full feature catalog](03-product-requirements-and-feature-catalog.md)
4. [Architecture options and final decision](04-architecture-options-and-decision.md)
5. [Target system architecture](05-system-architecture.md)
6. [Data model and database design](06-data-model-and-database-design.md)
7. [Internationalization, privacy, compliance and security](07-internationalization-compliance-security.md)
8. [Integrations and open-source reuse](08-integrations-and-open-source-reuse.md)
9. [Delivery roadmap and release strategy](09-delivery-roadmap.md)
10. [Testing, operations, observability and SLOs](10-testing-operations-and-slo.md)
11. [Risks, decisions and product guardrails](11-risks-decisions-and-guardrails.md)
12. [Research references](99-references.md)

## Design governance

- [Impeccable design governance](design/README.md)
- [Product design input brief](design/01-product-design-input.md)
- [UI delivery workflow](design/02-ui-delivery-workflow.md)
- [Agent design contract](design/03-agent-design-contract.md)

## Multi-agent execution documents

- [FND-01 foundation one-shot prompt](execution/FND-01-ONE-SHOT-PROMPT.md)
- [Execution system overview](execution/README.md)
- [Large-stream short-command catalog](execution/01-module-stream-short-commands.md)
- [Complete zero-context agent prompts](execution/02-module-stream-full-prompts.md)
- [Machine-readable agent board](execution/03-agent-board.json)
- [Progress tracker](execution/04-progress-tracker.md)
- [Module ownership and integration contracts](execution/05-module-ownership-and-integration-contracts.md)
- [Open-source clean-room and reuse policy](execution/06-open-source-clean-room-policy.md)
- [Execution artifact contract](execution/artifact-contract.md)

## Architecture Decision Records

- [ADR-001 — Cloudflare-centric hybrid architecture](adr/ADR-001-cloudflare-centric-hybrid.md)
- [ADR-002 — Modular monolith before microservices](adr/ADR-002-modular-monolith.md)
- [ADR-003 — Hybrid pooled and dedicated multi-tenancy](adr/ADR-003-multitenancy.md)
- [ADR-004 — Direct Neon Serverless PostgreSQL connectivity](adr/ADR-004-neon-serverless-direct.md)
- [ADR-005 — Whole-module agent ownership](adr/ADR-005-whole-module-agent-ownership.md)
- [ADR-006 — Impeccable design governance](adr/ADR-006-impeccable-design-governance.md)

## Core decisions already made

- **Product scope:** International K–12 SIS + School ERP; higher education is not the first release target.
- **Architecture:** Cloudflare is the edge, application, security and asynchronous platform; Neon Serverless PostgreSQL is the initial authoritative transactional database.
- **Database connectivity:** Workers connect through `@neondatabase/serverless`; Neon pooled endpoints are used for serverless concurrency. Hyperdrive is an optional benchmarked optimization, not a baseline dependency.
- **Application shape:** Domain-oriented modular monolith first, with asynchronous events and explicit module contracts.
- **Tenancy:** Shared regional database with strict tenant isolation by default; dedicated database/region is available for large or regulated customers.
- **Files:** Object storage; files are never stored as database blobs.
- **Accounting:** Immutable double-entry ledger; billing and accounting cannot be implemented as editable balance fields.
- **International design:** Country packs, locale-aware UI, configurable curricula, grading, academic calendars, currency, taxation, retention and document templates.
- **Interoperability:** OpenAPI/webhooks plus OneRoster, LTI, Ed-Fi-oriented mappings, SSO and bulk import/export.
- **Open source:** Direct source reuse requires exact license/commit review. GPL/AGPL/no-license school-platform code is reference-only for the proprietary core; permissive dependencies may be reused with notices and LGPL components require isolation/compliance review.
- **Agent execution:** One agent owns one complete large module on one branch/worktree. Internal module milestones use checkpoint commits and automatic continuation, not separate agents.
- **Design governance:** All frontend work uses the repository-local Impeccable skill. `FND-01` owns `PRODUCT.md`, `DESIGN.md`, shared tokens/components and design hooks; module agents run shape, critique, audit, harden and polish inside their whole-module stream.
- **AI:** Not part of the transactional core. Any future AI feature must be optional, auditable and prohibited from training on school data by default.

## Documentation conventions

- `P0` = required for first commercially usable platform foundation.
- `P1` = required for a broad competitive product after the foundation is stable.
- `P2` = advanced/enterprise/differentiating capability.
- “Tenant” means one contracted school organization or school group.
- “Campus” means a physical or virtual school unit inside a tenant.
- “Home region” means the region in which a tenant’s authoritative data is stored and processed.

## Important limitation

এই নথি একটি technical/product baseline; এটি কোনো দেশের legal opinion নয়। Production launch-এর আগে target country অনুযায়ী privacy, education, finance, tax, payroll, record-retention এবং child-safety counsel প্রয়োজন হবে।
