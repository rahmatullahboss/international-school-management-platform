from pathlib import Path

migration_path = Path(
    'infra/database/post-integration-migrations/'
    '202608010101_PILOT-09_teacher_runtime_projection_composer.sql'
)
migration = migration_path.read_text()

attendance_old = "'capability', 'attendance.manage'"
gradebook_old = "'capability', 'gradebook.manage'"
if migration.count(attendance_old) != 2:
    raise SystemExit('expected exactly two teacher attendance capability tokens')
if migration.count(gradebook_old) != 3:
    raise SystemExit('expected exactly three teacher gradebook capability tokens')

migration = migration.replace(attendance_old, "'capability', 'attendance.assigned.write'")
migration = migration.replace(gradebook_old, "'capability', 'gradebook.assigned.write'")
migration_path.write_text(migration)

verification_path = Path('tests/integration/verify-auth-durable-context.sh')
verification = verification_path.read_text()
old = """     OR jsonb_array_length(projection_payload->'today'->'classes') <> 1
     OR jsonb_array_length(projection_payload->'exceptions') <> 0 THEN
    RAISE EXCEPTION 'projection revision five must contain exact teacher metrics: %', projection_payload;
"""
new = """     OR jsonb_array_length(projection_payload->'today'->'classes') <> 1
     OR jsonb_array_length(projection_payload->'exceptions') <> 0
     OR projection_payload->'metrics'->0->>'capability' <> 'classes.assigned.read'
     OR projection_payload->'metrics'->1->>'capability' <> 'attendance.assigned.write'
     OR projection_payload->'metrics'->2->>'capability' <> 'gradebook.assigned.write'
     OR projection_payload->'metrics'->3->>'capability' <> 'gradebook.assigned.write' THEN
    RAISE EXCEPTION 'projection revision five must contain exact teacher metrics and capabilities: %', projection_payload;
"""
if verification.count(old) != 1:
    raise SystemExit('expected one teacher projection assertion marker')
verification_path.write_text(verification.replace(old, new, 1))
