DO $schema_guard$
BEGIN
  BEGIN
    INSERT INTO platform.mobile_family_form_request (
      tenant_id, form_id, student_profile_id, title, schema_version, fields
    ) VALUES (
      '40000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000590',
      '40000000-0000-4000-8000-000000000013',
      'Invalid numeric field id',
      1,
      '[{"fieldId":42,"label":"Bad","type":"text","required":true,"options":[]}]'::jsonb
    );
    RAISE EXCEPTION 'MOB-06B accepted a non-string form field id';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO platform.mobile_family_form_request (
      tenant_id, form_id, student_profile_id, title, schema_version, fields
    ) VALUES (
      '40000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000591',
      '40000000-0000-4000-8000-000000000013',
      'Invalid numeric choice option',
      1,
      '[{"fieldId":"choice","label":"Bad","type":"singleChoice","required":true,"options":[42]}]'::jsonb
    );
    RAISE EXCEPTION 'MOB-06B accepted a non-string choice option';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END
$schema_guard$;

INSERT INTO people.person (tenant_id, person_id, status)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000900',
  'active'
);

INSERT INTO student_lifecycle.student_profile (
  tenant_id, student_profile_id, person_id, status
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000901',
  '40000000-0000-4000-8000-000000000900',
  'active'
);

INSERT INTO student_lifecycle.enrollment (
  tenant_id, enrollment_id, student_profile_id, campus_id, program_id,
  academic_year_id, status, effective_from, idempotency_key
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000902',
  '40000000-0000-4000-8000-000000000901',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000015',
  '40000000-0000-4000-8000-000000000016',
  'active', current_date - 10, 'mobile-family-forms-unowned-student'
);

INSERT INTO platform.mobile_family_form_request (
  tenant_id, form_id, student_profile_id, title, status, due_at,
  schema_version, fields, version
) VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000600',
    '40000000-0000-4000-8000-000000000013',
    'Emergency contact update',
    'open',
    clock_timestamp() + interval '1 day',
    2,
    '[
      {"fieldId":"contact_name","label":"Contact name","type":"text","required":true,"options":[]},
      {"fieldId":"pickup_permission","label":"Pickup permission","type":"singleChoice","required":true,"options":["allowed","not_allowed"]},
      {"fieldId":"confirmed","label":"Confirmed","type":"boolean","required":false,"options":[]},
      {"fieldId":"effective_date","label":"Effective date","type":"date","required":false,"options":[]}
    ]'::jsonb,
    4
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000601',
    '40000000-0000-4000-8000-000000000013',
    'Expired update',
    'open',
    clock_timestamp() - interval '1 minute',
    1,
    '[{"fieldId":"note","label":"Note","type":"text","required":false,"options":[]}]'::jsonb,
    1
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000602',
    '40000000-0000-4000-8000-000000000013',
    'Authority revocation form',
    'open',
    clock_timestamp() + interval '1 day',
    1,
    '[{"fieldId":"note","label":"Note","type":"text","required":false,"options":[]}]'::jsonb,
    1
  );

INSERT INTO platform.mobile_family_consent_request (
  tenant_id, consent_id, student_profile_id, title, policy_version, purpose,
  status, due_at, version
) VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000700',
    '40000000-0000-4000-8000-000000000013',
    'Trip consent',
    'trip-policy-2026.2',
    'school-trip-2026',
    'pending',
    clock_timestamp() + interval '1 day',
    1
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000701',
    '40000000-0000-4000-8000-000000000013',
    'Photo consent',
    'photo-policy-2026.1',
    'school-photo-2026',
    'pending',
    clock_timestamp() + interval '1 day',
    1
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000702',
    '40000000-0000-4000-8000-000000000013',
    'Expired consent',
    'expired-policy-2026.1',
    'expired-purpose-2026',
    'pending',
    clock_timestamp() - interval '1 minute',
    1
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000703',
    '40000000-0000-4000-8000-000000000013',
    'Authority revocation consent',
    'revocation-policy-2026.1',
    'revocation-purpose-2026',
    'pending',
    clock_timestamp() + interval '1 day',
    1
  );

DO $mob06b_verify$
DECLARE
  forms_payload jsonb;
  form_payload jsonb;
  form_schema_mismatch jsonb;
  form_stale jsonb;
  form_invalid_answers jsonb;
  form_accepted jsonb;
  form_retry jsonb;
  form_idempotency_conflict jsonb;
  form_expired jsonb;
  consents_payload jsonb;
  consent_policy_mismatch jsonb;
  consent_granted jsonb;
  consent_retry jsonb;
  consent_idempotency_conflict jsonb;
  consent_declined jsonb;
  consent_expired jsonb;
  canonical_before integer;
  canonical_after integer;
BEGIN
  forms_payload := platform.resolve_mobile_family_forms(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000013'
  );

  IF forms_payload IS NULL
     OR jsonb_array_length(forms_payload->'forms') <> 3
     OR NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(forms_payload->'forms') AS form_row(value)
       WHERE value->>'formId' = '40000000-0000-4000-8000-000000000600'
         AND value->>'status' = 'open'
     )
     OR NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(forms_payload->'forms') AS form_row(value)
       WHERE value->>'formId' = '40000000-0000-4000-8000-000000000601'
         AND value->>'status' = 'closed'
     ) THEN
    RAISE EXCEPTION 'MOB-06B Family form list was invalid: %', forms_payload;
  END IF;

  IF platform.resolve_mobile_family_forms(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'student',
    '40000000-0000-4000-8000-000000000013'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06B student persona unexpectedly received guardian-only forms';
  END IF;

  form_payload := platform.resolve_mobile_family_form(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000600'
  );
  IF form_payload->>'formId' <> '40000000-0000-4000-8000-000000000600'
     OR (form_payload->>'baseVersion')::bigint <> 4
     OR (form_payload->>'schemaVersion')::integer <> 2
     OR jsonb_array_length(form_payload->'fields') <> 4
     OR form_payload ?| ARRAY['studentProfileId', 'requestDigest', 'submittedByPersonId'] THEN
    RAISE EXCEPTION 'MOB-06B Family form definition was invalid or leaked internals: %', form_payload;
  END IF;

  form_schema_mismatch := platform.submit_mobile_family_form(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000600',
    '40000000-0000-4000-8000-000000000013',
    1, 4,
    '{"contact_name":"Guardian","pickup_permission":"allowed"}'::jsonb,
    'family-form-db-idempotency-0001'
  );
  IF form_schema_mismatch <> jsonb_build_object('status', 'schema-mismatch') THEN
    RAISE EXCEPTION 'MOB-06B schema mismatch was not rejected: %', form_schema_mismatch;
  END IF;

  form_stale := platform.submit_mobile_family_form(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000600',
    '40000000-0000-4000-8000-000000000013',
    2, 3,
    '{"contact_name":"Guardian","pickup_permission":"allowed"}'::jsonb,
    'family-form-db-idempotency-0002'
  );
  IF form_stale <> jsonb_build_object('status', 'stale') THEN
    RAISE EXCEPTION 'MOB-06B stale form revision was not rejected: %', form_stale;
  END IF;

  form_invalid_answers := platform.submit_mobile_family_form(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000600',
    '40000000-0000-4000-8000-000000000013',
    2, 4,
    '{"contact_name":"Guardian","pickup_permission":"invalid-choice"}'::jsonb,
    'family-form-db-idempotency-0003'
  );
  IF form_invalid_answers <> jsonb_build_object('status', 'invalid-answers') THEN
    RAISE EXCEPTION 'MOB-06B invalid form answers were not rejected: %', form_invalid_answers;
  END IF;

  IF (SELECT version FROM platform.mobile_family_form_request
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND form_id = '40000000-0000-4000-8000-000000000600') <> 4
     OR EXISTS (
       SELECT 1 FROM platform.mobile_family_form_submission
       WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
         AND form_id = '40000000-0000-4000-8000-000000000600'
     ) THEN
    RAISE EXCEPTION 'MOB-06B rejected form submissions mutated canonical form state';
  END IF;

  form_accepted := platform.submit_mobile_family_form(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000600',
    '40000000-0000-4000-8000-000000000013',
    2, 4,
    '{"contact_name":"Guardian","pickup_permission":"allowed","confirmed":true,"effective_date":"2026-09-02"}'::jsonb,
    'family-form-db-idempotency-0004'
  );
  IF form_accepted <> jsonb_build_object('acceptedRevision', 5) THEN
    RAISE EXCEPTION 'MOB-06B valid form submission was not accepted: %', form_accepted;
  END IF;

  IF (SELECT status FROM platform.mobile_family_form_request
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND form_id = '40000000-0000-4000-8000-000000000600') <> 'submitted'
     OR (SELECT version FROM platform.mobile_family_form_request
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND form_id = '40000000-0000-4000-8000-000000000600') <> 5
     OR (SELECT count(*) FROM platform.mobile_family_form_submission
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND form_id = '40000000-0000-4000-8000-000000000600') <> 1
     OR (SELECT submitted_by_person_id FROM platform.mobile_family_form_submission
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND form_id = '40000000-0000-4000-8000-000000000600')
        <> '40000000-0000-4000-8000-000000000009'::uuid THEN
    RAISE EXCEPTION 'MOB-06B valid form submission did not persist exact guardian authority/revision';
  END IF;

  form_retry := platform.submit_mobile_family_form(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000600',
    '40000000-0000-4000-8000-000000000013',
    2, 4,
    '{"contact_name":"Guardian","pickup_permission":"allowed","confirmed":true,"effective_date":"2026-09-02"}'::jsonb,
    'family-form-db-idempotency-0004'
  );
  IF form_retry <> form_accepted THEN
    RAISE EXCEPTION 'MOB-06B exact form replay changed accepted revision';
  END IF;

  BEGIN
    UPDATE platform.mobile_family_form_request
    SET student_profile_id = '40000000-0000-4000-8000-000000000901'
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND form_id = '40000000-0000-4000-8000-000000000600';
    RAISE EXCEPTION 'MOB-06B allowed completed form identity reassignment';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
  IF (SELECT student_profile_id FROM platform.mobile_family_form_request
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND form_id = '40000000-0000-4000-8000-000000000600')
     <> '40000000-0000-4000-8000-000000000013'::uuid THEN
    RAISE EXCEPTION 'MOB-06B completed form identity changed despite immutability guard';
  END IF;

  form_idempotency_conflict := platform.submit_mobile_family_form(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000600',
    '40000000-0000-4000-8000-000000000013',
    2, 4,
    '{"contact_name":"Changed","pickup_permission":"allowed","confirmed":true,"effective_date":"2026-09-02"}'::jsonb,
    'family-form-db-idempotency-0004'
  );
  IF form_idempotency_conflict <> jsonb_build_object('status', 'idempotency-conflict') THEN
    RAISE EXCEPTION 'MOB-06B changed form idempotency reuse did not conflict';
  END IF;

  form_expired := platform.submit_mobile_family_form(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000601',
    '40000000-0000-4000-8000-000000000013',
    1, 1, '{}'::jsonb,
    'family-form-db-idempotency-0005'
  );
  IF form_expired <> jsonb_build_object('status', 'closed') THEN
    RAISE EXCEPTION 'MOB-06B expired form remained submit-able';
  END IF;

  consents_payload := platform.resolve_mobile_family_consents(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000013'
  );
  IF consents_payload IS NULL
     OR jsonb_array_length(consents_payload->'consents') <> 4
     OR NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(consents_payload->'consents') AS consent_row(value)
       WHERE value->>'consentId' = '40000000-0000-4000-8000-000000000702'
         AND value->>'status' = 'expired'
     ) THEN
    RAISE EXCEPTION 'MOB-06B consent list did not expose derived expired state: %', consents_payload;
  END IF;

  BEGIN
    UPDATE platform.mobile_family_consent_request
    SET purpose = 'changed-without-policy-version'
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND consent_id = '40000000-0000-4000-8000-000000000703';
    RAISE EXCEPTION 'MOB-06B allowed consent purpose drift without policy version change';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE platform.mobile_family_consent_request
    SET student_profile_id = '40000000-0000-4000-8000-000000000901'
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND consent_id = '40000000-0000-4000-8000-000000000703';
    RAISE EXCEPTION 'MOB-06B allowed pending consent reassignment without revision advance';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  IF (SELECT purpose FROM platform.mobile_family_consent_request
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND consent_id = '40000000-0000-4000-8000-000000000703') <> 'revocation-purpose-2026'
     OR (SELECT student_profile_id FROM platform.mobile_family_consent_request
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND consent_id = '40000000-0000-4000-8000-000000000703')
        <> '40000000-0000-4000-8000-000000000013'::uuid THEN
    RAISE EXCEPTION 'MOB-06B pending consent authoring guards did not preserve state';
  END IF;

  SELECT count(*) INTO canonical_before
  FROM people.consent_record
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001';

  consent_policy_mismatch := platform.decide_mobile_family_consent(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000700',
    '40000000-0000-4000-8000-000000000013',
    'wrong-policy', 'grant', 'family-consent-db-idempotency-0001'
  );
  IF consent_policy_mismatch <> jsonb_build_object('status', 'policy-mismatch') THEN
    RAISE EXCEPTION 'MOB-06B consent policy mismatch was not rejected';
  END IF;

  consent_granted := platform.decide_mobile_family_consent(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000700',
    '40000000-0000-4000-8000-000000000013',
    'trip-policy-2026.2', 'grant', 'family-consent-db-idempotency-0002'
  );
  IF consent_granted <> jsonb_build_object('acceptedRevision', 2) THEN
    RAISE EXCEPTION 'MOB-06B guardian consent grant was not accepted: %', consent_granted;
  END IF;

  SELECT count(*) INTO canonical_after
  FROM people.consent_record
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001';
  IF canonical_after <> canonical_before + 1
     OR NOT EXISTS (
       SELECT 1
       FROM people.consent_record AS consent
       WHERE consent.tenant_id = '40000000-0000-4000-8000-000000000001'
         AND consent.consent_id = (
           SELECT canonical_consent_id
           FROM platform.mobile_family_consent_request
           WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
             AND consent_id = '40000000-0000-4000-8000-000000000700'
         )
         AND consent.subject_person_id = '40000000-0000-4000-8000-000000000010'
         AND consent.granted_by_person_id = '40000000-0000-4000-8000-000000000009'
         AND consent.purpose = 'school-trip-2026'
         AND consent.status = 'granted'
     ) THEN
    RAISE EXCEPTION 'MOB-06B grant did not append exact canonical people.consent_record evidence';
  END IF;

  consent_retry := platform.decide_mobile_family_consent(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000700',
    '40000000-0000-4000-8000-000000000013',
    'trip-policy-2026.2', 'grant', 'family-consent-db-idempotency-0002'
  );
  IF consent_retry <> consent_granted THEN
    RAISE EXCEPTION 'MOB-06B exact consent replay changed accepted revision';
  END IF;
  IF (SELECT count(*) FROM people.consent_record
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001') <> canonical_after THEN
    RAISE EXCEPTION 'MOB-06B consent replay duplicated canonical grant evidence';
  END IF;

  BEGIN
    UPDATE platform.mobile_family_consent_request
    SET student_profile_id = '40000000-0000-4000-8000-000000000901'
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND consent_id = '40000000-0000-4000-8000-000000000700';
    RAISE EXCEPTION 'MOB-06B allowed decided consent identity reassignment';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
  IF (SELECT student_profile_id FROM platform.mobile_family_consent_request
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND consent_id = '40000000-0000-4000-8000-000000000700')
     <> '40000000-0000-4000-8000-000000000013'::uuid THEN
    RAISE EXCEPTION 'MOB-06B decided consent identity changed despite immutability guard';
  END IF;

  consent_idempotency_conflict := platform.decide_mobile_family_consent(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000700',
    '40000000-0000-4000-8000-000000000013',
    'trip-policy-2026.2', 'decline', 'family-consent-db-idempotency-0002'
  );
  IF consent_idempotency_conflict <> jsonb_build_object('status', 'idempotency-conflict') THEN
    RAISE EXCEPTION 'MOB-06B changed consent idempotency reuse did not conflict';
  END IF;

  consent_declined := platform.decide_mobile_family_consent(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000701',
    '40000000-0000-4000-8000-000000000013',
    'photo-policy-2026.1', 'decline', 'family-consent-db-idempotency-0003'
  );
  IF consent_declined <> jsonb_build_object('acceptedRevision', 2)
     OR (SELECT status FROM platform.mobile_family_consent_request
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND consent_id = '40000000-0000-4000-8000-000000000701') <> 'declined'
     OR (SELECT canonical_consent_id FROM platform.mobile_family_consent_request
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND consent_id = '40000000-0000-4000-8000-000000000701') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM people.consent_record
       WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
         AND purpose = 'school-photo-2026'
     ) THEN
    RAISE EXCEPTION 'MOB-06B decline incorrectly created canonical granted-consent evidence';
  END IF;

  consent_expired := platform.decide_mobile_family_consent(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000702',
    '40000000-0000-4000-8000-000000000013',
    'expired-policy-2026.1', 'grant', 'family-consent-db-idempotency-0004'
  );
  IF consent_expired <> jsonb_build_object('status', 'closed') THEN
    RAISE EXCEPTION 'MOB-06B expired consent remained decidable';
  END IF;

  UPDATE people.guardian_student_authority
  SET portal_access = false
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND authority_id = '40000000-0000-4000-8000-000000000017';

  IF platform.resolve_mobile_family_forms(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000013'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06B revoked guardian still read Family forms';
  END IF;

  IF platform.submit_mobile_family_form(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000602',
    '40000000-0000-4000-8000-000000000013',
    1, 1, '{}', 'family-form-db-idempotency-0006'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06B revoked guardian still submitted a Family form';
  END IF;

  IF platform.decide_mobile_family_consent(
    'https://identity.school.test', 'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003', 'guardian',
    '40000000-0000-4000-8000-000000000703',
    '40000000-0000-4000-8000-000000000013',
    'revocation-policy-2026.1', 'grant', 'family-consent-db-idempotency-0005'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06B revoked guardian still decided a Family consent';
  END IF;

  IF (SELECT status FROM platform.mobile_family_form_request
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND form_id = '40000000-0000-4000-8000-000000000602') <> 'open'
     OR (SELECT status FROM platform.mobile_family_consent_request
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND consent_id = '40000000-0000-4000-8000-000000000703') <> 'pending' THEN
    RAISE EXCEPTION 'MOB-06B revoked authority denial mutated pending work';
  END IF;

  UPDATE people.guardian_student_authority
  SET portal_access = true
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND authority_id = '40000000-0000-4000-8000-000000000017';

  IF has_function_privilege('public', 'platform.resolve_mobile_family_forms(text,text,uuid,uuid,text,uuid)', 'EXECUTE')
     OR has_function_privilege('public', 'platform.resolve_mobile_family_form(text,text,uuid,uuid,text,uuid)', 'EXECUTE')
     OR has_function_privilege('public', 'platform.submit_mobile_family_form(text,text,uuid,uuid,text,uuid,uuid,integer,bigint,jsonb,text)', 'EXECUTE')
     OR has_function_privilege('public', 'platform.resolve_mobile_family_consents(text,text,uuid,uuid,text,uuid)', 'EXECUTE')
     OR has_function_privilege('public', 'platform.decide_mobile_family_consent(text,text,uuid,uuid,text,uuid,uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PUBLIC received MOB-06B API function authority';
  END IF;

  IF NOT has_function_privilege('app_runtime', 'platform.resolve_mobile_family_forms(text,text,uuid,uuid,text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('app_runtime', 'platform.resolve_mobile_family_form(text,text,uuid,uuid,text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('app_runtime', 'platform.submit_mobile_family_form(text,text,uuid,uuid,text,uuid,uuid,integer,bigint,jsonb,text)', 'EXECUTE')
     OR NOT has_function_privilege('app_runtime', 'platform.resolve_mobile_family_consents(text,text,uuid,uuid,text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('app_runtime', 'platform.decide_mobile_family_consent(text,text,uuid,uuid,text,uuid,uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'app_runtime is missing MOB-06B API function authority';
  END IF;

  IF has_function_privilege('app_runtime', 'platform.resolve_mobile_family_interaction_authority(text,text,uuid,uuid,text)', 'EXECUTE')
     OR has_function_privilege('app_runtime', 'platform.mobile_family_form_fields_are_valid(jsonb)', 'EXECUTE')
     OR has_function_privilege('app_runtime', 'platform.mobile_family_form_answers_are_valid(jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('app_runtime', 'platform.enforce_mobile_family_form_request()', 'EXECUTE')
     OR has_function_privilege('app_runtime', 'platform.enforce_mobile_family_consent_request()', 'EXECUTE') THEN
    RAISE EXCEPTION 'app_runtime received MOB-06B internal helper authority';
  END IF;

  IF has_table_privilege('app_runtime', 'platform.mobile_family_form_request', 'SELECT')
     OR has_table_privilege('app_runtime', 'platform.mobile_family_form_submission', 'SELECT')
     OR has_table_privilege('app_runtime', 'platform.mobile_family_form_command', 'SELECT')
     OR has_table_privilege('app_runtime', 'platform.mobile_family_consent_request', 'SELECT')
     OR has_table_privilege('app_runtime', 'platform.mobile_family_consent_command', 'SELECT')
     OR has_table_privilege('app_runtime', 'platform.mobile_family_form_submission', 'INSERT')
     OR has_table_privilege('app_runtime', 'platform.mobile_family_consent_request', 'UPDATE') THEN
    RAISE EXCEPTION 'app_runtime received direct MOB-06B table authority';
  END IF;
END
$mob06b_verify$;
