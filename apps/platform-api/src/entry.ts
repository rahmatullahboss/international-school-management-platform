import coreWorkerModule from './index.js';
import { handleAuthLoginRequest, type AuthLoginBindings } from './auth-login-routes.js';
import { handlePilotOperatorRequest, type PilotOperatorBindings } from './pilot-operator-api.js';

interface WorkerEnvironment extends PilotOperatorBindings, AuthLoginBindings {
  readonly APP_REGION: string;
  readonly [key: string]: unknown;
}

interface CoreWorker {
  fetch(
    request: Request,
    environment: WorkerEnvironment,
    executionContext: ExecutionContext,
  ): Response | Promise<Response>;
  scheduled?(
    controller: ScheduledController,
    environment: WorkerEnvironment,
    executionContext: ExecutionContext,
  ): void | Promise<void>;
}

const coreWorker = coreWorkerModule as unknown as CoreWorker;

const worker = {
  async fetch(
    request: Request,
    environment: WorkerEnvironment,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    const authResponse = await handleAuthLoginRequest(request, environment);
    if (authResponse !== undefined) return authResponse;
    const operatorResponse = await handlePilotOperatorRequest(request, environment);
    if (operatorResponse !== undefined) return operatorResponse;
    return coreWorker.fetch(request, environment, executionContext);
  },

  scheduled(
    controller: ScheduledController,
    environment: WorkerEnvironment,
    executionContext: ExecutionContext,
  ): void | Promise<void> {
    return coreWorker.scheduled?.(controller, environment, executionContext);
  },
};

export default worker;
