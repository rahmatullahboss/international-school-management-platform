from pathlib import Path

migration_path = Path(
    'infra/database/post-integration-migrations/'
    '202608010101_PILOT-09_teacher_runtime_projection_composer.sql'
)
migration = migration_path.read_text()


def replace_exact(text: str, old: str, new: str, expected: int = 1) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'expected {expected} occurrence(s), found {count}: {old[:100]!r}')
    return text.replace(old, new, expected)


migration = replace_exact(
    migration,
    """  FROM scheduling.scheduled_class_meeting AS meeting
  WHERE meeting.tenant_id = p_tenant_id
    AND meeting.local_date = selected_local_date
""",
    """  FROM scheduling.scheduled_class_meeting AS meeting
  JOIN scheduling.timetable_version AS timetable
    ON timetable.tenant_id = meeting.tenant_id
   AND timetable.timetable_version_id = meeting.timetable_version_id
   AND timetable.campus_id = p_campus_id
   AND timetable.publication_state = 'published'
  WHERE meeting.tenant_id = p_tenant_id
    AND meeting.local_date = selected_local_date
""",
)

migration = replace_exact(
    migration,
    """  JOIN scheduling.scheduled_class_meeting AS meeting
    ON meeting.tenant_id = attendance_session.tenant_id
   AND meeting.scheduled_meeting_id = attendance_session.scheduled_meeting_id
  WHERE attendance_session.tenant_id = p_tenant_id
""",
    """  JOIN scheduling.scheduled_class_meeting AS meeting
    ON meeting.tenant_id = attendance_session.tenant_id
   AND meeting.scheduled_meeting_id = attendance_session.scheduled_meeting_id
  JOIN scheduling.timetable_version AS timetable
    ON timetable.tenant_id = meeting.tenant_id
   AND timetable.timetable_version_id = meeting.timetable_version_id
   AND timetable.campus_id = p_campus_id
   AND timetable.publication_state = 'published'
  WHERE attendance_session.tenant_id = p_tenant_id
""",
)

migration = replace_exact(
    migration,
    """      FROM scheduling.class_meeting_pattern AS pattern
      WHERE pattern.tenant_id = assessment.tenant_id
        AND pattern.section_id = assessment.section_id
""",
    """      FROM scheduling.class_meeting_pattern AS pattern
      JOIN scheduling.timetable_version AS timetable
        ON timetable.tenant_id = pattern.tenant_id
       AND timetable.timetable_version_id = pattern.timetable_version_id
       AND timetable.campus_id = p_campus_id
       AND timetable.publication_state = 'published'
      WHERE pattern.tenant_id = assessment.tenant_id
        AND pattern.section_id = assessment.section_id
""",
    expected=2,
)

migration = replace_exact(
    migration,
    """    FROM scheduling.scheduled_class_meeting AS meeting
    WHERE meeting.tenant_id = p_tenant_id
      AND meeting.local_date = selected_local_date
""",
    """    FROM scheduling.scheduled_class_meeting AS meeting
    JOIN scheduling.timetable_version AS timetable
      ON timetable.tenant_id = meeting.tenant_id
     AND timetable.timetable_version_id = meeting.timetable_version_id
     AND timetable.campus_id = p_campus_id
     AND timetable.publication_state = 'published'
    WHERE meeting.tenant_id = p_tenant_id
      AND meeting.local_date = selected_local_date
""",
)

migration_path.write_text(migration)

verification_path = Path('tests/integration/verify-auth-durable-context.sh')
verification = verification_path.read_text()
marker = """INSERT INTO platform.runtime_read_model_projection (
  tenant_id, membership_id, campus_id, projection_key, persona,
  subject_ref, revision, payload, source_updated_at, generated_at
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000052',
"""
if verification.count(marker) != 1:
    raise SystemExit('expected one teacher projection fixture marker')

cross_campus_fixture = """INSERT INTO tenancy.campus (
  tenant_id, campus_id, legal_entity_id, code, name, time_zone
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000078',
  '30000000-0000-4000-8000-000000000002',
  'PILOT-X',
  'Pilot Secondary Campus',
  'Asia/Dhaka'
);

INSERT INTO scheduling.timetable_version (
  tenant_id, timetable_version_id, academic_year_id, term_id, campus_id,
  timetable_name, effective_from, publication_state, idempotency_key
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000079',
  '30000000-0000-4000-8000-000000000061',
  '30000000-0000-4000-8000-000000000062',
  '30000000-0000-4000-8000-000000000078',
  'Cross-campus Teacher Timetable',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30,
  'published',
  'pilot-09-cross-campus-timetable-01'
);

INSERT INTO scheduling.class_meeting_pattern (
  tenant_id, meeting_pattern_id, timetable_version_id, section_id,
  weekday, starts_at, ends_at, timezone, teacher_ids, student_ids, valid_from
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000007a',
  '30000000-0000-4000-8000-000000000079',
  '30000000-0000-4000-8000-00000000007b',
  extract(dow FROM (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date)::smallint,
  TIME '11:00',
  TIME '11:45',
  'Asia/Dhaka',
  '[\"30000000-0000-4000-8000-000000000055\"]'::jsonb,
  '[\"30000000-0000-4000-8000-000000000031\"]'::jsonb,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 30
);

INSERT INTO scheduling.scheduled_class_meeting (
  tenant_id, scheduled_meeting_id, timetable_version_id, meeting_pattern_id,
  section_id, local_date, starts_at, ends_at, timezone, teacher_ids,
  student_ids, meeting_status
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000007c',
  '30000000-0000-4000-8000-000000000079',
  '30000000-0000-4000-8000-00000000007a',
  '30000000-0000-4000-8000-00000000007b',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  TIME '11:00',
  TIME '11:45',
  'Asia/Dhaka',
  '[\"30000000-0000-4000-8000-000000000055\"]'::jsonb,
  '[\"30000000-0000-4000-8000-000000000031\"]'::jsonb,
  'scheduled'
);

-- The schema permits imported attendance data to carry an inconsistent campus.
-- The composer must trust the canonical timetable campus and exclude this row.
INSERT INTO attendance.attendance_session (
  tenant_id, session_id, scheduled_meeting_id, section_id, campus_id,
  local_date, starts_at, ends_at, timezone, roster_student_ids, session_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000007f',
  '30000000-0000-4000-8000-00000000007c',
  '30000000-0000-4000-8000-00000000007b',
  '30000000-0000-4000-8000-000000000003',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date,
  TIME '11:00',
  TIME '11:45',
  'Asia/Dhaka',
  '[\"30000000-0000-4000-8000-000000000031\"]'::jsonb,
  'open'
);

INSERT INTO gradebook.assessment (
  tenant_id, assessment_id, section_id, reporting_period_id,
  policy_version_id, category_id, assessment_title, maximum_points,
  due_at, assessment_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000007d',
  '30000000-0000-4000-8000-00000000007b',
  '30000000-0000-4000-8000-00000000006c',
  '30000000-0000-4000-8000-000000000068',
  '30000000-0000-4000-8000-000000000069',
  'Cross-campus Teacher Quiz',
  10,
  clock_timestamp() + interval '2 days',
  'published'
);

INSERT INTO gradebook.assessment_result (
  tenant_id, assessment_result_id, assessment_id, student_profile_id,
  result_state, raw_score, entered_by
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000007e',
  '30000000-0000-4000-8000-00000000007d',
  '30000000-0000-4000-8000-000000000031',
  'missing',
  NULL,
  '30000000-0000-4000-8000-000000000050'
);

"""
verification_path.write_text(verification.replace(marker, cross_campus_fixture + marker, 1))
