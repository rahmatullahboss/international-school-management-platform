import {
  Children,
  isValidElement,
  type EffectCallback,
  type ReactElement,
  type ReactNode,
} from 'react';
import type * as ReactTypes from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductionOperatorCommandResult } from './production-operator-command.js';
import type {
  AdmissionsLifecycleCandidate,
  ProductionOperatorWorkQueue,
} from './production-operator-work-queue.js';

const reactMocks = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
  values: [] as unknown[],
  setters: [] as ReturnType<typeof vi.fn>[],
  stateCall: 0,
}));

const queueMocks = vi.hoisted(() => ({
  loadProductionOperatorWorkQueue: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactTypes>();
  return {
    ...actual,
    useEffect: ((effect: EffectCallback) => {
      reactMocks.effects.push(effect);
    }) as typeof actual.useEffect,
    useMemo: ((factory: () => unknown) => factory()) as typeof actual.useMemo,
    useState: ((initialState: unknown) => {
      const index = reactMocks.stateCall++;
      const setter = vi.fn();
      reactMocks.setters[index] = setter;
      const value = Object.prototype.hasOwnProperty.call(reactMocks.values, index)
        ? reactMocks.values[index]
        : initialState;
      return [value, setter];
    }) as unknown as typeof actual.useState,
  };
});

vi.mock('./production-operator-work-queue', () => ({
  loadProductionOperatorWorkQueue: queueMocks.loadProductionOperatorWorkQueue,
}));

const reviewCandidate: AdmissionsLifecycleCandidate = {
  applicationId: '11111111-1111-4111-8111-111111111111',
  applicationNumber: 'APP-2026-0101',
  status: 'under-review',
  version: 3,
  submittedAt: '2026-08-18T08:30:00.000Z',
  action: 'review',
  placementOptions: [],
  offerExpiresAt: null,
  suggestedEffectiveFrom: null,
  effectiveFromMax: null,
};

const offeredCandidate: AdmissionsLifecycleCandidate = {
  applicationId: '22222222-2222-4222-8222-222222222222',
  applicationNumber: 'APP-2026-0102',
  status: 'offered',
  version: 6,
  submittedAt: '2026-08-17T07:15:00.000Z',
  action: 'accept-offer',
  placementOptions: [],
  offerExpiresAt: '2026-09-15T23:59:59.000Z',
  suggestedEffectiveFrom: null,
  effectiveFromMax: null,
};

function admissionsQueue(
  items: readonly AdmissionsLifecycleCandidate[],
): ProductionOperatorWorkQueue {
  return { state: 'ready', role: 'admissions', items };
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

async function renderPanel(
  options: {
    readonly queue?: ProductionOperatorWorkQueue;
    readonly selectedId?: string;
    readonly pending?: boolean;
    readonly result?: ProductionOperatorCommandResult;
    readonly capabilities?: readonly string[];
  } = {},
): Promise<{ readonly element: ReactElement; readonly html: string }> {
  reactMocks.values = [];
  reactMocks.stateCall = 0;
  if (options.queue !== undefined) reactMocks.values[0] = options.queue;
  if (options.selectedId !== undefined) reactMocks.values[1] = options.selectedId;
  if (options.pending !== undefined) reactMocks.values[2] = options.pending;
  if (options.result !== undefined) reactMocks.values[3] = options.result;
  const { ProductionAdmissionsLifecyclePanel } =
    await import('./production-admissions-lifecycle.js');
  const element = ProductionAdmissionsLifecyclePanel({ capabilities: options.capabilities ?? [] });
  return { element, html: renderToStaticMarkup(element) };
}

beforeEach(() => {
  vi.resetModules();
  reactMocks.effects.length = 0;
  reactMocks.values = [];
  reactMocks.setters.length = 0;
  reactMocks.stateCall = 0;
  queueMocks.loadProductionOperatorWorkQueue.mockReset();
});

describe('ProductionAdmissionsLifecyclePanel queue and UI lifecycle', () => {
  it('loads the current server-owned admissions queue and selects its first candidate', async () => {
    const queue = admissionsQueue([reviewCandidate, offeredCandidate]);
    queueMocks.loadProductionOperatorWorkQueue.mockResolvedValue(queue);
    const { html } = await renderPanel();

    expect(html).toContain('Loading admissions lifecycle…');
    expect(reactMocks.effects).toHaveLength(1);
    const cleanup = reactMocks.effects[0]?.();

    await vi.waitFor(() =>
      expect(queueMocks.loadProductionOperatorWorkQueue).toHaveBeenCalledOnce(),
    );
    expect(reactMocks.setters[0]).toHaveBeenCalledWith(queue);
    expect(reactMocks.setters[1]).toHaveBeenCalledWith(reviewCandidate.applicationId);
    expect(typeof cleanup).toBe('function');
    cleanup?.();
  });

  it('ignores a queue result that arrives after the component has been cleaned up', async () => {
    let resolveQueue: ((queue: ProductionOperatorWorkQueue) => void) | undefined;
    queueMocks.loadProductionOperatorWorkQueue.mockReturnValue(
      new Promise<ProductionOperatorWorkQueue>((resolve) => {
        resolveQueue = resolve;
      }),
    );
    await renderPanel();
    const cleanup = reactMocks.effects[0]?.();
    expect(typeof cleanup).toBe('function');
    cleanup?.();

    resolveQueue?.(admissionsQueue([reviewCandidate]));
    await Promise.resolve();
    await Promise.resolve();

    expect(reactMocks.setters[0]).not.toHaveBeenCalled();
    expect(reactMocks.setters[1]).not.toHaveBeenCalled();
  });

  it('renders loading, unavailable and empty queue states without exposing an action form', async () => {
    const loading = await renderPanel();
    const unavailable = await renderPanel({
      queue: { state: 'unavailable', message: 'Admissions queue unavailable.' },
    });
    const empty = await renderPanel({ queue: admissionsQueue([]) });

    expect(loading.html).toContain('Loading admissions lifecycle…');
    expect(unavailable.html).toContain('Admissions lifecycle unavailable');
    expect(unavailable.html).toContain('Admissions queue unavailable.');
    expect(empty.html).toContain('No actionable admissions work');
    expect(empty.html).not.toContain('<form');
  });

  it('fails closed when the current database grants do not permit the candidate action', async () => {
    const { element, html } = await renderPanel({
      queue: admissionsQueue([reviewCandidate, offeredCandidate]),
      selectedId: reviewCandidate.applicationId,
      capabilities: [],
    });

    expect(html).toContain('APP-2026-0101');
    expect(html).toContain('Action not granted');
    expect(html).toContain('admissions.application.review');
    expect(html).not.toContain('<form');

    const select = findElement(
      element,
      (candidate) =>
        candidate.type === 'select' &&
        (candidate.props as { readonly value?: unknown }).value === reviewCandidate.applicationId,
    );
    if (select === undefined) throw new Error('expected application selector');
    const onChange = (
      select.props as {
        readonly onChange?: (event: { readonly target: { readonly value: string } }) => void;
      }
    ).onChange;
    if (onChange === undefined) throw new Error('expected application selection handler');
    onChange({ target: { value: offeredCandidate.applicationId } });
    expect(reactMocks.setters[1]).toHaveBeenCalledWith(offeredCandidate.applicationId);
  });

  it('renders an offered candidate summary and pending action state with server-bounded context', async () => {
    const { html } = await renderPanel({
      queue: admissionsQueue([offeredCandidate]),
      selectedId: offeredCandidate.applicationId,
      pending: true,
      capabilities: ['admissions.application.offer.accept'],
    });

    expect(html).toContain('APP-2026-0102');
    expect(html).toContain('Accept admissions offer');
    expect(html).toContain('Offer expires');
    expect(html).toContain('Submitting…');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Checklist and contract requirements are already verified');
  });

  it('renders accepted, replayed, rejected and unavailable command feedback', async () => {
    const accepted = await renderPanel({
      queue: admissionsQueue([]),
      result: {
        state: 'accepted',
        replayed: false,
        commandId: '33333333-3333-4333-8333-333333333333',
        evidenceId: '44444444-4444-4444-8444-444444444444',
        acceptedAt: '2026-08-19T12:30:00.000Z',
      },
    });
    const replayed = await renderPanel({
      queue: admissionsQueue([]),
      result: {
        state: 'accepted',
        replayed: true,
        commandId: '55555555-5555-4555-8555-555555555555',
        evidenceId: '66666666-6666-4666-8666-666666666666',
        acceptedAt: '2026-08-19T12:31:00.000Z',
      },
    });
    const rejected = await renderPanel({
      queue: admissionsQueue([]),
      result: {
        state: 'rejected',
        code: 'VERSION_CONFLICT',
        message: 'The application changed before this action was recorded.',
        currentVersion: 9,
      },
    });
    const unavailable = await renderPanel({
      queue: admissionsQueue([]),
      result: { state: 'unavailable', message: 'Admissions command service unavailable.' },
    });

    expect(accepted.html).toContain('Lifecycle action accepted');
    expect(accepted.html).toContain('Evidence 44444444-4444-4444-8444-444444444444');
    expect(replayed.html).toContain('Existing receipt verified');
    expect(rejected.html).toContain('VERSION_CONFLICT');
    expect(rejected.html).toContain('Current record version: 9');
    expect(unavailable.html).toContain('Lifecycle action unavailable');
    expect(unavailable.html).toContain('Admissions command service unavailable.');
  });
});
