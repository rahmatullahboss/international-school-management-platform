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

vi.mock('react-dom/client', () => ({ createRoot: rootMocks.createRoot }));
vi.mock('./pwa', () => ({ registerPlatformServiceWorker: vi.fn() }));

function installBrowser(pathname: string, root: unknown = {}): void {
  vi.stubGlobal('window', {
    location: {
      pathname,
      href: `https://school.test${pathname}`,
      origin: 'https://school.test',
    },
  });
  vi.stubGlobal('navigator', {
    onLine: true,
    connection: { saveData: false },
  });
  vi.stubGlobal('document', {
    getElementById(id: string) {
      return id === 'root' ? root : null;
    },
  });
}

function renderedHtml(): string {
  const element = rootMocks.render.mock.calls.at(-1)?.[0] as ReactElement | undefined;
  if (element === undefined) throw new Error('expected application render');
  return renderToStaticMarkup(element);
}

async function importMain(): Promise<void> {
  await import('./main.js');
}

beforeEach(() => {
  vi.resetModules();
  rootMocks.createRoot.mockClear();
  rootMocks.render.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('platform main bootstrap', () => {
  it('renders the principal role chooser at the root path', async () => {
    installBrowser('/');

    await importMain();

    expect(rootMocks.createRoot).toHaveBeenCalledOnce();
    const html = renderedHtml();
    expect(html).toContain('Who are you working as?');
    expect(html).toContain('School administrator');
    expect(html).toContain('Teacher');
    expect(html).toContain('Parent or guardian');
    expect(html).toContain('Student');
  });

  it('falls back to the role chooser for an unscoped application path', async () => {
    installBrowser('/not-a-workspace');

    await importMain();

    expect(renderedHtml()).toContain('Who are you working as?');
  });

  it.each([
    ['/admin', 'admin'],
    ['/teacher/classes/', 'teacher'],
    ['/family', 'guardian'],
    ['/student/results/', 'student'],
  ] as const)('renders the %s workspace loading shell before its lazy portal resolves', async (path, role) => {
    installBrowser(path);

    await importMain();

    const html = renderedHtml();
    expect(html).toContain(`data-role="${role}"`);
    expect(html).toContain('Your workspace is almost ready');
  });

  it('fails clearly when the application root is missing', async () => {
    installBrowser('/', null);

    await expect(import('./main.js')).rejects.toThrow('Root element not found');
  });
});
