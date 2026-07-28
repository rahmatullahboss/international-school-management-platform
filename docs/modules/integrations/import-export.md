# Secure Import and Export Foundation

## Supported tabular inputs

The import foundation accepts UTF-8 CSV directly and XLSX through a decoder port. This separates security and workflow policy from the selected OOXML parsing library so a deployment can use a reviewed adapter without coupling domain imports to a third-party workbook model.

CSV handling supports quoted fields, escaped quotes and LF/CRLF input while enforcing configurable byte, row and column limits. XLSX input must have the ZIP signature used by OOXML, remain within byte/sheet/row/column limits and contain no hidden sheets. Macro-enabled formats and arbitrary embedded content are outside this profile.

## Mapping and staging

Mappings are immutable, versioned definitions containing:

- source column;
- target command field;
- required status;
- bounded transforms such as trim, case conversion, boolean and integer parsing.

A staged job records the exact mapping key/version, tenant, object type, file name, source checksum, mode and every physical row number. Header duplication and missing configured columns fail the file-level validation. Row-level transformation and required-field failures remain attached to the affected row so valid and invalid data are explainable separately.

## Dry run and commit mode

A dry run parses, maps and validates but never executes a domain command. A commit-mode job remains staged until explicit execution. Valid rows execute through an injected application/domain command port using the deterministic idempotency key:

```text
<job_id>:<physical_row_number>
```

The import engine does not write another module's tables. Domain validation failures become row evidence and do not erase successful rows. Re-executing a completed job returns the stored result and does not issue commands again.

## Reconciliation

Every job records:

- input row count;
- valid and invalid row counts;
- succeeded and failed row counts;
- source SHA-256 checksum.

The reconciliation summary is evidence about import execution, not a replacement for domain-specific reconciliation such as student/enrolment counts, finance balances or historical records. Migration studio and standard-specific adapters extend the same contract with their own expected counts.

## Safe exports

CSV and workbook-model exports require an explicit ordered column list and maximum row count. Spreadsheet formula prefixes (`=`, `+`, `-`, `@` and tab) are neutralised before CSV output, and quotes/newlines are encoded. Complex values are deterministically serialised rather than converted to implementation-dependent strings.

The workbook export returns a bounded, visible-sheet tabular model. A reviewed XLSX encoder may serialise that model; the domain query that supplies export rows remains tenant- and permission-scoped.

## Database migration

`202607280103_INT-01_import_export` adds tenant-scoped tables for:

- versioned mapping definitions;
- import job metadata and reconciliation;
- staged row payloads, errors, idempotency keys and domain result references;
- export job metadata and output checksums.

Forced row-level security is applied through `app.tenant_id`. A source checksum/mapping/version/mode uniqueness constraint prevents accidental duplicate job creation, and row-level idempotency keys are unique per tenant.

## Security boundaries

- Imported files are untrusted data and must be malware-scanned before reaching the decoder where deployment policy requires it.
- The decoder must not evaluate formulas, external links, macros or embedded scripts.
- Original source records and row errors require retention limits because they may contain personal data.
- Export queries require explicit scopes and disclosure-audit evidence.
- File limits are enforced before expensive processing to reduce memory and denial-of-service risk.
