from pathlib import Path
import runpy

path = Path('scripts/fix_pilot_10_guardian_campus_lineage.py')
text = path.read_text()
old = '''attendance_record_marker = """INSERT INTO gradebook.grading_policy_version (
  tenant_id, policy_version_id, policy_key, version_label,
"""
if verification.count(attendance_record_marker) != 1:
    raise SystemExit('expected one guardian grade fixture marker')
'''
new = '''attendance_record_marker = """INSERT INTO gradebook.grading_policy_version (
  tenant_id, policy_version_id, policy_key, version_label,
  calculation_mode, missing_score_treatment, rounding_decimals, publication_state
) VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-00000000008d',
  'pilot-10-guardian-grade-policy',
"""
if verification.count(attendance_record_marker) != 1:
    raise SystemExit('expected one guardian-specific grade fixture marker')
'''
if text.count(old) != 1:
    raise SystemExit('expected one duplicate grade marker block to harden')
path.write_text(text.replace(old, new, 1))
runpy.run_path(str(path), run_name='__main__')
