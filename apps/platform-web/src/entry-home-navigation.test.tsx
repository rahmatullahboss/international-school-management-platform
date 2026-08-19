import { beforeEach, describe, expect, it, vi } from 'vitest';

const rootMocks = vi.hoisted(() => ({
  render: vi.fn(),
  createRoot: vi.fn(() => ({ render: vi.fn() })),
}));

const gatewayMocks = vi.hoisted(() => ({
  isProductionWebHost: vi.fn(() => false),
  resolveProductionWorkspace: vi.fn(),
  mountProductionGate: vi.fn(),
  pathBelongsToWorkspace: vi.fn(),
}));

vi.mock('react-dom/client', () => ({ createRoot: rootMocks.createRoot }));
vi.mock('./production-gateway', () => gatewayMocks);
vi.mock('./production-operator-portal', () => ({ mountProductionOperatorPortal: vi.fn() }));
vi.mock('./main', () => ({}));

class TestElement {
  readonly anchor: { readonly href: string } | null;

  constructor(anchor: { readonly href: string } | null) {
    this.anchor = anchor;
  }

  closest<T>(selector: string): T | null {
    void selector;
    return this.anchor as T | null;
  }
}

interface ClickHarness {
  readonly listener: (event: Event) => void;
  readonly assign: ReturnType<typeof vi.fn>;
}

async function installAndImport(): Promise<ClickHarness> {
  let clickListener: ((event: Event) => void) | undefined;
  const assign = vi.fn();
  vi.stubGlobal('Element', TestElement);
  vi.stubGlobal('window', {
    location: {
      pathname: '/teacher/classes',
      href: 'https://school.test/teacher/classes',
      origin: 'https://school.test',
      hostname: 'school.test',
      assign,
    },
  });
  vi.stubGlobal('document', {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === 'click' && typeof listener === 'function') clickListener = listener;
    },
    getElementById: vi.fn(() => ({})),
  });

  await import('./entry.js');
  if (clickListener === undefined) throw new Error('expected home navigation click listener');
  return { listener: clickListener, assign };
}

function clickEvent(target: unknown): {
  readonly event: Event;
  readonly preventDefault: ReturnType<typeof vi.fn>;
  readonly stopImmediatePropagation: ReturnType<typeof vi.fn>;
} {
  const preventDefault = vi.fn();
  const stopImmediatePropagation = vi.fn();
  const event = { target, preventDefault, stopImmediatePropagation } as unknown as Event;
  return { event, preventDefault, stopImmediatePropagation };
}

beforeEach(() => {
  vi.resetModules();
  rootMocks.createRoot.mockClear();
  gatewayMocks.isProductionWebHost.mockReturnValue(false);
  vi.unstubAllGlobals();
});

describe('entry home navigation interception', () => {
  it('intercepts same-origin links to the role chooser and performs a hard home navigation', async () => {
    const browser = await installAndImport();
    const click = clickEvent(new TestElement({ href: 'https://school.test/' }));

    browser.listener(click.event);

    expect(click.preventDefault).toHaveBeenCalledOnce();
    expect(click.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(browser.assign).toHaveBeenCalledWith('/');
  });

  it.each([
    ['a non-element target', {}],
    ['an element without an anchor', new TestElement(null)],
    ['an external home link', new TestElement({ href: 'https://example.test/' })],
    ['a same-origin non-home link', new TestElement({ href: 'https://school.test/admin' })],
  ])('does not intercept %s', async (_label, target) => {
    const browser = await installAndImport();
    const click = clickEvent(target);

    browser.listener(click.event);

    expect(click.preventDefault).not.toHaveBeenCalled();
    expect(click.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(browser.assign).not.toHaveBeenCalled();
  });
});
