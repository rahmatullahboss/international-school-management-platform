INSERT INTO iam.account (
  account_id, provider, provider_subject, email, assurance_level
) VALUES (
  '40000000-0000-4000-8000-000000000050',
  'https://identity.school.test',
  'provider-mobile-teacher-1',
  'teacher@example.test',
  'aal1'
);

INSERT INTO iam.membership (
  tenant_id, membership_id, account_id, campus_id, status
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000051',
  '40000000-0000-4000-8000-000000000050',
  '40000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.role (tenant_id, role_id, role_key, display_name, system_role)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000053',
  'teacher',
  'Teacher',
  true
);

INSERT INTO iam.role_permission (tenant_id, role_id, permission_key)
VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000053',
    'attendance.take'
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000053',
    'grades.write'
  );

INSERT INTO iam.oidc_membership_binding (
  binding_id, provider_issuer, provider_subject, account_id, tenant_id, membership_id, campus_id, status
) VALUES (
  '40000000-0000-4000-8000-000000000052',
  'https://identity.school.test',
  'provider-mobile-teacher-1',
  '40000000-0000-4000-8000-000000000050',
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000051',
  '40000000-0000-4000-8000-000000000003',
  'active'
);

INSERT INTO iam.oidc_membership_role_binding (tenant_id, binding_id, role_id)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000052',
  '40000000-0000-4000-8000-000000000053'
);

INSERT INTO people.person (tenant_id, person_id, status)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000054',
  'active'
);

INSERT INTO people.person_name (
  tenant_id, person_name_id, person_id, usage, given_name, family_name, effective_from
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000055',
  '40000000-0000-4000-8000-000000000054',
  'legal', 'Teacher', 'Tester', current_date - 30
);

INSERT INTO iam.person_link (tenant_id, account_id, person_id)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000050',
  '40000000-0000-4000-8000-000000000054'
);

INSERT INTO hr.staff_profile (
  tenant_id, legal_entity_id, campus_id, staff_id, person_ref,
  staff_number, display_name, work_email, employment_status, joined_on
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000056',
  '40000000-0000-4000-8000-000000000054',
  'T-MOB-001', 'Teacher Tester', 'teacher-work@example.test', 'active', current_date - 60
);

INSERT INTO academics.academic_year (
  tenant_id, academic_year_id, year_code, year_name, starts_on, ends_on, publication_state
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000060',
  'MOB-2026', 'Mobile 2026', current_date - 120, current_date + 120, 'published'
);

INSERT INTO academics.academic_term (
  tenant_id, term_id, academic_year_id, term_code, term_name, starts_on, ends_on, sequence_no
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000061',
  '40000000-0000-4000-8000-000000000060',
  'MOB-T1', 'Mobile Term', current_date - 60, current_date + 60, 1
);

INSERT INTO academics.curriculum_version (
  tenant_id, curriculum_version_id, curriculum_key, version_label, curriculum_name,
  effective_from, publication_state
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000062',
  'MOB-CURRICULUM', 'v1', 'Mobile Curriculum', current_date - 120, 'published'
);

INSERT INTO academics.course_version (
  tenant_id, course_version_id, course_key, version_label, curriculum_version_id,
  course_code, course_title, publication_state
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000063',
  'MOB-MATH', 'v1', '40000000-0000-4000-8000-000000000062',
  'MOB-MATH', 'Mobile Mathematics', 'published'
);

INSERT INTO academics.class_section (
  tenant_id, section_id, course_version_id, academic_year_id, term_id, campus_id,
  section_code, section_title, capacity, publication_state
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000064',
  '40000000-0000-4000-8000-000000000063',
  '40000000-0000-4000-8000-000000000060',
  '40000000-0000-4000-8000-000000000061',
  '40000000-0000-4000-8000-000000000003',
  'MOB-5A', 'Mobile Grade 5A', 30, 'published'
);

INSERT INTO academics.staff_assignment (
  tenant_id, assignment_id, section_id, staff_profile_id, assignment_role, effective_from, effective_to
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000065',
  '40000000-0000-4000-8000-000000000064',
  '40000000-0000-4000-8000-000000000056',
  'teacher', current_date - 30, current_date + 30
);

INSERT INTO academics.section_roster (
  tenant_id, roster_entry_id, section_id, student_profile_id, enrollment_id, joined_on
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000066',
  '40000000-0000-4000-8000-000000000064',
  '40000000-0000-4000-8000-000000000013',
  '40000000-0000-4000-8000-000000000014',
  current_date - 30
);

INSERT INTO scheduling.timetable_version (
  tenant_id, timetable_version_id, academic_year_id, term_id, campus_id,
  timetable_name, effective_from, effective_to, publication_state, idempotency_key
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000067',
  '40000000-0000-4000-8000-000000000060',
  '40000000-0000-4000-8000-000000000061',
  '40000000-0000-4000-8000-000000000003',
  'Mobile Timetable', current_date - 30, current_date + 30, 'published', 'mob05-timetable'
);

INSERT INTO scheduling.class_meeting_pattern (
  tenant_id, meeting_pattern_id, timetable_version_id, section_id, weekday,
  starts_at, ends_at, timezone, teacher_ids, student_ids, valid_from, valid_to
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000068',
  '40000000-0000-4000-8000-000000000067',
  '40000000-0000-4000-8000-000000000064',
  extract(dow from current_date)::smallint,
  '09:00', '10:00', 'Asia/Dhaka',
  '["40000000-0000-4000-8000-000000000056"]'::jsonb,
  '["40000000-0000-4000-8000-000000000013"]'::jsonb,
  current_date - 30, current_date + 30
);

INSERT INTO scheduling.scheduled_class_meeting (
  tenant_id, scheduled_meeting_id, timetable_version_id, meeting_pattern_id, section_id,
  local_date, starts_at, ends_at, timezone, teacher_ids, student_ids, meeting_status, version
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000069',
  '40000000-0000-4000-8000-000000000067',
  '40000000-0000-4000-8000-000000000068',
  '40000000-0000-4000-8000-000000000064',
  current_date, '09:00', '10:00', 'Asia/Dhaka',
  '["40000000-0000-4000-8000-000000000056"]'::jsonb,
  '["40000000-0000-4000-8000-000000000013"]'::jsonb,
  'scheduled', 1
);

INSERT INTO attendance.attendance_policy_version (
  tenant_id, policy_version_id, policy_key, version_label, late_after_minutes,
  chronic_absence_threshold_percent, publication_state
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000070',
  'MOB-ATT', 'v1', 10, 20, 'published'
);

INSERT INTO attendance.attendance_code (
  tenant_id, attendance_code_id, policy_version_id, code, label, meaning, counts_as_present
) VALUES
  ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000071', '40000000-0000-4000-8000-000000000070', 'P', 'Present', 'present', true),
  ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000072', '40000000-0000-4000-8000-000000000070', 'A', 'Absent', 'absent', false),
  ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000073', '40000000-0000-4000-8000-000000000070', 'L', 'Late', 'late', true),
  ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000074', '40000000-0000-4000-8000-000000000070', 'E', 'Excused', 'excused', false);

INSERT INTO gradebook.grading_policy_version (
  tenant_id, policy_version_id, policy_key, version_label, calculation_mode,
  missing_score_treatment, rounding_decimals, publication_state
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000075',
  'MOB-GRADE', 'v1', 'traditional', 'exclude', 2, 'published'
);

INSERT INTO gradebook.assessment_category (
  tenant_id, category_id, policy_version_id, category_code, category_label, weight_percent
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000076',
  '40000000-0000-4000-8000-000000000075',
  'QUIZ', 'Quiz', 100
);

INSERT INTO gradebook.assessment (
  tenant_id, assessment_id, section_id, reporting_period_id, policy_version_id, category_id,
  assessment_title, maximum_points, due_at, assessment_state, version
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000077',
  '40000000-0000-4000-8000-000000000064',
  '40000000-0000-4000-8000-000000000078',
  '40000000-0000-4000-8000-000000000075',
  '40000000-0000-4000-8000-000000000076',
  'Mobile Quiz', 100, clock_timestamp() + interval '1 day', 'draft', 1
);

DO $mob05_verify$
DECLARE
  attendance_pre_stale jsonb;
  attendance_accept jsonb;
  attendance_replay jsonb;
  attendance_idempotency_conflict jsonb;
  attendance_stale jsonb;
  attendance_denied jsonb;
  grade_pre_stale jsonb;
  grade_accept jsonb;
  grade_replay jsonb;
  grade_idempotency_conflict jsonb;
  grade_stale jsonb;
  grade_roster_denied jsonb;
  grade_locked jsonb;
  attendance_client_created_at timestamptz := clock_timestamp();
BEGIN
  attendance_pre_stale := platform.submit_mobile_teacher_attendance(
    'https://identity.school.test', 'provider-mobile-teacher-1',
    '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003',
    'attendance-idempotency-pre-stale', 'attendance-operation-pre-stale',
    '40000000-0000-4000-8000-000000000069', 0, attendance_client_created_at,
    '[{"studentId":"40000000-0000-4000-8000-000000000013","mark":"present"}]'::jsonb
  );
  IF attendance_pre_stale->>'status' <> 'conflict'
     OR attendance_pre_stale->>'reasonCode' <> 'revision-conflict' THEN
    RAISE EXCEPTION 'MOB-05 initial stale attendance revision was not rejected';
  END IF;
  IF EXISTS (
    SELECT 1 FROM attendance.attendance_session
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND scheduled_meeting_id = '40000000-0000-4000-8000-000000000069'
  ) THEN
    RAISE EXCEPTION 'MOB-05 initial stale attendance request mutated session state';
  END IF;

  attendance_accept := platform.submit_mobile_teacher_attendance(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'attendance-idempotency-0001',
    'attendance-operation-0001',
    '40000000-0000-4000-8000-000000000069',
    1,
    attendance_client_created_at,
    '[{"studentId":"40000000-0000-4000-8000-000000000013","mark":"present"}]'::jsonb
  );
  IF attendance_accept->>'status' <> 'accepted'
     OR (attendance_accept->>'acceptedRevision')::bigint <> 2 THEN
    RAISE EXCEPTION 'MOB-05 attendance write was not accepted: %', attendance_accept;
  END IF;

  attendance_replay := platform.submit_mobile_teacher_attendance(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'attendance-idempotency-0001',
    'attendance-operation-0001',
    '40000000-0000-4000-8000-000000000069',
    1,
    attendance_client_created_at,
    '[{"studentId":"40000000-0000-4000-8000-000000000013","mark":"present"}]'::jsonb
  );
  IF attendance_replay <> attendance_accept THEN
    RAISE EXCEPTION 'MOB-05 attendance replay changed receipt';
  END IF;

  attendance_idempotency_conflict := platform.submit_mobile_teacher_attendance(
    'https://identity.school.test', 'provider-mobile-teacher-1',
    '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003',
    'attendance-idempotency-0001', 'attendance-operation-0001',
    '40000000-0000-4000-8000-000000000069', 1, clock_timestamp(),
    '[{"studentId":"40000000-0000-4000-8000-000000000013","mark":"absent"}]'::jsonb
  );
  IF attendance_idempotency_conflict->>'status' <> 'conflict' THEN
    RAISE EXCEPTION 'MOB-05 changed attendance idempotency did not conflict';
  END IF;

  attendance_stale := platform.submit_mobile_teacher_attendance(
    'https://identity.school.test', 'provider-mobile-teacher-1',
    '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003',
    'attendance-idempotency-0002', 'attendance-operation-0002',
    '40000000-0000-4000-8000-000000000069', 1, clock_timestamp(),
    '[{"studentId":"40000000-0000-4000-8000-000000000013","mark":"absent"}]'::jsonb
  );
  IF attendance_stale->>'status' <> 'conflict'
     OR attendance_stale->>'reasonCode' <> 'revision-conflict' THEN
    RAISE EXCEPTION 'MOB-05 stale attendance revision was not rejected';
  END IF;

  IF (SELECT session_state FROM attendance.attendance_session
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND scheduled_meeting_id = '40000000-0000-4000-8000-000000000069') <> 'open' THEN
    RAISE EXCEPTION 'MOB-05 attendance write finalized the session';
  END IF;
  IF EXISTS (
    SELECT 1 FROM attendance.attendance_finalization
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'MOB-05 attendance write created finalization evidence';
  END IF;

  attendance_denied := platform.submit_mobile_teacher_attendance(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003',
    'attendance-idempotency-0003', 'attendance-operation-0003',
    '40000000-0000-4000-8000-000000000069', 2, clock_timestamp(),
    '[{"studentId":"40000000-0000-4000-8000-000000000013","mark":"present"}]'::jsonb
  );
  IF attendance_denied IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-05 non-teacher identity received attendance authority';
  END IF;

  grade_pre_stale := platform.save_mobile_teacher_grade_draft(
    'https://identity.school.test', 'provider-mobile-teacher-1',
    '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003',
    'grade-idempotency-pre-stale', 'grade-operation-pre-stale',
    '40000000-0000-4000-8000-000000000077', 0, 100, 10000,
    '[{"studentId":"40000000-0000-4000-8000-000000000013","status":"scored","scoreUnits":8750}]'::jsonb
  );
  IF grade_pre_stale->>'status' <> 'conflict'
     OR grade_pre_stale->>'reasonCode' <> 'revision-conflict' THEN
    RAISE EXCEPTION 'MOB-05 initial stale grade revision was not rejected';
  END IF;
  IF EXISTS (
    SELECT 1 FROM platform.mobile_teacher_grade_revision
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND assessment_id = '40000000-0000-4000-8000-000000000077'
  ) OR EXISTS (
    SELECT 1 FROM gradebook.assessment_result
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND assessment_id = '40000000-0000-4000-8000-000000000077'
  ) THEN
    RAISE EXCEPTION 'MOB-05 initial stale grade request mutated draft state';
  END IF;

  grade_accept := platform.save_mobile_teacher_grade_draft(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'grade-idempotency-0001',
    'grade-operation-0001',
    '40000000-0000-4000-8000-000000000077',
    1,
    100,
    10000,
    '[{"studentId":"40000000-0000-4000-8000-000000000013","status":"scored","scoreUnits":8750}]'::jsonb
  );
  IF grade_accept->>'status' <> 'accepted'
     OR (grade_accept->>'acceptedRevision')::bigint <> 2 THEN
    RAISE EXCEPTION 'MOB-05 grade draft was not accepted: %', grade_accept;
  END IF;
  IF (SELECT raw_score FROM gradebook.assessment_result
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND assessment_id = '40000000-0000-4000-8000-000000000077'
        AND student_profile_id = '40000000-0000-4000-8000-000000000013') <> 87.5 THEN
    RAISE EXCEPTION 'MOB-05 grade score did not preserve integer scale conversion';
  END IF;
  IF (SELECT assessment_state FROM gradebook.assessment
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND assessment_id = '40000000-0000-4000-8000-000000000077') <> 'draft' THEN
    RAISE EXCEPTION 'MOB-05 grade write published or closed the assessment';
  END IF;

  grade_replay := platform.save_mobile_teacher_grade_draft(
    'https://identity.school.test', 'provider-mobile-teacher-1',
    '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003',
    'grade-idempotency-0001', 'grade-operation-0001',
    '40000000-0000-4000-8000-000000000077', 1, 100, 10000,
    '[{"studentId":"40000000-0000-4000-8000-000000000013","status":"scored","scoreUnits":8750}]'::jsonb
  );
  IF grade_replay <> grade_accept THEN
    RAISE EXCEPTION 'MOB-05 grade replay changed receipt';
  END IF;

  grade_idempotency_conflict := platform.save_mobile_teacher_grade_draft(
    'https://identity.school.test', 'provider-mobile-teacher-1',
    '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003',
    'grade-idempotency-0001', 'grade-operation-0001',
    '40000000-0000-4000-8000-000000000077', 1, 100, 10000,
    '[{"studentId":"40000000-0000-4000-8000-000000000013","status":"scored","scoreUnits":8000}]'::jsonb
  );
  IF grade_idempotency_conflict->>'status' <> 'conflict' THEN
    RAISE EXCEPTION 'MOB-05 changed grade idempotency did not conflict';
  END IF;

  grade_stale := platform.save_mobile_teacher_grade_draft(
    'https://identity.school.test', 'provider-mobile-teacher-1',
    '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003',
    'grade-idempotency-0002', 'grade-operation-0002',
    '40000000-0000-4000-8000-000000000077', 1, 100, 10000,
    '[{"studentId":"40000000-0000-4000-8000-000000000013","status":"scored","scoreUnits":8000}]'::jsonb
  );
  IF grade_stale->>'status' <> 'conflict'
     OR grade_stale->>'reasonCode' <> 'revision-conflict' THEN
    RAISE EXCEPTION 'MOB-05 stale grade revision was not rejected';
  END IF;

  grade_roster_denied := platform.save_mobile_teacher_grade_draft(
    'https://identity.school.test', 'provider-mobile-teacher-1',
    '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003',
    'grade-idempotency-0003', 'grade-operation-0003',
    '40000000-0000-4000-8000-000000000077', 2, 100, 10000,
    '[{"studentId":"40000000-0000-4000-8000-000000000099","status":"missing"}]'::jsonb
  );
  IF grade_roster_denied->>'status' <> 'rejected'
     OR grade_roster_denied->>'reasonCode' <> 'roster-mismatch' THEN
    RAISE EXCEPTION 'MOB-05 foreign grade roster entry was not rejected';
  END IF;

  INSERT INTO gradebook.gradebook_lock (
    tenant_id,
    lock_id,
    section_id,
    reporting_period_id,
    lock_state,
    locked_by,
    locked_at
  ) VALUES (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000079',
    '40000000-0000-4000-8000-000000000064',
    '40000000-0000-4000-8000-000000000078',
    'locked',
    '40000000-0000-4000-8000-000000000056',
    clock_timestamp()
  );

  grade_locked := platform.save_mobile_teacher_grade_draft(
    'https://identity.school.test', 'provider-mobile-teacher-1',
    '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003',
    'grade-idempotency-0004', 'grade-operation-0004',
    '40000000-0000-4000-8000-000000000077', 2, 100, 10000,
    '[{"studentId":"40000000-0000-4000-8000-000000000013","status":"scored","scoreUnits":8000}]'::jsonb
  );
  IF grade_locked->>'status' <> 'conflict'
     OR grade_locked->>'reasonCode' <> 'gradebook-locked'
     OR (grade_locked->>'acceptedRevision')::bigint <> 2 THEN
    RAISE EXCEPTION 'MOB-05 locked gradebook write was not rejected: %', grade_locked;
  END IF;
  IF (SELECT raw_score FROM gradebook.assessment_result
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND assessment_id = '40000000-0000-4000-8000-000000000077'
        AND student_profile_id = '40000000-0000-4000-8000-000000000013') <> 87.5 THEN
    RAISE EXCEPTION 'MOB-05 locked gradebook write mutated assessment result';
  END IF;
  IF (SELECT revision FROM platform.mobile_teacher_grade_revision
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND assessment_id = '40000000-0000-4000-8000-000000000077') <> 2 THEN
    RAISE EXCEPTION 'MOB-05 locked gradebook write mutated mobile grade revision';
  END IF;

  IF has_function_privilege(
    'public',
    'platform.submit_mobile_teacher_attendance(text,text,uuid,uuid,text,text,uuid,bigint,timestamp with time zone,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC must not execute MOB-05 attendance write';
  END IF;
  IF NOT has_function_privilege(
    'app_runtime',
    'platform.submit_mobile_teacher_attendance(text,text,uuid,uuid,text,text,uuid,bigint,timestamp with time zone,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'app_runtime must execute MOB-05 attendance write';
  END IF;
  IF has_function_privilege(
    'public',
    'platform.save_mobile_teacher_grade_draft(text,text,uuid,uuid,text,text,uuid,bigint,integer,bigint,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC must not execute MOB-05 grade write';
  END IF;
  IF NOT has_function_privilege(
    'app_runtime',
    'platform.save_mobile_teacher_grade_draft(text,text,uuid,uuid,text,text,uuid,bigint,integer,bigint,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'app_runtime must execute MOB-05 grade write';
  END IF;
  IF has_function_privilege(
    'app_runtime',
    'platform.resolve_mobile_teacher_write_authority(text,text,uuid,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'app_runtime must not execute MOB-05 internal authority helper directly';
  END IF;
END
$mob05_verify$;
