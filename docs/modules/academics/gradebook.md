# Gradebook, Moderation and Publication

Gradebook rules are versioned and explainable. Raw assessment states/scores remain separate from calculated and displayed grades, and every published output points to the exact policy and calculation inputs used.

## Contracts

- category weights must total 100 percent;
- scale boundaries, missing-score treatment and rounding belong to an immutable published policy version;
- assessments reference opaque section/reporting-period/standard identifiers;
- rubrics and outcome scores retain standards evidence alongside traditional points;
- `missing` and `exempt` have no raw score; `scored` and `late` require a valid score;
- one current result exists per assessment/student;
- calculation snapshots contain each input, inclusion decision, category percentages, final percentage, displayed grade and formula;
- all active assessments require moderation before gradebook lock;
- publication requires a locked section/reporting period and an explicit availability window;
- after lock, result correction requires a reasoned request and independent approve/reject decision;
- historical snapshots and publication/decision evidence are append-only.

## Events

The domain emits versioned events for policy/rubric/assessment creation and publication, result entry, moderation/closure, calculation snapshot, gradebook lock, snapshot publication and grade-change request/decision.

## Database

Migration `202607280204_ACAD-01_gradebook` creates 14 forced-RLS tables for policies, categories, scales, rubrics, assessments, raw/outcome results, calculation snapshots/inputs, locks, publication and grade changes. Published policies are immutable; locked results have a database guard; snapshots, calculation inputs, publication and decisions are append-only evidence.
