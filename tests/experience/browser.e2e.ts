import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const root = process.cwd();
const legacyCss = readFileSync(
  path.join(root, 'packages/modules/documents-experience/src/shell.css'),
  'utf8',
);
const authorityCss = readFileSync(
  path.join(root, 'packages/modules/documents-experience/src/shell-authority.css'),
  'utf8',
).replace("@import './shell.css';", '');

function pageShell(direction: 'ltr' | 'rtl' = 'ltr'): string {
  return `<!doctype html>
<html lang="${direction === 'rtl' ? 'ar' : 'en'}" dir="${direction}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>EXP-01 persona shell proof</title>
    <style>${legacyCss}</style>
    <style>${authorityCss}</style>
  </head>
  <body>
    <div class="experience-shell" data-persona="teacher" data-connectivity="syncing" dir="${direction}">
      <a class="experience-skip" href="#experience-main">Skip to current work</a>
      <aside class="experience-rail" aria-label="Teacher workspace navigation">
        <div class="experience-identity">
          <span class="experience-identity__mark" aria-hidden="true">I</span>
          <div><strong>International Community School</strong><span>Teacher workspace</span></div>
        </div>
        <nav class="experience-nav" aria-label="Primary navigation">
          <ul>
            <li><a href="/teacher"><span><strong>Today</strong><small>Classes and priority work</small></span></a></li>
            <li><a href="/teacher/attendance" aria-current="page"><span><strong>Attendance</strong><small>Assigned sessions and offline capture</small></span><span class="experience-nav__badge" aria-label="3 items">3</span></a></li>
            <li><a href="/teacher/gradebook"><span><strong>Gradebook</strong><small>Assessments and results</small></span></a></li>
          </ul>
        </nav>
        <div class="experience-rail__footer">
          <div class="experience-connectivity" data-state="syncing" role="status">
            <span class="experience-connectivity__signal" aria-hidden="true"></span>
            <span><strong>Syncing changes</strong> · 3 pending</span>
            <time datetime="2026-07-29T14:00:00+06:00">Last synced 2026-07-29T14:00:00+06:00</time>
          </div>
          <a href="/help">Help and support</a>
        </div>
      </aside>
      <section class="experience-stage">
        <header class="experience-masthead">
          <div><p>Amina Rahman</p><h1>Morning attendance</h1><span>Capture the assigned class safely, including when the connection drops.</span></div>
          <div class="experience-session" aria-label="Session and device status">
            <span data-assurance="aal2">Verified session</span><span>School-managed Chromebook</span><time datetime="2026-07-29T18:00:00+06:00">Expires 18:00</time>
          </div>
        </header>
        <div class="experience-notice"><strong>Approved changes are protected.</strong><span>Pending attendance will retry safely.</span></div>
        <main id="experience-main" class="experience-main" tabindex="-1">
          <section class="experience-loading" role="status" aria-live="polite">
            <strong>Preparing your workspace</strong><span>Loading current permissions, tasks and school context.</span>
            <div class="experience-loading__line" aria-hidden="true"></div>
            <div class="experience-loading__line experience-loading__line--short" aria-hidden="true"></div>
          </section>
        </main>
      </section>
    </div>
  </body>
</html>`;
}

test('desktop shell exposes stable role, session, active task and keyboard entry', async ({
  page,
}) => {
  await page.setContent(pageShell());

  await expect(
    page.getByRole('complementary', { name: 'Teacher workspace navigation' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Morning attendance' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Attendance/ })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByText('Verified session', { exact: true })).toBeVisible();
  await expect(page.getByText('Syncing changes', { exact: false })).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to current work' })).toBeFocused();
  const focusOutline = await page
    .getByRole('link', { name: 'Skip to current work' })
    .evaluate((element) => getComputedStyle(element).outlineColor);
  expect(focusOutline).toBe('rgb(11, 99, 206)');

  const shell = page.locator('.experience-shell');
  await expect(shell).toHaveCSS('display', 'grid');
  await expect(page.locator('.experience-error, .experience-loading')).toHaveCSS(
    'box-shadow',
    'none',
  );
});

test('mobile shell becomes one reading flow with horizontally reachable navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.setContent(pageShell());

  await expect(page.locator('.experience-shell')).toHaveCSS('display', 'block');
  await expect(page.locator('.experience-rail')).toHaveCSS('position', 'static');
  const navigation = page.locator('.experience-nav ul');
  const dimensions = await navigation.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);

  const bodyOverflow = await page.locator('body').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(bodyOverflow.scrollWidth).toBeLessThanOrEqual(bodyOverflow.clientWidth + 1);
  await expect(page.locator('.experience-session')).toHaveCSS('justify-content', 'flex-start');
});

test('RTL and reduced-motion preferences preserve logical layout without animation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setContent(pageShell('rtl'));

  await expect(page.locator('.experience-shell')).toHaveAttribute('dir', 'rtl');
  const railBorders = await page.locator('.experience-rail').evaluate((element) => {
    const styles = getComputedStyle(element);
    return { left: styles.borderLeftWidth, right: styles.borderRightWidth };
  });
  expect(railBorders.left).toBe('1px');
  expect(railBorders.right).toBe('0px');
  await expect(page.locator('.experience-connectivity__signal')).toHaveCSS(
    'animation-name',
    'none',
  );
  await expect(page.locator('.experience-loading__line').first()).toHaveCSS(
    'animation-name',
    'none',
  );
});
