from pathlib import Path

path = Path(
    "infra/database/post-integration-migrations/"
    "202608010301_PILOT-11_student_runtime_projection_composer.sql"
)
text = path.read_text(encoding="utf-8")

replacements = {
    "min(person_id),": "min(person_id::text)::uuid,",
    "min(student_profile_id),": "min(student_profile_id::text)::uuid,",
    "min(enrollment_id)": "min(enrollment_id::text)::uuid",
}

for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one occurrence of {old!r}, got {count}")
    text = text.replace(old, new, 1)

for old in replacements:
    if old in text:
        raise SystemExit(f"legacy UUID aggregate remained: {old!r}")

path.write_text(text, encoding="utf-8")
