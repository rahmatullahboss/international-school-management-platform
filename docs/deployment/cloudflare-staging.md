# Cloudflare staging deployment

## Purpose

Deploy a non-production pilot surface to Cloudflare Workers so the integrated platform can be opened in a browser and smoke-tested without touching production resources.

## Staging services

- `international-school-platform-web-staging`: Vite SPA served through Workers Static Assets with SPA fallback.
- `international-school-platform-api-staging`: Hono API Worker with observability enabled and `/health` verification.

Both services use their generated `*.workers.dev` addresses. Custom domains, production routes and production data are intentionally out of scope.

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
6. live `/health`, homepage, manifest and offline-page smoke tests;
7. deployment URLs in the GitHub Actions job summary.

The workflow runs for pushes to `deploy/cloudflare-staging-pilot` and can also be run manually.

## Current pilot limitation

The deployed `platform-web` entrypoint currently exposes the foundation/PWA resilience shell. Admin, teacher, guardian and student experience packages are implemented and verified, but complete runtime routing, authentication and role-to-portal composition remain the next application-composition milestone. Therefore this deployment validates Cloudflare delivery, PWA assets, Worker health and browser reachability; it is not yet a complete school-user acceptance environment.

## Promotion rule

Do not attach a production domain or use production Neon credentials until:

- portal composition and authentication are complete;
- staging acceptance journeys pass;
- secrets and data-classification review passes;
- monitoring, rollback and backup rehearsal are recorded;
- the owner explicitly authorizes production deployment.
