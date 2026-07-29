import { expect, test } from '@playwright/test';

test('pilot role chooser exposes every role workspace', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'International School Platform' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open admin workspace/u })).toHaveAttribute(
    'href',
    '/admin',
  );
  await expect(page.getByRole('link', { name: /Open teacher workspace/u })).toHaveAttribute(
    'href',
    '/teacher',
  );
  await expect(page.getByRole('link', { name: /Open family portal/u })).toHaveAttribute(
    'href',
    '/family',
  );
  await expect(page.getByRole('link', { name: /Open student portal/u })).toHaveAttribute(
    'href',
    '/student',
  );
  await expect(page.getByRole('heading', { name: 'Module coverage' })).toBeVisible();
});

test('admin portal composes integrated module navigation and readiness work', async ({ page }) => {
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'School operations overview' })).toBeVisible();
  await expect(page.getByRole('link', { name: /People and admissions/u })).toBeVisible();
  await expect(page.getByRole('link', { name: /Academics/u })).toBeVisible();
  await expect(page.getByRole('link', { name: /Finance/u })).toBeVisible();
  await expect(page.getByText('Three registers are not finalised')).toBeVisible();

  await page.goto('/admin/finance');
  await expect(page.getByRole('heading', { name: 'Finance command centre' }).first()).toBeVisible();
  await expect(page.getByText('BDT 2.84m')).toBeVisible();
  await expect(page.getByText('Match seven verified receipts')).toBeVisible();
});

test('teacher portal exposes daily work and assigned module routes', async ({ page }) => {
  await page.goto('/teacher');

  await expect(page.getByRole('heading', { name: 'Today’s teaching workspace' })).toBeVisible();
  await expect(page.getByText('Year 8A · Mathematics')).toBeVisible();
  await expect(page.getByRole('link', { name: /Attendance/u })).toBeVisible();

  await page.goto('/teacher/gradebook');
  await expect(page.getByRole('heading', { name: 'Gradebook tasks' }).first()).toBeVisible();
  await expect(page.getByText('21 / 28')).toBeVisible();
});

test('guardian and student portals remain scoped to their own records', async ({ page }) => {
  await page.goto('/family');
  await expect(page.getByRole('heading', { name: 'Family home' })).toBeVisible();
  await expect(page.getByText('Samira Noor').first()).toBeVisible();
  await expect(page.getByText('August tuition instalment')).toBeVisible();

  await page.goto('/student');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByText('Multi-step equations practice')).toBeVisible();
  await expect(page.getByText('Term 2 progress report')).toBeVisible();
  await expect(page.getByText('Nabil Noor')).toHaveCount(0);
});
