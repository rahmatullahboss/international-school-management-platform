import { expect, test } from '@playwright/test';

test('renders an accessible foundation shell', async ({ page }) => {
  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
    'href',
    '#main-content',
  );
  await expect(page.getByText('sis', { exact: true })).toBeVisible();
});

test('renders the public marketing landing page', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'One operating record for the whole school.',
  );
  await expect(page.getByRole('navigation', { name: 'Marketing navigation' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Scale with active students, not staff logins.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open product preview' }).first()).toHaveAttribute(
    'href',
    '/app',
  );
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
    'href',
    '#marketing-main',
  );
});

test('lets visitors explore capability groups', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Fees & finance/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Trace every balance back to its source' }),
  ).toBeVisible();
  await expect(
    page.getByText('Immutable double-entry ledger and source-to-journal drill-down'),
  ).toBeVisible();
});

test('provides mobile navigation without hiding the offer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(page.getByRole('link', { name: 'Pricing', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'View plans' })).toBeVisible();
});
