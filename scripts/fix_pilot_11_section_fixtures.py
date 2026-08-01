from pathlib import Path

path = Path("tests/integration/verify-auth-durable-context.sh")
text = path.read_text(encoding="utf-8")
marker = """-- Current selected-campus and cross-campus rosters intentionally coexist.
INSERT INTO academics.section_roster (
"""
if text.count(marker) != 1:
    raise SystemExit(f"expected one student roster marker, got {text.count(marker)}")

fixture = r'''INSERT INTO academics.academic_year (
  tenant_id, academic_year_id, year_code, year_name,
  starts_on, ends_on, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c7',
  'PILOT-11-AY',
  'PILOT-11 Academic Year',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 60,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date + 300,
  'published'
);

INSERT INTO academics.academic_term (
  tenant_id, term_id, academic_year_id, term_code, term_name,
  starts_on, ends_on, sequence_no
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c8',
  '30000000-0000-4000-8000-0000000000c7',
  'PILOT-11-T1',
  'PILOT-11 Term 1',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 60,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date + 120,
  1
);

INSERT INTO academics.curriculum_version (
  tenant_id, curriculum_version_id, curriculum_key, version_label,
  curriculum_name, effective_from, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000c9',
  'pilot-11-student',
  'v1',
  'PILOT-11 Student Curriculum',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 60,
  'published'
);

INSERT INTO academics.course_version (
  tenant_id, course_version_id, course_key, version_label,
  curriculum_version_id, course_code, course_title,
  credits, prerequisite_course_keys, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000ca',
  'pilot-11-student-home',
  'v1',
  '30000000-0000-4000-8000-0000000000c9',
  'P11-HOME',
  'PILOT-11 Student Home Course',
  0,
  '[]'::jsonb,
  'published'
);

INSERT INTO academics.class_section (
  tenant_id, section_id, course_version_id, academic_year_id,
  term_id, campus_id, section_code, section_title,
  capacity, publication_state
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000065',
    '30000000-0000-4000-8000-0000000000ca',
    '30000000-0000-4000-8000-0000000000c7',
    '30000000-0000-4000-8000-0000000000c8',
    '30000000-0000-4000-8000-000000000003',
    'P11-PRIMARY',
    'PILOT-11 Primary Campus Section',
    30,
    'published'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-00000000007b',
    '30000000-0000-4000-8000-0000000000ca',
    '30000000-0000-4000-8000-0000000000c7',
    '30000000-0000-4000-8000-0000000000c8',
    '30000000-0000-4000-8000-000000000078',
    'P11-CROSS',
    'PILOT-11 Cross-campus Section',
    30,
    'published'
  );

-- Current selected-campus and cross-campus rosters intentionally coexist.
INSERT INTO academics.section_roster (
'''
text = text.replace(marker, fixture, 1)

required = [
    "'30000000-0000-4000-8000-0000000000c7'",
    "'30000000-0000-4000-8000-0000000000c8'",
    "'30000000-0000-4000-8000-0000000000c9'",
    "'30000000-0000-4000-8000-0000000000ca'",
    "'P11-PRIMARY'",
    "'P11-CROSS'",
]
for value in required:
    if text.count(value) < 1:
        raise SystemExit(f"missing student section fixture marker: {value}")

path.write_text(text, encoding="utf-8")
