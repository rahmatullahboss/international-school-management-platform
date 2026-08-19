import type { MobileReadPersona, MobileReadScope } from './database-mobile-read-store.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type MobileScopeResolution =
  | { readonly ok: true; readonly scope: MobileReadScope }
  | {
      readonly ok: false;
      readonly status: 400 | 403;
      readonly code: 'mobile_scope_required' | 'mobile_scope_invalid' | 'mobile_persona_denied';
      readonly message: string;
    };

export function isMobileUuid(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

export function resolveMobileRequestScope(
  headers: Readonly<{
    tenantId: string | undefined;
    campusId: string | undefined;
    persona: string | undefined;
  }>,
  allowedPersonas: ReadonlySet<MobileReadPersona>,
): MobileScopeResolution {
  const tenantId = headers.tenantId?.trim();
  const campusId = headers.campusId?.trim();
  const persona = headers.persona?.trim().toLowerCase();
  if (
    tenantId === undefined ||
    tenantId === '' ||
    campusId === undefined ||
    campusId === '' ||
    persona === undefined ||
    persona === ''
  ) {
    return {
      ok: false,
      status: 400,
      code: 'mobile_scope_required',
      message: 'Tenant, campus, and persona request scope is required.',
    };
  }
  if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(campusId)) {
    return {
      ok: false,
      status: 400,
      code: 'mobile_scope_invalid',
      message: 'The mobile request scope is invalid.',
    };
  }
  if (persona !== 'guardian' && persona !== 'student' && persona !== 'teacher') {
    return {
      ok: false,
      status: 400,
      code: 'mobile_scope_invalid',
      message: 'The mobile request scope is invalid.',
    };
  }
  if (!allowedPersonas.has(persona)) {
    return {
      ok: false,
      status: 403,
      code: 'mobile_persona_denied',
      message: 'The active mobile persona is not permitted for this resource.',
    };
  }
  return { ok: true, scope: { tenantId, campusId, persona } };
}
