import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rootMocks = vi.hoisted(() => {
  const render = vi.fn();
  return {
    render,
    createRoot: vi.fn(() => ({ render })),
  };
});

const gatewayMocks = vi.hoisted(() => ({
  isProductionWebHost: vi.fn(),
  resolveProductionWorkspace: vi.fn(),
  mountProductionGate: vi.fn(),
  pathBelongsToWorkspace: vi.fn(),
}));

const operatorMocks = vi.hoisted(() => ({
  mountOperatorPortal: vi.fn(),
  mountProductionOperatorPortal: vi.fn(),
}));

vi.mock('react-dom/client', () => ({ createRoot: rootMocks.createRoot }));
vi.mock('./production-gateway', () => gatewayMocks);
vi.mock('./operator-portal', () => ({
  mountOperatorPortal: operatorMocks.mountOperatorPortal,
}));
vi.mock('./production-operator-portal', () => ({
  mountProductionOperatorPortal: operatorMocks.mountProductionOperatorPortal,
}));
vi.mock('./main', () => ({}));

interface BrowserHarness {
  readonly replace: ReturnType<typeof vi.fn>;
  readonly addEventListener: ReturnType<typeof vi.fn>;
}

interface ProductionWorkspaceFixture {
  readonly role:
    | 'admin'
    | 'teacher'
    | 'guardian'
    | 'student'
    | 'admissions'
    | 'finance'
    | 'support';
  readonly path: string;
  readonly assurance: 'aal1' | 'aal2';
  readonly expiresAt: string;
  readonly capabilities: readonly string[];
}

const adminWorkspace: ProductionWorkspaceFixture = {
  role: 'admin',
  path: '/admin',
  assurance: 'aal2',
  expiresAt: '2026-08-20T08:00:00Z',
  capabilities: ['sis.people.read'],
};

function installBrowser(pathname: string, root: unknown = {}): BrowserHarness {
  const assign = vi.fn();
  const replace = vi.fn();
  const addEventListener = vi.fn();
  const href = `https://school.test${pathname}`;

  vi.stubGlobal('window', {
    location: {
      pathname,
      href,
      origin: 'https://school.test',
      hostname: 'school.test',
      assign,
      replace,
    },
  });
  vi.stubGlobal('document', {
    getElementById(id: string) {
      return id === 'root' ? root : null;
    },
    addEventListener,
  });

  return { replace, addEventListener };
}

function renderedHtml(): string {
  const element = rootMocks.render.mock.calls.at(-1)?.[0] as
    | ReactElement
    | undefined;
  if (element === undefined) throw new Error('expected entry render');
  return renderToStaticMarkup(element);
}

async function importEntry(): Promise<void> {
  await import('./entry.js');
}

beforeEach(() => {
  vi.resetModules();
  rootMocks.createRoot.mockClear();
  rootMocks.render.mockClear();
  gatewayMocks.isProductionWebHost.mockReset();
  gatewayMocks.resolveProductionWorkspace.mockReset();
  gatewayMocks.mountProductionGate.mockReset();
  gatewayMocks.pathBelongsToWorkspace.mockReset();
  operatorMocks.mountOperatorPortal.mockReset();
  operatorMocks.mountProductionOperatorPortal.mockReset();
  gatewayMocks.isProductionWebHost.mockReturnValue(false);
  gatewayMocks.pathBelongsToWorkspace.mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('non-production entry bootstrap', () => {
  it('renders the complete principal and specialist role landing at the root', async () => {
    installBrowser('/');

    await importEntry();

    expect(rootMocks.createRoot).toHaveBeenCalledOnce();
    const html = renderedHtml();
    expect(html).toContain('Who are you working as?');
    expect(html).toContain('School administrator');
    expect(html).toContain('Teacher');
    expect(html).toContain('Parent or guardian');
    expect(html).toContain('Student');
    expect(html).toContain('Admissions staff');
    expect(html).toContain('Finance or cashier');
    expect(html).toContain('Platform support');
  });

  it.each([
    ['/admissions/applications/', 'admissions'],
    ['/finance/receipts/', 'finance'],
    ['/support', 'support'],
  ] as const)(
    'mounts the %s specialist route through the operator portal',
    async (path, role) => {
      installBrowser(path);

      await importEntry();

      await vi.waitFor(() =>
        expect(operatorMocks.mountOperatorPortal).toHaveBeenCalledWith(role),
      );
      expect(operatorMocks.mountProductionOperatorPortal).not.toHaveBeenCalled();
    },
  );

  it('loads the core application and installs home navigation for a principal route', async () => {
    const browser = installBrowser('/teacher/classes/');

    await importEntry();

    expect(browser.addEventListener).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
      true,
    );
    expect(operatorMocks.mountOperatorPortal).not.toHaveBeenCalled();
  });

  it('fails clearly when the landing root is missing', async () => {
    installBrowser('/', null);

    await expect(import('./entry.js')).rejects.toThrow('Root element not found');
  });
});

describe('production entry bootstrap', () => {
  it('fails closed through the production gate when workspace resolution is not current', async () => {
    installBrowser('/admin');
    gatewayMocks.isProductionWebHost.mockReturnValue(true);
    gatewayMocks.resolveProductionWorkspace.mockResolvedValue({ state: 'anonymous' });

    await importEntry();

    await vi.waitFor(() =>
      expect(gatewayMocks.mountProductionGate).toHaveBeenCalledWith('anonymous'),
    );
    expect(operatorMocks.mountProductionOperatorPortal).not.toHaveBeenCalled();
  });

  it('redirects the production root to the resolved authorized workspace', async () => {
    const browser = installBrowser('/');
    gatewayMocks.isProductionWebHost.mockReturnValue(true);
    gatewayMocks.resolveProductionWorkspace.mockResolvedValue({
      state: 'current',
      workspace: adminWorkspace,
    });

    await importEntry();

    await vi.waitFor(() => expect(browser.replace).toHaveBeenCalledWith('/admin'));
    expect(gatewayMocks.pathBelongsToWorkspace).not.toHaveBeenCalled();
  });

  it('fails closed when the requested path does not belong to the resolved workspace', async () => {
    installBrowser('/teacher');
    gatewayMocks.isProductionWebHost.mockReturnValue(true);
    gatewayMocks.resolveProductionWorkspace.mockResolvedValue({
      state: 'current',
      workspace: adminWorkspace,
    });
    gatewayMocks.pathBelongsToWorkspace.mockReturnValue(false);

    await importEntry();

    await vi.waitFor(() =>
      expect(gatewayMocks.pathBelongsToWorkspace).toHaveBeenCalledWith(
        '/teacher',
        '/admin',
      ),
    );
    expect(gatewayMocks.mountProductionGate).toHaveBeenCalledWith(
      'denied',
      adminWorkspace,
    );
  });

  it('mounts an authorized specialist workspace without loading the principal application', async () => {
    const financeWorkspace: ProductionWorkspaceFixture = {
      ...adminWorkspace,
      role: 'finance',
      path: '/finance',
    };
    installBrowser('/finance/invoices/');
    gatewayMocks.isProductionWebHost.mockReturnValue(true);
    gatewayMocks.resolveProductionWorkspace.mockResolvedValue({
      state: 'current',
      workspace: financeWorkspace,
    });

    await importEntry();

    await vi.waitFor(() =>
      expect(operatorMocks.mountProductionOperatorPortal).toHaveBeenCalledWith(
        financeWorkspace,
        '/finance/invoices',
      ),
    );
    expect(gatewayMocks.mountProductionGate).not.toHaveBeenCalled();
  });

  it('loads an authorized principal workspace and installs home navigation', async () => {
    const browser = installBrowser('/admin/sis');
    gatewayMocks.isProductionWebHost.mockReturnValue(true);
    gatewayMocks.resolveProductionWorkspace.mockResolvedValue({
      state: 'current',
      workspace: adminWorkspace,
    });

    await importEntry();

    await vi.waitFor(() =>
      expect(gatewayMocks.pathBelongsToWorkspace).toHaveBeenCalledWith(
        '/admin/sis',
        '/admin',
      ),
    );
    expect(browser.addEventListener).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
      true,
    );
    expect(gatewayMocks.mountProductionGate).not.toHaveBeenCalled();
    expect(operatorMocks.mountProductionOperatorPortal).not.toHaveBeenCalled();
  });
});
