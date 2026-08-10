from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:120]!r}")
    target.write_text(text.replace(old, new, count))


def add_max_after_nulls(path: str) -> None:
    target = Path(path)
    text = target.read_text()
    text = text.replace(
        "suggestedEffectiveFrom: null,\n",
        "suggestedEffectiveFrom: null,\n              effectiveFromMax: null,\n",
    )
    target.write_text(text)


for path in [
    "apps/platform-api/src/database-operator-work-queue-store.test.ts",
    "apps/platform-api/src/production-operator-work-queue-api.test.ts",
    "apps/platform-web/src/production-operator-work-queue.test.ts",
]:
    add_max_after_nulls(path)

for path in [
    "apps/platform-api/src/database-operator-work-queue-store.test.ts",
    "apps/platform-web/src/production-operator-work-queue.test.ts",
]:
    replace(
        path,
        "suggestedEffectiveFrom: '2026-02-30',\n",
        "suggestedEffectiveFrom: '2026-02-30',\n            effectiveFromMax: '2027-06-30',\n",
    )

verify = "tests/integration/verify-admissions-lifecycle-work-queue.sh"
replace(
    verify,
    """INSERT INTO academics.academic_year (
  tenant_id, academic_year_id, year_code, year_name, starts_on, ends_on, publication_state
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95500000-0000-4000-8000-000000000303',
  'LIFECYCLE-2026',
  'Lifecycle Academic Year',
  current_date - 30,
  current_date + 300,
  'published'
)
ON CONFLICT (tenant_id, academic_year_id) DO NOTHING;
""",
    """INSERT INTO academics.academic_year (
  tenant_id, academic_year_id, year_code, year_name, starts_on, ends_on, publication_state
) VALUES
  (
    '95000000-0000-4000-8000-000000000001',
    '95500000-0000-4000-8000-000000000303',
    'LIFECYCLE-2026',
    'Lifecycle Academic Year',
    current_date - 30,
    current_date + 300,
    'published'
  ),
  (
    '95000000-0000-4000-8000-000000000001',
    '95500000-0000-4000-8000-000000000305',
    'LIFECYCLE-NO-CALENDAR',
    'Lifecycle Year Without Campus Calendar',
    current_date - 10,
    current_date + 200,
    'published'
  )
ON CONFLICT (tenant_id, academic_year_id) DO NOTHING;

INSERT INTO academics.instructional_calendar (
  tenant_id, calendar_id, academic_year_id, campus_id, timezone, publication_state
) VALUES (
  '95000000-0000-4000-8000-000000000001',
  '95500000-0000-4000-8000-000000000304',
  '95500000-0000-4000-8000-000000000303',
  '95000000-0000-4000-8000-000000000003',
  'Asia/Dhaka',
  'published'
)
ON CONFLICT (tenant_id, academic_year_id, campus_id) DO NOTHING;
""",
)

issue_guard = """if [[ "$schema_version" != "2" || "$queue_role" != "admissions" || "$issue_action" != "issue-offer" || "$issue_version" != "2" || "$program_id" != "95500000-0000-4000-8000-000000000302" || "$academic_year_id" != "95500000-0000-4000-8000-000000000303" || -z "$grade_level_id" || ( "$grade_level_label" != "Grade 7" && "$grade_level_label" != "Grade 8" ) ]]; then
  echo "Unexpected issue-offer lifecycle stage: $issue_stage" >&2
  exit 1
fi
"""
replace(
    verify,
    issue_guard,
    issue_guard
    + """
no_calendar_option_count="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; WITH resolved AS (SELECT platform.resolve_admissions_lifecycle_work_queue('95500000-0000-4000-8000-000000000001'::uuid) AS queue), candidate AS (SELECT item FROM resolved CROSS JOIN LATERAL jsonb_array_elements(queue->'items') AS item WHERE item->>'applicationId'='95500000-0000-4000-8000-000000000203') SELECT count(*) FROM candidate CROSS JOIN LATERAL jsonb_array_elements(item->'placementOptions') AS option WHERE option->>'academicYearId'='95500000-0000-4000-8000-000000000305';")"
if [[ "$no_calendar_option_count" != "0" ]]; then
  echo "Academic year without selected-campus calendar leaked into placement options: $no_calendar_option_count" >&2
  exit 1
fi

no_calendar_offer="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT admissions.issue_application_offer_catalog_command('95500000-0000-4000-8000-000000000001'::uuid,'95500000-0000-4000-8000-000000000203'::uuid,2,'95500000-0000-4000-8000-000000000302'::uuid,'95500000-0000-4000-8000-000000000305'::uuid,'$grade_level_id'::uuid,clock_timestamp()+interval '30 days','admissions-lifecycle-no-calendar-0001','95500000-0000-4000-8000-000000000405'::uuid)->>'reason';")"
if [[ "$no_calendar_offer" != "domain-conflict" ]]; then
  echo "Expected academic year without selected-campus calendar to fail closed, got: $no_calendar_offer" >&2
  exit 1
fi
""",
)

replace(
    verify,
    """convert_stage="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH resolved AS (SELECT platform.resolve_admissions_lifecycle_work_queue('95500000-0000-4000-8000-000000000001'::uuid) AS queue), candidate AS (SELECT item FROM resolved CROSS JOIN LATERAL jsonb_array_elements(queue->'items') AS item WHERE item->>'applicationId'='95500000-0000-4000-8000-000000000203') SELECT item->>'action', item->>'version', item->>'suggestedEffectiveFrom' FROM candidate;")"
IFS='|' read -r convert_action convert_version effective_from <<<"$convert_stage"
if [[ "$convert_action" != "convert-applicant" || "$convert_version" != "4" || ! "$effective_from" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "Unexpected convert-applicant lifecycle stage: $convert_stage" >&2
  exit 1
fi

convert_result="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.convert_accepted_applicant_command('95500000-0000-4000-8000-000000000001'::uuid,'95500000-0000-4000-8000-000000000203'::uuid,4,'$effective_from'::date,'admissions-lifecycle-convert-0001','95500000-0000-4000-8000-000000000404'::uuid) AS value) SELECT value->>'accepted', value->>'replayed', value->'receipt'->>'command' FROM result;")"
""",
    """convert_stage="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH resolved AS (SELECT platform.resolve_admissions_lifecycle_work_queue('95500000-0000-4000-8000-000000000001'::uuid) AS queue), candidate AS (SELECT item FROM resolved CROSS JOIN LATERAL jsonb_array_elements(queue->'items') AS item WHERE item->>'applicationId'='95500000-0000-4000-8000-000000000203') SELECT item->>'action', item->>'version', item->>'suggestedEffectiveFrom', item->>'effectiveFromMax' FROM candidate;")"
IFS='|' read -r convert_action convert_version effective_from effective_max <<<"$convert_stage"
if [[ "$convert_action" != "convert-applicant" || "$convert_version" != "4" || ! "$effective_from" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ || ! "$effective_max" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ || "$effective_from" > "$effective_max" ]]; then
  echo "Unexpected convert-applicant lifecycle stage: $convert_stage" >&2
  exit 1
fi

outside_year="$("${PSQL[@]}" -Atqc "SET ROLE app_runtime; SELECT admissions.convert_accepted_applicant_catalog_command('95500000-0000-4000-8000-000000000001'::uuid,'95500000-0000-4000-8000-000000000203'::uuid,4,('$effective_max'::date + 1),'admissions-lifecycle-outside-year-0001','95500000-0000-4000-8000-000000000406'::uuid)->>'reason';")"
if [[ "$outside_year" != "domain-conflict" ]]; then
  echo "Expected conversion outside offered academic year to fail closed, got: $outside_year" >&2
  exit 1
fi

convert_result="$("${PSQL[@]}" -AtqF '|' -c "SET ROLE app_runtime; WITH result AS (SELECT admissions.convert_accepted_applicant_catalog_command('95500000-0000-4000-8000-000000000001'::uuid,'95500000-0000-4000-8000-000000000203'::uuid,4,'$effective_from'::date,'admissions-lifecycle-convert-0001','95500000-0000-4000-8000-000000000404'::uuid) AS value) SELECT value->>'accepted', value->>'replayed', value->'receipt'->>'command' FROM result;")"
""",
)

print("semantic regression fixture patch applied")
