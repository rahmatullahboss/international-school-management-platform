# PILOT-01 — Runtime portal composition and staging acceptance

## Purpose

Convert the integrated module packages into a browser-runnable pilot application that can be inspected on Cloudflare staging without production data or production mutation authority.

## Reviewed base

- Repository: `rahmatullahboss/international-school-management-platform`
- Base branch: `main`
- Starting merge: `41639fab433491df0395d02217a70c6eb2ddb775`
- Working branch: `pilot/runtime-portal-composition`
- Deployment target: existing non-production Cloudflare Workers staging services

## Scope

PILOT-01 owns integration-only runtime composition across already reviewed module packages. It does not change module-owned database schemas, finance invariants, restricted-data rules or domain contracts.

The workstream includes:

- a pilot role chooser;
- admin, teacher, guardian and student runtime shells;
- deep-link routing through the Cloudflare SPA fallback;
- capability-scoped navigation;
- existing EXP-01 overview components mounted into the composition root;
- synthetic pilot read models for all module route groups;
- browser acceptance coverage;
- Cloudflare live route smoke tests;
- deployment, execution and progress documentation.

## Implemented checkpoint

The first composition checkpoint includes:

- `/` role chooser and module coverage;
- `/admin` administration readiness workspace;
- `/teacher` daily teaching workspace;
- `/family` household workspace;
- `/student` student daily workspace;
- route surfaces for SIS, academics, finance, operations, student support, communications, reports, integrations, classes, attendance, gradebook, resources, messages, forms, documents and requests;
- synthetic, non-sensitive staging records;
- explicit production-mutation disabled notice;
- responsive role and module surfaces;
- browser tests for role selection, role scoping and representative module routes;
- Cloudflare smoke tests for every role route.

## Security and data boundary

- The role chooser simulates pilot identities; it is not production authentication.
- No production Neon credential or production customer data is used.
- Sensitive student-support details remain represented only by non-disclosing synthetic summaries.
- Payment, publication, restricted-data mutation, final approval and destructive actions remain disabled.
- Existing tenant isolation, capability filtering and domain invariants remain authoritative.

## Verification gates

`GATE-PILOT-RUNTIME-COMPOSED` requires:

1. format, lint, architecture boundary and typecheck pass;
2. all repository tests pass;
3. fresh canonical migration replay and live Neon driver pass;
4. production builds and PWA budget pass;
5. all existing browser journeys plus PILOT-01 journeys pass;
6. execution-artifact validation passes;
7. Cloudflare deploy succeeds for API and web Workers;
8. live role chooser, admin, teacher, guardian, student, manifest, offline page and API health smoke tests pass.

## Remaining milestones after this checkpoint

1. replace synthetic read models with permission-aware Worker API endpoints;
2. implement reviewed OAuth/OIDC login, logout, session renewal and role/tenant context;
3. add approved staging tenant seed and reset tooling;
4. connect safe pilot mutations, beginning with low-risk forms and attendance drafts;
5. add end-to-end permission-negative tests against live staging APIs;
6. add monitoring, alerting, backup evidence and rollback rehearsal;
7. complete owner-led user acceptance before production-domain consideration.

## Production boundary

PILOT-01 does not authorize a production domain, production database access or production mutation. Production promotion remains a separate owner-authorized release gate.
