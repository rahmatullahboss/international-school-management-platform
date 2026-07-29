# PILOT-01 — Runtime Portal Composition and Staging Acceptance

## Purpose

Convert the integrated module packages into a browser-runnable pilot application that can be inspected on Cloudflare staging without production data or production mutation authority.

## Reviewed base and candidate

- Repository: `rahmatullahboss/international-school-management-platform`
- Starting main merge: `41639fab433491df0395d02217a70c6eb2ddb775`
- Working branch: `pilot/runtime-portal-composition`
- Verified implementation candidate: `a50ad782489137f5afd806e30c7a3e249b5074ec`
- Deployment target: non-production Cloudflare Workers staging services

## Completed scope

PILOT-01 owns integration-only runtime composition across already reviewed module packages. It does not change module-owned database schemas, finance invariants, restricted-data rules or domain contracts.

The completed checkpoint includes:

- `/` role chooser, module coverage and accessible skip navigation;
- `/admin` administration readiness workspace;
- `/teacher` daily teaching workspace;
- `/family` household workspace;
- `/student` student daily workspace;
- route surfaces for SIS, academics, finance, operations, student support, communications, reports, integrations, classes, attendance, gradebook, resources, messages, forms, documents and requests;
- existing EXP-01 overview components mounted into role-specific lazy bundles;
- synthetic, non-sensitive staging records;
- capability-scoped navigation and role isolation;
- explicit production-mutation disabled notice;
- responsive pilot UI;
- browser tests for role selection, role scoping and representative module routes;
- Cloudflare smoke tests for every role route.

## Gate evidence

`GATE-PILOT-RUNTIME-COMPOSED` passed on candidate `a50ad782489137f5afd806e30c7a3e249b5074ec`.

### Root verification

Root CI run `30484622352` passed all 21 gates:

- clean installation, format, lint, architecture boundaries and typecheck;
- all repository tests;
- fresh 40-migration PostgreSQL replay;
- live Neon serverless driver;
- production Worker and Vite builds;
- initial and total route asset budgets;
- dependency audit, licence policy and provenance drift;
- all existing and PILOT-01 Chromium journeys;
- execution-artifact validation.

### Performance evidence

| Measure | Actual | Limit | Result |
|---|---:|---:|---|
| Initial JavaScript | 203,338 bytes | 250,000 bytes | passed |
| Initial CSS | 8,475 bytes | 50,000 bytes | passed |
| Total route JavaScript | 283,316 bytes | 350,000 bytes | passed |
| Total route CSS | 60,355 bytes | 85,000 bytes | passed |

### Cloudflare evidence

Cloudflare run `30484622364` passed credentials, clean install, canonical verification, API deployment, web deployment, live route smoke tests and URL publication.

- API Worker version: `360f923e-1518-4d1d-9540-3f02c4939216`
- Web Worker version: `11539129-464f-4f80-8fc1-8254f4c9e1be`
- Role chooser: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/`
- Admin: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/admin`
- Teacher: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/teacher`
- Guardian: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/family`
- Student: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/student`
- API health: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/health`

## Security and data boundary

- The role chooser simulates pilot identities; it is not production authentication.
- No production Neon credential or production customer data is used.
- Sensitive student-support details use non-disclosing synthetic summaries.
- Payment, publication, restricted-data mutation, final approval and destructive actions remain disabled.
- Existing tenant isolation, capability filtering and domain invariants remain authoritative.

## Remaining milestones

1. replace synthetic read models with permission-aware Worker API endpoints;
2. implement reviewed OAuth/OIDC login, logout, session renewal and role/tenant/campus context;
3. add approved staging tenant seed and reset tooling;
4. connect safe pilot mutations, beginning with low-risk forms and attendance drafts;
5. add end-to-end permission-negative tests against live staging APIs;
6. add monitoring, alerting, backup evidence and rollback rehearsal;
7. complete owner-led user acceptance before production-domain consideration.

## Production boundary

PILOT-01 does not authorize a production domain, production database access or production mutation. Production promotion remains a separate owner-authorized release gate.
