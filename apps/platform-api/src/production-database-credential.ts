import { createHttpDatabase, type HttpDatabase } from '@school/database';

export interface ProductionDatabaseCredentialBindings {
  readonly APP_ENV?: string;
  readonly DATABASE_URL?: string;
}

export interface ProductionDatabaseCredentialDependencies {
  readonly verify: (databaseUrl: string) => Promise<boolean>;
}

interface CredentialReadinessRow extends Record<string, unknown> {
  readonly ready: unknown;
}

const READINESS_PATH = '/auth/v1/database-credential/readiness';
const BASE_AUTH_READINESS_PATH = '/auth/v1/readiness';

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function configuredDatabaseUrl(
  environment: ProductionDatabaseCredentialBindings,
): string | undefined {
  const databaseUrl = environment.DATABASE_URL?.trim();
  return databaseUrl ? databaseUrl : undefined;
}

export async function verifyProductionDatabaseCredential(database: HttpDatabase): Promise<boolean> {
  const rows = await database.query<CredentialReadinessRow>(
    'SELECT platform.production_runtime_credential_ready() AS ready',
  );
  return rows.length === 1 && rows[0]?.ready === true;
}

async function defaultVerify(databaseUrl: string): Promise<boolean> {
  return verifyProductionDatabaseCredential(createHttpDatabase(databaseUrl));
}

function errorPayload(code: string, message: string): object {
  return {
    error: {
      code,
      message,
    },
  };
}

async function resolveCredentialReadiness(
  environment: ProductionDatabaseCredentialBindings,
  dependencies: ProductionDatabaseCredentialDependencies,
): Promise<'ready' | 'unavailable' | 'invalid'> {
  const databaseUrl = configuredDatabaseUrl(environment);
  if (databaseUrl === undefined) return 'unavailable';
  try {
    return (await dependencies.verify(databaseUrl)) ? 'ready' : 'invalid';
  } catch {
    return 'invalid';
  }
}

export async function enforceProductionDatabaseCredential(
  request: Request,
  environment: ProductionDatabaseCredentialBindings,
  dependencies: ProductionDatabaseCredentialDependencies = { verify: defaultVerify },
): Promise<Response | undefined> {
  if (environment.APP_ENV !== 'production') return undefined;

  const pathname = new URL(request.url).pathname;
  if (pathname === BASE_AUTH_READINESS_PATH) return undefined;
  if (pathname !== READINESS_PATH && !pathname.startsWith('/auth/')) return undefined;

  if (pathname === READINESS_PATH && request.method !== 'GET' && request.method !== 'HEAD') {
    return jsonResponse(
      errorPayload('method_not_allowed', 'Only GET and HEAD are supported.'),
      405,
    );
  }

  const readiness = await resolveCredentialReadiness(environment, dependencies);
  if (readiness === 'ready') {
    if (pathname === READINESS_PATH) {
      return jsonResponse({ schemaVersion: 1, ready: true }, 200);
    }
    return undefined;
  }

  const code =
    readiness === 'unavailable'
      ? 'production_database_credential_unavailable'
      : 'production_database_credential_invalid';
  const message =
    readiness === 'unavailable'
      ? 'The production database credential is unavailable.'
      : 'The production database credential is not authorized.';

  if (pathname === READINESS_PATH) {
    return jsonResponse({ schemaVersion: 1, ready: false, ...errorPayload(code, message) }, 503);
  }
  return jsonResponse(errorPayload(code, message), 503);
}
