# Contract Change Request: Nested Module Workspaces

## Request

- Requesting stream: `INT-01`
- Checkpoint SHA: `0ac974fd7632079d1dc4f056285cb21e2aa77df4`
- Branch: `module/international-integrations`
- Worktree: `.worktrees/int-01-integrations`
- Starting foundation SHA: `55114f55a375d3d79dba7ea21f984b789b5dbca1`
- Raised: `2026-07-28T08:49:54+06:00`

## Exact current contract

`docs/execution/03-agent-board.json` assigns module packages under nested paths such as `packages/modules/country-packs/**`, `packages/modules/integrations/**` and `packages/modules/migration-studio/**`.

The frozen root workspace configuration declares only `packages/*`. The frozen architecture check enumerates every first-level directory under `packages` and unconditionally reads `<directory>/package.json`:

```text
for (const directory of await directories('packages')) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
}
```

Once an owned module path creates `packages/modules/`, `npm run check:boundaries` fails with:

```text
ENOENT: no such file or directory, open 'packages/modules/package.json'
```

## Required change

Approve a compatible foundation/integration change that supports nested module packages without making every module stream edit one shared parent manifest.

Recommended contract:

1. Update `scripts/check-architecture-boundaries.mjs` to discover actual package manifests recursively or skip namespace directories that have no `package.json` while continuing to validate each nested package boundary.
2. Define integration-time workspace/typecheck composition for `packages/modules/*` using module-local manifests plus a generated or integrator-owned composition file.
3. Keep module agents from concurrently editing a shared `packages/modules/package.json`, root `package.json` or root `tsconfig.json`.

## Alternatives considered

### Create `packages/modules/package.json` in INT-01

Rejected. The file is outside `INT-01` owned paths and would become a shared conflict point for SIS, FIN and INT parallel streams. It would also require shared TypeScript/build composition decisions.

### Change root `package.json`, root `tsconfig.json` or boundary script in INT-01

Rejected. These are frozen foundation-owned paths and require coordinator/foundation approval.

### Ignore the boundary failure

Rejected. Module definition of done requires architecture boundary verification; continuing would hide a known integration failure.

### Move module source to a first-level package

Rejected. This violates the reviewed agent-board ownership paths and would create a different unapproved contract.

## Affected streams

- `SIS-01`
- `FIN-01`
- `INT-01`
- all Wave 2 module streams using `packages/modules/*`
- `INTEG-01` workspace/typecheck composition

## Migration and event impact

No database migration or event schema change is required. Existing INT-01 database migration `202607280101_INT-01_country_pack_engine` is unaffected.

## Security, privacy and finance impact

The requested change is build-time/package-boundary infrastructure only. It must preserve undeclared dependency detection and package-crossing import detection. No production data, credentials, financial logic or privacy policy changes are involved.

## Rollout and backward compatibility

- Existing first-level packages under `packages/*` must continue to be checked.
- Nested module packages must receive the same import/dependency checks.
- Existing root verification commands must remain stable.
- The change should be merged into a reviewed foundation/integration base, after which module branches can incorporate the exact approved commit without rewriting module-owned history.

## Required tests

- boundary checker passes on the current foundation packages;
- boundary checker passes with a valid nested module package;
- boundary checker fails for an undeclared `@school/*` dependency inside a nested module package;
- boundary checker fails for a relative import crossing a nested package boundary;
- root lint, typecheck, tests, build and execution-artifact validation remain green.

## Owner/integrator decision

Pending. `INT-01` is hard-stopped after the country-pack checkpoint until an approved foundation/integration SHA resolves the nested-module workspace contract.
