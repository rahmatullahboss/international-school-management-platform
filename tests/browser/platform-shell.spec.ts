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

test('switches Teacher resource edit context in place', async ({ page }) => {
  await page.goto('/teacher/resources');
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(
    'Multi-step equations practice',
  );
  await page.getByRole('button', { name: 'Edit Geometry quiz' }).click();
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Geometry quiz');
  await expect(page.getByRole('textbox', { name: 'Asset' })).toHaveValue('geometry.pdf');
  await page.getByRole('button', { name: 'Repair Calculus intro' }).click();
  await expect(page.getByRole('heading', { name: 'Repair resource' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Calculus intro');
  await expect(page.getByRole('textbox', { name: 'Asset' })).toHaveValue('Broken link');
});

test('switches published attendance history in place', async ({ page }) => {
  await page.goto('/family/attendance');
  await expect(page.getByRole('heading', { name: '12 July absence' })).toBeVisible();
  await page.getByRole('button', { name: 'View 14 July revision history' }).click();
  await expect(page.getByRole('heading', { name: '14 July revision history' })).toBeVisible();
  await expect(page.getByText('Original attendance published')).toBeVisible();
  await page.getByRole('button', { name: 'Track 12 July explanation' }).click();
  await expect(page.getByRole('heading', { name: '12 July absence' })).toBeVisible();
});

test('switches authorised document metadata in place', async ({ page }) => {
  await page.goto('/family/documents');
  await expect(page.getByRole('heading', { name: 'Term 2 progress report' })).toBeVisible();
  await page.getByRole('button', { name: 'Welcome' }).click();
  await expect(page.getByRole('heading', { name: 'School welcome letter' })).toBeVisible();
  await expect(page.getByText('PDF · 340 KB')).toBeVisible();
  await page.getByRole('button', { name: 'Term 2' }).click();
  await expect(page.getByRole('heading', { name: 'Term 2 progress report' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open authorised copy' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download authorised copy' })).toBeDisabled();
});
