import { expect, test } from '@playwright/test';

test('renders an accessible and task-led role chooser', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Run the school day from one place',
  );
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
    'href',
    '#main-content',
  );
  await expect(page.getByRole('heading', { name: 'Students and admissions' })).toBeVisible();
});
