from pathlib import Path


verification_path = Path('tests/integration/verify-auth-durable-context.sh')
verification = verification_path.read_text()

marker = """-- Current selected-campus and cross-campus rosters intentionally coexist.
INSERT INTO academics.section_roster (
"""

replacement = """-- Student roster fixtures must satisfy the canonical academic-section foreign key.
INSERT INTO academics.academic_year (
  tenant_id, academic_year_id, year_code, year_name,
  starts_on, ends_on, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000e0',
  'PILOT-STUDENT-AY',
  'Pilot Student Academic Year',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 180,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date + 180,
  'published'
);

INSERT INTO academics.academic_term (
  tenant_id, term_id, academic_year_id, term_code, term_name,
  starts_on, ends_on, sequence_no
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000e1',
  '30000000-0000-4000-8000-0000000000e0',
  'PILOT-STUDENT-T1',
  'Pilot Student Term One',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 90,
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date + 90,
  1
);

INSERT INTO academics.curriculum_version (
  tenant_id, curriculum_version_id, curriculum_key, version_label,
  curriculum_name, effective_from, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000e2',
  'pilot-student-curriculum',
  'v1',
  'Pilot Student Curriculum',
  (clock_timestamp() AT TIME ZONE 'Asia/Dhaka')::date - 180,
  'published'
);

INSERT INTO academics.course_version (
  tenant_id, course_version_id, course_key, version_label,
  curriculum_version_id, course_code, course_title, credits,
  publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-0000000000e3',
  'pilot-student-course',
  'v1',
  '30000000-0000-4000-8000-0000000000e2',
  'PILOT-STUDENT',
  'Pilot Student Course',
  1,
  'published'
);

INSERT INTO academics.class_section (
  tenant_id, section_id, course_version_id, academic_year_id,
  term_id, campus_id, section_code, section_title, capacity,
  publication_state
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000065',
    '30000000-0000-4000-8000-0000000000e3',
    '30000000-0000-4000-8000-0000000000e0',
    '30000000-0000-4000-8000-0000000000e1',
    '30000000-0000-4000-8000-000000000003',
    'PILOT-STUDENT-PRIMARY',
    'Pilot Student Primary Section',
    50,
    'published'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-00000000007b',
    '30000000-0000-4000-8000-0000000000e3',
    '30000000-0000-4000-8000-0000000000e0',
    '30000000-0000-4000-8000-0000000000e1',
    '30000000-0000-4000-8000-000000000078',
    'PILOT-STUDENT-CROSS',
    'Pilot Student Cross-campus Section',
    50,
    'published'
  );

-- Current selected-campus and cross-campus rosters intentionally coexist.
INSERT INTO academics.section_roster (
"""

count = verification.count(marker)
if count != 1:
    raise SystemExit(f'expected one PILOT-11 roster fixture marker, found {count}')

verification_path.write_text(verification.replace(marker, replacement, 1))
