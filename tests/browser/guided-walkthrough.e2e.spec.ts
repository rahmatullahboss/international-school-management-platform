import { expect, test } from '@playwright/test';

const roleCases = [
  { path: '/admin', firstStep: 'Your signed-in workspace' },
  { path: '/teacher', firstStep: 'Your signed-in workspace' },
  { path: '/family', firstStep: 'Your signed-in workspace' },
  { path: '/student', firstStep: 'Your signed-in workspace' },
  { path: '/admissions', firstStep: 'Workspace summary' },
  { path: '/finance', firstStep: 'Workspace summary' },
  { path: '/support', firstStep: 'Workspace summary' },
] as const;

for (const roleCase of roleCases) {
  test(`${roleCase.path} automatically introduces the signed-in workspace`, async ({ page }) => {
    await page.goto(roleCase.path);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: roleCase.firstStep })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show walkthrough' })).toBeVisible();
  });
}

test('admin walkthrough explains governed modules and can be restarted after completion', async ({ page }) => {
  await page.goto('/admin');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByRole('heading', { name: 'Find a task' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByRole('heading', { name: 'Role-based navigation' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByRole('heading', { name: 'Students & admissions' })).toBeVisible();
  await expect(page.locator('a[href="/admin/sis"]')).toHaveClass(/guided-walkthrough__target/u);

  await dialog.getByRole('button', { name: 'Skip tour' }).click();
  await expect(dialog).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show walkthrough' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('walkthrough is keyboard dismissible and leaves the workspace usable', async ({ page }) => {
  await page.goto('/teacher');
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Today’s teaching workspace' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Attendance:/u })).toBeVisible();
});
