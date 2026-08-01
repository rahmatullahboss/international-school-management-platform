import { describe, expect, it } from 'vitest';

import {
  PILOT_OPERATOR_CAMPUS_ID,
  PILOT_OPERATOR_TENANT_ID,
  authorizePilotOperatorPermission,
  isPilotOperatorRole,
  pilotOperatorAssurance,
  pilotOperatorCapabilities,
  pilotOperatorHeaders,
  pilotOperatorSubject,
  resolvePilotOperatorSnapshot,
  type PilotOperatorRole,
} from './pilot-operator-models.js';

const roles = ['admissions', 'finance', 'support'] as const satisfies readonly PilotOperatorRole[];

function validHeaders(role: PilotOperatorRole): Headers {
  return pilotOperatorHeaders(role);
}

describe('pilot operator models', () => {
  it('recognizes only published operator roles', () => {
    for (const role of roles) expect(isPilotOperatorRole(role)).toBe(true);
    expect(isPilotOperatorRole('admin')).toBe(false);
    expect(isPilotOperatorRole(undefined)).toBe(false);
  });

  it('exposes deterministic subject, assurance and capability contracts', () => {
    expect(pilotOperatorSubject('admissions')).toBe('admissions-1');
    expect(pilotOperatorSubject('finance')).toBe('cashier-1');
    expect(pilotOperatorSubject('support')).toBe('support-operator-1');
    expect(pilotOperatorAssurance('admissions')).toBe('aal1');
    expect(pilotOperatorAssurance('finance')).toBe('aal1');
    expect(pilotOperatorAssurance('support')).toBe('aal2');
    expect(pilotOperatorCapabilities('admissions')).toContain('admissions.application.review');
    expect(pilotOperatorCapabilities('finance')).toContain('finance.reconciliation.write');
    expect(pilotOperatorCapabilities('support')).toContain('support.break-glass.request');
  });

  it('enforces grants and AAL2 step-up requirements', () => {
    expect(authorizePilotOperatorPermission('admissions', 'finance.receipt.create', 'aal1')).toEqual({
      allowed: false,
      reason: 'permission-not-granted',
    });
    expect(authorizePilotOperatorPermission('support', 'support.break-glass.request', 'aal1')).toEqual({
      allowed: false,
      reason: 'step-up-required',
      requiredAssurance: 'aal2',
    });
    expect(authorizePilotOperatorPermission('support', 'support.break-glass.request', 'aal2')).toEqual({
      allowed: true,
      reason: 'role-grant',
    });
    expect(authorizePilotOperatorPermission('finance', 'finance.invoice.read', 'aal1')).toEqual({
      allowed: true,
      reason: 'role-grant',
    });
  });

  it('rejects unknown and incomplete snapshot scope', () => {
    expect(resolvePilotOperatorSnapshot(new Headers(), 'administrator')).toMatchObject({
      ok: false,
      status: 404,
      code: 'pilot_role_not_found',
    });

    expect(resolvePilotOperatorSnapshot(new Headers(), 'admissions')).toMatchObject({
      ok: false,
      status: 400,
      code: 'pilot_scope_incomplete',
    });

    const emptyTenant = validHeaders('admissions');
    emptyTenant.set('x-school-tenant-id', '   ');
    expect(resolvePilotOperatorSnapshot(emptyTenant, 'admissions')).toMatchObject({
      ok: false,
      status: 400,
      code: 'pilot_scope_incomplete',
    });
  });

  it.each([
    ['x-school-tenant-id', 'tenant-other'],
    ['x-school-campus-id', 'campus-other'],
    ['x-school-role', 'finance'],
    ['x-school-subject-id', 'different-subject'],
    ['x-school-assurance', 'aal2'],
  ] as const)('rejects mismatched %s snapshot scope', (header, value) => {
    const headers = validHeaders('admissions');
    headers.set(header, value);
    expect(resolvePilotOperatorSnapshot(headers, 'admissions')).toMatchObject({
      ok: false,
      status: 403,
      code: 'pilot_scope_denied',
    });
  });

  it.each(roles)('resolves a scoped %s snapshot with stable ETag evidence', (role) => {
    const generatedAt = '2026-08-01T12:34:56.000Z';
    const result = resolvePilotOperatorSnapshot(validHeaders(role), role, generatedAt);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected valid operator snapshot');

    expect(result.etag).toContain(`${PILOT_OPERATOR_TENANT_ID}:${PILOT_OPERATOR_CAMPUS_ID}:${role}`);
    expect(result.snapshot.generatedAt).toBe(generatedAt);
    expect(result.snapshot.scope).toMatchObject({
      tenantId: PILOT_OPERATOR_TENANT_ID,
      campusId: PILOT_OPERATOR_CAMPUS_ID,
      role,
      subjectId: pilotOperatorSubject(role),
      assurance: pilotOperatorAssurance(role),
    });
    expect(result.snapshot.scope.capabilities).toEqual(pilotOperatorCapabilities(role));
  });

  it('builds exact trusted headers from the role contract', () => {
    const headers = pilotOperatorHeaders('support');
    expect(Object.fromEntries(headers.entries())).toEqual({
      'x-school-assurance': 'aal2',
      'x-school-campus-id': PILOT_OPERATOR_CAMPUS_ID,
      'x-school-role': 'support',
      'x-school-subject-id': 'support-operator-1',
      'x-school-tenant-id': PILOT_OPERATOR_TENANT_ID,
    });
  });
});
