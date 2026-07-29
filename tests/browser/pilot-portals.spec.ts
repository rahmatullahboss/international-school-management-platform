import { expect, test } from '@playwright/test';

test('pilot role chooser explains every role workspace', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Run the school day from one place' })).toBeVisible();
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
