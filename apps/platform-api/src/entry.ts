import coreWorkerModule from './index.js';
import { handleAuthLoginRequest, type AuthLoginBindings } from './auth-login-routes.js';
import { handlePilotOperatorRequest, type PilotOperatorBindings } from './pilot-operator-api.js';
import { enforceProductionPilotBoundary } from './production-boundary.js';
import {
  enforceProductionDatabaseCredential,
  type ProductionDatabaseCredentialBindings,
} from './production-database-credential.js';
import {
  handleProductionOperatorCommandRequest,
  type ProductionOperatorCommandBindings,
} from './production-operator-command-api.js';
import {
  handleProductionOperatorWorkQueueRequest,
  type ProductionOperatorWorkQueueBindings,
} from './production-operator-work-queue-api.js';

interface WorkerEnvironment
  extends
    PilotOperatorBindings,
    AuthLoginBindings,
    ProductionDatabaseCredentialBindings,
    ProductionOperatorCommandBindings,
    ProductionOperatorWorkQueueBindings {
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
    const databaseCredentialResponse = await enforceProductionDatabaseCredential(
      request,
      environment,
    );
    if (databaseCredentialResponse !== undefined) return databaseCredentialResponse;

    const authResponse = await handleAuthLoginRequest(request, environment);
    if (authResponse !== undefined) return authResponse;
    const productionWorkQueueResponse = await handleProductionOperatorWorkQueueRequest(
      request,
      environment,
    );
    if (productionWorkQueueResponse !== undefined) return productionWorkQueueResponse;
    const productionOperatorResponse = await handleProductionOperatorCommandRequest(
      request,
      environment,
    );
    if (productionOperatorResponse !== undefined) return productionOperatorResponse;
    const productionBoundary = enforceProductionPilotBoundary(request, environment);
    if (productionBoundary !== undefined) return productionBoundary;
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
