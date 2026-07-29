DO $verify_acad_schema$
DECLARE
  migration_count integer;
  table_count integer;
  rls_enabled_count integer;
  rls_forced_count integer;
  tenant_policy_count integer;
  missing_schema_count integer;
  missing_trigger_count integer;
BEGIN
  SELECT count(*)
  INTO migration_count
  FROM platform.schema_migration
  WHERE stream_id = 'ACAD-01'
    AND migration_id IN (
      '202607280201_ACAD-01_academic_structure',
      '202607280202_ACAD-01_timetable',
      '202607280203_ACAD-01_attendance',
      '202607280204_ACAD-01_gradebook',
      '202607280205_ACAD-01_records'
    );

  IF migration_count <> 5 THEN
    RAISE EXCEPTION 'expected 5 ACAD migration ledger rows, found %', migration_count;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE c.relrowsecurity),
         count(*) FILTER (WHERE c.relforcerowsecurity)
  INTO table_count, rls_enabled_count, rls_forced_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname IN ('academics', 'scheduling', 'attendance', 'gradebook', 'records');

  IF table_count <> 53 THEN
    RAISE EXCEPTION 'expected 53 ACAD tables, found %', table_count;
  END IF;
  IF rls_enabled_count <> table_count THEN
    RAISE EXCEPTION 'expected RLS enabled on all ACAD tables, found % of %', rls_enabled_count, table_count;
  END IF;
  IF rls_forced_count <> table_count THEN
    RAISE EXCEPTION 'expected forced RLS on all ACAD tables, found % of %', rls_forced_count, table_count;
  END IF;

  SELECT count(*)
  INTO tenant_policy_count
  FROM pg_policies
  WHERE schemaname IN ('academics', 'scheduling', 'attendance', 'gradebook', 'records')
    AND policyname = 'tenant_policy';

  IF tenant_policy_count <> table_count THEN
    RAISE EXCEPTION 'expected tenant policy on all ACAD tables, found % of %', tenant_policy_count, table_count;
  END IF;

  SELECT count(*)
  INTO missing_schema_count
  FROM (VALUES ('academics'), ('scheduling'), ('attendance'), ('gradebook'), ('records')) expected(schema_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_namespace n WHERE n.nspname = expected.schema_name
  );

  IF missing_schema_count <> 0 THEN
    RAISE EXCEPTION 'one or more ACAD schemas are missing';
  END IF;

  SELECT count(*)
  INTO missing_trigger_count
  FROM (
    VALUES
      ('academics', 'academic_year', 'published_version_immutable'),
      ('scheduling', 'timetable_version', 'published_timetable_immutable'),
      ('attendance', 'attendance_policy_version', 'published_attendance_policy_immutable'),
      ('attendance', 'attendance_record', 'finalized_attendance_record_guard'),
      ('gradebook', 'grading_policy_version', 'published_grading_policy_immutable'),
      ('gradebook', 'assessment_result', 'locked_grade_result_guard'),
      ('records', 'report_card_snapshot', 'published_report_card_immutable'),
      ('records', 'transcript_record', 'transcript_content_immutable')
  ) expected(schema_name, table_name, trigger_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND n.nspname = expected.schema_name
      AND c.relname = expected.table_name
      AND t.tgname = expected.trigger_name
  );

  IF missing_trigger_count <> 0 THEN
    RAISE EXCEPTION 'one or more required ACAD immutability triggers are missing';
  END IF;

  RAISE NOTICE 'ACAD schema verification passed: % migrations, % tables, forced RLS and tenant policies confirmed',
    migration_count,
    table_count;
END
$verify_acad_schema$;
