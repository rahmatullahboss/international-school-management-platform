export type ProductionOperatorCommandBody =
  | {
      readonly command: 'admissions.application.review.record';
      readonly applicationId: string;
      readonly expectedVersion: number;
      readonly recommendation: 'admit' | 'waitlist' | 'decline' | 'more-information';
      readonly score: number | null;
      readonly notes: string | null;
    }
  | {
      readonly command: 'finance.bank-line.reconcile';
      readonly bankStatementLineId: string;
      readonly paymentId: string;
      readonly reason: string;
    }
  | {
      readonly command: 'support.break-glass.request';
      readonly reason: string;
      readonly requestedMinutes: number;
    };

export type ProductionOperatorCommandResult =
  | {
      readonly state: 'accepted';
      readonly replayed: boolean;
      readonly commandId: string;
      readonly evidenceId: string;
      readonly acceptedAt: string;
    }
  | {
      readonly state: 'rejected';
      readonly code: string;
      readonly message: string;
      readonly requiredAssurance?: 'aal2';
      readonly currentVersion?: number;
    }
  | {
      readonly state: 'unavailable';
      readonly message: string;
    };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function acceptedResult(value: unknown): ProductionOperatorCommandResult | undefined {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.replayed !== 'boolean') {
    return undefined;
  }
  if (!isRecord(value.receipt)) return undefined;
  if (
    typeof value.receipt.commandId !== 'string' ||
    !UUID_PATTERN.test(value.receipt.commandId) ||
    typeof value.receipt.domainEvidenceId !== 'string' ||
    !UUID_PATTERN.test(value.receipt.domainEvidenceId) ||
    typeof value.receipt.acceptedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.receipt.acceptedAt))
  ) {
    return undefined;
  }
  return {
    state: 'accepted',
    replayed: value.replayed,
    commandId: value.receipt.commandId,
    evidenceId: value.receipt.domainEvidenceId,
    acceptedAt: value.receipt.acceptedAt,
  };
}

function rejectedResult(value: unknown): ProductionOperatorCommandResult | undefined {
  if (!isRecord(value) || !isRecord(value.error)) return undefined;
  if (typeof value.error.code !== 'string' || typeof value.error.message !== 'string') {
    return undefined;
  }
  const requiredAssurance = value.requiredAssurance === 'aal2' ? 'aal2' : undefined;
  const currentVersion =
    typeof value.currentVersion === 'number' &&
    Number.isSafeInteger(value.currentVersion) &&
    value.currentVersion > 0
      ? value.currentVersion
      : undefined;
  return {
    state: 'rejected',
    code: value.error.code,
    message: value.error.message,
    ...(requiredAssurance === undefined ? {} : { requiredAssurance }),
    ...(currentVersion === undefined ? {} : { currentVersion }),
  };
}

export async function submitProductionOperatorCommand(
  body: ProductionOperatorCommandBody,
  idempotencyKey: string,
): Promise<ProductionOperatorCommandResult> {
  try {
    const response = await fetch('/auth/v1/operator/commands', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    const value: unknown = await response.json();
    if (response.ok) {
      return (
        acceptedResult(value) ?? {
          state: 'unavailable',
          message: 'The command response could not be verified.',
        }
      );
    }
    return (
      rejectedResult(value) ?? {
        state: 'unavailable',
        message: 'The command response could not be verified.',
      }
    );
  } catch {
    return {
      state: 'unavailable',
      message: 'The command service could not be reached.',
    };
  }
}

export function newOperatorIdempotencyKey(command: ProductionOperatorCommandBody['command']): string {
  const prefix =
    command === 'admissions.application.review.record'
      ? 'admissions'
      : command === 'finance.bank-line.reconcile'
        ? 'finance'
        : 'support';
  return `${prefix}:${crypto.randomUUID()}`;
}
