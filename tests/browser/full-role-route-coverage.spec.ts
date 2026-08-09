import { expect, test } from '@playwright/test';

interface RouteExpectation {
  readonly path: string;
  readonly heading: string;
}

const routesByRole = {
  admin: [
    { path: '/admin', heading: 'School operations overview' },
    { path: '/admin/sis', heading: 'People, admissions and enrolment' },
    { path: '/admin/academics', heading: 'Academic operations' },
    { path: '/admin/finance', heading: 'Finance command centre' },
    { path: '/admin/operations', heading: 'Operations and services' },
    { path: '/admin/student-support', heading: 'Restricted student support' },
    { path: '/admin/communications', heading: 'School communications' },
    { path: '/admin/integrations', heading: 'Integration platform' },
    { path: '/admin/reports', heading: 'Reports and evidence' },
  ],
  teacher: [
    { path: '/teacher', heading: 'Today’s teaching workspace' },
    { path: '/teacher/classes', heading: 'My classes' },
    { path: '/teacher/attendance', heading: 'Assigned registers' },
    { path: '/teacher/gradebook', heading: 'Gradebook tasks' },
    { path: '/teacher/students', heading: 'Student learning context' },
    { path: '/teacher/messages', heading: 'Teacher messages' },
    { path: '/teacher/resources', heading: 'Class resources' },
  ],
  guardian: [
    { path: '/family', heading: 'Family home' },
    { path: '/family/applications', heading: 'Family applications' },
    { path: '/family/children', heading: 'My children' },
    { path: '/family/attendance', heading: 'Attendance record' },
    { path: '/family/grades', heading: 'Grades and reports' },
    { path: '/family/finance', heading: 'Household finance' },
    { path: '/family/forms', heading: 'Household forms' },
    { path: '/family/documents', heading: 'Family documents' },
    { path: '/family/messages', heading: 'Family messages' },
  ],
  student: [
    { path: '/student', heading: 'Today' },
    { path: '/student/timetable', heading: 'My timetable' },
    { path: '/student/attendance', heading: 'My attendance' },
    { path: '/student/results', heading: 'My results' },
    { path: '/student/documents', heading: 'My documents' },
    { path: '/student/resources', heading: 'My resources' },
    { path: '/student/requests', heading: 'My requests' },
    { path: '/student/messages', heading: 'My messages' },
  ],
} as const satisfies Readonly<Record<string, readonly RouteExpectation[]>>;

for (const [role, routes] of Object.entries(routesByRole)) {
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
