# Foundation Provenance

FND-01 uses a clean-room implementation process. External projects may inform requirements and interoperability research, but restricted source code, proprietary assets, private datasets, and copied implementation text are not accepted into this repository.

## Reproducibility

- Node and npm versions are constrained in the root manifest.
- `package-lock.json` is authoritative for JavaScript dependency resolution.
- `npm ci` is the required clean-install command in CI and release evidence.
- Licence inventory and CycloneDX-style SBOM files are generated only from committed manifests and the lockfile.
- Generated provenance contains no credentials, environment values, tenant data, or production metadata.

## Verification

```bash
npm ci
npm audit --audit-level=high
npm run licenses:check
npm run provenance:generate
npm run verify
npm run test:browser
```

A secret-enabled environment may additionally run `npm run test:neon`. The test is intentionally skipped when `DATABASE_URL` is absent and never logs the connection string.

## Review expectations

Any new dependency must have a clear product need, a supported maintenance path, an acceptable licence, and a bounded security surface. Generated artifacts must be refreshed in the same pull request as lockfile changes.
