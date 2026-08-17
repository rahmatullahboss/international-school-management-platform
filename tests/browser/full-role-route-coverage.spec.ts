import { expect, test } from '@playwright/test';

import { modulePages } from '../../apps/platform-web/src/pilot-data.js';

interface RouteExpectation {
  readonly path: string;
  readonly heading: string;
}

type CorePilotRole = 'admin' | 'teacher' | 'guardian' | 'student';

const homeRouteByRole = {
  admin: { path: '/admin', heading: 'School operations overview' },
  teacher: { path: '/teacher', heading: 'Today’s teaching workspace' },
  guardian: { path: '/family', heading: 'Family home' },
  student: { path: '/student', heading: 'Today' },
} as const satisfies Readonly<Record<CorePilotRole, RouteExpectation>>;

const routePrefixByRole = {
  admin: '/admin',
  teacher: '/teacher',
  guardian: '/family',
  student: '/student',
} as const satisfies Readonly<Record<CorePilotRole, string>>;

const roles = Object.keys(homeRouteByRole) as CorePilotRole[];

const routesByRole = Object.fromEntries(
  roles.map((role) => {
    const prefix = routePrefixByRole[role];
    const publishedModuleRoutes = Object.entries(modulePages)
      .filter(([path]) => path.startsWith(`${prefix}/`))
      .map(([path, page]) => ({ path, heading: page.title }))
      .sort((left, right) => left.path.localeCompare(right.path));

    return [role, [homeRouteByRole[role], ...publishedModuleRoutes]];
  }),
) as Readonly<Record<CorePilotRole, readonly RouteExpectation[]>>;

test('core route E2E matrix covers every published module page exactly once', () => {
  const expectedPublishedPaths = Object.keys(modulePages).sort();
  const coveredPublishedPaths = roles
    .flatMap((role) => routesByRole[role].slice(1).map((route) => route.path))
    .sort();

  expect(coveredPublishedPaths).toEqual(expectedPublishedPaths);
  expect(new Set(coveredPublishedPaths).size).toBe(expectedPublishedPaths.length);
});

for (const role of roles) {
  const routes = routesByRole[role];

  test.describe(`${role} published route coverage`, () => {
    for (const route of routes) {
      test(`${route.path} renders its governed workspace`, async ({ page }) => {
        await page.goto(route.path);

        await expect(page).toHaveURL(new RegExp(`${route.path.replaceAll('/', '\\/')}$`, 'u'));
        await expect(
          page.getByRole('heading', { name: route.heading, exact: true }).first(),
        ).toBeVisible();
        await expect(page.getByRole('alert').filter({ hasText: 'Page not available' })).toHaveCount(
          0,
        );
        await expect(page.getByRole('link', { name: 'Change role' })).toBeVisible();
        await expect(page.getByText('Pilot browser', { exact: true })).toHaveCount(0);
      });
    }
  });
}

const deniedRoleRoutes = [
  { path: '/admin/not-a-published-module', home: '/admin' },
  { path: '/teacher/finance', home: '/teacher' },
  { path: '/family/gradebook', home: '/family' },
  { path: '/student/operations', home: '/student' },
] as const;

for (const denied of deniedRoleRoutes) {
  test(`unpublished role route ${denied.path} fails closed`, async ({ page }) => {
    await page.goto(denied.path);

    const unavailable = page.getByRole('alert').filter({ hasText: 'Page not available' });
    await expect(unavailable).toBeVisible();
    await expect(unavailable).toContainText(
      'This task is not available in your current workspace.',
    );
    await expect(
      unavailable.getByRole('link', { name: 'Return to workspace home' }),
    ).toHaveAttribute('href', denied.home);
  });
}
