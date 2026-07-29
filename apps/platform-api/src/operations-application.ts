import type {
  OperationsApiDependencies,
  OperationsCommandInput,
  OperationsCommandName,
  OperationsPrincipal,
  OperationsReportInput,
  OperationsReportName,
  OperationsSummaryInput,
} from './operations-routes.js';

export type OperationsMetricTone = 'neutral' | 'positive' | 'warning' | 'critical';
export type OperationsExceptionSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface OperationsSummaryMetric {
  readonly id: string;
  readonly domain: string;
  readonly label: string;
  readonly value: number | string;
  readonly context: string;
  readonly source: string;
  readonly tone: OperationsMetricTone;
}

export interface OperationsSummaryException {
  readonly id: string;
  readonly domain: string;
  readonly severity: OperationsExceptionSeverity;
  readonly title: string;
  readonly detail: string;
  readonly owner: string;
  readonly href: string;
  readonly openedAt: string;
}

export interface OperationsSummaryQueue {
  readonly id: string;
  readonly domain: string;
  readonly label: string;
  readonly count: number;
  readonly oldestOpenedAt: string | null;
  readonly href: string;
}

export interface OperationsDomainSnapshot {
  readonly report: OperationsReportName;
  readonly metrics: readonly OperationsSummaryMetric[];
  readonly exceptions: readonly OperationsSummaryException[];
  readonly queues: readonly OperationsSummaryQueue[];
  readonly data: unknown;
}

export interface OperationsSummary {
  readonly asOf: string;
  readonly metrics: readonly OperationsSummaryMetric[];
  readonly exceptions: readonly OperationsSummaryException[];
  readonly queues: readonly OperationsSummaryQueue[];
  readonly coveredReports: readonly OperationsReportName[];
  readonly generatedAt: string;
}

export interface OperationsReportProvider {
  readonly report: OperationsReportName;
  readonly requiredPermission: string;
  readonly load: (input: OperationsReportInput) => Promise<OperationsDomainSnapshot>;
}

export interface OperationsCommandHandler {
  readonly command: OperationsCommandName;
  readonly requiredPermission: string;
  readonly stepUpRequired: boolean;
  readonly idempotencyRequired: boolean;
  readonly execute: (input: OperationsCommandInput) => Promise<unknown>;
}

export interface OperationsApplicationCoverage {
  readonly reportNames: readonly OperationsReportName[];
  readonly commandNames: readonly OperationsCommandName[];
  readonly duplicateReports: readonly OperationsReportName[];
  readonly duplicateCommands: readonly OperationsCommandName[];
}

function hasPermission(principal: OperationsPrincipal, required: string): boolean {
  if (principal.permissions.includes(required) || principal.permissions.includes('operations.*')) {
    return true;
  }
  const segments = required.split('.');
  for (let index = segments.length - 1; index > 0; index -= 1) {
    if (principal.permissions.includes(`${segments.slice(0, index).join('.')}.*`)) return true;
  }
  return false;
}

function duplicates<T extends string>(values: readonly T[]): readonly T[] {
  const seen = new Set<T>();
  const duplicate = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return Object.freeze([...duplicate].sort());
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

const severityOrder: Readonly<Record<OperationsExceptionSeverity, number>> = Object.freeze({
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
});

export class OperationsApplication implements OperationsApiDependencies {
  readonly #providers: ReadonlyMap<OperationsReportName, OperationsReportProvider>;
  readonly #handlers: ReadonlyMap<OperationsCommandName, OperationsCommandHandler>;
  readonly #coverage: OperationsApplicationCoverage;
  readonly #now: () => Date;

  constructor(
    providers: readonly OperationsReportProvider[],
    handlers: readonly OperationsCommandHandler[],
    now: () => Date = () => new Date(),
  ) {
    const duplicateReports = duplicates(providers.map((provider) => provider.report));
    const duplicateCommands = duplicates(handlers.map((handler) => handler.command));
    if (duplicateReports.length > 0) {
      throw new Error(`OPS_API_DUPLICATE_REPORT_PROVIDER:${duplicateReports.join(',')}`);
    }
    if (duplicateCommands.length > 0) {
      throw new Error(`OPS_API_DUPLICATE_COMMAND_HANDLER:${duplicateCommands.join(',')}`);
    }
    this.#providers = new Map(providers.map((provider) => [provider.report, provider]));
    this.#handlers = new Map(handlers.map((handler) => [handler.command, handler]));
    this.#coverage = Object.freeze({
      reportNames: freezeArray(providers.map((provider) => provider.report).sort()),
      commandNames: freezeArray(handlers.map((handler) => handler.command).sort()),
      duplicateReports,
      duplicateCommands,
    });
    this.#now = now;
  }

  get coverage(): OperationsApplicationCoverage {
    return this.#coverage;
  }

  async getSummary(input: OperationsSummaryInput): Promise<OperationsSummary> {
    const providers = [...this.#providers.values()].filter((provider) =>
      hasPermission(input.principal, provider.requiredPermission),
    );
    const snapshots = await Promise.all(
      providers.map((provider) =>
        provider.load({
          report: provider.report,
          asOf: input.asOf,
          principal: input.principal,
          resourceId: null,
        }),
      ),
    );
    const metrics = snapshots.flatMap((snapshot) => snapshot.metrics);
    const exceptions = snapshots
      .flatMap((snapshot) => snapshot.exceptions)
      .sort(
        (left, right) =>
          severityOrder[left.severity] - severityOrder[right.severity] ||
          left.openedAt.localeCompare(right.openedAt) ||
          left.id.localeCompare(right.id),
      );
    const queues = snapshots
      .flatMap((snapshot) => snapshot.queues)
      .filter((queue) => queue.count > 0)
      .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
    return Object.freeze({
      asOf: input.asOf,
      metrics: freezeArray(metrics),
      exceptions: freezeArray(exceptions),
      queues: freezeArray(queues),
      coveredReports: freezeArray(snapshots.map((snapshot) => snapshot.report).sort()),
      generatedAt: this.#now().toISOString(),
    });
  }

  async getReport(input: OperationsReportInput): Promise<unknown> {
    const provider = this.#providers.get(input.report);
    if (!provider) throw new Error(`OPS_API_REPORT_NOT_CONFIGURED:${input.report}`);
    if (!hasPermission(input.principal, provider.requiredPermission)) {
      throw new Error(`OPS_PERMISSION_DENIED:${provider.requiredPermission}`);
    }
    const snapshot = await provider.load(input);
    if (snapshot.report !== input.report) {
      throw new Error(`OPS_API_REPORT_MISMATCH:${input.report}:${snapshot.report}`);
    }
    return snapshot.data;
  }

  async executeCommand(input: OperationsCommandInput): Promise<unknown> {
    const handler = this.#handlers.get(input.command);
    if (!handler) throw new Error(`OPS_API_COMMAND_NOT_CONFIGURED:${input.command}`);
    if (!hasPermission(input.principal, handler.requiredPermission)) {
      throw new Error(`OPS_PERMISSION_DENIED:${handler.requiredPermission}`);
    }
    if (handler.stepUpRequired && input.principal.assurance !== 'aal2') {
      throw new Error('OPS_STEP_UP_REQUIRED');
    }
    if (handler.idempotencyRequired && input.idempotencyKey === null) {
      throw new Error('OPS_IDEMPOTENCY_KEY_REQUIRED');
    }
    return await handler.execute(input);
  }
}
