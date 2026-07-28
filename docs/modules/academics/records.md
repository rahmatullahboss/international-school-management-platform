# Report Cards, Promotion, Credits and Transcripts

Academic records are immutable snapshots of the exact policies and source results used when an artifact was approved or issued. Later policy changes never rewrite historical report cards, GPA snapshots or transcripts.

## Report cards

- reporting periods must be closed before generation;
- templates are localized, versioned and immutable after publication;
- every course row stores the immutable course-version and grade-snapshot identifiers plus displayed values;
- attendance stores the exact policy version and summarized counts used;
- generation is idempotent;
- approval is separate from publication;
- publication includes an explicit availability window;
- published cards are immutable evidence.

## Promotion and completion

Promotion, retention, completion and review are proposals backed by published report-card IDs. A separate decision records effective date, decision-maker and rationale. ACAD emits the decision for SIS to consume through its public contract; ACAD does not update SIS enrollment state directly.

## Credits and GPA

Credit policy versions define pass thresholds and GPA rounding. GPA snapshots store every course outcome, attempted/earned credits, quality points, formula and policy version. Courses without grade points are excluded from the GPA denominator but remain in academic history.

## Transcripts

- transcript numbers and initial issue commands are idempotent;
- issued content includes localized school/student labels, immutable course outcomes, GPA snapshot, totals and a deterministic artifact digest;
- transcript content cannot be edited or deleted;
- a correction requires a reason, independent approver and a replacement GPA snapshot;
- reissue creates a new transcript version linked to the superseded artifact;
- old content and digest remain available in version history.

## Database

Migration `202607280205_ACAD-01_records` creates ten forced-RLS tables. Published template/policy versions and report cards are immutable; GPA snapshots, decisions and amendment evidence are append-only; transcript content has a database immutability trigger while status may only progress through controlled reissue/revocation workflows.
