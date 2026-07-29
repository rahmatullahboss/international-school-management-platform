# Cloudflare staging deployment

## Purpose

Deploy a non-production pilot surface to Cloudflare Workers so the integrated platform can be opened in a browser and acceptance-tested without touching production resources.

## Staging services

- `international-school-platform-web-staging`: Vite SPA served through Workers Static Assets with SPA fallback.
- `international-school-platform-api-staging`: Hono API Worker with observability enabled and `/health` verification.

Both services use their generated `*.workers.dev` addresses. Custom domains, production routes and production data are intentionally out of scope.

## Pilot routes

The staging web Worker exposes one role chooser and four permission-scoped workspaces:

- `/` — pilot role chooser and integrated module coverage;
- `/admin` — administration readiness, SIS, academics, finance, operations, student support, communications, integrations and reports;
- `/teacher` — classes, attendance, gradebook, assigned student context, messages and resources;
- `/family` — applications, children, attendance, grades, finance, forms, documents and messages;
- `/student` — timetable, attendance, results, documents, resources, requests and messages.

Deep links use Workers Static Assets single-page-application fallback. The pilot currently uses synthetic staging records and simulated role sessions; it does not expose production data or production mutation credentials.

## GitHub environment and secrets

Create a GitHub Actions environment named `cloudflare-staging` and add:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The token should be account-scoped and limited to the Cloudflare Workers permissions required for staging deployment. Never commit either value.

## Deployment workflow

`.github/workflows/deploy-cloudflare-staging.yml` performs:

1. clean npm installation;
2. canonical repository verification;
3. production builds;
4. staging API Worker deployment;
5. staging web Worker deployment;
6. live `/health`, role chooser, admin, teacher, guardian, student, manifest and offline-page smoke tests;
7. deployment URLs in the GitHub Actions job summary.

The workflow runs for the reviewed staging deployment and pilot runtime-composition pull requests, and can also be run manually.

## Data and authentication boundary

The role chooser is a pilot aid, not the production identity provider. It selects a synthetic persona and capability set so reviewers can inspect composed module surfaces. Before production promotion, replace it with reviewed OAuth/OIDC authentication, tenant and campus selection, server-issued capability grants, session expiry enforcement and real permission-aware API reads.

The current module routes are composed from integrated experience components and synthetic read models. Production mutations, payments, publication, restricted-data access and final approvals remain disabled in this staging demonstration.

## Promotion rule

Do not attach a production domain or use production Neon credentials until:

- production authentication and tenant context are complete;
- real Worker API read models replace synthetic pilot data;
- staging acceptance journeys pass with approved test accounts;
- secrets and data-classification review passes;
- monitoring, rollback and backup rehearsal are recorded;
- the owner explicitly authorizes production deployment.
