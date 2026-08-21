import { Hono } from 'hono';

import { createHttpDatabase } from '@school/database';

import { readBoundedUtf8RequestBody } from './bounded-request-body.js';
import { DatabaseMobileFamilyDocumentStore } from './database-mobile-family-document-store.js';
import { authenticateMobileBearer, type MobileAuthBindings } from './mobile-auth.js';
import { isEmptyMobileMutationBody } from './mobile-device-session.js';
import {
  isMobileFamilyDocumentIdempotencyKey,
  parseMobileFamilyDocumentCursor,
  parseMobileFamilyDocumentLimit,
} from './mobile-family-document.js';
import {
  resolveMobileFamilyDocumentObject,
  type MobileDocumentBucket,
} from './mobile-family-document-storage.js';
import { isMobileUuid, resolveMobileRequestScope } from './mobile-request-scope.js';

interface MobileFamilyDocumentBindings extends MobileAuthBindings {
  readonly DATABASE_URL?: string;
  readonly MOBILE_DOCUMENT_BUCKET?: MobileDocumentBucket;
}

const app = new Hono<{ Bindings: MobileFamilyDocumentBindings }>();
const familyMobilePersonas = new Set(['guardian', 'student'] as const);

function databaseUrl(env: MobileFamilyDocumentBindings): string | undefined {
  const value = env.DATABASE_URL?.trim();
  if (value === undefined || value === '' || env.MOBILE_MEMBERSHIP_SOURCE?.trim() !== 'database') {
    return undefined;
  }
  return value;
}

function familyScope(context: { req: { header(name: string): string | undefined } }) {
  return resolveMobileRequestScope(
    {
      tenantId: context.req.header('x-tenant-id'),
      campusId: context.req.header('x-campus-id'),
      persona: context.req.header('x-persona'),
    },
    familyMobilePersonas,
  );
}

app.get('/v1/mobile/family/students/:studentId/documents', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) {
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
  const scope = familyScope(context);
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }
  const studentId = context.req.param('studentId');
  const rawLimit = context.req.query('limit');
  const rawCursor = context.req.query('cursor');
  const limit = parseMobileFamilyDocumentLimit(rawLimit);
  const cursor = parseMobileFamilyDocumentCursor(rawCursor);
  if (
    !isMobileUuid(studentId) ||
    limit === undefined ||
    (rawCursor !== undefined && cursor === undefined)
  ) {
    return context.json(
      {
        error: {
          code: 'mobile_document_query_invalid',
          message: 'The mobile document request is invalid.',
        },
      },
      400,
    );
  }
  const authentication = await authenticateMobileBearer(
    context.env,
    context.req.header('authorization'),
  );
  if (!authentication.ok) {
    return context.json(
      { error: { code: authentication.code, message: authentication.message } },
      authentication.status,
    );
  }
  try {
    const payload = await new DatabaseMobileFamilyDocumentStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).listDocuments(authentication.identity, scope.scope, studentId, cursor, limit);
    if (payload === undefined) {
      return context.json(
        {
          error: {
            code: 'mobile_scope_denied',
            message: 'The selected student is not authorized for mobile documents.',
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
          code: 'mobile_document_temporarily_unavailable',
          message: 'Mobile documents are temporarily unavailable.',
        },
      },
      503,
    );
  }
});

app.post('/v1/mobile/family/documents/:documentId/download-grants', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) {
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
  const scope = familyScope(context);
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }
  const documentId = context.req.param('documentId');
  const idempotencyKey = context.req.header('idempotency-key');
  if (
    !isMobileUuid(documentId) ||
    !isMobileFamilyDocumentIdempotencyKey(idempotencyKey) ||
    !isEmptyMobileMutationBody(await readBoundedUtf8RequestBody(context.req.raw.body, 2 * 1024))
  ) {
    return context.json(
      {
        error: {
          code: 'mobile_document_grant_invalid',
          message: 'The mobile document grant request is invalid.',
        },
      },
      400,
    );
  }
  const authentication = await authenticateMobileBearer(
    context.env,
    context.req.header('authorization'),
  );
  if (!authentication.ok) {
    return context.json(
      { error: { code: authentication.code, message: authentication.message } },
      authentication.status,
    );
  }
  try {
    const payload = await new DatabaseMobileFamilyDocumentStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).issueDownloadGrant(authentication.identity, scope.scope, documentId, idempotencyKey);
    if (payload === undefined) {
      return context.json(
        {
          error: {
            code: 'mobile_scope_denied',
            message: 'The requested document is not authorized for this mobile scope.',
          },
        },
        403,
      );
    }
    if ('status' in payload && payload.status === 'idempotency-conflict') {
      return context.json(
        {
          error: {
            code: 'mobile_document_idempotency_conflict',
            message: 'The idempotency key was already used for a different document request.',
          },
        },
        409,
      );
    }
    return context.json(payload);
  } catch {
    return context.json(
      {
        error: {
          code: 'mobile_document_temporarily_unavailable',
          message: 'Mobile document grants are temporarily unavailable.',
        },
      },
      503,
    );
  }
});

app.post('/v1/mobile/family/document-download-grants/:grantId/exchange', async (context) => {
  context.header('cache-control', 'no-store');
  const resolvedDatabaseUrl = databaseUrl(context.env);
  if (resolvedDatabaseUrl === undefined) {
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
  const scope = familyScope(context);
  if (!scope.ok) {
    return context.json({ error: { code: scope.code, message: scope.message } }, scope.status);
  }
  const grantId = context.req.param('grantId');
  const idempotencyKey = context.req.header('idempotency-key');
  if (
    !isMobileUuid(grantId) ||
    !isMobileFamilyDocumentIdempotencyKey(idempotencyKey) ||
    !isEmptyMobileMutationBody(await readBoundedUtf8RequestBody(context.req.raw.body, 2 * 1024))
  ) {
    return context.json(
      {
        error: {
          code: 'mobile_document_exchange_invalid',
          message: 'The mobile document exchange request is invalid.',
        },
      },
      400,
    );
  }
  const authentication = await authenticateMobileBearer(
    context.env,
    context.req.header('authorization'),
  );
  if (!authentication.ok) {
    return context.json(
      { error: { code: authentication.code, message: authentication.message } },
      authentication.status,
    );
  }
  if (context.env.MOBILE_DOCUMENT_BUCKET === undefined) {
    return context.json(
      {
        error: {
          code: 'mobile_document_storage_unavailable',
          message: 'Secure mobile document storage is not configured.',
        },
      },
      503,
    );
  }
  try {
    const claim = await new DatabaseMobileFamilyDocumentStore(
      createHttpDatabase(resolvedDatabaseUrl),
    ).claimDownloadGrant(authentication.identity, scope.scope, grantId, idempotencyKey);
    if (claim === undefined) {
      return context.json(
        {
          error: {
            code: 'mobile_scope_denied',
            message: 'The requested document grant is not authorized for this mobile scope.',
          },
        },
        403,
      );
    }
    if (claim.status === 'step-up-required') {
      return context.json(
        {
          error: {
            code: 'mobile_document_step_up_required',
            message: 'This document requires a fresh higher-assurance sign-in.',
          },
        },
        403,
      );
    }
    if (claim.status === 'expired') {
      return context.json(
        {
          error: {
            code: 'mobile_document_grant_expired',
            message: 'The document grant has expired.',
          },
        },
        410,
      );
    }
    if (claim.status === 'already-consumed') {
      return context.json(
        {
          error: {
            code: 'mobile_document_grant_consumed',
            message: 'The single-use document grant has already been consumed.',
          },
        },
        409,
      );
    }
    if (claim.status !== 'claimed') {
      return context.json(
        {
          error: {
            code: 'mobile_document_temporarily_unavailable',
            message: 'Secure mobile document exchange is temporarily unavailable.',
          },
        },
        503,
      );
    }

    const object = await resolveMobileFamilyDocumentObject(
      context.env.MOBILE_DOCUMENT_BUCKET,
      claim,
    );
    if (object === undefined) {
      return context.json(
        {
          error: {
            code: 'mobile_document_storage_integrity_unavailable',
            message: 'The secure document object is unavailable or failed integrity checks.',
          },
        },
        503,
      );
    }
    return new Response(object.body, {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-length': String(claim.sizeBytes),
        'content-type': claim.contentType,
        'x-content-sha256': claim.sha256Hex,
        'x-content-type-options': 'nosniff',
        'x-document-id': claim.documentId,
      },
    });
  } catch {
    return context.json(
      {
        error: {
          code: 'mobile_document_temporarily_unavailable',
          message: 'Secure mobile document exchange is temporarily unavailable.',
        },
      },
      503,
    );
  }
});

export default app;
