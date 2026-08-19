import {
  Children,
  isValidElement,
  type EffectCallback,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import type * as ReactTypes from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ProductionOperatorCommandBody,
  ProductionOperatorCommandResult,
} from './production-operator-command.js';
import type {
  AdmissionsLifecycleCandidate,
  ProductionOperatorWorkQueue,
} from './production-operator-work-queue.js';

const commandMocks = vi.hoisted(() => ({
  submitProductionOperatorCommand: vi.fn(),
  newOperatorIdempotencyKey: vi.fn(
    (command: ProductionOperatorCommandBody['command']) => `key:${command}`,
  ),
}));

const queueMocks = vi.hoisted(() => ({
  loadProductionOperatorWorkQueue: vi.fn(),
}));

const stateMocks = vi.hoisted(() => ({
  values: [] as unknown[],
  setters: [] as ReturnType<typeof vi.fn>[],
  stateCall: 0,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactTypes>();
  return {
    ...actual,
    useEffect: ((effect: EffectCallback) => {
      void effect;
    }) as typeof actual.useEffect,
    useMemo: ((factory: () => unknown) => factory()) as typeof actual.useMemo,
    useState: ((initialState: unknown) => {
      const index = stateMocks.stateCall++;
      const setter = vi.fn();
      stateMocks.setters[index] = setter;
      const value = Object.prototype.hasOwnProperty.call(stateMocks.values, index)
        ? stateMocks.values[index]
        : initialState;
      return [value, setter];
    }) as unknown as typeof actual.useState,
  };
});

vi.mock('./production-operator-command', () => ({
  submitProductionOperatorCommand: commandMocks.submitProductionOperatorCommand,
  newOperatorIdempotencyKey: commandMocks.newOperatorIdempotencyKey,
}));

vi.mock('./production-operator-work-queue', () => ({
  loadProductionOperatorWorkQueue: queueMocks.loadProductionOperatorWorkQueue,
}));

const placement = {
  programId: '11111111-1111-4111-8111-111111111111',
  programName: 'Primary Programme',
  academicYearId: '22222222-2222-4222-8222-222222222222',
  academicYearName: '2026/27',
  gradeLevelId: '33333333-3333-4333-8333-333333333333',
  gradeLevelLabel: 'Grade 4',
} as const;

function candidate(action: AdmissionsLifecycleCandidate['action']): AdmissionsLifecycleCandidate {
  const common = {
    applicationId: '44444444-4444-4444-8444-444444444444',
    applicationNumber: 'APP-2026-0042',
    version: 7,
    submittedAt: '2026-08-18T08:30:00.000Z',
  } as const;
  if (action === 'review') {
    return {
      ...common,
      status: 'under-review',
      action,
      placementOptions: [],
      offerExpiresAt: null,
      suggestedEffectiveFrom: null,
      effectiveFromMax: null,
    };
  }
  if (action === 'issue-offer') {
    return {
      ...common,
      status: 'under-review',
      action,
      placementOptions: [placement],
      offerExpiresAt: null,
      suggestedEffectiveFrom: null,
      effectiveFromMax: null,
    };
  }
  if (action === 'accept-offer') {
    return {
      ...common,
      status: 'offered',
      action,
      placementOptions: [],
      offerExpiresAt: '2026-09-15T23:59:59.000Z',
      suggestedEffectiveFrom: null,
      effectiveFromMax: null,
    };
  }
  return {
    ...common,
    status: 'accepted',
    action,
    placementOptions: [],
    offerExpiresAt: null,
    suggestedEffectiveFrom: '2026-09-01',
    effectiveFromMax: '2026-09-30',
  };
}

const permissions: Readonly<Record<AdmissionsLifecycleCandidate['action'], string>> = {
  review: 'admissions.application.review',
  'issue-offer': 'admissions.application.offer.issue',
  'accept-offer': 'admissions.application.offer.accept',
  'convert-applicant': 'admissions.application.applicant.convert',
};

class TestFormData {
  private readonly values: Readonly<Record<string, string>>;

  constructor(form: HTMLFormElement) {
    this.values = (form as unknown as { readonly values: Readonly<Record<string, string>> }).values;
  }

  get(key: string): string | null {
    return this.values[key] ?? null;
  }
}

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement) => boolean,
): ReactElement | undefined {
  if (!isValidElement(node)) return undefined;
  if (predicate(node)) return node;
  const props = node.props as { readonly children?: ReactNode };
  for (const child of Children.toArray(props.children)) {
    const found = findElement(child, predicate);
    if (found !== undefined) return found;
  }
  return undefined;
}

function submitEvent(values: Readonly<Record<string, string>>): FormEvent<HTMLFormElement> {
  return {
    preventDefault: vi.fn(),
    currentTarget: { values } as unknown as HTMLFormElement,
  } as unknown as FormEvent<HTMLFormElement>;
}

async function submitCandidate(
  item: AdmissionsLifecycleCandidate,
  values: Readonly<Record<string, string>>,
): Promise<void> {
  stateMocks.values[0] = {
    state: 'ready',
    role: 'admissions',
    items: [item],
  } satisfies ProductionOperatorWorkQueue;
  stateMocks.values[1] = item.applicationId;
  stateMocks.values[2] = false;
  const { ProductionAdmissionsLifecyclePanel } =
    await import('./production-admissions-lifecycle.js');
  const panel = ProductionAdmissionsLifecyclePanel({ capabilities: [permissions[item.action]] });
  const form = findElement(panel, (element) => element.type === 'form');
  if (form === undefined) throw new Error('expected lifecycle form');
  const onSubmit = (
    form.props as { readonly onSubmit?: (event: FormEvent<HTMLFormElement>) => void }
  ).onSubmit;
  if (onSubmit === undefined) throw new Error('expected lifecycle submit handler');
  onSubmit(submitEvent(values));
}

const rejectedResult: ProductionOperatorCommandResult = {
  state: 'rejected',
  code: 'TEST_REJECTION',
  message: 'Test rejection after body verification.',
};

beforeEach(() => {
  vi.resetModules();
  stateMocks.values = [];
  stateMocks.setters.length = 0;
  stateMocks.stateCall = 0;
  commandMocks.submitProductionOperatorCommand.mockReset();
  commandMocks.newOperatorIdempotencyKey.mockClear();
  queueMocks.loadProductionOperatorWorkQueue.mockReset();
  vi.stubGlobal('FormData', TestFormData);
});

describe('ProductionAdmissionsLifecyclePanel command submission', () => {
  it('records review evidence and reconciles the accepted server queue', async () => {
    const item = candidate('review');
    const accepted: ProductionOperatorCommandResult = {
      state: 'accepted',
      replayed: false,
      commandId: '55555555-5555-4555-8555-555555555555',
      evidenceId: '66666666-6666-4666-8666-666666666666',
      acceptedAt: '2026-08-19T12:00:00.000Z',
    };
    commandMocks.submitProductionOperatorCommand.mockResolvedValue(accepted);
    const refreshedQueue: ProductionOperatorWorkQueue = {
      state: 'ready',
      role: 'admissions',
      items: [item],
    };
    queueMocks.loadProductionOperatorWorkQueue.mockResolvedValue(refreshedQueue);

    await submitCandidate(item, {
      recommendation: 'admit',
      score: '88.5',
      notes: '  Strong candidate  ',
    });

    await vi.waitFor(() =>
      expect(commandMocks.submitProductionOperatorCommand).toHaveBeenCalledOnce(),
    );
    expect(commandMocks.newOperatorIdempotencyKey).toHaveBeenCalledWith(
      'admissions.application.review.record',
    );
    expect(commandMocks.submitProductionOperatorCommand).toHaveBeenCalledWith(
      {
        command: 'admissions.application.review.record',
        applicationId: item.applicationId,
        expectedVersion: 7,
        recommendation: 'admit',
        score: 88.5,
        notes: 'Strong candidate',
      },
      'key:admissions.application.review.record',
    );
    await vi.waitFor(() =>
      expect(queueMocks.loadProductionOperatorWorkQueue).toHaveBeenCalledOnce(),
    );
    expect(stateMocks.setters[0]).toHaveBeenCalledWith(refreshedQueue);
    const selectionSetter = stateMocks.setters[1];
    if (selectionSetter === undefined) throw new Error('expected selection setter');
    const selectionUpdater = selectionSetter.mock.calls.at(-1)?.[0] as
      ((current: string) => string) | undefined;
    expect(selectionUpdater).toBeDefined();
    expect(selectionUpdater?.(item.applicationId)).toBe(item.applicationId);
    expect(selectionUpdater?.('missing-application')).toBe(item.applicationId);
    expect(stateMocks.setters[2]).toHaveBeenCalledWith(true);
    expect(stateMocks.setters[2]).toHaveBeenCalledWith(false);
    expect(stateMocks.setters[3]).toHaveBeenCalledWith(accepted);
  });

  it('issues an offer only with a placement returned by the server-owned queue', async () => {
    const item = candidate('issue-offer');
    commandMocks.submitProductionOperatorCommand.mockResolvedValue(rejectedResult);
    const expiresAt = '2026-09-15T10:30';

    await submitCandidate(item, {
      placement: `${placement.programId}:${placement.academicYearId}:${placement.gradeLevelId}`,
      expiresAt,
    });

    await vi.waitFor(() =>
      expect(commandMocks.submitProductionOperatorCommand).toHaveBeenCalledOnce(),
    );
    expect(commandMocks.submitProductionOperatorCommand).toHaveBeenCalledWith(
      {
        command: 'admissions.application.offer.issue',
        applicationId: item.applicationId,
        expectedVersion: 7,
        programId: placement.programId,
        academicYearId: placement.academicYearId,
        gradeLevelId: placement.gradeLevelId,
        expiresAt: new Date(expiresAt).toISOString(),
      },
      'key:admissions.application.offer.issue',
    );
    expect(queueMocks.loadProductionOperatorWorkQueue).not.toHaveBeenCalled();
  });

  it('accepts only the exact current offer version from the queue', async () => {
    const item = candidate('accept-offer');
    commandMocks.submitProductionOperatorCommand.mockResolvedValue(rejectedResult);

    await submitCandidate(item, {});

    await vi.waitFor(() =>
      expect(commandMocks.submitProductionOperatorCommand).toHaveBeenCalledOnce(),
    );
    expect(commandMocks.submitProductionOperatorCommand).toHaveBeenCalledWith(
      {
        command: 'admissions.application.offer.accept',
        applicationId: item.applicationId,
        expectedVersion: 7,
      },
      'key:admissions.application.offer.accept',
    );
  });

  it('converts an accepted applicant using the server-bounded effective date', async () => {
    const item = candidate('convert-applicant');
    commandMocks.submitProductionOperatorCommand.mockResolvedValue(rejectedResult);

    await submitCandidate(item, { effectiveFrom: '2026-09-08' });

    await vi.waitFor(() =>
      expect(commandMocks.submitProductionOperatorCommand).toHaveBeenCalledOnce(),
    );
    expect(commandMocks.submitProductionOperatorCommand).toHaveBeenCalledWith(
      {
        command: 'admissions.application.applicant.convert',
        applicationId: item.applicationId,
        expectedVersion: 7,
        effectiveFrom: '2026-09-08',
      },
      'key:admissions.application.applicant.convert',
    );
  });

  it('fails closed when an offer placement was not returned by the server queue', async () => {
    const item = candidate('issue-offer');
    commandMocks.submitProductionOperatorCommand.mockResolvedValue(rejectedResult);

    await submitCandidate(item, {
      placement:
        '77777777-7777-4777-8777-777777777777:88888888-8888-4888-8888-888888888888:99999999-9999-4999-8999-999999999999',
      expiresAt: '2026-09-15T10:30',
    });

    expect(commandMocks.submitProductionOperatorCommand).not.toHaveBeenCalled();
    expect(stateMocks.setters[3]).toHaveBeenCalledWith({
      state: 'unavailable',
      message: 'Select a valid server-authorized placement and required values.',
    });
    expect(stateMocks.setters[2]).not.toHaveBeenCalledWith(true);
  });
});
