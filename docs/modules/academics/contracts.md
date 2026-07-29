# ACAD-01 Public Contracts

## Scope

ACAD-01 owns versioned academic structure, scheduling, attendance, gradebook and academic records. This checkpoint establishes the public academic-structure contract without changing frozen foundation, SIS, FIN or INT internals.

## External references

The module stores the following cross-module identifiers as opaque tenant-scoped references:

- SIS: `studentProfileId`, `staffProfileId`, `enrollmentId`;
- foundation tenancy: `campusId`;
- INT: `countryPackRef` and curriculum configuration references;
- FIN: no direct dependency in the academic-structure milestone.

No ACAD migration creates a foreign key into another module-owned schema. Application services must validate external references through the owning module's public API/read contract before accepting a command.

## Versioned academic structure

Published academic years, instructional calendars, bell schedules, curriculum versions, program versions, course versions and class sections are immutable. A material change creates a new version or draft successor. Historical rosters, attendance, results and records always retain the exact version identifiers used at the time.

The public contract includes:

- academic years and non-overlapping terms;
- campus instructional calendars and local school timezone;
- bell schedules and ordered, non-overlapping periods;
- curriculum, program and course versions;
- learning standards/outcomes;
- class sections with capacity;
- effective-dated teacher/co-teacher/assistant assignments;
- effective-dated roster entries linked to opaque SIS enrollment and student identifiers.

## Events

Events use the shared domain envelope and are additive within schema version 1. Initial event names include:

- `academic.year.created.v1`;
- `academic.term.created.v1`;
- `academic.calendar.created.v1`;
- `academic.bell-schedule.created.v1`;
- `academic.curriculum-version.created.v1`;
- `academic.program-version.created.v1`;
- `academic.course-version.created.v1`;
- `academic.learning-standard.created.v1`;
- `academic.class-section.created.v1`;
- `academic.staff-assignment.created.v1`;
- `academic.roster-entry.created.v1`;
- `academic.<aggregate>.published.v1`.

Every event includes tenant, aggregate, version, correlation and occurrence metadata. Consumers must deduplicate by event ID and may not infer current academic policy from an old event without resolving the referenced version.

## Permissions

The complete application-service layer will enforce deny-by-default permissions. The stable permission vocabulary begins with:

- `academics.structure.read`;
- `academics.structure.manage`;
- `academics.structure.publish`;
- `academics.roster.read`;
- `academics.roster.manage`;
- `academics.audit.read`.

Teacher access is section-assignment scoped. Guardian and student publication reads will be limited to their authorized student and only published records.

## Database and tenancy

Migration `202607280201_ACAD-01_academic_structure` creates the `academics` schema and 13 tenant-owned tables. Every table has forced row-level security using `app.tenant_id`. Published version tables reject update/delete mutation at the database layer.

The assigned Neon branch is `agent/acad-01-academics` (`br-gentle-waterfall-axcl7l8z`). The available Neon connector created it from `main` because the connector does not expose a parent selector. ACAD completion therefore requires deterministic replay of the reviewed Wave 1 migration manifest plus ACAD migrations on this isolated branch or a fresh equivalent branch before the module gate can pass.

## Design-governance note

The exact reviewed base `8cc8ee1562ade672b14c1c44af935fe7e2307976` does not contain foundation-owned `PRODUCT.md` or `DESIGN.md`. ACAD will not recreate or alter those frozen authorities. UI work will use repository design documents, incumbent tokens/components and Impeccable 4.0.2, and will record the missing authorities explicitly in UI evidence.
