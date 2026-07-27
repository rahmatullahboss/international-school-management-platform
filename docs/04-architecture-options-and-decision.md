# 04 — Architecture Options and Final Decision

## 1. Decision statement

Use a **Cloudflare-centric hybrid architecture**:

- Cloudflare for global edge delivery, application runtime, security, caching, files, asynchronous processing and selected coordination.
- Regional managed PostgreSQL for authoritative student, academic, finance, identity and audit transactions.
- A tenant is assigned to one home region. Cross-region access is routed to that region; synchronous multi-primary writes are avoided.

This is preferred over both a completely Cloudflare-native D1 architecture and a conventional single-region cloud architecture.

## 2. Evaluation criteria

The architecture was evaluated against:

- Transaction correctness and relational integrity
- Tenant isolation and data residency
- International latency
- Burst performance during attendance/payment/report-card periods
- Complex finance and academic reporting
- Operational complexity for a small product team
- Cost predictability and scale-to-zero behavior
- Vendor portability
- Backup, restore and auditability
- Integration ecosystem
- Ability to offer dedicated enterprise deployments

## 3. Option A — Fully Cloudflare-native with D1 as core database

### Shape

- Workers application/API
- D1 database per tenant or tenant shard
- R2 files
- KV configuration/cache
- Queues and Workflows
- Durable Objects for coordination

### Advantages

- Very simple global deployment surface
- Strong edge integration and low operational overhead
- D1 scale-to-zero pricing and managed backups/time travel
- Natural database-per-tenant isolation for smaller customers
- Good fit for lightweight, read-heavy applications

### Limitations

- A paid D1 database is currently capped at 10 GB.
- Each individual D1 database processes queries on a single thread.
- Database-per-tenant complicates cross-tenant administration, migrations, school-group analytics and schema rollout at large tenant counts.
- SQLite semantics and tooling are less suitable than PostgreSQL for a finance-heavy, analytics-heavy international ERP.
- Large imports, morning attendance bursts, report generation and high-volume audit/event history may contend on a tenant database.
- Global read replication is useful, but applications must use the Sessions API correctly for sequential consistency and read-your-writes behavior.

### Suitable use

- Starter edition for very small schools with strict product limits
- Edge read models, temporary sync state or isolated lightweight modules
- Local development/test datasets

### Decision

**Not selected as the default authoritative database.** Avoid maintaining two authoritative transactional architectures unless a clear commercial need justifies a D1-based starter tier.

## 4. Option B — Cloudflare edge/application + regional Neon PostgreSQL

### Shape

- Workers/Static Assets for web application and APIs
- Tenant routing to home region
- Neon project/primary branch per supported residency region or deployment profile
- Direct `@neondatabase/serverless` connectivity from Workers
- Neon pooled endpoints for serverless burst concurrency
- R2 or jurisdiction-compatible object storage
- KV, Queues, Workflows and selected Durable Objects
- Separate analytical store/lake

### Advantages

- Mature relational database, constraints, transactions and ecosystem
- Strong fit for double-entry accounting, enrollment history and complex reporting
- Row-level security adds tenant-isolation defense in depth
- Declarative partitioning and read replicas support growth
- Standard PostgreSQL migration, backup, BI and data-integration tooling
- Cloudflare still provides global performance and managed edge services
- Easier enterprise dedicated-database option
- Better path for regional residency and large tenants

### Limitations

- More infrastructure than D1-only
- Database region affects write latency for globally distributed users
- HTTP versus WebSocket transaction paths, pooled endpoints, autoscaling and cold-start behavior must be tested
- Managed PostgreSQL provider, backups and region coverage become important dependencies
- R2 currently has limited jurisdiction-specific storage guarantees; exact-country requirements may need another regional object store

### Decision

**Selected.** It provides the best balance of correctness, global reach and operational manageability.

## 5. Option C — Conventional cloud application and PostgreSQL

### Shape

- Application hosted in AWS/Azure/GCP or a regional PaaS
- Managed PostgreSQL in the same cloud/region
- CDN/WAF at the perimeter
- Native cloud queues, object storage and workflows

### Advantages

- Strong regional product coverage and enterprise procurement familiarity
- Excellent exact-country and regulated-environment options in major clouds
- Mature observability, networking, data and compliance services
- Easy alignment with a customer demanding a specific cloud

### Limitations

- More platform/DevOps complexity for a small team
- Global application delivery and security require more assembly
- Potentially higher idle cost and operational burden
- Multi-cloud portability becomes difficult if native services spread into domain code

### Suitable use

- Dedicated enterprise deployment when contract, sovereignty or procurement requires it
- Countries where the selected Cloudflare/PostgreSQL combination cannot satisfy residency or connectivity needs

### Decision

**Supported later as a deployment profile, not the primary shared SaaS architecture.**

## 6. Weighted decision matrix

Scores are 1 (weak) to 5 (strong). Weights reflect this product’s requirements.

| Criterion | Weight | D1-native | Cloudflare + PostgreSQL | Conventional cloud |
|---|---:|---:|---:|---:|
| Transactional/financial correctness | 20 | 3 | 5 | 5 |
| Large-tenant scalability | 15 | 2 | 5 | 5 |
| Global user experience | 10 | 5 | 4 | 3 |
| Data residency flexibility | 15 | 3 | 5 | 5 |
| Reporting/data ecosystem | 10 | 2 | 5 | 5 |
| Small-team operations | 10 | 5 | 4 | 2 |
| Tenant isolation options | 10 | 5 | 5 | 5 |
| Portability/open ecosystem | 5 | 3 | 5 | 4 |
| Cost efficiency at early stage | 5 | 5 | 4 | 2 |
| **Weighted total / 5** | **100** | **3.35** | **4.75** | **4.35** |

The score is a planning aid, not a vendor benchmark. It makes the trade-off explicit: D1-native wins simplicity; conventional cloud wins provider breadth; the hybrid wins the overall product fit.

## 7. Neon Serverless PostgreSQL baseline

Neon is selected as the initial PostgreSQL provider. The application uses standard PostgreSQL schema and migrations plus a database adapter so provider portability remains possible. Validate Neon by region using:

- Required regions and data-processing terms
- Point-in-time recovery and restore-window retention
- Read replicas, autoscaling and failover behavior
- `@neondatabase/serverless` HTTP and WebSocket behavior in Workers
- Neon pooled endpoint behavior under attendance/payment bursts
- Scale-to-zero cold-start impact and production suspend policy
- Database branching for development, pull-request previews and migration tests
- Private networking and IP controls where needed
- Encryption/key-management options
- Logical replication/change-data-capture support
- Maintenance windows and upgrade control
- Observability and slow-query tooling
- Restore/export portability
- Contractual SLA and support
- Cost under steady workload, not only free-tier attractiveness

The foundation proof of concept must benchmark direct HTTP queries, interactive WebSocket transactions and the pooled Neon endpoint. A second standard PostgreSQL provider is retained only as an exit/region comparison, not as a parallel production architecture.

## 8. Cloudflare service allocation

| Service | Recommended use | Do not use as |
|---|---|---|
| Workers | API gateway, application runtime, BFF, webhooks | Unbounded batch processor |
| Static Assets/Pages-compatible delivery | Frontend assets | Source of tenant data |
| Neon serverless driver | Direct one-shot HTTP queries and request-scoped WebSocket transactions | A global mutable connection or authorization boundary |
| Neon pooled endpoint | Serverless connection pooling and burst concurrency | A substitute for bounded queries, transactions or capacity tests |
| Hyperdrive | Optional benchmark-only optimization if measured latency/cost warrants it | A required baseline dependency or correctness mechanism |
| R2 | Documents, images, generated reports and data exports where jurisdiction permits | Relational database or authorization store |
| KV | Localization bundles, non-sensitive feature/config cache, public metadata | Authoritative permissions, balances or attendance |
| Queues | Notifications, imports, exports, webhooks and event processing | Exactly-once delivery mechanism |
| Workflows | Long-running admissions, rollover, reminders and approval processes | High-frequency synchronous request path |
| Durable Objects | Per-entity coordination, websocket rooms, locks and sequence allocation | General relational database |
| D1 | Optional lightweight read models or small isolated workloads | Default core SIS/ERP database |
| Turnstile/WAF | Abuse and bot mitigation | Replacement for authentication/authorization |
| Analytics Engine/logging | Operational metrics | Storage for raw sensitive student data |

## 9. Data residency decision

- Every tenant has a `home_region` established at provisioning.
- Authoritative PostgreSQL data, backups and normal administrative access stay in that region.
- Files use a storage provider with matching contractual jurisdiction guarantees.
- Cloudflare edge code may receive requests globally, but sensitive persistence is routed home.
- Exact-country storage is offered only where all databases, files, backups, logs and support systems can meet it.
- Cross-region analytics uses de-identified or contractually approved data and asynchronous replication.
- A move between regions is a controlled migration with maintenance, reconciliation and audit—not a configuration toggle.

## 10. Architecture guardrails

- No cache is authoritative.
- No cross-region synchronous distributed transaction.
- No finance operation without an idempotency key and immutable posting result.
- No queue consumer that assumes a message is delivered exactly once.
- No country-specific behavior embedded directly throughout domain code.
- No microservice extraction without measured scaling, isolation or team-ownership need.
- No sensitive data in logs, analytics events or error messages.
- No provider-specific API inside core domain modules; use infrastructure adapters.

## 11. Revisit triggers

Re-evaluate this decision when:

- A customer requires a country not covered by the selected regional stack.
- One regional PostgreSQL cluster approaches capacity or noisy-neighbor limits.
- A module has independently measurable scaling or availability requirements.
- A D1 starter tier has a validated commercial case and can be kept functionally bounded.
- Cloudflare introduces materially different database/jurisdiction capabilities.
- Enterprise contracts require customer-hosted or dedicated-cloud deployment.

## 12. Research basis

See [99-references.md](99-references.md), references `C01–C13`, `N01–N08` and `D01–D04`.
