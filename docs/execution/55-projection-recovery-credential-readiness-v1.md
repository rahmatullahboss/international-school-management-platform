# Projection Recovery Credential Readiness v1

**Program:** `international-school-platform-v1`  
**Stream:** `PROD-07`  
**Status:** implementation planned; production activation is not authorized

## Objective

Add a fail-closed database-owned readiness assertion for the password-bearing login that may eventually invoke the reviewed `app_projection_recovery` capability. This does not provision, store or authorize a production credential. It only defines and verifies the exact privilege shape that an external secret-bound login must satisfy before deployment.

## Required login shape

The session login must:

- be a real PostgreSQL `LOGIN` role;
- have no superuser, database-create, role-create, replication or RLS-bypass capability;
- be a member of `app_projection_recovery`;
- not be a member of `app_runtime`, `app_production_runtime`, `app_projection_monitor`, `app_projection_admin`, `app_projection_publisher` or `app_projection_composer`;
- not inherit Neon `neon_superuser` when that role exists;
- have no application relation CRUD privilege and no application sequence privilege;
- be able to execute `platform.recover_runtime_projection_dead_letter(...)` and the readiness assertion itself;
- be unable to execute any other application SECURITY DEFINER function.

## Fail-closed contract

`platform.projection_recovery_credential_ready()` derives the login identity from `session_user`. Callers cannot supply or spoof a role name. Any unknown, expanded or drifted privilege surface returns `false`.

The readiness function is itself SECURITY DEFINER, PUBLIC execute is revoked, and only `app_projection_recovery` receives execute permission.

## Verification

The PostgreSQL rehearsal must create a temporary password-capable test login and prove:

1. the exact reviewed role shape returns `true`;
2. broad `app_runtime` membership makes readiness `false`;
3. projection-monitor membership makes readiness `false`;
4. direct protected-relation SELECT makes readiness `false`;
5. elevated role attributes such as `CREATEDB` make readiness `false`;
6. after all drift is removed, readiness returns `true` again;
7. existing dead-letter recovery rehearsal remains green.

## Activation boundary

This stream does not create a production password, `DATABASE_URL`, Cloudflare secret, schedule or operator authorization. Those remain external activation work and require deployed readiness verification, credential rotation/revocation rehearsal, monitoring/escalation ownership and explicit owner/security approval.
