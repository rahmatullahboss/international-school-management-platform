from pathlib import Path


def replace_exact(text: str, old: str, new: str, expected: int = 1) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'expected {expected} occurrence(s), found {count}: {old[:140]!r}')
    return text.replace(old, new, expected)


migration_path = Path(
    'infra/database/post-integration-migrations/'
    '202608010201_PILOT-10_guardian_runtime_projection_composer.sql'
)
migration = migration_path.read_text()
migration = replace_exact(
    migration,
    "SET search_path = pg_catalog, platform, iam, tenancy, people, student_lifecycle,\n                  attendance, gradebook, billing, audit",
    "SET search_path = pg_catalog, platform, iam, tenancy, people, student_lifecycle,\n                  scheduling, attendance, gradebook, billing, audit",
)
migration = replace_exact(
    migration,
    """  JOIN attendance.attendance_session AS attendance_session
    ON attendance_session.tenant_id = attendance_record.tenant_id
   AND attendance_session.session_id = attendance_record.session_id
   AND attendance_session.campus_id = p_campus_id
   AND attendance_session.local_date = selected_local_date
  JOIN attendance.attendance_code AS attendance_code
""",
    """  JOIN attendance.attendance_session AS attendance_session
    ON attendance_session.tenant_id = attendance_record.tenant_id
   AND attendance_session.session_id = attendance_record.session_id
   AND attendance_session.campus_id = p_campus_id
   AND attendance_session.local_date = selected_local_date
  JOIN scheduling.scheduled_class_meeting AS scheduled_meeting
    ON scheduled_meeting.tenant_id = attendance_session.tenant_id
   AND scheduled_meeting.scheduled_meeting_id = attendance_session.scheduled_meeting_id
  JOIN scheduling.timetable_version AS timetable
    ON timetable.tenant_id = scheduled_meeting.tenant_id
   AND timetable.timetable_version_id = scheduled_meeting.timetable_version_id
   AND timetable.campus_id = p_campus_id
   AND timetable.publication_state = 'published'
  JOIN attendance.attendance_code AS attendance_code
""",
)
migration = replace_exact(
    migration,
    """    AND grade_snapshot.student_profile_id = ANY(education_student_profile_ids)
    AND grade_publication.available_from <= selected_composed_at
""",
    """    AND grade_snapshot.student_profile_id = ANY(education_student_profile_ids)
    AND EXISTS (
      SELECT 1
      FROM scheduling.class_meeting_pattern AS class_pattern
      JOIN scheduling.timetable_version AS timetable
        ON timetable.tenant_id = class_pattern.tenant_id
       AND timetable.timetable_version_id = class_pattern.timetable_version_id
       AND timetable.campus_id = p_campus_id
       AND timetable.publication_state = 'published'
      WHERE class_pattern.tenant_id = grade_snapshot.tenant_id
        AND class_pattern.section_id = grade_snapshot.section_id
    )
    AND grade_publication.available_from <= selected_composed_at
""",
)
migration_path.write_text(migration)

verification_path = Path('tests/integration/verify-auth-durable-context.sh')
verification = verification_path.read_text()

attendance_marker = """INSERT INTO attendance.attendance_policy_version (
  tenant_id, policy_version_id, policy_key, version_label,
"""
if verification.count(attendance_marker) != 1:
    raise SystemExit('expected one guardian attendance fixture marker')
main_schedule_fixture = r'''INSERT INTO scheduling.timetable_version (
  tenant_id, timetable_version_id, academic_year_id, term_id, campus_id,
  timetable_name, effective_from, publication_state, idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000099',
  '30000000-0000-4000-8000-000000000061',
  '30000000-0000-4000-8000-000000000062',
  '30000000-0000-4000-8000-000000000003',
  'Pilot Guardian Timetable',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30,
  'published',
  'pilot-10-guardian-timetable-01'
);
INSERT INTO scheduling.class_meeting_pattern (
  tenant_id, meeting_pattern_id, timetable_version_id, section_id,
  weekday, starts_at, ends_at, timezone, teacher_ids, student_ids, valid_from
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000009a',
  '30000000-0000-4000-8000-000000000099',
  '30000000-0000-4000-8000-000000000065',
  extract(dow FROM (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date)::smallint,
  TIME '12:00',
  TIME '12:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000055"]'::jsonb,
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
);
INSERT INTO scheduling.scheduled_class_meeting (
  tenant_id, scheduled_meeting_id, timetable_version_id, meeting_pattern_id,
  section_id, local_date, starts_at, ends_at, timezone, teacher_ids,
  student_ids, meeting_status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000009b',
  '30000000-0000-4000-8000-000000000099',
  '30000000-0000-4000-8000-00000000009a',
  '30000000-0000-4000-8000-000000000065',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  TIME '12:00',
  TIME '12:45',
  'Asia/Dhaka',
  '["30000000-0000-4000-8000-000000000055"]'::jsonb,
  '["30000000-0000-4000-8000-000000000031"]'::jsonb,
  'scheduled'
);

'''
verification = verification.replace(attendance_marker, main_schedule_fixture + attendance_marker, 1)
verification = replace_exact(
    verification,
    "  '30000000-0000-4000-8000-00000000008c',\n  '30000000-0000-4000-8000-000000000065',",
    "  '30000000-0000-4000-8000-00000000009b',\n  '30000000-0000-4000-8000-000000000065',",
)

attendance_record_marker = """INSERT INTO gradebook.grading_policy_version (
  tenant_id, policy_version_id, policy_key, version_label,
"""
if verification.count(attendance_record_marker) != 1:
    raise SystemExit('expected one guardian grade fixture marker')
cross_campus_attendance = r'''-- Same-child attendance with a forged selected-campus field but a cross-campus timetable must remain invisible.
INSERT INTO attendance.attendance_record (
  tenant_id, attendance_record_id, client_record_id, session_id,
  student_profile_id, attendance_code_id, record_source, recorded_by
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000ba',
  'pilot-10-cross-campus-attendance-01',
  '30000000-0000-4000-8000-00000000007f',
  '30000000-0000-4000-8000-000000000031',
  '30000000-0000-4000-8000-000000000088',
  'guardian',
  '30000000-0000-4000-8000-000000000080'
);

'''
verification = verification.replace(
    attendance_record_marker,
    cross_campus_attendance + attendance_record_marker,
    1,
)

grade_publication_marker = """INSERT INTO ledger.book (
  tenant_id, legal_entity_id, book_id, code, name, base_currency
"""
if verification.count(grade_publication_marker) != 1:
    raise SystemExit('expected one guardian ledger fixture marker')
cross_campus_grade = r'''-- A published grade for the same child in a cross-campus section must remain invisible.
INSERT INTO gradebook.grade_calculation_snapshot (
  tenant_id, snapshot_id, section_id, reporting_period_id,
  student_profile_id, policy_version_id, category_percentages,
  calculated_percent, displayed_grade, formula
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b8',
  '30000000-0000-4000-8000-00000000007b',
  '30000000-0000-4000-8000-00000000006c',
  '30000000-0000-4000-8000-000000000031',
  '30000000-0000-4000-8000-00000000008d',
  '{"coursework":90}'::jsonb,
  90,
  'A+',
  'cross-campus guardian fixture'
);
INSERT INTO gradebook.grade_publication (
  tenant_id, publication_id, snapshot_id, available_from, published_by
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000b9',
  '30000000-0000-4000-8000-0000000000b8',
  clock_timestamp() - interval '1 day',
  '30000000-0000-4000-8000-000000000080'
);

'''
verification = verification.replace(
    grade_publication_marker,
    cross_campus_grade + grade_publication_marker,
    1,
)
verification_path.write_text(verification)
