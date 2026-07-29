import { expect, test } from '@playwright/test';

const adminSnapshot = {
  schemaVersion: 1,
  sourceVersion: 'browser-test-v1',
  generatedAt: '2026-07-30T04:00:00+06:00',
  scope: {
    tenantId: 'tenant-pilot-001',
    campusId: 'campus-main',
    role: 'admin',
    subjectId: 'principal-1',
    capabilities: [
      'sis.read',
      'academics.read',
      'finance.read',
      'operations.read',
      'reports.read',
      'attendance.manage',
      'attendance.bulk-remind',
      'records.approve',
      'student.read',
    ],
  },
  data: {
    metrics: [
      {
        id: 'students',
        label: 'Active students',
        value: 842,
        definition: 'Students with an active enrolment in the current academic year.',
        tone: 'stable',
        source: {
          label: 'Scoped staging read API',
          href: '/admin/reports',
          updatedAt: '2026-07-30T04:00:00+06:00',
        },
        capability: 'sis.read',
      },
      {
        id: 'attendance',
        label: 'Registers ready',
        value: '42 / 44',
        definition: 'Finalised attendance registers for today’s scheduled sessions.',
        tone: 'warning',
        source: {
          label: 'Scoped staging read API',
          href: '/admin/reports',
          updatedAt: '2026-07-30T04:00:00+06:00',
        },
        capability: 'academics.read',
      },
    ],
    exceptions: [
      {
        id: 'attendance-1',
        area: 'Attendance',
        title: 'Two registers are not finalised',
        summary: 'Assigned classes remain open after the daily cut-off.',
        severity: 'warning',
        status: 'Open',
        href: '/admin/academics',
        source: {
          label: 'Scoped staging read API',
          href: '/admin/reports',
          updatedAt: '2026-07-30T04:00:00+06:00',
        },
        capability: 'attendance.manage',
        bulkGroup: 'attendance-finalisation',
        bulkCapability: 'attendance.bulk-remind',
      },
    ],
    approvals: [],
    searchResults: [],
    bulkActions: [
      {
        id: 'remind',
        label: 'Send reminder',
        group: 'attendance-finalisation',
        capability: 'attendance.bulk-remind',
        href: '/admin/academics',
      },
    ],
  },
};

async function configurePilotApi(page: Parameters<typeof test>[0] extends never ? never : any): Promise<void> {
  await page.addInitScript(() => {
    (window as typeof window & { __PLATFORM_API_URL__?: string }).__PLATFORM_API_URL__ =
      'https://pilot-api.test';
  });
}

test('pilot role chooser explains every role workspace', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Run the school day from one place' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Go to administration/u })).toHaveAttribute(
    'href',
    '/admin',
  );
  await expect(page.getByRole('link', { name: /Go to teacher workspace/u })).toHaveAttribute(
    'href',
    '/teacher',
  );
  await expect(page.getByRole('link', { name: /Go to family portal/u })).toHaveAttribute(
    'href',
    '/family',
  );
  await expect(page.getByRole('link', { name: /Go to student portal/u })).toHaveAttribute(
    'href',
    '/student',
  );
  await expect(
    page.getByRole('heading', { name: 'Common school work, clearly organised' }),
  ).toBeVisible();
});

test('admin portal groups tasks and filters them using school language', async ({ page }) => {
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'School operations overview' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Students & admissions/u })).toBeVisible();
  await expect(page.getByRole('link', { name: /Academics & attendance/u })).toBeVisible();
  await expect(page.getByRole('link', { name: /Fees & accounting/u })).toBeVisible();
  await expect(page.getByText('Three registers are not finalised')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Find a task' }).fill('payments');
  await expect(page.getByRole('link', { name: /Fees & accounting/u })).toBeVisible();
  await expect(page.getByRole('link', { name: /Students & admissions/u })).toHaveCount(0);
});

test('same-role navigation keeps the document and shell alive', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'School operations overview' })).toBeVisible();

  await page.evaluate(() => {
    (window as typeof window & { __uxNavigationMarker?: string }).__uxNavigationMarker = 'kept';
  });
  await page.getByRole('link', { name: /Fees & accounting/u }).click();

  await expect(page).toHaveURL(/\/admin\/finance$/u);
  await expect(page.getByRole('heading', { name: 'Finance command centre' }).first()).toBeVisible();
  await expect(page.getByText('BDT 2.84m')).toBeVisible();
  await expect(page.getByText('Match seven verified receipts')).toBeVisible();
  await expect(page.getByText('Your workspace is almost ready')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as typeof window & { __uxNavigationMarker?: string }).__uxNavigationMarker,
    ),
  ).toBe('kept');

  await page.goBack();
  await expect(page).toHaveURL(/\/admin$/u);
  await expect(page.getByRole('heading', { name: 'School operations overview' })).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as typeof window & { __uxNavigationMarker?: string }).__uxNavigationMarker,
    ),
  ).toBe('kept');
});

test('teacher portal exposes daily work and assigned tasks', async ({ page }) => {
  await page.goto('/teacher');

  await expect(page.getByRole('heading', { name: 'Today’s teaching workspace' })).toBeVisible();
  await expect(page.getByText('Year 8A · Mathematics')).toBeVisible();
  await expect(page.getByRole('link', { name: /Take attendance/u })).toBeVisible();

  await page.getByRole('link', { name: /Grades & assessments/u }).click();
  await expect(page).toHaveURL(/\/teacher\/gradebook$/u);
  await expect(page.getByRole('heading', { name: 'Gradebook tasks' }).first()).toBeVisible();
  await expect(page.getByText('21 / 28')).toBeVisible();
});

test('guardian and student portals remain scoped to their own records', async ({ page }) => {
  await page.goto('/family');
  await expect(page.getByRole('heading', { name: 'Family home' })).toBeVisible();
  await expect(page.getByText('Samira Noor').first()).toBeVisible();
  await expect(page.getByText('August tuition instalment')).toBeVisible();

  await page.getByRole('link', { name: 'Change role' }).click();
  await page.getByRole('link', { name: /Go to student portal/u }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true }).first()).toBeVisible();
  await expect(page.getByText('Multi-step equations practice')).toBeVisible();
  await expect(page.getByText('Term 2 progress report')).toBeVisible();
  await expect(page.getByText('Nabil Noor')).toHaveCount(0);
});

test('background revalidation keeps current content visible and accepts only the scoped response', async ({
  page,
}) => {
  await configurePilotApi(page);
  await page.route('https://pilot-api.test/pilot/v1/snapshots/admin', async (route) => {
    const headers = route.request().headers();
    expect(headers['x-school-tenant-id']).toBe('tenant-pilot-001');
    expect(headers['x-school-campus-id']).toBe('campus-main');
    expect(headers['x-school-role']).toBe('admin');
    expect(headers['x-school-subject-id']).toBe('principal-1');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      status: 200,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'etag',
        etag: 'W/"browser-test-v1"',
      },
      contentType: 'application/json',
      body: JSON.stringify(adminSnapshot),
    });
  });

  await page.goto('/admin');
  await expect(page.getByText('Three registers are not finalised')).toBeVisible();
  await expect(page.getByText('Checking for updates')).toBeVisible();
  await expect(page.getByText('Your workspace is almost ready')).toHaveCount(0);

  await expect(page.getByText('Two registers are not finalised')).toBeVisible();
  await expect(page.getByText('Current from staging API')).toBeVisible();
  await expect(page.getByText('Three registers are not finalised')).toHaveCount(0);
});

test('a failed refresh keeps the last safe role data instead of showing a loading page', async ({
  page,
}) => {
  await configurePilotApi(page);
  await page.route('https://pilot-api.test/pilot/v1/snapshots/student', async (route) => {
    await route.abort('failed');
  });

  await page.goto('/student');
  await expect(page.getByText('Multi-step equations practice')).toBeVisible();
  await expect(page.getByText('Using saved data')).toBeVisible();
  await expect(page.getByText('Your workspace is almost ready')).toHaveCount(0);
  await expect(page.getByText('Term 2 progress report')).toBeVisible();
});
