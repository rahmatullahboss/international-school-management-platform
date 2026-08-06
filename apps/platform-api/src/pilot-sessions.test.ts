import { describe, expect, it } from 'vitest';

import { issuePilotSession, verifyPilotSession } from './pilot-sessions.js';

const secret = 'pilot-session-contract-test-secret-with-32-plus-characters';
const issuedAt = Date.UTC(2026, 6, 30, 0, 0, 0);

async function issuedToken(role: string): Promise<string> {
  const issuance = await issuePilotSession(secret, role, issuedAt);
  if (!issuance.ok) throw new Error('Expected a signed pilot session.');
  return issuance.token;
}

describe('pilot signed session contract', () => {
  it('verifies a signed session only for its bound role before expiry', async () => {
    const token = await issuedToken('teacher');

    await expect(
      verifyPilotSession(secret, `Bearer ${token}`, 'teacher', issuedAt + 60_000),
    ).resolves.toMatchObject({
      ok: true,
      claims: {
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-main',
        role: 'teacher',
        subjectId: 'teacher-1',
      },
    });

    await expect(
      verifyPilotSession(secret, `Bearer ${token}`, 'admin', issuedAt + 60_000),
    ).resolves.toMatchObject({
      ok: false,
      status: 401,
      code: 'pilot_session_invalid',
    });
  });

  it('rejects the token at and after its fifteen-minute expiry boundary', async () => {
    const token = await issuedToken('student');

    await expect(
      verifyPilotSession(secret, `Bearer ${token}`, 'student', issuedAt + 15 * 60_000),
    ).resolves.toMatchObject({
      ok: false,
      status: 401,
      code: 'pilot_session_invalid',
    });
  });

  it('rejects a signature generated with another secret', async () => {
    const token = await issuedToken('guardian');

    await expect(
      verifyPilotSession(
        'different-pilot-session-secret-with-32-plus-characters',
        `Bearer ${token}`,
        'guardian',
        issuedAt + 60_000,
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 401,
      code: 'pilot_session_invalid',
    });
  });
});
