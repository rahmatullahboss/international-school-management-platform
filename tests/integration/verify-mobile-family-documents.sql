INSERT INTO integration_core.document_object (
  tenant_id, document_id, object_key, content_type, scan_status
) VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000500',
    'mobile/family/general-report.pdf',
    'application/pdf',
    'clean'
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000503',
    'mobile/family/restricted-report.pdf',
    'application/pdf',
    'clean'
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000506',
    'mobile/family/internal-only.pdf',
    'application/pdf',
    'clean'
  );

INSERT INTO student_lifecycle.profile_document (
  tenant_id, profile_document_id, profile_kind, profile_id, document_id,
  document_type, visibility, valid_from
) VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000501',
    'student',
    '40000000-0000-4000-8000-000000000013',
    '40000000-0000-4000-8000-000000000500',
    'report',
    'guardian-visible',
    current_date - 10
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000504',
    'student',
    '40000000-0000-4000-8000-000000000013',
    '40000000-0000-4000-8000-000000000503',
    'report',
    'guardian-visible',
    current_date - 10
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000507',
    'student',
    '40000000-0000-4000-8000-000000000013',
    '40000000-0000-4000-8000-000000000506',
    'internal-note',
    'restricted',
    current_date - 10
  );

INSERT INTO platform.mobile_family_document_publication (
  tenant_id, publication_id, student_profile_id, document_id, title, file_name,
  size_bytes, issued_at, classification, cache_policy, content_sha256
) VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000502',
    '40000000-0000-4000-8000-000000000013',
    '40000000-0000-4000-8000-000000000500',
    'General student report',
    'general-report.pdf',
    7,
    '2026-08-21T10:00:00.000Z'::timestamptz,
    'general',
    'encryptedTemporary',
    repeat('b', 64)
  ),
  (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000505',
    '40000000-0000-4000-8000-000000000013',
    '40000000-0000-4000-8000-000000000503',
    'Restricted student report',
    'restricted-report.pdf',
    6,
    '2026-08-21T09:00:00.000Z'::timestamptz,
    'restricted',
    'noStore',
    repeat('a', 64)
  );

DO $publication_guard$
BEGIN
  BEGIN
    INSERT INTO platform.mobile_family_document_publication (
      tenant_id, publication_id, student_profile_id, document_id, title, file_name,
      size_bytes, issued_at, classification, cache_policy, content_sha256
    ) VALUES (
      '40000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000508',
      '40000000-0000-4000-8000-000000000013',
      '40000000-0000-4000-8000-000000000506',
      'Internal-only publication',
      'internal-only.pdf',
      5,
      '2026-08-21T11:00:00.000Z'::timestamptz,
      'general',
      'noStore',
      repeat('c', 64)
    );
    RAISE EXCEPTION 'MOB-06A publication authority guard accepted restricted canonical visibility';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  IF EXISTS (
    SELECT 1
    FROM platform.mobile_family_document_publication
    WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
      AND publication_id = '40000000-0000-4000-8000-000000000508'
  ) THEN
    RAISE EXCEPTION 'MOB-06A invalid publication persisted despite authority guard';
  END IF;
END
$publication_guard$;

DO $mob06a_verify$
DECLARE
  first_page jsonb;
  second_page jsonb;
  scan_filtered_page jsonb;
  unauthorized_page jsonb;
  restricted_grant jsonb;
  restricted_retry jsonb;
  grant_conflict jsonb;
  restricted_aal1 jsonb;
  restricted_aal2 jsonb;
  restricted_replay jsonb;
  general_grant jsonb;
  general_claim jsonb;
  withdrawn_grant jsonb;
  withdrawn_claim jsonb;
  revoked_grant jsonb;
  revoked_claim jsonb;
BEGIN
  first_page := platform.resolve_mobile_family_documents(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000013',
    NULL,
    1
  );
  IF jsonb_array_length(first_page->'documents') <> 1
     OR first_page#>>'{documents,0,documentId}' <> '40000000-0000-4000-8000-000000000500'
     OR first_page->>'nextCursor' <> '40000000-0000-4000-8000-000000000500'
     OR first_page#>>'{documents,0,classification}' <> 'general'
     OR first_page#>>'{documents,0,cachePolicy}' <> 'encryptedTemporary' THEN
    RAISE EXCEPTION 'MOB-06A first document page was invalid: %', first_page;
  END IF;
  IF (first_page#>'{documents,0}') ?| ARRAY['objectKey', 'contentType', 'sha256Hex', 'url', 'downloadUrl'] THEN
    RAISE EXCEPTION 'MOB-06A metadata response leaked storage authority';
  END IF;

  second_page := platform.resolve_mobile_family_documents(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000013',
    '40000000-0000-4000-8000-000000000500',
    1
  );
  IF second_page#>>'{documents,0,documentId}' <> '40000000-0000-4000-8000-000000000503'
     OR second_page->'nextCursor' <> 'null'::jsonb
     OR second_page#>>'{documents,0,classification}' <> 'restricted'
     OR second_page#>>'{documents,0,cachePolicy}' <> 'noStore' THEN
    RAISE EXCEPTION 'MOB-06A second document page was invalid: %', second_page;
  END IF;

  unauthorized_page := platform.resolve_mobile_family_documents(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000599',
    NULL,
    25
  );
  IF unauthorized_page IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06A unauthorized student document scope was accepted';
  END IF;

  UPDATE integration_core.document_object
  SET scan_status = 'quarantined'
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND document_id = '40000000-0000-4000-8000-000000000500';

  scan_filtered_page := platform.resolve_mobile_family_documents(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000013',
    NULL,
    25
  );
  IF jsonb_array_length(scan_filtered_page->'documents') <> 1
     OR scan_filtered_page#>>'{documents,0,documentId}' <> '40000000-0000-4000-8000-000000000503' THEN
    RAISE EXCEPTION 'MOB-06A quarantined document was not filtered';
  END IF;

  UPDATE integration_core.document_object
  SET scan_status = 'clean'
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND document_id = '40000000-0000-4000-8000-000000000500';

  restricted_grant := platform.issue_mobile_family_document_download_grant(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000503',
    'family-document-grant-idempotency-0001'
  );
  IF restricted_grant->>'documentId' <> '40000000-0000-4000-8000-000000000503'
     OR restricted_grant->>'requiresStepUp' <> 'true'
     OR restricted_grant->>'singleUse' <> 'true'
     OR restricted_grant ?| ARRAY['objectKey', 'contentType', 'sha256Hex', 'url', 'downloadUrl'] THEN
    RAISE EXCEPTION 'MOB-06A restricted grant was invalid: %', restricted_grant;
  END IF;

  restricted_retry := platform.issue_mobile_family_document_download_grant(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000503',
    'family-document-grant-idempotency-0001'
  );
  IF restricted_retry <> restricted_grant THEN
    RAISE EXCEPTION 'MOB-06A exact grant replay changed receipt';
  END IF;

  grant_conflict := platform.issue_mobile_family_document_download_grant(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000500',
    'family-document-grant-idempotency-0001'
  );
  IF grant_conflict <> jsonb_build_object('status', 'idempotency-conflict') THEN
    RAISE EXCEPTION 'MOB-06A changed grant idempotency did not conflict: %', grant_conflict;
  END IF;

  restricted_aal1 := platform.claim_mobile_family_document_download_grant(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    (restricted_grant->>'grantId')::uuid,
    'aal1',
    'family-document-exchange-idempotency-0001'
  );
  IF restricted_aal1 <> jsonb_build_object('status', 'step-up-required') THEN
    RAISE EXCEPTION 'MOB-06A restricted AAL1 claim was not denied: %', restricted_aal1;
  END IF;
  IF (SELECT consumed_at FROM platform.mobile_family_document_download_grant
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND grant_id = (restricted_grant->>'grantId')::uuid) IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06A AAL1 denial consumed the restricted grant';
  END IF;

  restricted_aal2 := platform.claim_mobile_family_document_download_grant(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    (restricted_grant->>'grantId')::uuid,
    'aal2',
    'family-document-exchange-idempotency-0002'
  );
  IF restricted_aal2->>'status' <> 'claimed'
     OR restricted_aal2->>'documentId' <> '40000000-0000-4000-8000-000000000503'
     OR restricted_aal2->>'objectKey' <> 'mobile/family/restricted-report.pdf'
     OR restricted_aal2->>'contentType' <> 'application/pdf'
     OR (restricted_aal2->>'sizeBytes')::bigint <> 6
     OR restricted_aal2->>'sha256Hex' <> repeat('a', 64) THEN
    RAISE EXCEPTION 'MOB-06A AAL2 claim did not return bounded storage metadata: %', restricted_aal2;
  END IF;

  restricted_replay := platform.claim_mobile_family_document_download_grant(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    (restricted_grant->>'grantId')::uuid,
    'aal2',
    'family-document-exchange-idempotency-0002'
  );
  IF restricted_replay <> jsonb_build_object('status', 'already-consumed') THEN
    RAISE EXCEPTION 'MOB-06A single-use grant replay was not rejected';
  END IF;

  general_grant := platform.issue_mobile_family_document_download_grant(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000500',
    'family-document-grant-idempotency-0002'
  );
  IF general_grant->>'requiresStepUp' <> 'false' THEN
    RAISE EXCEPTION 'MOB-06A general document unexpectedly required step-up';
  END IF;

  general_claim := platform.claim_mobile_family_document_download_grant(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    (general_grant->>'grantId')::uuid,
    'aal1',
    'family-document-exchange-idempotency-0003'
  );
  IF general_claim->>'status' <> 'claimed'
     OR general_claim->>'objectKey' <> 'mobile/family/general-report.pdf' THEN
    RAISE EXCEPTION 'MOB-06A general AAL1 claim failed: %', general_claim;
  END IF;

  withdrawn_grant := platform.issue_mobile_family_document_download_grant(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000503',
    'family-document-grant-idempotency-0003'
  );
  UPDATE platform.mobile_family_document_publication
  SET publication_state = 'withdrawn', withdrawn_at = clock_timestamp(), version = version + 1
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND publication_id = '40000000-0000-4000-8000-000000000505';

  withdrawn_claim := platform.claim_mobile_family_document_download_grant(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    (withdrawn_grant->>'grantId')::uuid,
    'aal2',
    'family-document-exchange-idempotency-0004'
  );
  IF withdrawn_claim IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06A withdrawn publication remained claimable';
  END IF;
  IF (SELECT consumed_at FROM platform.mobile_family_document_download_grant
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND grant_id = (withdrawn_grant->>'grantId')::uuid) IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06A withdrawn publication denial consumed grant';
  END IF;

  UPDATE platform.mobile_family_document_publication
  SET publication_state = 'published', withdrawn_at = NULL, version = version + 1
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND publication_id = '40000000-0000-4000-8000-000000000505';

  revoked_grant := platform.issue_mobile_family_document_download_grant(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    '40000000-0000-4000-8000-000000000503',
    'family-document-grant-idempotency-0004'
  );
  UPDATE people.guardian_student_authority
  SET portal_access = false
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND authority_id = '40000000-0000-4000-8000-000000000017';

  revoked_claim := platform.claim_mobile_family_document_download_grant(
    'https://identity.school.test',
    'provider-mobile-user-1',
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'guardian',
    (revoked_grant->>'grantId')::uuid,
    'aal2',
    'family-document-exchange-idempotency-0005'
  );
  IF revoked_claim IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06A revoked guardian authority remained claimable';
  END IF;
  IF (SELECT consumed_at FROM platform.mobile_family_document_download_grant
      WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
        AND grant_id = (revoked_grant->>'grantId')::uuid) IS NOT NULL THEN
    RAISE EXCEPTION 'MOB-06A revoked authority denial consumed grant';
  END IF;

  UPDATE people.guardian_student_authority
  SET portal_access = true
  WHERE tenant_id = '40000000-0000-4000-8000-000000000001'
    AND authority_id = '40000000-0000-4000-8000-000000000017';

  IF has_function_privilege(
    'public',
    'platform.resolve_mobile_family_documents(text,text,uuid,uuid,text,uuid,uuid,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC must not execute MOB-06A document list function';
  END IF;
  IF NOT has_function_privilege(
    'app_runtime',
    'platform.resolve_mobile_family_documents(text,text,uuid,uuid,text,uuid,uuid,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'app_runtime must execute MOB-06A document list function';
  END IF;
  IF has_function_privilege(
    'public',
    'platform.issue_mobile_family_document_download_grant(text,text,uuid,uuid,text,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC must not execute MOB-06A grant issue function';
  END IF;
  IF NOT has_function_privilege(
    'app_runtime',
    'platform.issue_mobile_family_document_download_grant(text,text,uuid,uuid,text,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'app_runtime must execute MOB-06A grant issue function';
  END IF;
  IF has_function_privilege(
    'public',
    'platform.claim_mobile_family_document_download_grant(text,text,uuid,uuid,text,uuid,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC must not execute MOB-06A grant claim function';
  END IF;
  IF NOT has_function_privilege(
    'app_runtime',
    'platform.claim_mobile_family_document_download_grant(text,text,uuid,uuid,text,uuid,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'app_runtime must execute MOB-06A grant claim function';
  END IF;
  IF has_function_privilege(
    'app_runtime',
    'platform.resolve_mobile_family_document_identity_authority(text,text,uuid,uuid,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'app_runtime',
    'platform.mobile_family_student_is_authorized(uuid,uuid,text,uuid,uuid,date)',
    'EXECUTE'
  ) OR has_function_privilege(
    'app_runtime',
    'platform.enforce_mobile_family_document_publication_authority()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'app_runtime must not execute MOB-06A internal authority helpers';
  END IF;
  IF has_table_privilege(
    'app_runtime', 'platform.mobile_family_document_publication', 'SELECT'
  ) OR has_table_privilege(
    'app_runtime', 'platform.mobile_family_document_download_grant', 'SELECT'
  ) OR has_table_privilege(
    'app_runtime', 'platform.mobile_family_document_download_grant', 'INSERT'
  ) THEN
    RAISE EXCEPTION 'app_runtime received direct MOB-06A table authority';
  END IF;
END
$mob06a_verify$;
