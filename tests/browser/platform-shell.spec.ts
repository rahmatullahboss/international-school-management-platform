import { expect, test } from '@playwright/test';

test('renders an accessible and task-led role chooser', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Run the school day from one place',
  );
  await expect(page.getByRole('navigation', { name: 'Primary role navigation' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Specialist operator navigation' }),
  ).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
    'href',
    '#main-content',
  );
  await expect(page.getByText('Students and admissions', { exact: true })).toBeVisible();
});

test('switches Teacher permitted student context in place', async ({ page }) => {
  await page.goto('/teacher/students');
  await expect(
    page.getByRole('heading', { name: 'Samira Noor · permitted context' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open Riya Ahmed permitted profile' }).click();
  await expect(page.getByRole('heading', { name: 'Riya Ahmed · permitted context' })).toBeVisible();
  await expect(page.getByText('Present in the assigned class')).toBeVisible();
});
