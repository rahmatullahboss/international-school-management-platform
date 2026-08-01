from pathlib import Path

path = Path(
    "infra/database/post-integration-migrations/"
    "202608010101_PILOT-09_teacher_runtime_projection_composer.sql"
)
text = path.read_text(encoding="utf-8")

attendance_old = "'capability', 'attendance.manage'"
gradebook_old = "'capability', 'gradebook.manage'"

if text.count(attendance_old) != 2:
    raise SystemExit(
        f"expected exactly two attendance capability markers, got {text.count(attendance_old)}"
    )
if text.count(gradebook_old) != 3:
    raise SystemExit(
        f"expected exactly three gradebook capability markers, got {text.count(gradebook_old)}"
    )

text = text.replace(attendance_old, "'capability', 'attendance.assigned.write'")
text = text.replace(gradebook_old, "'capability', 'gradebook.assigned.write'")

if attendance_old in text or gradebook_old in text:
    raise SystemExit("legacy teacher capability marker remained after replacement")
if text.count("'capability', 'attendance.assigned.write'") != 2:
    raise SystemExit("attendance capability replacement count is invalid")
if text.count("'capability', 'gradebook.assigned.write'") != 3:
    raise SystemExit("gradebook capability replacement count is invalid")

path.write_text(text, encoding="utf-8")
