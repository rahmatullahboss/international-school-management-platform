import { expect, test } from '@playwright/test';

test('renders an accessible pilot role chooser', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'International School Platform',
  );
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
    'href',
    '#main-content',
  );
  await expect(page.getByRole('heading', { name: 'Core SIS' })).toBeVisible();
});
