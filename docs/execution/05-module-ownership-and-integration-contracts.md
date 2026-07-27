# Module Ownership and Integration Contracts

## 1. Ownership principle

A stream may create and modify only the paths assigned in `03-agent-board.json`, plus its own module documentation and tests. Ownership includes schema, domain, API and module-specific UI. It does not grant permission to rewrite shared platform contracts.

## 2. Foundation-owned shared paths

`FND-01` owns and freezes:

- root package/workspace configuration;
- CI, lint, typecheck, test and build configuration;
- `packages/database` adapter, migration runner and common database test kit;
- `packages/policy` authorization interface and test kit;
- `packages/events` event envelope/outbox/idempotency primitives;
- tenant/region context and module registration;
- shared localization/country-pack registration interfaces;
- shared object/document, notification and workflow interfaces;
- common error, observability and correlation contracts;
- shared design tokens/components and application shells;
- architecture boundary rules.

After `GATE-FOUNDATION-READY`, module agents may consume and add compatible extensions but may not make breaking changes.

## 3. Module-owned database objects

Each module owns a logical PostgreSQL schema or explicit table namespace and its migration directory. Recommended ownership:

| Stream | Logical schemas/namespaces |
|---|---|
| `FND-01` | `platform`, `tenancy`, `iam`, `audit`, `workflow`, `integration_core` |
| `SIS-01` | `people`, `admissions`, `student_lifecycle` |
| `FIN-01` | `billing`, `ledger` |
| `INT-01` | `country_pack`, `integration`, `migration_studio` |
| `ACAD-01` | `academics`, `scheduling`, `attendance`, `gradebook`, `records` |
| `OPS-01` | `hr`, `procurement`, `inventory`, `library`, `transport`, `hostel`, `cafeteria`, `activities` |
| `CARE-01` | `health`, `behavior`, `wellbeing`, `safeguarding`, `learning_support` |
| `EXP-01` | `communications`, `reporting`, `experience_documents`; other domains remain read through APIs/read models |

A module cannot update another module’s owned tables directly. Cross-module actions use application commands, stable references or events.

## 4. Reference rules

- A module may store another module’s opaque ID and declared snapshot fields only when the contract permits it.
- It cannot depend on another module’s internal status values, columns or table joins.
- Cross-module foreign keys are used only when ownership and deletion/history behavior are stable and explicitly approved.
- Reporting projections may combine events/read contracts but cannot become a second authoritative source.
- No agent may create an ungoverned shared `common` domain package.

## 5. Contract-change request

When a module cannot proceed without changing a frozen shared contract, the agent must create:

`docs/execution/contract-change-requests/<stream-id>-<short-name>.md`

The request contains:

- requesting stream and checkpoint SHA;
- exact current contract;
- required compatible/breaking change;
- business reason and alternatives considered;
- affected streams, migrations and events;
- security/privacy/finance impact;
- rollout and backward-compatibility plan;
- tests required;
- owner/integrator decision.

The stream stops at that boundary unless it can safely continue independent milestones without speculative code. It must not silently patch the foundation package.

## 6. Event contracts

Every event declares:

- stable event name and version;
- tenant, region, event ID, aggregate ID/version, occurred time and correlation/causation IDs;
- minimum payload and data classification;
- producer ownership;
- allowed consumers and purpose;
- ordering/deduplication assumptions;
- retention and replay behavior.

Events are additive within a version. Breaking payload changes require a new event version and coexistence period.

## 7. API contracts

- Public and cross-module APIs are versioned and documented.
- Commands are idempotent where clients/providers can retry.
- Queries are tenant- and permission-scoped and bounded.
- Errors use stable codes without sensitive details.
- Module-specific UI consumes APIs/application services, not direct database clients.
- Integration APIs must have scope, rate, disclosure and deprecation policy.

## 8. Migration contracts for parallel streams

- Every module keeps migrations in its owned directory.
- Migration IDs include sortable timestamp, stream ID and descriptive name.
- Module migrations cannot alter another module’s tables.
- The integration stream builds the canonical migration manifest in dependency order.
- Every wave is tested from an empty database and the previous reviewed integration checkpoint.
- Data backfills are bounded, resumable, idempotent and independently observable.
- A destructive contract/drop occurs only after expand/migrate/contract evidence and a later reviewed release.

## 9. Neon branch contract

- Each stream creates a Neon branch from the exact database point corresponding to its Git base SHA.
- Branch names must match `03-agent-board.json`.
- The stream records Neon project, parent branch/LSN or restore point where available, creation time and schema version.
- Agent branches use synthetic data.
- Schema drift from unrelated branches is prohibited.
- Before integration, the module’s migrations are replayed on a fresh branch from the integration parent; passing only on the long-lived agent branch is insufficient.

## 10. UI ownership

Module agents own feature components under their declared feature path. `EXP-01` owns application composition, persona navigation and cross-module journeys but cannot rewrite domain rules inside UI code.

When `EXP-01` needs a new domain capability, it requests an API/read-model extension rather than reading module tables or reproducing business rules.

## 11. Integration conflict policy

`INTEG-01` may resolve:

- mechanical imports/exports;
- migration manifest ordering;
- generated contract snapshots;
- cross-module test wiring;
- configuration composition;
- documentation links.

It must not independently redesign a module’s financial, academic, authorization or historical invariant. Semantic conflicts return to the owning stream or require an approved contract-change decision.

## 12. Shared-file policy

Files commonly causing conflicts—root configuration, generated API catalogs, navigation registry, migration manifest, shared translations and package exports—must use append-only registration or generated composition where possible. Module agents write module-local manifests; `INTEG-01` composes the canonical output.

## 13. Module definition of done

A module completion report is valid only when:

- all ordered milestones are checkpointed;
- worktree is clean;
- owned migrations replay from the correct base;
- unit, integration, authorization/tenant, browser and applicable performance tests pass;
- module contracts and events are versioned;
- audit/import/export/reporting/runbook behavior exists;
- no unresolved unapproved contract change remains;
- exact final SHA and Neon branch evidence are recorded.
