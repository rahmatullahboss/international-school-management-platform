import { describe, expect, it } from 'vitest';

import { admissionsApiContract } from '../../packages/modules/admissions/src/contracts.js';
import { peopleApiContract } from '../../packages/modules/people/src/contracts.js';
import { studentLifecycleApiContract } from '../../packages/modules/student-lifecycle/src/contracts.js';

const eventNames = [
  'sis.people.person-created.v1',
  'sis.people.person-merged.v1',
  'sis.people.guardian-authority-changed.v1',
  'sis.admissions.application-submitted.v1',
  'sis.admissions.decision-recorded.v1',
  'sis.admissions.offer-accepted.v1',
  'sis.admissions.applicant-converted.v1',
  'sis.lifecycle.student-profile-created.v1',
  'sis.lifecycle.enrollment-created.v1',
  'sis.lifecycle.student-transferred.v1',
  'sis.lifecycle.student-withdrawn.v1',
] as const;

describe('SIS contract v1', () => {
  it('publishes unique versioned event names', () => {
    expect(new Set(eventNames).size).toBe(eventNames.length);
    expect(eventNames.every((name) => name.startsWith('sis.') && name.endsWith('.v1'))).toBe(true);
  });

  it('keeps command and query names unique within each API', () => {
    for (const contract of [
      peopleApiContract,
      admissionsApiContract,
      studentLifecycleApiContract,
    ]) {
      expect(contract.version).toBe('v1');
      expect(new Set(contract.commands).size).toBe(contract.commands.length);
      expect(new Set(contract.queries).size).toBe(contract.queries.length);
    }
  });

  it('exposes replay-safe admissions and lifecycle commands', () => {
    expect(admissionsApiContract.commands).toContain('ConvertApplicant');
    expect(admissionsApiContract.commands).toContain('AcceptOffer');
    expect(studentLifecycleApiContract.commands).toContain('TransferEnrollment');
    expect(studentLifecycleApiContract.commands).toContain('WithdrawEnrollment');
  });
});
