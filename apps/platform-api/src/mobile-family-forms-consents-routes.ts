import { Hono, type Context } from 'hono';

import { createHttpDatabase } from '@school/database';

import { readBoundedUtf8RequestBody } from './bounded-request-body.js';
import { DatabaseMobileFamilyFormsConsentsStore } from './database-mobile-family-forms-consents-store.js';
import { authenticateMobileBearer, type MobileAuthBindings } from './mobile-auth.js';
import {
  isMobileFamilyInteractionIdempotencyKey,
  parseFamilyConsentDecision,
  parseFamilyFormSubmission,
} from './mobile-family-forms-consents.js';
import { isMobileUuid, resolveMobileRequestScope } from './mobile-request-scope.js';

interface MobileFamilyFormsConsentsBindings extends MobileAuthBindings {
  readonly DATABASE_URL?: string;
}

type InteractionMutationStatus =
  | 'idempotency-conflict'
  | 'stale'
  | 'schema-mismatch'
  | 'policy-mismatch'
  | 'closed'
  | 'invalid-answers';

type MobileFamilyFormsConsentsContext = Context<{
  Bindings: MobileFamilyFormsConsentsBindings;
}>;

const app = new Hono<{ Bindings: MobileFamilyFormsConsentsBindings }>();
const guardianPersona = new Set(['guardian'] as const);

function databaseUrl(env: MobileFamilyFormsConsentsBindings): string | undefined {
  const value = env.DATABASE_URL?.trim();
  if (value === undefined || value === '' || env.MOBILE_MEMBERSHIP_SOURCE?.trim() !== 'database') {
    return undefined;
  }
  return value;
}

function guardianScope(context: { req: { header(name: string): string | undefined } }) {
  return resolveMobileRequestScope(
    {
      tenantId: context.req.header('x-tenant-id'),
      campusId: context.req.header('x-campus-id'),
      persona: context.req.header('x-persona'),
    },
    guardianPersona,
  );
}

function configurationUnavailable(context: MobileFamilyFormsConsentsContext) {
  return context.json(
    {
      error: {
        code: 'mobile_access_configuration_unavailable',
        message: 'Mobile account access is not configured.',
      },
    },
    503,
  );
}

function mutationFailure(
  context: MobileFamilyFormsConsentsContext,
  workflow: 'form' | 'consent',
  status: InteractionMutationStatus,
) {
  const code = `mobile_family_${workflow}_${status.replaceAll('-', '_')}`;
  const message =
    status === 'invalid-answers'
      ? 'The submitted form answers are invalid for the current form schema.'
      : `The Family ${workflow} request conflicts with the current server state.`;
  return context.json({ error: { code, message } }, status === 'invalid-answers' ? 400 : 409);
}

async function authenticate(context: MobileFamilyFormsConsentsContext) {
  const authentication = await authenticateMobileBearer(
    context.env,
    context.req.header('authorization'),
  );
  if (!authentication.ok) {
    return {
      response: context.json(
        { error: { code: authentication.code, message: authentication.message } },
        authentication.status,
      ),
    } as const;
  }
  return { identity: authentication.identity } as const;
}

app.get('/v1/mobile/family/students/:studentId/forms', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);
  const scope = guardianScope(context);
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }
  const studentId = context.req.param('studentId');
  if (!isMobileUuid(studentId)) {
    return context.json(
      {
        error: {
          code: 'mobile_student_invalid',
          message: 'The requested student identifier is invalid.',
        },
      },
      400,
    );
  }
  const authentication = await authenticate(context);
  if ('response' in authentication) return authentication.response;
  try {
    const payload = await new DatabaseMobileFamilyFormsConsentsStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).listForms(authentication.identity, scope.scope, studentId);
    if (payload === undefined) {
      return context.json(
        {
          error: {
            code: 'mobile_scope_denied',
            message: 'The selected student is not authorized for Family forms.',
          },
        },
        403,
      );
    }
    return context.json(payload);
  } catch {
    return context.json(
      {
        error: {
          code: 'mobile_family_forms_temporarily_unavailable',
          message: 'Family forms are temporarily unavailable.',
        },
      },
      503,
    );
  }
});

app.get('/v1/mobile/family/forms/:formId', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);
  const scope = guardianScope(context);
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }
  const formId = context.req.param('formId');
  if (!isMobileUuid(formId)) {
    return context.json(
      {
        error: {
          code: 'mobile_family_form_invalid',
          message: 'The requested form identifier is invalid.',
        },
      },
      400,
    );
  }
  const authentication = await authenticate(context);
  if ('response' in authentication) return authentication.response;
  try {
    const payload = await new DatabaseMobileFamilyFormsConsentsStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).loadForm(authentication.identity, scope.scope, formId);
    if (payload === undefined) {
      return context.json(
        {
          error: {
            code: 'mobile_scope_denied',
            message: 'The requested form is not authorized for this Family scope.',
          },
        },
        403,
      );
    }
    return context.json(payload);
  } catch {
    return context.json(
      {
        error: {
          code: 'mobile_family_form_temporarily_unavailable',
          message: 'The Family form is temporarily unavailable.',
        },
      },
      503,
    );
  }
});

app.post('/v1/mobile/family/forms/:formId/submit', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);
  const scope = guardianScope(context);
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }
  const formId = context.req.param('formId');
  const idempotencyKey = context.req.header('idempotency-key');
  const input = parseFamilyFormSubmission(
    await readBoundedUtf8RequestBody(context.req.raw.body, 64 * 1024),
  );
  if (
    !isMobileUuid(formId) ||
    !isMobileFamilyInteractionIdempotencyKey(idempotencyKey) ||
    input === undefined
  ) {
    return context.json(
      {
        error: {
          code: 'mobile_family_form_submission_invalid',
          message: 'The Family form submission is invalid.',
        },
      },
      400,
    );
  }
  const authentication = await authenticate(context);
  if ('response' in authentication) return authentication.response;
  try {
    const payload = await new DatabaseMobileFamilyFormsConsentsStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).submitForm(authentication.identity, scope.scope, formId, idempotencyKey, input);
    if (payload === undefined) {
      return context.json(
        {
          error: {
            code: 'mobile_scope_denied',
            message: 'The requested form is not authorized for this Family scope.',
          },
        },
        403,
      );
    }
    if ('status' in payload) return mutationFailure(context, 'form', payload.status);
    return context.json(payload);
  } catch {
    return context.json(
      {
        error: {
          code: 'mobile_family_form_temporarily_unavailable',
          message: 'The Family form submission is temporarily unavailable.',
        },
      },
      503,
    );
  }
});

app.get('/v1/mobile/family/students/:studentId/consents', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);
  const scope = guardianScope(context);
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }
  const studentId = context.req.param('studentId');
  if (!isMobileUuid(studentId)) {
    return context.json(
      {
        error: {
          code: 'mobile_student_invalid',
          message: 'The requested student identifier is invalid.',
        },
      },
      400,
    );
  }
  const authentication = await authenticate(context);
  if ('response' in authentication) return authentication.response;
  try {
    const payload = await new DatabaseMobileFamilyFormsConsentsStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).listConsents(authentication.identity, scope.scope, studentId);
    if (payload === undefined) {
      return context.json(
        {
          error: {
            code: 'mobile_scope_denied',
            message: 'The selected student is not authorized for Family consents.',
          },
        },
        403,
      );
    }
    return context.json(payload);
  } catch {
    return context.json(
      {
        error: {
          code: 'mobile_family_consents_temporarily_unavailable',
          message: 'Family consents are temporarily unavailable.',
        },
      },
      503,
    );
  }
});

app.post('/v1/mobile/family/consents/:consentId/decisions', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) return configurationUnavailable(context);
  const scope = guardianScope(context);
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }
  const consentId = context.req.param('consentId');
  const idempotencyKey = context.req.header('idempotency-key');
  const input = parseFamilyConsentDecision(
    await readBoundedUtf8RequestBody(context.req.raw.body, 8 * 1024),
  );
  if (
    !isMobileUuid(consentId) ||
    !isMobileFamilyInteractionIdempotencyKey(idempotencyKey) ||
    input === undefined
  ) {
    return context.json(
      {
        error: {
          code: 'mobile_family_consent_decision_invalid',
          message: 'The Family consent decision is invalid.',
        },
      },
      400,
    );
  }
  const authentication = await authenticate(context);
  if ('response' in authentication) return authentication.response;
  try {
    const payload = await new DatabaseMobileFamilyFormsConsentsStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).decideConsent(authentication.identity, scope.scope, consentId, idempotencyKey, input);
    if (payload === undefined) {
      return context.json(
        {
          error: {
            code: 'mobile_scope_denied',
            message: 'The requested consent is not authorized for this Family scope.',
          },
        },
        403,
      );
    }
    if ('status' in payload) return mutationFailure(context, 'consent', payload.status);
    return context.json(payload);
  } catch {
    return context.json(
      {
        error: {
          code: 'mobile_family_consent_temporarily_unavailable',
          message: 'The Family consent decision is temporarily unavailable.',
        },
      },
      503,
    );
  }
});

export default app;
