BEGIN;

SET LOCAL ROLE app_runtime;

SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

INSERT INTO academics.academic_year (
  tenant_id,
  academic_year_id,
  year_code,
  year_name,
  starts_on,
  ends_on,
  publication_state,
  version
)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
  'ACAD-PROBE-A',
  'ACAD tenant A recovery probe',
  DATE '2099-01-01',
  DATE '2099-12-31',
  'draft',
  1
);

SELECT set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);

INSERT INTO academics.academic_year (
  tenant_id,
  academic_year_id,
  year_code,
  year_name,
  starts_on,
  ends_on,
  publication_state,
  version
)
VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001',
  'ACAD-PROBE-B',
  'ACAD tenant B recovery probe',
  DATE '2099-01-01',
  DATE '2099-12-31',
  'draft',
  1
);

SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

DO $tenant_a_rls$
DECLARE
  visible_count integer;
  cross_tenant_count integer;
BEGIN
  SELECT count(*) INTO visible_count
  FROM academics.academic_year
  WHERE year_code LIKE 'ACAD-PROBE-%';

  SELECT count(*) INTO cross_tenant_count
  FROM academics.academic_year
  WHERE tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  IF visible_count <> 1 OR cross_tenant_count <> 0 THEN
    RAISE EXCEPTION 'tenant A RLS probe failed: visible %, cross-tenant %', visible_count, cross_tenant_count;
  END IF;
END
$tenant_a_rls$;

UPDATE academics.academic_year
SET publication_state = 'published',
    version = version + 1
WHERE academic_year_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001';

DO $published_immutability$
BEGIN
  BEGIN
    UPDATE academics.academic_year
    SET year_name = 'forbidden mutation'
    WHERE academic_year_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001';

    RAISE EXCEPTION 'published academic versions are immutable probe did not fail';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%published academic versions are immutable%' THEN
        RAISE;
      END IF;
  END;
END
$published_immutability$;

SELECT set_config('app.tenant_id', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);

DO $unknown_tenant_rls$
DECLARE
  visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count
  FROM academics.academic_year
  WHERE year_code LIKE 'ACAD-PROBE-%';

  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'unknown tenant RLS probe failed: visible %', visible_count;
  END IF;
END
$unknown_tenant_rls$;

RESET ROLE;

ROLLBACK;
