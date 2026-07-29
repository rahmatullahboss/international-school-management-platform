import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const shellCss = readFileSync(
  new URL('../../packages/modules/documents-experience/src/shell.css', import.meta.url),
  'utf8',
);

function shellFixture(options: { direction?: 'ltr' | 'rtl'; offline?: boolean } = {}): string {
  const direction = options.direction ?? 'ltr';
  const offline = options.offline ?? false;
  return `<!doctype html>
<html lang="${direction === 'rtl' ? 'ar' : 'en'}" dir="${direction}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>EXP-01 persona shell proof</title>
    <style>${shellCss}</style>
  </head>
  <body>
    <div class="experience-shell" data-persona="teacher" data-connectivity="${offline ? 'offline' : 'online'}">
      <a class="experience-skip" href="#experience-main">Skip to current work</a>
      <aside class="experience-rail" aria-label="Teacher workspace navigation">
        <div class="experience-identity">
          <span class="experience-identity__mark" aria-hidden="true">I</span>
          <div><strong>International Community School</strong><span>Teacher workspace</span></div>
        </div>
        <nav class="experience-nav" aria-label="Primary navigation">
          <ul>
            <li><a href="/teacher"><span><strong>Today</strong><small>Teaching sequence and priority work</small></span></a></li>
            <li><a href="/teacher/attendance" aria-current="page"><span><strong>Attendance</strong><small>Capture, sync and finalise registers</small></span><span class="experience-nav__badge" aria-label="3 items">3</span></a></li>
            <li><a href="/teacher/gradebook"><span><strong>Gradebook</strong><small>Assessments, evidence and comments</small></span></a></li>
          </ul>
        </nav>
        <div class="experience-rail__footer">
          <div class="experience-connectivity" data-state="${offline ? 'offline' : 'online'}" role="status">
            <span class="experience-connectivity__signal" aria-hidden="true"></span>
            <span><strong>${offline ? 'Working offline' : 'Online'}</strong>${offline ? ' · 3 pending' : ''}</span>
            ${offline ? '<a href="/teacher/sync">Retry sync</a>' : '<time datetime="2026-07-29T14:00:00+06:00">Last synced 2026-07-29T14:00:00+06:00</time>'}
          </div>
          <a href="/help">Help and support</a>
        </div>
      </aside>
      <section class="experience-stage">
        <header class="experience-masthead">
          <div><p>Amina Rahman</p><h1>Today at school</h1><span>Current work, trusted state and the next action for this role.</span></div>
          <div class="experience-session" aria-label="Session and device status">
            <span data-assurance="aal2">Verified session</span>
            <span>School-managed Chromebook</span>
            <time datetime="2026-07-29T18:00:00+06:00">Expires 2026-07-29T18:00:00+06:00</time>
          </div>
        </header>
        ${
          offline
            ? '<div class="experience-notice" role="status"><strong>You are working offline.</strong><span>Approved changes will stay on this device and sync when the connection returns.</span></div>'
            : ''
        }
        <main id="experience-main" class="experience-main" tabindex="-1">
          <section aria-labelledby="register-title"><h2 id="register-title">Morning register</h2><button type="button">Open attendance</button></section>
        </main>
      </section>
    </div>
  </body>
</html>`;
}

test('persona shell is semantic, capability-shaped and keyboard reachable', async ({ page }) => {
  await page.setContent(shellFixture());

  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Attendance/ })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByText('Verified session', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Morning register' })).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to current work' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#experience-main')).toBeFocused();

  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds).toEqual([]);
});

test('mobile RTL layout keeps logical alignment and contains page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.setContent(shellFixture({ direction: 'rtl' }));

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const layout = await page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>('.experience-rail')!;
    const navList = document.querySelector<HTMLElement>('.experience-nav ul')!;
    const heading = document.querySelector<HTMLElement>('.experience-masthead h1')!;
    return {
      railPosition: getComputedStyle(rail).position,
      navDisplay: getComputedStyle(navList).display,
      headingAlign: getComputedStyle(heading).textAlign,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(layout.railPosition).toBe('static');
  expect(layout.navDisplay).toBe('flex');
  expect(['start', 'right']).toContain(layout.headingAlign);
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
});

test('offline and reduced-motion states remain explicit without blocking work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setContent(shellFixture({ offline: true }));

  await expect(page.getByText('Working offline', { exact: true })).toBeVisible();
  await expect(page.getByText('3 pending', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retry sync' })).toBeVisible();
  await expect(page.getByText('Approved changes will stay on this device')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open attendance' })).toBeEnabled();

  const animationDuration = await page
    .locator('.experience-connectivity__signal')
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(['0s', '0.00001s']).toContain(animationDuration);
});
