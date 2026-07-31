from pathlib import Path

path = Path('scripts/implement_pilot_06.py')
source = path.read_text(encoding='utf-8')
old = '''replace_once(
    verifier,
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05'))",
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06'))",
)
replace_once(
    verifier,
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05')),",
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06')),",
)
'''
new = '''verifier_path = Path(verifier)
verifier_source = verifier_path.read_text(encoding="utf-8")
old_stream_tuple = "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05'))"
new_stream_tuple = "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06'))"
if verifier_source.count(old_stream_tuple) != 2:
    raise SystemExit(
        f"{verifier}: expected two summary stream tuples, got "
        f"{verifier_source.count(old_stream_tuple)}"
    )
verifier_path.write_text(
    verifier_source.replace(old_stream_tuple, new_stream_tuple),
    encoding="utf-8",
)
'''
if source.count(old) != 1:
    raise SystemExit(f'expected one duplicated-marker block, got {source.count(old)}')
path.write_text(source.replace(old, new), encoding='utf-8')
