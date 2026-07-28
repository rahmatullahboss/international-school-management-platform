# Timetable and Scheduling

ACAD-01 represents every timetable as a version with an effective period and publication state. Draft versions may be shaped and validated; published versions and their meeting patterns/instances are immutable.

## Supported workflow

1. Create an idempotent draft timetable for an academic year, term and campus.
2. Add local-time weekly meeting patterns referencing opaque class-section, teacher, student and room identifiers.
3. Materialize dated meetings only when the date matches the pattern weekday/effective range.
4. Detect overlapping section, teacher, room and student resources.
5. Block publication while any blocking conflict remains.
6. Publish a conflict-free non-empty version.
7. Record effective-dated teacher and/or room substitutions without rewriting the published base meeting.
8. Resolve student and teacher timetable views from base meetings plus substitutions.

## Invariants

- local school timezone and wall-clock intent are retained;
- duplicate materialization is idempotent by pattern/date;
- published timetable versions, patterns and meetings are immutable;
- substitutions are append-only evidence and keep the original teacher/room visible;
- cross-module identities remain opaque; scheduling never writes SIS or academic-structure tables;
- queries are tenant-scoped and application permissions will additionally scope teacher/student access.

## Events

- `schedule.timetable.created.v1`
- `schedule.meeting-pattern.created.v1`
- `schedule.meeting.materialized.v1`
- `schedule.timetable.published.v1`
- `schedule.substitution.created.v1`

## Database

Migration `202607280202_ACAD-01_timetable` creates the `scheduling` schema with timetable versions, patterns, resolved meetings, room bookings, conflict evidence and substitutions. All six tables use forced tenant RLS. Database triggers reject mutation of a published timetable and its patterns/meeting instances.
