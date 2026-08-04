import { expect, test } from '@playwright/test';

const teacherRoutes = [
  {
    path: '/teacher/classes',
    pageHeading: 'My classes',
    registerHeading: 'Assigned class schedule',
  },
  {
    path: '/teacher/attendance',
    pageHeading: 'Assigned registers',
    registerHeading: 'Attendance register status',
  },
  {
    path: '/teacher/gradebook',
    pageHeading: 'Gradebook tasks',
    registerHeading: 'Assessment entry queue',
  },
  {
    path: '/teacher/students',
    pageHeading: 'Student learning context',
    registerHeading: 'Assigned student context',
  },
  {
    path: '/teacher/messages',
    pageHeading: 'Teacher messages',
    registerHeading: 'Conversation register',
  },
] as const;

for (const route of teacherRoutes) {
  test(`${route.path} uses a scoped operational register`, async ({ page }) => {
    await page.goto(route.path);

    await expect(page.getByRole('heading', { name: route.pageHeading, exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: route.registerHeading, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: `${route.registerHeading} table` })).toBeVisible();
    await expect(page.getByText('What would you like to do?')).toHaveCount(0);
    await expect(page.getByText('Pilot information')).toHaveCount(0);
  });
}

test('teacher attendance register search filters the scoped read model', async ({ page }) => {
  await page.goto('/teacher/attendance');

  const search = page.getByRole('searchbox', { name: 'Search' });
  await search.fill('Year 8A');
  await expect(page.getByRole('cell', { name: 'Year 8A · Mathematics' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Year 9B · Mathematics' })).toHaveCount(0);

  await search.fill('not-a-real-register');
  await expect(page.getByText('No records match the current filters.')).toBeVisible();
});
