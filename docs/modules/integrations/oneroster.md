# OneRoster 1.2 Supported Profile

## Conformance statement

The current implementation is an explicitly documented **supported subset** of the OneRoster 1.2 CSV exchange model. It does not claim full OneRoster certification or support for every object, field, manifest rule or service endpoint.

The source-controlled profile is:

`packages/modules/integrations/profiles/oneroster-1.2-csv.json`

## Supported CSV objects

The initial full-profile archive requires these files in deterministic dependency order:

1. `orgs.csv`
2. `academicSessions.csv`
3. `courses.csv`
4. `classes.csv`
5. `users.csv`
6. `enrollments.csv`

The current profile intentionally excludes demographics, line items, results, categories, resources and certification packaging. Those objects require separate mappings, authorisation rules and contract tests before being added.

## Validation

Validation covers:

- required files for a full exchange;
- required headers for every supported object;
- unique `sourcedId` values within each file;
- accepted status values (`active` and `tobedeleted`);
- organisation, school, academic-session, course, class and user references;
- bounded secure CSV parsing inherited from the import/export foundation.

A delta exchange may contain only changed object files, but every provided file still requires `status` and `dateLastModified` so deletion and idempotency semantics remain explicit.

## Domain-command mapping

Validated records become idempotent integration commands rather than direct writes to SIS or academic tables. The command key is:

```text
oneroster:1.2:<object_type>:<sourcedId>:<dateLastModified>
```

`active` records map to upsert commands and `tobedeleted` records map to delete/disable commands. The receiving domain remains responsible for deciding whether deletion means tombstone, disablement or historical retention.

External identifiers remain connection-scoped. OneRoster `sourcedId` values are not substituted for internal primary keys or human-facing student numbers.

## Export

Exports use the exact supported header order and the secure CSV encoder. Only explicitly supplied object collections are emitted. Formula-like spreadsheet values are neutralised by the shared export foundation.

A full export must be reconciled by object count and relationship count before delivery. Delta exports require a persisted cursor/change boundary owned by the source domain or its read model.

## REST extension path

The REST extension contract is reserved under:

```text
/api/v1/standards/oneroster/1.2
```

Collection paths use cursor pagination with a maximum page size of 500. The current status is **contract-only**: routes, scopes, canonical mappings, error semantics and conformance tests must be implemented before advertising REST support.

The REST adapter will translate between the stable OneRoster representation and purpose-built domain APIs/read models. The internal database will not copy the OneRoster schema as its authoritative model.

## Database migration

`202607280105_INT-01_oneroster_profile` stores:

- immutable versioned standard-profile documents;
- tenant exchange metadata, source checksum, object counts and lifecycle;
- row/file/reference validation issues.

Tenant exchange evidence uses forced row-level security. Globally published profile documents are read-only for the runtime role.

## Security and privacy

- User exports must minimise claims to the configured purpose and connector scopes.
- Password fields are part of the declared CSV header profile but must not be exported or imported as reusable plaintext credentials by this platform.
- Validation issue records may contain identifiers and must follow tenant retention and disclosure controls.
- Exchange delivery requires the integration runtime's credential, health, retry and disclosure-audit controls.
