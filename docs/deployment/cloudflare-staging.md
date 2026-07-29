# Cloudflare Staging Deployment

## Purpose

Deploy the non-production pilot surface to Cloudflare Workers so the integrated platform can be opened in a browser and acceptance-tested without touching production resources.

## Verified services

- `international-school-platform-web-staging`: Vite SPA served through Workers Static Assets with SPA fallback.
- `international-school-platform-api-staging`: Hono API Worker with observability enabled and `/health` verification.

Current verified candidate: `a50ad782489137f5afd806e30c7a3e249b5074ec`  
Root CI: `30484622352`  
Cloudflare deploy/smoke: `30484622364`

## Live pilot routes

- Role chooser: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/`
- Admin: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/admin`
- Teacher: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/teacher`
- Guardian: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/family`
- Student: `https://international-school-platform-web-staging.rahmatullahzisan.workers.dev/student`
- API health: `https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/health`

Deep links use Workers Static Assets single-page-application fallback. The pilot uses synthetic staging records and simulated role sessions; it does not expose production data or production mutation credentials.

## Deployment versions

- API Worker version: `360f923e-1518-4d1d-9540-3f02c4939216`
- Web Worker version: `11539129-464f-4f80-8fc1-8254f4c9e1be`

## Performance evidence

- Initial JavaScript: 203,338 bytes; limit 250,000 bytes.
- Initial CSS: 8,475 bytes; limit 50,000 bytes.
- Total route JavaScript: 283,316 bytes; limit 350,000 bytes.
- Total route CSS: 60,355 bytes; limit 85,000 bytes.
- Role applications are lazy-loaded so the role chooser remains within the initial payload budget.

## GitHub environment and secrets

The GitHub Actions environment is `cloudflare-staging` and supplies:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The token is account-scoped to the Workers permissions required for staging deployment. Neither value is committed.

## Deployment workflow

`.github/workflows/deploy-cloudflare-staging.yml` performs:

1. clean npm installation;
2. canonical repository verification;
3. production builds and asset-budget verification;
4. staging API Worker deployment;
5. staging web Worker deployment;
6. live `/health`, role chooser, admin, teacher, guardian, student, manifest and offline-page smoke tests;
7. deployment URLs in the GitHub Actions job summary.

## Data and authentication boundary

The role chooser is a pilot aid, not the production identity provider. It selects a synthetic persona and capability set so reviewers can inspect composed module surfaces. Before production promotion, replace it with reviewed OAuth/OIDC authentication, tenant and campus selection, server-issued capability grants, session expiry enforcement and real permission-aware API reads.

Production mutations, payments, publication, restricted-data access and final approvals remain disabled in this staging demonstration.

## Promotion rule

Do not attach a production domain or use production Neon credentials until:

- production authentication and tenant context are complete;
- real Worker API read models replace synthetic pilot data;
- staging acceptance journeys pass with approved test accounts;
- secrets and data-classification review passes;
- monitoring, rollback and backup rehearsal are recorded;
- the owner explicitly authorizes production deployment.
