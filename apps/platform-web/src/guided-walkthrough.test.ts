import { describe, expect, it } from 'vitest';

import {
  walkthroughRoleForPath,
  walkthroughStepsForRole,
  walkthroughStorageKey,
  type WalkthroughRole,
} from './guided-walkthrough';

describe('guided walkthrough model', () => {
  it.each([
    ['/admin', 'admin'],
    ['/admin/finance', 'admin'],
    ['/teacher/attendance', 'teacher'],
    ['/family/documents', 'guardian'],
    ['/student/results', 'student'],
    ['/admissions/applications', 'admissions'],
    ['/finance/reconciliation', 'finance'],
    ['/support/access', 'support'],
  ] as const)('maps %s to %s', (path, role) => {
    expect(walkthroughRoleForPath(path)).toBe(role);
  });

  it('does not activate on the role chooser or unrelated paths', () => {
    expect(walkthroughRoleForPath('/')).toBeUndefined();
    expect(walkthroughRoleForPath('/offline.html')).toBeUndefined();
  });

  it('uses a versioned completion key per persona', () => {
    const roles: readonly WalkthroughRole[] = [
      'admin',
      'teacher',
      'guardian',
      'student',
      'admissions',
      'finance',
      'support',
    ];
    const keys = roles.map(walkthroughStorageKey);

    expect(new Set(keys).size).toBe(roles.length);
    for (const key of keys) expect(key).toContain('school-platform:walkthrough:v1:');
  });

  it('covers every published core workspace area in the role guide', () => {
    expect(walkthroughStepsForRole('admin').map((step) => step.title)).toEqual(
      expect.arrayContaining([
        'Students & admissions',
        'Academics & attendance',
        'Fees & accounting',
        'School operations',
        'Health & support',
        'Messages & notices',
        'Imports & integrations',
        'Reports & exports',
      ]),
    );
    expect(walkthroughStepsForRole('teacher')).toHaveLength(12);
    expect(walkthroughStepsForRole('guardian')).toHaveLength(14);
    expect(walkthroughStepsForRole('student')).toHaveLength(13);
  });

  it('keeps operator walkthroughs bounded to their scoped workspace surfaces', () => {
    for (const role of ['admissions', 'finance', 'support'] as const) {
      expect(walkthroughStepsForRole(role).map((step) => step.title)).toEqual([
        'Workspace summary',
        'Common actions',
        'Current workload',
        'Trust and data status',
      ]);
    }
  });
});
