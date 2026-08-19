import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AdminPortal from './admin.js';
import GuardianPortal from './guardian.js';
import StudentPortal from './student.js';
import TeacherPortal from './teacher.js';

function withBrowserPath<T>(pathname: string, run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {
        hostname: 'localhost',
        origin: 'http://localhost:4173',
        pathname,
      },
    },
  });

  try {
    return run();
  } finally {
    if (descriptor === undefined) delete (globalThis as { window?: unknown }).window;
    else Object.defineProperty(globalThis, 'window', descriptor);
  }
}

const portals = {
  admin: (path: string) =>
    withBrowserPath(path, () =>
      renderToStaticMarkup(<AdminPortal path={path} connectivity="online" />),
    ),
  teacher: (path: string) =>
    withBrowserPath(path, () =>
      renderToStaticMarkup(<TeacherPortal path={path} connectivity="online" />),
    ),
  guardian: (path: string) =>
    withBrowserPath(path, () =>
      renderToStaticMarkup(<GuardianPortal path={path} connectivity="online" />),
    ),
  student: (path: string) =>
    withBrowserPath(path, () =>
      renderToStaticMarkup(<StudentPortal path={path} connectivity="online" />),
    ),
} as const;

const roleCases = [
  {
    role: 'admin',
    home: '/admin',
    homeHeading: 'School operations overview',
    module: '/admin/academics',
    moduleHeading: 'Academic operations',
  },
  {
    role: 'teacher',
    home: '/teacher',
    homeHeading: 'Today’s teaching workspace',
    module: '/teacher/classes',
    moduleHeading: 'My classes',
  },
  {
    role: 'guardian',
    home: '/family',
    homeHeading: 'Family home',
    module: '/family/children',
    moduleHeading: 'My children',
  },
  {
    role: 'student',
    home: '/student',
    homeHeading: 'Today',
    module: '/student/timetable',
    moduleHeading: 'My timetable',
  },
] as const;

describe('core portal route composition', () => {
  it.each(roleCases)('renders the $role home workspace', ({ role, home, homeHeading }) => {
    const html = portals[role](home);
    expect(html).toContain(homeHeading);
    expect(html).not.toContain('Page not available');
    expect(html).toContain('Show walkthrough');
  });

  it.each(roleCases)(
    'renders a published $role module in the governed workspace',
    ({ role, module, moduleHeading }) => {
      const html = portals[role](module);
      expect(html).toContain(moduleHeading);
      expect(html).not.toContain('Page not available');
      expect(html).toContain('Show walkthrough');
    },
  );

  it.each(roleCases)('fails closed for an unpublished $role route', ({ role, home }) => {
    const path = `${home}/not-a-published-module`;
    const html = portals[role](path);
    expect(html).toContain('Page not available');
    expect(html).toContain('This task is not available in your current workspace.');
    expect(html).toContain(`href="${home}"`);
  });
});
