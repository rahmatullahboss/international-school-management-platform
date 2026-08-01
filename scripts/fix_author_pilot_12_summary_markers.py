from pathlib import Path

path = Path("scripts/author_pilot_12.py")
text = path.read_text(encoding="utf-8")
old_entry = '''    "'PILOT-09', 'PILOT-10', 'PILOT-11'))":
        "'PILOT-09', 'PILOT-10', 'PILOT-11', 'PILOT-12'))",
'''
if text.count(old_entry) != 1:
    raise SystemExit(f"expected one summary replacement entry, got {text.count(old_entry)}")
text = text.replace(old_entry, "", 1)
old_loop = '''for old, new in replacements.items():
    verifier = replace_once(verifier, old, new, old)

marker = "SET ROLE app_runtime;\\nDO $account_revoke_verification$"
'''
new_loop = '''for old, new in replacements.items():
    verifier = replace_once(verifier, old, new, old)

summary_old = "'PILOT-09', 'PILOT-10', 'PILOT-11'))"
summary_new = "'PILOT-09', 'PILOT-10', 'PILOT-11', 'PILOT-12'))"
summary_count = verifier.count(summary_old)
if summary_count != 2:
    raise SystemExit(f"expected two PILOT-12 summary markers, got {summary_count}")
verifier = verifier.replace(summary_old, summary_new)

marker = "SET ROLE app_runtime;\\nDO $account_revoke_verification$"
'''
if text.count(old_loop) != 1:
    raise SystemExit(f"expected one authoring loop marker, got {text.count(old_loop)}")
text = text.replace(old_loop, new_loop, 1)
path.write_text(text, encoding="utf-8")
