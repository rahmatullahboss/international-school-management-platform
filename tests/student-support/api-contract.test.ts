import { describe, expect, test } from 'vitest';

import {
  CARE_API_V1_ROUTES,
  authorizeCareApiRoute,
  createCareApiError,
  createCareApiEnvelope,
  type CareRequestContext,
} from '../../packages/modules/safeguarding/src/index.js';

function context(overrides: Partial<CareRequestContext> = {}): CareRequestContext {
  return {
    tenantId: 'tenant-a',
    principalId: 'principal-1',
    linkedPersonId: 'person-1',
    persona: 'learning-support',
    assurance: 'aal2',
    purpose: 'student-support-plan',
    correlationId: 'api-correlation-1',
    membershipActive: true,
    permissions: ['care.learning-support.assessment.read'],
    ...overrides,
  };
}

function contextWithoutTenant(): CareRequestContext {
  const value = context();
  delete value.tenantId;
  return value;
}

describe('CARE restricted API v1', () => {
  test('publishes unique versioned routes with bounded sensitive queries', () => {
    expect(new Set(CARE_API_V1_ROUTES.map((route) => route.id)).size).toBe(
      CARE_API_V1_ROUTES.length,
    );
    expect(new Set(CARE_API_V1_ROUTES.map((route) => `${route.method}:${route.path}`)).size).toBe(
      CARE_API_V1_ROUTES.length,
    );
    expect(CARE_API_V1_ROUTES.every((route) => route.version === 'v1')).toBe(true);
    expect(
      CARE_API_V1_ROUTES.filter((route) => route.method === 'GET').every(
        (route) => route.boundedQuery,
      ),
    ).toBe(true);
    expect(
      CARE_API_V1_ROUTES.filter(
        (route) =>
          route.audience === 'teacher-projection' ||
          route.audience === 'portal-projection' ||
          route.audience === 'privacy-review',
      ).every((route) => !route.allowsNarrativeResponse),
    ).toBe(true);
  });

  test('denies missing context and permission with masked not-found semantics', () => {
    expect(
      authorizeCareApiRoute({
        routeId: 'learning-support.assessment.read',
        context: contextWithoutTenant(),
      }),
    ).toMatchObject({
      allowed: false,
      status: 404,
      code: 'CARE_API_CONTEXT_REQUIRED',
      masked: true,
    });
    expect(
      authorizeCareApiRoute({
        routeId: 'learning-support.assessment.read',
        context: context({ permissions: [] }),
      }),
    ).toMatchObject({
      allowed: false,
      status: 404,
      code: 'CARE_API_PERMISSION_DENIED',
      masked: true,
    });
  });

  test('requires exact purpose and AAL2 for safeguarding case access', () => {
    expect(
      authorizeCareApiRoute({
        routeId: 'safeguarding.case.read',
        context: context({
          persona: 'safeguarding-case-member',
          assurance: 'aal1',
          purpose: 'safeguarding-assessment',
          permissions: ['care.safeguarding.read'],
        }),
      }),
    ).toMatchObject({ allowed: false, code: 'CARE_API_STEP_UP_REQUIRED' });
    expect(
      authorizeCareApiRoute({
        routeId: 'safeguarding.case.read',
        context: context({
          persona: 'safeguarding-case-member',
          assurance: 'aal2',
          purpose: 'direct-care',
          permissions: ['care.safeguarding.read'],
        }),
      }),
    ).toMatchObject({ allowed: false, code: 'CARE_API_PURPOSE_DENIED', masked: true });
    expect(
      authorizeCareApiRoute({
        routeId: 'safeguarding.case.read',
        context: context({
          persona: 'safeguarding-case-member',
          assurance: 'aal2',
          purpose: 'safeguarding-assessment',
          permissions: ['care.safeguarding.read'],
        }),
      }),
    ).toMatchObject({ allowed: true, code: 'CARE_API_ALLOWED' });
  });

  test('rejects unbounded page sizes before domain query execution', () => {
    expect(
      authorizeCareApiRoute({
        routeId: 'health.profile.read',
        pageSize: 101,
        context: context({
          persona: 'nurse',
          purpose: 'direct-care',
          permissions: ['care.health.read'],
        }),
      }),
    ).toMatchObject({ allowed: false, status: 400, code: 'CARE_API_PAGE_SIZE_INVALID' });
  });

  test('creates stable envelopes and removes sensitive detail from masked errors', () => {
    expect(createCareApiEnvelope('correlation-1', { status: 'accepted' })).toEqual({
      version: 'v1',
      correlationId: 'correlation-1',
      data: { status: 'accepted' },
    });
    expect(
      createCareApiError({
        correlationId: 'correlation-1',
        code: 'SAFEGUARDING_MEMBERSHIP_INVALID',
        masked: true,
      }),
    ).toEqual({
      version: 'v1',
      correlationId: 'correlation-1',
      error: {
        code: 'CARE_NOT_FOUND',
        message: 'The requested resource was not found.',
        retryable: false,
      },
    });
  });
});
