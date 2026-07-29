# Final System and Pilot-Readiness Evidence

## Candidate

- Program: `international-school-platform-v1`
- Wave 3 main integration: `6093109c8c573c3b4495141ad71661d5d5ca22c1`
- Finalization branch: `integration/international-school-platform-finalization`
- Canonical migration manifest: 40 migrations across FND-01, SIS-01, FIN-01, INT-01, ACAD-01, OPS-01 and CARE-01
- Experience implementation: `5c952703c24ee9927fcf2cd480d3ce8d0d139847`

EXP-01 adds application, communication, reporting, document and PWA capabilities without adding a database migration stream. The reviewed database manifest therefore intentionally remains anchored to `GATE-WAVE-2-INTEGRATED` while the final system gate re-verifies the complete integrated application against that canonical database.

## Required final gates

The finalization pull request must pass both independent workflows:

1. Root CI: clean install, format, lint, architecture boundaries, typecheck, all tests, fresh PostgreSQL migration replay, live Neon driver, build, PWA budget, audit, licences, provenance, all browser suites and execution-artifact validation.
2. INTEG-01 Final Neon Recovery Gate: exact Neon project/branch identity, idempotent canonical apply, forced-RLS and runtime-policy checks, finance immutability/balance checks, cross-tenant read/write probes and disposable database recovery replay.

## Current evidence

- EXP implementation CI `30464998020`: passed.
- EXP final-head CI `30465524930`: passed.
- Wave 3 integration CI `30466466903`: passed.
- Wave 3 final evidence CI `30466808450`: passed.
- Wave 3 merge commit: `6093109c8c573c3b4495141ad71661d5d5ca22c1`.

## Pending finalization evidence

The exact root CI run, final Neon recovery run, finalization head and merge commit will be recorded after both workflows pass. No production deployment or production database mutation is authorized by this evidence document.
