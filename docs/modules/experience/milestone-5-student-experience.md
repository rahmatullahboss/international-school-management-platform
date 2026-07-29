# EXP-01 Milestone 5 — Student Self-Service Experience

## Scope

This milestone delivers the age-appropriate student workspace for the student’s own timetable, published attendance, published results, class resources, requests, authorised documents and secure communication. It consumes bounded self-authorised read models and links back to module-owned actions; it does not read private academic, SIS, communication or CARE tables.

## Product and design authority

- Starting checkpoint: EXP-01 Milestone 4 merge `cfb7c71aa591e49f2e2e678f62ab5d47eaf8faad`.
- Reviewed product authority: `PRODUCT.md` blob `5e769c75f28c0c5cc426f5b85eaf46f032a3367f`.
- Reviewed design authority: `DESIGN.md` blob `4be926a77d501dd8f16934ad4c50672ba754d66f`.
- Mode: Operate; self-only, publication-aware, age-appropriate and non-disclosing.

## Surface brief

- **Audience:** authenticated primary, secondary and senior students using school-managed devices, personal phones and intermittent networks.
- **Job:** understand today’s lessons, review published attendance/results, open authorised resources, submit/track permitted requests, download own documents and communicate securely.
- **Primary action:** open the current lesson or continue the student’s next permitted task.
- **Constraints:** exact self-ID filtering, published-only academic data, no internal teacher notes, age/role capability controls, long names/translations, mobile layout, RTL, keyboard use, reduced motion and recoverable failures.
- **Memorable moment:** the current lesson and next action are clear without exposing drafts, another student’s data or restricted support context.

## Contract

`StudentDailyWorkspace` accepts self-scoped lessons, attendance, results, resources, requests, documents and conversations. Exact `studentId` equality and capability checks happen before sorting, counts and rendering. Attendance, results and documents also require a published or revised state. Draft marks, internal notes, other-student records and restricted conversations cannot affect visible totals or empty states.

## Implementation checkpoint

- Current/upcoming lesson timeline from the published student timetable.
- Published attendance summaries with explanation status.
- Published/revised results with student-facing feedback only.
- Current-class resources and expiry information.
- Age/role-permitted requests with draft, submitted, review, complete and declined states.
- Authorised self-document downloads.
- Secure student conversations with capability filtering.
- Primary/secondary/senior language treatment plus loading, recoverable error and non-disclosing empty states.

## Verification

Canonical formatter checkpoint `205c4d1e463c35320c1119b1a512ee7a5b44c29c` restored the standard repository CI and formatted the student workspace and focused tests.

Full verification run `30449572525` passed format, lint, architecture boundaries, repository typecheck, all tests, fresh 40-migration replay, live Neon driver, build, dependency audit, licences, provenance, all Chromium suites and execution-artifact validation. Focused tests prove exact self-ID filtering before sorting/counting, published-only attendance/results/documents, other-student exclusion, internal-note and restricted-message masking, request-state actions and recoverable failures. No production deployment or database mutation was performed.
