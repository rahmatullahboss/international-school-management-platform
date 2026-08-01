from pathlib import Path


tracker_path = Path('docs/execution/04-progress-tracker.md')
tracker = tracker_path.read_text()

replacements = {
    " and `GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1` have passed.": ", `GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1` and `GATE-PILOT-STUDENT-RUNTIME-COMPOSER-V1` have passed.",
    "and database-owned admin, teacher and guardian home composers with authoritative scoped metrics, deterministic unchanged-payload no-op evidence, canonical persona capabilities, verified guardian authority, education/billing separation and canonical campus-lineage isolation, while": "and database-owned admin, teacher, guardian and student home composers with authoritative scoped metrics, deterministic unchanged-payload no-op evidence, canonical persona capabilities, verified guardian authority, education/billing separation, exact student identity/enrollment/roster derivation and canonical campus-lineage isolation, while",
    "followed by the database-owned guardian runtime composer in [44-pilot-guardian-runtime-projection-composer-v1.md](44-pilot-guardian-runtime-projection-composer-v1.md) and [45-pilot-guardian-runtime-projection-composer-release-evidence.md](45-pilot-guardian-runtime-projection-composer-release-evidence.md).": "followed by the database-owned guardian runtime composer in [44-pilot-guardian-runtime-projection-composer-v1.md](44-pilot-guardian-runtime-projection-composer-v1.md) and [45-pilot-guardian-runtime-projection-composer-release-evidence.md](45-pilot-guardian-runtime-projection-composer-release-evidence.md), and the database-owned student runtime composer in [46-pilot-student-runtime-projection-composer-v1.md](46-pilot-student-runtime-projection-composer-v1.md) and [47-pilot-student-runtime-projection-composer-release-evidence.md](47-pilot-student-runtime-projection-composer-release-evidence.md).",
    "| `GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1` | passed | Implementation proof `d59334952813afafd00b2ddf4ae9b5e06d5f3286`; main merge `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`; root CI `30662644211`; verified child authority, education/billing separation, canonical campus lineage and composer-to-worker projection `3 → 4` verified |": "| `GATE-PILOT-GUARDIAN-RUNTIME-COMPOSER-V1` | passed | Implementation proof `d59334952813afafd00b2ddf4ae9b5e06d5f3286`; main merge `6c6273adf1e42dc2a5e19b1130747a3ae5de46ee`; root CI `30662644211`; verified child authority, education/billing separation, canonical campus lineage and composer-to-worker projection `3 → 4` verified |\n| `GATE-PILOT-STUDENT-RUNTIME-COMPOSER-V1` | passed | Implementation proof `9a3978e294bc3d9f463780ec9154bed67d802eb8`; main merge `f260d18bab8084ab2132767f2d8fb3040290c6cd`; root CI `30678621687`; exact active student identity, campus enrollment and roster derivation, authoritative self-service metrics, cross-campus isolation and composer-to-worker projection `2 → 3` verified |",
}

for old, new in replacements.items():
    count = tracker.count(old)
    if count != 1:
        raise SystemExit(f'expected one PILOT-11 tracker marker {old!r}, found {count}')
    tracker = tracker.replace(old, new, 1)

tracker_path.write_text(tracker)
