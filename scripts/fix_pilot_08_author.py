from pathlib import Path

path = Path('scripts/author_pilot_08.py')
text = path.read_text()
old = '''text = replace_once(
    text,
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07'))",
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08'))",
    'canonical exclusion',
)
text = replace_once(
    text,
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07'))",
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08'))",
    'post integration inclusion',
)
'''
new = '''summary_marker = "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07'))"
if text.count(summary_marker) != 2:
    raise SystemExit(f'summary stream markers: expected two, found {text.count(summary_marker)}')
text = text.replace(
    summary_marker,
    "('AUTH-03', 'AUTH-07', 'AUTH-08', 'PILOT-04', 'PILOT-05', 'PILOT-06', 'PILOT-07', 'PILOT-08'))",
)
'''
if text.count(old) != 1:
    raise SystemExit('expected one author summary patch block')
path.write_text(text.replace(old, new, 1))
