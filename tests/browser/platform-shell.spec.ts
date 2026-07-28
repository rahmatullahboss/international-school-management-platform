import { expect, test } from '@playwright/test';

test('renders an accessible foundation shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('International School Platform');
});
