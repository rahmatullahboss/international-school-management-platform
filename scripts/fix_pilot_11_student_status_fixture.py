from pathlib import Path


verification_path = Path('tests/integration/verify-auth-durable-context.sh')
verification = verification_path.read_text()

replacements = {
    "UPDATE student_lifecycle.student_profile\nSET status = 'inactive',\n    version = version + 1\nWHERE tenant_id = '30000000-0000-4000-8000-000000000001'\n  AND student_profile_id = '30000000-0000-4000-8000-000000000031';": "UPDATE student_lifecycle.student_profile\nSET status = 'withdrawn',\n    version = version + 1\nWHERE tenant_id = '30000000-0000-4000-8000-000000000001'\n  AND student_profile_id = '30000000-0000-4000-8000-000000000031';",
    '$student_composer_inactive_profile$': '$student_composer_withdrawn_profile$',
    'inactive student profile must fail closed: %': 'withdrawn student profile must fail closed: %',
}

expected_counts = {
    "UPDATE student_lifecycle.student_profile\nSET status = 'inactive',\n    version = version + 1\nWHERE tenant_id = '30000000-0000-4000-8000-000000000001'\n  AND student_profile_id = '30000000-0000-4000-8000-000000000031';": 1,
    '$student_composer_inactive_profile$': 2,
    'inactive student profile must fail closed: %': 1,
}

for old, new in replacements.items():
    count = verification.count(old)
    if count != expected_counts[old]:
        raise SystemExit(
            f'expected {expected_counts[old]} PILOT-11 status fixture occurrence(s) '
            f'for {old!r}, found {count}'
        )
    verification = verification.replace(old, new)

verification_path.write_text(verification)
