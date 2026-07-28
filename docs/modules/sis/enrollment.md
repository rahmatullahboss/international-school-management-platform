# SIS Enrollment Lifecycle

Enrollment records are append-oriented, effective-dated placements linked to a student profile, campus, program, academic year and optional grade level. Creation and transfer use tenant-scoped idempotency keys.

Transfers close the source enrollment and create a distinct destination enrollment. Withdrawals close the enrollment and retain reason, destination and notes. Promotion closes the prior academic-year enrollment before creating the next placement; re-enrollment always references a closed prior enrollment. Previous-school, admission and placement history remain separate append-only records.

The lifecycle can transition a student to alumni only after the final enrollment is completed or withdrawn. Active placement identity fields—student, campus, program, year, grade and start date—cannot be rewritten in PostgreSQL; a transfer or promotion must append a new enrollment.

Migration `202607280104_SIS-01_enrollment` creates ten forced-RLS lifecycle tables and completes the applicant-conversion enrollment foreign key. Neon verification confirmed tenant isolation and rejected placement identity mutation.
