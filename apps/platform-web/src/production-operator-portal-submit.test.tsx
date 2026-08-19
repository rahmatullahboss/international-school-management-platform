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

import type { ProductionWorkspace } from './production-gateway.js';
import type {
  ProductionOperatorCommandBody,
  ProductionOperatorCommandResult,
} from './production-operator-command.js';
import type { ProductionOperatorWorkQueue } from './production-operator-work-queue.js';

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
  call: 0,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactTypes>();
  return {
    ...actual,
    useEffect: ((effect: EffectCallback) => {
      void effect;
    }) as typeof actual.useEffect,
    useState: ((initialState: unknown) => {
      const index = stateMocks.call++;
      const setter = vi.fn();
      stateMocks.setters[index] = setter;
      const injected = stateMocks.values[index];
      return [injected === undefined ? initialState : injected, setter];
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

const financeCandidate = {
  bankStatementLineId: '11111111-1111-4111-8111-111111111111',
  bookingDate: '2026-08-19',
  amountMinor: '125000',
  currency: 'BDT',
  paymentId: '22222222-2222-4222-8222-222222222222',
  paymentReceivedAt: '2026-08-19T05:30:00.000Z',
} as const;

const financeQueue: ProductionOperatorWorkQueue = {
  state: 'ready',
  role: 'finance',
  items: [financeCandidate],
};

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

async function commandPanel(
  workspace: ProductionWorkspace,
  pathname: string,
): Promise<ReactElement> {
  const { ProductionOperatorPortal } = await import('./production-operator-portal.js');
  const portal = ProductionOperatorPortal({ workspace, pathname });
  const element = findElement(
    portal,
    (candidate) =>
      typeof candidate.type === 'function' && candidate.type.name === 'OperatorCommandPanel',
  );
  if (element === undefined || typeof element.type !== 'function') {
    throw new Error('expected operator command panel');
  }
  stateMocks.call = 0;
  const Component = element.type as unknown as (props: unknown) => ReactElement;
  return Component(element.props);
}

function formFrom(
  panel: ReactElement,
): ReactElement<{ onSubmit: (event: FormEvent<HTMLFormElement>) => void }> {
  const form = findElement(panel, (element) => element.type === 'form');
  if (form === undefined) throw new Error('expected operator command form');
  return form as ReactElement<{ onSubmit: (event: FormEvent<HTMLFormElement>) => void }>;
}

class TestFormData {
  private readonly values: Readonly<Record<string, string>>;

  constructor(form: HTMLFormElement) {
    this.values = (form as unknown as { readonly values: Readonly<Record<string, string>> }).values;
  }

  get(key: string): string | null {
    return this.values[key] ?? null;
  }
}

function submitEvent(values: Readonly<Record<string, string>>): FormEvent<HTMLFormElement> {
  return {
    preventDefault: vi.fn(),
    currentTarget: { values } as unknown as HTMLFormElement,
  } as unknown as FormEvent<HTMLFormElement>;
}

beforeEach(() => {
  vi.resetModules();
  commandMocks.submitProductionOperatorCommand.mockReset();
  commandMocks.newOperatorIdempotencyKey.mockClear();
  queueMocks.loadProductionOperatorWorkQueue.mockReset();
  stateMocks.values = [];
  stateMocks.setters = [];
  stateMocks.call = 0;
  vi.stubGlobal('FormData', TestFormData);
});

describe('ProductionOperatorPortal command submission', () => {
  it('submits only the selected finance queue identities and refreshes the queue after acceptance', async () => {
    const accepted: ProductionOperatorCommandResult = {
      state: 'accepted',
      replayed: false,
      commandId: '33333333-3333-4333-8333-333333333333',
      evidenceId: '44444444-4444-4444-8444-444444444444',
      acceptedAt: '2026-08-19T06:00:00.000Z',
    };
    commandMocks.submitProductionOperatorCommand.mockResolvedValue(accepted);
    queueMocks.loadProductionOperatorWorkQueue.mockResolvedValue({
      state: 'ready',
      role: 'finance',
      items: [],
    } satisfies ProductionOperatorWorkQueue);
    stateMocks.values = [false, undefined, financeQueue];
    const workspace: ProductionWorkspace = {
      role: 'finance',
      path: '/finance/reconciliation',
      assurance: 'aal2',
      expiresAt: '2099-01-01T00:00:00.000Z',
      capabilities: ['finance.reconciliation.write'],
    };
    const panel = await commandPanel(workspace, '/finance/reconciliation');
    const form = formFrom(panel);

    form.props.onSubmit(
      submitEvent({
        candidate: `${financeCandidate.bankStatementLineId}:${financeCandidate.paymentId}`,
        reason: '  matched against settled receipt  ',
      }),
    );

    await vi.waitFor(() =>
      expect(commandMocks.submitProductionOperatorCommand).toHaveBeenCalledOnce(),
    );
    expect(commandMocks.newOperatorIdempotencyKey).toHaveBeenCalledWith(
      'finance.bank-line.reconcile',
    );
    expect(commandMocks.submitProductionOperatorCommand).toHaveBeenCalledWith(
      {
        command: 'finance.bank-line.reconcile',
        bankStatementLineId: financeCandidate.bankStatementLineId,
        paymentId: financeCandidate.paymentId,
        reason: 'matched against settled receipt',
      },
      'key:finance.bank-line.reconcile',
    );
    await vi.waitFor(() =>
      expect(queueMocks.loadProductionOperatorWorkQueue).toHaveBeenCalledOnce(),
    );
    expect(stateMocks.setters[0]).toHaveBeenCalledWith(true);
    expect(stateMocks.setters[0]).toHaveBeenCalledWith(false);
    expect(stateMocks.setters[1]).toHaveBeenCalledWith(undefined);
    expect(stateMocks.setters[1]).toHaveBeenCalledWith(accepted);
  });

  it('submits a support break-glass request without a queue refresh and preserves AAL2 rejection', async () => {
    const rejected: ProductionOperatorCommandResult = {
      state: 'rejected',
      code: 'ASSURANCE_REQUIRED',
      message: 'Fresh AAL2 authentication is required.',
      requiredAssurance: 'aal2',
    };
    commandMocks.submitProductionOperatorCommand.mockResolvedValue(rejected);
    stateMocks.values = [false, undefined, undefined];
    const workspace: ProductionWorkspace = {
      role: 'support',
      path: '/support/access',
      assurance: 'aal1',
      expiresAt: '2099-01-01T00:00:00.000Z',
      capabilities: ['support.break-glass.request'],
    };
    const panel = await commandPanel(workspace, '/support/access');
    const form = formFrom(panel);

    form.props.onSubmit(
      submitEvent({
        reason: '  investigate tenant incident  ',
        requestedMinutes: '20',
      }),
    );

    await vi.waitFor(() =>
      expect(commandMocks.submitProductionOperatorCommand).toHaveBeenCalledOnce(),
    );
    expect(commandMocks.newOperatorIdempotencyKey).toHaveBeenCalledWith(
      'support.break-glass.request',
    );
    expect(commandMocks.submitProductionOperatorCommand).toHaveBeenCalledWith(
      {
        command: 'support.break-glass.request',
        reason: 'investigate tenant incident',
        requestedMinutes: 20,
      },
      'key:support.break-glass.request',
    );
    expect(queueMocks.loadProductionOperatorWorkQueue).not.toHaveBeenCalled();
    expect(stateMocks.setters[1]).toHaveBeenCalledWith(rejected);
    expect(stateMocks.setters[0]).toHaveBeenCalledWith(false);
  });
});
