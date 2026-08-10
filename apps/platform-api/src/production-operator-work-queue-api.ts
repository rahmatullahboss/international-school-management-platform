import { createHttpDatabase } from '@school/database';

import {
  resolveAuthenticatedBrowserSessionContext,
  type AuthBindings,
  type AuthenticatedBrowserSessionContextResult,
} from './auth-boundary.js';
import { DurableAuthStore } from './auth-durable-store.js';
import {
  DatabaseOperatorWorkQueueStore,
  type DatabaseOperatorWorkQueue,
} from './database-operator-work-queue-store.js';
import { DatabaseWorkspaceStore, type DatabaseWorkspaceRole } from './database-workspace-store.js';

export interface ProductionOperatorWorkQueueBindings extends AuthBindings {
  readonly APP_ENV: string;
  readonly DATABASE_URL?: string;
}

interface ProductionOperatorWorkQueueDependencies {
  readonly resolveSession: (
    environment: ProductionOperatorWorkQueueBindings,
    cookieHeader: string | undefined,
  ) => Promise<AuthenticatedBrowserSessionContextResult>;
  readonly resolveWorkspaceRole: (
    databaseUrl: string,
    sessionId: string,
  ) => Promise<DatabaseWorkspaceRole | undefined>;
  readonly resolveQueue: (
    databaseUrl: string,
    sessionId: string,
    role: 'admissions' | 'finance',
  ) => Promise<DatabaseOperatorWorkQueue | undefined>;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function errorResponse(code: string, message: string, status: number): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function configuredValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized === '' ? undefined : normalized;
}

function strongSecret(value: string | undefined): boolean {
  return value !== undefined && value.length >= 32;
}

function configured(environment: ProductionOperatorWorkQueueBindings): string | undefined {
  const databaseUrl = configuredValue(environment.DATABASE_URL);
  if (
    environment.APP_ENV !== 'production' ||
    databaseUrl === undefined ||
    environment.AUTH_SESSION_REGISTRY_SOURCE !== 'database' ||
    environment.AUTH_PERMISSION_SOURCE !== 'database' ||
    !strongSecret(configuredValue(environment.AUTH_SESSION_SECRET))
  ) {
    return undefined;
  }
  return databaseUrl;
}

const defaultDependencies: ProductionOperatorWorkQueueDependencies = {
  async resolveSession(environment, cookieHeader) {
    const databaseUrl = configuredValue(environment.DATABASE_URL);
    if (databaseUrl === undefined) {
      return {
        ok: false,
        status: 503,
        code: 'session_registry_unavailable',
        message: 'The browser session registry is unavailable.',
      };
    }
    const store = new DurableAuthStore(createHttpDatabase(databaseUrl));
    return resolveAuthenticatedBrowserSessionContext(environment, cookieHeader, (sessionId) =>
      store.isSessionActive(sessionId),
    );
  },
  async resolveWorkspaceRole(databaseUrl, sessionId) {
    const workspace = await new DatabaseWorkspaceStore(createHttpDatabase(databaseUrl)).resolve(
      sessionId,
    );
    return workspace?.role;
  },
  async resolveQueue(databaseUrl, sessionId, role) {
    const store = new DatabaseOperatorWorkQueueStore(createHttpDatabase(databaseUrl));
    return role === 'admissions' ? store.resolveAdmissions(sessionId) : store.resolve(sessionId);
  },
};

export async function handleProductionOperatorWorkQueueRequest(
  request: Request,
  environment: ProductionOperatorWorkQueueBindings,
  dependencies: ProductionOperatorWorkQueueDependencies = defaultDependencies,
): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (url.pathname !== '/auth/v1/operator/work-queue') return undefined;
  if (environment.APP_ENV !== 'production') return undefined;
  if (request.method !== 'GET') {
    return errorResponse('method_not_allowed', 'Method not allowed.', 405);
  }

  const databaseUrl = configured(environment);
  if (databaseUrl === undefined) {
    return errorResponse('operator_work_queue_unavailable', 'The work queue is unavailable.', 503);
  }

  const session = await dependencies.resolveSession(
    environment,
    request.headers.get('cookie') ?? undefined,
  );
  if (!session.ok) {
    return errorResponse(session.code, session.message, session.status);
  }

  let workspaceRole: DatabaseWorkspaceRole | undefined;
  try {
    workspaceRole = await dependencies.resolveWorkspaceRole(databaseUrl, session.context.sessionId);
  } catch {
    return errorResponse('operator_work_queue_unavailable', 'The work queue is unavailable.', 503);
  }
  if (workspaceRole !== 'admissions' && workspaceRole !== 'finance') {
    return errorResponse('operator_work_queue_denied', 'No operator work queue is available.', 403);
  }

  let queue: DatabaseOperatorWorkQueue | undefined;
  try {
    queue = await dependencies.resolveQueue(databaseUrl, session.context.sessionId, workspaceRole);
  } catch {
    return errorResponse('operator_work_queue_unavailable', 'The work queue is unavailable.', 503);
  }
  if (queue === undefined || queue.role !== workspaceRole) {
    return errorResponse('operator_work_queue_denied', 'No operator work queue is available.', 403);
  }

  return jsonResponse(queue, 200);
}
