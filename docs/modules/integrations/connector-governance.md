# Connector Governance, Administration and Observability

## Connector manifest

Every connector release is an immutable `<connectorKey>@<version>` manifest. It declares:

- provider and display name;
- supported regions;
- permitted data categories;
- authentication modes;
- required scopes;
- inbound events and outbound commands;
- rate and retry policy;
- maximum retained delivery/import evidence;
- subprocessor legal name, country, privacy URL and purpose.

A connector may transfer only categories and execute only scopes declared by its exact manifest version. New categories, scopes, destinations or subprocessors require a new reviewed manifest version.

The synthetic validation manifest is stored at:

`packages/modules/integrations/connectors/synthetic-lms-v1.json`

It is test-only configuration and does not represent a real provider agreement.

## Tenant approval lifecycle

A tenant connection follows this sequence:

1. An operator requests an exact connector version, purpose, scopes, categories and retention period.
2. The request is checked against the immutable manifest.
3. A different reviewer records an approval or rejection.
4. Approved requests run the connector sandbox using synthetic data only.
5. Every configuration, connectivity, inbound mapping and outbound mapping check must pass.
6. Only then may the tenant connection become active.

The requester cannot approve their own request. Requested retention cannot exceed the manifest maximum. A rejected or sandbox-failing request cannot be enabled.

## Sandbox contract

The sandbox adapter receives synthetic configuration and payloads. It verifies:

- configuration shape;
- provider reachability and latency;
- inbound transformation;
- outbound transformation;
- requested data-category subset.

Sandbox evidence records booleans, execution time, latency and mapped field names without retaining reusable credentials or production records. A sandbox pass proves adapter wiring for the tested profile; it does not prove production provider availability or legal approval.

## Administration feature

`@school/web-admin` exports the integration administration feature from:

`apps/web-admin/src/features/integrations/integration-admin.tsx`

The feature displays:

- exact active and available country-pack versions;
- locale, time zone and upgrade-change count;
- connector lifecycle, independent approval and sandbox status;
- health text and alert count;
- approved scopes and data categories;
- subprocessor name, country and privacy URL;
- credential reference only, never the reusable value;
- connection test, dead-letter replay and credential-rotation actions.

The component supports left-to-right and right-to-left direction, semantic headings/regions/tables, status text independent of colour and keyboard-focusable actions. Shared navigation and persona composition remain the responsibility of the later experience stream.

## Observability

The module records bounded counters for each tenant connection:

- delivery attempts, delivered, failed and dead-letter counts;
- total delivery latency and calculated average;
- import runs, rows, failed rows and duration.

Current actionable alert contracts are:

- any dead-letter delivery: critical;
- combined failed/dead-letter delivery rate at or above 20%: warning;
- import row failure rate at or above 1%: warning.

These thresholds are initial operational defaults and may become tenant/provider policy. Metrics are tenant-partitioned and must not contain full transferred payloads.

## Privacy and subprocessor governance

Before enablement, the reviewer must confirm:

- the destination and purpose are documented;
- approved categories are the minimum required;
- retention is bounded;
- subprocessor identity, processing country and privacy URL are current;
- contractual transfer and local legal reviews are recorded outside the software where required;
- disclosure-audit evidence is enabled;
- deletion, disablement and reconciliation behaviour are defined.

The product stores evidence supporting a governance decision. It does not declare a provider or tenant legally compliant.

## Persistence

`202607280107_INT-01_connector_governance` creates:

- immutable connector manifests;
- subprocessor metadata;
- tenant approval records with independent reviewer fields;
- synthetic-only sandbox evidence;
- per-connection metric buckets;
- actionable alert records.

Tenant-owned tables use forced row-level security through `app.tenant_id`. Published manifest records are append-only by version.
