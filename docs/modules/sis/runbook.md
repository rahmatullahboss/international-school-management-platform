# SIS-01 Operations Runbook

## Scope

This runbook covers the `people`, `admissions`, and `student_lifecycle` bounded contexts delivered by SIS-01. It applies to people and household management, guardian authority, admissions, profiles, enrollment lifecycle, imports, data-quality queues, exports, reports, and reconciliation.

## Deployment prerequisites

1. Deploy only from a reviewed commit descended from foundation SHA `55114f55a375d3d79dba7ea21f984b789b5dbca1`.
2. Confirm foundation migrations `202607280001` through `202607280005` are present in `platform.schema_migration`.
3. Confirm the runtime role is `app_runtime` and does not have `BYPASSRLS`.
4. Apply migrations in this exact order:
   - `202607280101_SIS-01_people.sql`
   - `202607280102_SIS-01_profiles.sql`
   - `202607280103_SIS-01_admissions.sql`
   - `202607280104_SIS-01_enrollment.sql`
   - `202607280105_SIS-01_operations.sql`
   - `202607280106_SIS-01_contract_signer.sql`
5. Run migrations with `ON_ERROR_STOP` or an equivalent transactional failure policy.
6. Do not load production data into preview or development branches. Use synthetic tenant-scoped records only.

## Required post-deployment checks

Run the following checks before allowing application traffic:

- all six SIS migration IDs exist exactly once;
- schemas `people`, `admissions`, and `student_lifecycle` exist;
- all SIS base tables have both `relrowsecurity` and `relforcerowsecurity` enabled;
- no rows are visible to `app_runtime` before `app.tenant_id` is set;
- after setting Tenant A context, no Tenant B rows are visible;
- submitted application responses reject update and delete operations;
- enrollment placement identity fields reject direct rewrite;
- report snapshots reject update and delete operations.

A request transaction must set tenant context before reading or writing tenant-owned records:

```sql
SELECT set_config('app.tenant_id', :tenant_id, true);
SET LOCAL ROLE app_runtime;
```

Never trust a tenant identifier from a route, form, or request body without matching it to the authenticated membership and resolved tenant context.

## People and guardian operations

### Duplicate review and merge

1. Open the duplicate-candidate queue.
2. Compare normalized name, date of birth, identifiers, contact points, source mappings, households, guardian authority, and active profiles.
3. Select one surviving person record.
4. Record a non-empty reviewed reason and accountable actor.
5. Execute the merge once.
6. Confirm the absorbed person is marked `merged`, retains `merged_into_person_id`, and has an immutable merge record.
7. Confirm guardian references and source mappings reconcile to the survivor.

Do not delete either person record and do not merge automatically from a score alone.

### Guardian portal access

Portal access requires all of the following:

- the account is linked to the guardian person in the current tenant;
- guardian authority is verified;
- `portal_access` is enabled;
- the requested date falls inside the effective period;
- no separate restriction or revocation blocks the requested operation.

When an authority expires or is revoked, preserve historical visibility according to policy but remove active authorization immediately.

## Admissions operations

### Submitted application correction

Submitted responses are immutable. To correct an answer:

1. create a new response version;
2. reference the superseded response version;
3. validate and submit the new version;
4. retain both versions for audit and historical reporting.

Never update a submitted response in place.

### Offer acceptance and conversion

Before accepting an offer, verify:

- the decision is `admit`;
- the offer is issued and unexpired;
- every required checklist item is verified or waived;
- an enrollment contract is signed when a contract exists;
- the external deposit reference is in the required state when tenant policy requires it.

Applicant conversion must use a tenant-scoped idempotency key. One application can create at most one conversion, student profile reference, and initial enrollment reference. A retry must return the original conversion result.

If conversion is interrupted, run reconciliation before retrying. Do not manually create a second profile or enrollment.

## Enrollment lifecycle operations

### Transfer

1. Verify the source enrollment is active.
2. Use an idempotency key for the transfer command.
3. Close the source enrollment on the transfer date.
4. Append `transferred` status history.
5. Create a separate destination enrollment and placement record.
6. Confirm source and destination appear in chronological enrollment history.

Never rewrite campus, programme, academic year, grade, student, or start date on an existing enrollment.

### Withdrawal

1. Verify the enrollment is pending, active, or on leave.
2. Record withdrawal date, reason code, and optional destination school/country.
3. Close the enrollment and append withdrawal history.
4. Apply status-driven access effects and stop future operational expectations.
5. Retain historical family access according to policy.

### Promotion and re-enrollment

Promotion closes the prior academic-year enrollment and creates the next enrollment. Re-enrollment references a closed prior enrollment. Neither operation overwrites historical placement.

### Alumni transition

Transition to alumni only after the final enrollment is completed or withdrawn. Preserve the final enrollment reference and explicitly set alumni access enabled or disabled.

## Import operations

1. Upload the source document through the shared document service.
2. Create a tenant-scoped import batch with an idempotency key.
3. Map source columns to approved target fields.
4. Run validation or dry-run first.
5. Review duplicate source keys, missing required fields, invalid transforms, orphan references, and duplicate identity candidates.
6. Apply only valid rows.
7. Preserve row checksum, errors, result reference, and applied state.
8. Re-running the same tenant/entity/source-key/checksum must return the prior result.
9. Resolve or dismiss data-quality issues with an accountable actor and reason.

Do not silently drop invalid rows and do not bypass duplicate-person review.

## Export and reporting operations

Every export requires:

- an explicit business purpose;
- an allowed field list;
- tenant and authorization scope;
- record count and filter audit;
- separate authorization before including restricted documents.

Generate reports as immutable snapshots. Store the report key, parameters, data, generation time, and accountable actor. Re-run a report to create a new snapshot; never mutate an existing snapshot.

Recommended scheduled reconciliation checks:

- converted application missing profile;
- converted application missing enrollment;
- active profile missing enrollment;
- enrollment missing profile;
- student missing guardian authority;
- unverified authority with portal access.

## Incident response

### Suspected cross-tenant visibility

1. Disable the affected endpoint or feature flag.
2. Preserve request correlation IDs and audit records.
3. Confirm `app.tenant_id`, runtime role, and membership resolution.
4. Run RLS probes with two synthetic tenants.
5. Review policy definitions and grants on every affected table.
6. Do not restore traffic until no-context and cross-tenant probes return zero forbidden rows.

### Duplicate conversion or enrollment concern

1. Stop retries for the affected idempotency key.
2. Query conversion, idempotency, profile, enrollment, outbox, and audit records by correlation ID.
3. Run SIS reconciliation.
4. Preserve both records until a reviewed repair plan is approved.
5. Use merge or lifecycle correction workflows; do not delete historical records.

### Import failure

1. Keep the batch and row records.
2. Mark the batch `failed` or `completed-with-errors`.
3. Correct mappings or source data in a new batch unless an unapplied staged batch is still safely amendable.
4. Reuse prior applied results through checksum replay.

## Rollback policy

SIS migrations are forward-only. Do not run destructive down migrations on a shared environment. For a failed preview deployment, discard the isolated Neon branch only after evidence is preserved and the user authorizes cleanup. For production, deploy a reviewed forward repair migration.
