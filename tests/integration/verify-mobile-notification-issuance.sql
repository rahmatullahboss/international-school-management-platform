DO $mob07_verify$
DECLARE
  guardian_device_one jsonb;
  guardian_device_two jsonb;
  guardian_device_three jsonb;
  teacher_device jsonb;
  queued_result jsonb;
  replay_result jsonb;
  conflict_result jsonb;
  production_result jsonb;
  preference_result jsonb;
  form_result jsonb;
  authority_result jsonb;
  authority_replay jsonb;
  staff_result jsonb;
  expires_at timestamptz := date_trunc('milliseconds', clock_timestamp()) + interval '2 hours';
  queued_notification_id uuid;
  form_notification_id uuid;
  authority_notification_id uuid;
BEGIN
  guardian_device_one := platform.register_mobile_device_session(
    'https://identity.school.test',
    'provider-mobile-user-1',
    'notification-device-register-0001',
    'notify_guardian_dev_0001',
    'family',
    'android',
    '0.1.0+7',
    'firebase',
    'development',
    repeat('a', 64)
  );
  guardian_device_two := platform.register_mobile_device_session(
    'https://identity.school.test',
    'provider-mobile-user-1',
    'notification-device-register-0002',
    'notify_guardian_dev_0002',
    'family',
    'ios',
    '0.1.0+7',
    'apns',
    'development',
    repeat('b', 64)
  );
  IF guardian_device_one IS NULL OR guardian_device_two IS NULL THEN
    RAISE EXCEPTION 'MOB-07 could not establish isolated guardian device fixtures';
  END IF;

  queued_result := platform.issue_mobile_notification(
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004',
    'family',
    'guardian',
    'familyConversation',
    '40000000-0000-4000-8000-000000000810',
    'development',
    'mob07-conversation-queue-0001',
    expires_at
  );
  IF queued_result IS NULL
     OR queued_result->>'status' <> 'queued'
     OR (queued_result->>'targetCount')::integer <> 2 THEN
    RAISE EXCEPTION 'MOB-07 did not queue the exact active Family device set: %', queued_result;
  END IF;
  queued_notification_id := (queued_result->>'notificationId')::uuid;

  IF (SELECT count(*) FROM platform.mobile_notification_outbox
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND notification_id = queued_notification_id
        AND status = 'pending') <> 2 THEN
    RAISE EXCEPTION 'MOB-07 did not create one provider-neutral target per active device';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM integration_core.notification_delivery
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND notification_key = 'mobile:mob07-conversation-queue-0001'
      AND recipient_id = '40000000-0000-4000-8000-000000000004'
      AND channel = 'push'
      AND template_key = 'mobile.data-only.family'
      AND locale = 'und'
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'MOB-07 shared notification delivery evidence is missing or widened';
  END IF;

  replay_result := platform.issue_mobile_notification(
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004',
    'family',
    'guardian',
    'familyConversation',
    '40000000-0000-4000-8000-000000000810',
    'development',
    'mob07-conversation-queue-0001',
    expires_at
  );
  IF replay_result <> queued_result THEN
    RAISE EXCEPTION 'MOB-07 exact issuance replay changed its receipt';
  END IF;

  conflict_result := platform.issue_mobile_notification(
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004',
    'family',
    'guardian',
    'familyHome',
    NULL,
    'development',
    'mob07-conversation-queue-0001',
    expires_at
  );
  IF conflict_result <> jsonb_build_object('status', 'idempotency-conflict') THEN
    RAISE EXCEPTION 'MOB-07 changed notification-key reuse did not conflict: %', conflict_result;
  END IF;

  PERFORM platform.revoke_mobile_device_session(
    'https://identity.school.test',
    'provider-mobile-user-1',
    'notification-device-revoke-0001',
    (guardian_device_one->>'deviceSessionId')::uuid
  );
  IF (SELECT target_count FROM platform.mobile_notification_issuance
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND notification_id = queued_notification_id) <> 1
     OR (SELECT status FROM platform.mobile_notification_issuance
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND notification_id = queued_notification_id) <> 'queued' THEN
    RAISE EXCEPTION 'MOB-07 first device revoke did not preserve the remaining target';
  END IF;

  PERFORM platform.revoke_mobile_device_session(
    'https://identity.school.test',
    'provider-mobile-user-1',
    'notification-device-revoke-0002',
    (guardian_device_two->>'deviceSessionId')::uuid
  );
  IF NOT EXISTS (
    SELECT 1
    FROM platform.mobile_notification_issuance
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND notification_id = queued_notification_id
      AND status = 'suppressed'
      AND suppression_reason = 'no-active-device'
      AND target_count = 0
  ) THEN
    RAISE EXCEPTION 'MOB-07 final device revoke did not suppress the exhausted issuance';
  END IF;
  IF (SELECT count(*) FROM platform.mobile_notification_outbox
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND notification_id = queued_notification_id
        AND status = 'suppressed'
        AND suppression_reason = 'device-revoked') <> 2 THEN
    RAISE EXCEPTION 'MOB-07 device revoke did not retain suppressed per-device evidence';
  END IF;
  IF (SELECT status FROM integration_core.notification_delivery
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND notification_key = 'mobile:mob07-conversation-queue-0001') <> 'suppressed' THEN
    RAISE EXCEPTION 'MOB-07 device exhaustion did not suppress shared delivery evidence';
  END IF;

  guardian_device_three := platform.register_mobile_device_session(
    'https://identity.school.test',
    'provider-mobile-user-1',
    'notification-device-register-0003',
    'notify_guardian_dev_0003',
    'family',
    'android',
    '0.1.0+8',
    'firebase',
    'development',
    repeat('c', 64)
  );
  IF guardian_device_three IS NULL THEN
    RAISE EXCEPTION 'MOB-07 could not restore a guardian development device';
  END IF;

  production_result := platform.issue_mobile_notification(
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004',
    'family',
    'guardian',
    'familyHome',
    NULL,
    'production',
    'mob07-production-isolation-0001',
    expires_at
  );
  IF production_result IS NULL
     OR production_result->>'status' <> 'suppressed'
     OR (production_result->>'targetCount')::integer <> 0
     OR (SELECT suppression_reason FROM platform.mobile_notification_issuance
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND notification_id = (production_result->>'notificationId')::uuid) <> 'no-active-device' THEN
    RAISE EXCEPTION 'MOB-07 crossed development/production notification environments: %', production_result;
  END IF;

  INSERT INTO platform.mobile_family_form_request (
    tenant_id, form_id, student_profile_id, title, status, due_at,
    schema_version, fields, version
  ) VALUES (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000690',
    '40000000-0000-4000-8000-000000000901',
    'Unowned notification fixture',
    'open',
    clock_timestamp() + interval '1 day',
    1,
    '[{"fieldId":"note","label":"Note","type":"text","required":false,"options":[]}]'::jsonb,
    1
  );
  IF platform.issue_mobile_notification(
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004',
    'family',
    'guardian',
    'familyForms',
    '40000000-0000-4000-8000-000000000690',
    'development',
    'mob07-unowned-form-0001',
    expires_at
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-07 issued a resource notification outside current guardian authority';
  END IF;

  form_result := platform.issue_mobile_notification(
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004',
    'family',
    'guardian',
    'familyForms',
    '40000000-0000-4000-8000-000000000602',
    'development',
    'mob07-authorized-form-0001',
    expires_at
  );
  IF form_result IS NULL OR form_result->>'status' <> 'queued' THEN
    RAISE EXCEPTION 'MOB-07 rejected an authorized Family form target: %', form_result;
  END IF;
  form_notification_id := (form_result->>'notificationId')::uuid;

  INSERT INTO integration_core.notification_preference (
    tenant_id, recipient_id, channel, enabled, locale
  ) VALUES (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000004',
    'push', false, 'und'
  )
  ON CONFLICT (tenant_id, recipient_id, channel)
  DO UPDATE SET enabled = EXCLUDED.enabled, locale = EXCLUDED.locale;

  preference_result := platform.issue_mobile_notification(
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004',
    'family',
    'guardian',
    'familyHome',
    NULL,
    'development',
    'mob07-preference-disabled-0001',
    expires_at
  );
  IF preference_result IS NULL
     OR preference_result->>'status' <> 'suppressed'
     OR (SELECT suppression_reason FROM platform.mobile_notification_issuance
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND notification_id = (preference_result->>'notificationId')::uuid) <> 'preference-disabled'
     OR EXISTS (
       SELECT 1 FROM platform.mobile_notification_outbox
       WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
         AND notification_id = (preference_result->>'notificationId')::uuid
     ) THEN
    RAISE EXCEPTION 'MOB-07 ignored an explicit push preference opt-out';
  END IF;
  UPDATE integration_core.notification_preference
  SET enabled = true
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND recipient_id = '40000000-0000-4000-8000-000000000004'
    AND channel = 'push';

  authority_result := platform.issue_mobile_notification(
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004',
    'family',
    'guardian',
    'familyConversation',
    '40000000-0000-4000-8000-000000000810',
    'development',
    'mob07-authority-revoke-0001',
    expires_at
  );
  IF authority_result IS NULL OR authority_result->>'status' <> 'queued' THEN
    RAISE EXCEPTION 'MOB-07 could not establish the authority-revocation fixture';
  END IF;
  authority_notification_id := (authority_result->>'notificationId')::uuid;

  UPDATE people.guardian_student_authority
  SET portal_access = false
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND authority_id = '40000000-0000-4000-8000-000000000017';
  authority_replay := platform.issue_mobile_notification(
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004',
    'family',
    'guardian',
    'familyConversation',
    '40000000-0000-4000-8000-000000000810',
    'development',
    'mob07-authority-revoke-0001',
    expires_at
  );
  IF authority_replay IS NULL
     OR authority_replay->>'status' <> 'suppressed'
     OR EXISTS (
       SELECT 1 FROM platform.mobile_notification_outbox
       WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
         AND notification_id = authority_notification_id
         AND status = 'pending'
     )
     OR (SELECT suppression_reason FROM platform.mobile_notification_issuance
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND notification_id = authority_notification_id) <> 'authority-revoked'
     OR (SELECT status FROM integration_core.notification_delivery
         WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
           AND notification_key = 'mobile:mob07-authority-revoke-0001') <> 'suppressed' THEN
    RAISE EXCEPTION 'MOB-07 stored issuance replay bypassed current Family authority revocation';
  END IF;
  UPDATE people.guardian_student_authority
  SET portal_access = true
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND authority_id = '40000000-0000-4000-8000-000000000017';

  IF platform.mobile_notification_target_is_authorized(
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000050',
    'staff',
    'teacher',
    'staffMessages',
    NULL
  ) THEN
    RAISE EXCEPTION 'MOB-07 staffMessages authority bypassed required message capability';
  END IF;

  teacher_device := platform.register_mobile_device_session(
    'https://identity.school.test',
    'provider-mobile-teacher-1',
    'notification-teacher-register-0001',
    'notify_teacher_dev_0001',
    'staff',
    'android',
    '0.1.0+8',
    'firebase',
    'development',
    repeat('d', 64)
  );
  IF teacher_device IS NULL THEN
    RAISE EXCEPTION 'MOB-07 could not establish a Teacher notification device';
  END IF;
  staff_result := platform.issue_mobile_notification(
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000050',
    'staff',
    'teacher',
    'staffToday',
    NULL,
    'development',
    'mob07-staff-today-0001',
    expires_at
  );
  IF staff_result IS NULL
     OR staff_result->>'status' <> 'queued'
     OR (staff_result->>'targetCount')::integer <> 1 THEN
    RAISE EXCEPTION 'MOB-07 rejected an active Teacher staffToday target: %', staff_result;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'platform'
      AND table_name IN ('mobile_notification_issuance', 'mobile_notification_outbox')
      AND column_name IN (
        'push_token', 'push_provider', 'provider_message_id', 'body', 'title', 'student_name', 'amount', 'url'
      )
  ) THEN
    RAISE EXCEPTION 'MOB-07 copied provider credentials or sensitive display data into its ledger';
  END IF;

  BEGIN
    UPDATE platform.mobile_notification_issuance
    SET kind = 'familyHome'
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND notification_id = form_notification_id;
    RAISE EXCEPTION 'MOB-07 allowed notification identity rewrite';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM platform.mobile_notification_issuance
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND notification_id = form_notification_id;
    RAISE EXCEPTION 'MOB-07 allowed notification evidence deletion';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE platform.mobile_notification_outbox
    SET target_id = gen_random_uuid()
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND notification_id = form_notification_id;
    RAISE EXCEPTION 'MOB-07 allowed outbox target identity rewrite';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM platform.mobile_notification_outbox
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND notification_id = form_notification_id;
    RAISE EXCEPTION 'MOB-07 allowed outbox evidence deletion';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  IF has_table_privilege('app_runtime', 'platform.mobile_notification_issuance', 'SELECT')
     OR has_table_privilege('app_runtime', 'platform.mobile_notification_issuance', 'INSERT')
     OR has_table_privilege('app_runtime', 'platform.mobile_notification_issuance', 'UPDATE')
     OR has_table_privilege('app_runtime', 'platform.mobile_notification_outbox', 'SELECT')
     OR has_table_privilege('app_runtime', 'platform.mobile_notification_outbox', 'INSERT')
     OR has_table_privilege('app_runtime', 'platform.mobile_notification_outbox', 'UPDATE') THEN
    RAISE EXCEPTION 'MOB-07 granted app_runtime direct mobile notification table access';
  END IF;
  IF has_function_privilege(
       'public',
       'platform.issue_mobile_notification(uuid,uuid,uuid,text,text,text,text,text,text,timestamptz)',
       'EXECUTE'
     )
     OR NOT has_function_privilege(
       'app_runtime',
       'platform.issue_mobile_notification(uuid,uuid,uuid,text,text,text,text,text,text,timestamptz)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'MOB-07 public/runtime issuance function privilege boundary is incorrect';
  END IF;
  IF has_function_privilege(
       'app_runtime',
       'platform.mobile_notification_target_is_authorized(uuid,uuid,uuid,text,text,text,text)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_runtime',
       'platform.resolve_mobile_notification_person_id(uuid,uuid)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_runtime',
       'platform.enforce_mobile_notification_outbox_state()',
       'EXECUTE'
     )
     OR has_function_privilege(
       'app_runtime',
       'platform.suppress_mobile_notification_outbox_on_device_revoke()',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'MOB-07 exposed internal authority/integrity helpers';
  END IF;
END
$mob07_verify$;
