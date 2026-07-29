import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const shellCss = readFileSync(
  new URL('../../packages/modules/documents-experience/src/shell.css', import.meta.url),
  'utf8',
);
const communicationsCss = readFileSync(
  new URL('../../packages/modules/documents-experience/src/communications.css', import.meta.url),
  'utf8',
);
const reportingCss = readFileSync(
  new URL('../../packages/modules/documents-experience/src/reporting.css', import.meta.url),
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

function communicationsFixture(direction: 'ltr' | 'rtl' = 'ltr'): string {
  return `<!doctype html>
<html lang="${direction === 'rtl' ? 'ar' : 'en'}" dir="${direction}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>EXP-01 communications proof</title>
    <style>${communicationsCss}</style>
  </head>
  <body>
    <main class="communications-workspace" data-persona="guardian">
      <header class="communications-masthead">
        <div><p>School communication ledger</p><h2>International Community School</h2><span>Announcements, secure conversations and delivery evidence.</span></div>
        <dl aria-label="Communication summary"><div><dt>Unread messages</dt><dd>2</dd></div><div><dt>Responses due</dt><dd>1</dd></div><div><dt>Delivery failures</dt><dd>1</dd></div></dl>
      </header>
      <section class="communications-section" aria-labelledby="communications-announcements">
        <header><h3 id="communications-announcements">Announcements</h3><p>Only notices addressed to this household appear.</p></header>
        <ol class="communications-announcements"><li data-priority="urgent"><div><span>urgent</span><time datetime="2026-07-29T07:00:00+06:00">29 Jul 2026</time></div><h4>Campus closes early</h4><p>Collection starts at 1:00 PM.</p><a href="/family/announcements/weather">Review and acknowledge</a></li></ol>
      </section>
      <section class="communications-section" aria-labelledby="communications-delivery">
        <header><h3 id="communications-delivery">Delivery status</h3><p>Destinations stay masked.</p></header>
        <div class="communications-table" role="region" aria-label="Notification delivery status" tabindex="0">
          <table><thead><tr><th scope="col">Notification</th><th scope="col">Channel</th><th scope="col">Destination</th><th scope="col">Status</th><th scope="col">Updated</th></tr></thead><tbody><tr data-state="failed"><th scope="row">Campus closes early</th><td>email</td><td>r••••@example.test</td><td><strong>Failed</strong><small>Verify the saved address.</small></td><td><time datetime="2026-07-29T07:03:00+06:00">29 Jul 2026</time></td></tr></tbody></table>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function reportingFixture(direction: 'ltr' | 'rtl' = 'ltr'): string {
  return `<!doctype html>
<html lang="${direction === 'rtl' ? 'ar' : 'en'}" dir="${direction}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>EXP-01 reporting proof</title>
    <style>${reportingCss}</style>
  </head>
  <body>
    <main class="reporting-workspace" data-persona="admin">
      <header class="reporting-masthead">
        <div><p>Evidence and document ledger</p><h2>International Community School</h2><span>Reproducible metrics, bounded reports and authorised documents.</span></div>
        <dl aria-label="Reporting summary"><div><dt>Metrics needing attention</dt><dd>1</dd></div><div><dt>Active report jobs</dt><dd>1</dd></div><div><dt>Documents ready</dt><dd>1</dd></div></dl>
      </header>
      <section class="reporting-section" aria-labelledby="reporting-metrics">
        <header><h3 id="reporting-metrics">Governed dashboard</h3><p>Every value names its definition and source.</p></header>
        <ol class="reporting-metrics"><li data-state="exception"><div><span>exception</span><time datetime="2026-07-29T11:45:00+06:00">As of 29 Jul 2026</time></div><h4>Registers awaiting finalisation</h4><strong>3</strong><p>Three registers remain open.</p><dl><div><dt>Definition</dt><dd>Open register after timetable end v2</dd></div><div><dt>Source</dt><dd>Attendance published read model</dd></div></dl><a href="/admin/reports/attendance/open-registers">Open governed drill-down</a></li></ol>
      </section>
      <section class="reporting-section" aria-labelledby="reporting-jobs">
        <header><h3 id="reporting-jobs">Asynchronous report jobs</h3><p>Current lifecycle state remains visible.</p></header>
        <div class="reporting-table" role="region" aria-label="Report job status" tabindex="0"><table><thead><tr><th scope="col">Report</th><th scope="col">Format</th><th scope="col">Status</th><th scope="col">Updated</th><th scope="col">Result</th></tr></thead><tbody><tr data-state="running"><th scope="row">Attendance readiness report</th><td>csv</td><td><strong>Running</strong><span>65%</span></td><td><time datetime="2026-07-29T10:05:00+06:00">29 Jul 2026</time></td><td><span>Not available</span></td></tr></tbody></table></div>
      </section>
      <section class="reporting-section" aria-labelledby="reporting-documents">
        <header><h3 id="reporting-documents">Authorised documents</h3><p>Publication and security scanning determine availability.</p></header>
        <ol class="reporting-documents"><li data-ready="true"><div><span>personal</span><strong>Ready to download</strong></div><h4>Term attendance evidence</h4><p>Attendance evidence</p><dl><div><dt>Generated</dt><dd><time datetime="2026-07-29T08:00:00+06:00">29 Jul 2026</time></dd></div><div><dt>Evidence</dt><dd>SHA-256 verified</dd></div></dl><a href="/admin/documents/document-ready/request">Request secure download</a></li></ol>
      </section>
    </main>
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

test('offline and reduced-motion states remain explicit without blocking work', async ({
  page,
}) => {
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
  expect(Number.parseFloat(animationDuration)).toBeLessThanOrEqual(0.00001);
});

test('communications ledger is responsive, RTL-aware and keyboard reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(communicationsFixture('rtl'));

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'Campus closes early' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review and acknowledge' })).toBeVisible();
  const deliveryRegion = page.getByRole('region', { name: 'Notification delivery status' });
  await expect(deliveryRegion).toBeVisible();
  await deliveryRegion.focus();
  await expect(deliveryRegion).toBeFocused();

  const layout = await page.evaluate(() => {
    const masthead = document.querySelector<HTMLElement>('.communications-masthead')!;
    const tableRegion = document.querySelector<HTMLElement>('.communications-table')!;
    return {
      mastheadColumns: getComputedStyle(masthead).gridTemplateColumns,
      tableOverflow: getComputedStyle(tableRegion).overflowX,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(layout.mastheadColumns.split(' ')).toHaveLength(1);
  expect(['auto', 'scroll']).toContain(layout.tableOverflow);
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
});

test('reporting ledger contains provenance, responsive overflow and keyboard access', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(reportingFixture('rtl'));

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(
    page.getByRole('heading', { name: 'Registers awaiting finalisation' }),
  ).toBeVisible();
  await expect(page.getByText('Open register after timetable end v2')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open governed drill-down' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request secure download' })).toBeVisible();

  const jobRegion = page.getByRole('region', { name: 'Report job status' });
  await expect(jobRegion).toBeVisible();
  await jobRegion.focus();
  await expect(jobRegion).toBeFocused();

  const layout = await page.evaluate(() => {
    const masthead = document.querySelector<HTMLElement>('.reporting-masthead')!;
    const metrics = document.querySelector<HTMLElement>('.reporting-metrics')!;
    const tableRegion = document.querySelector<HTMLElement>('.reporting-table')!;
    return {
      mastheadColumns: getComputedStyle(masthead).gridTemplateColumns,
      metricColumns: getComputedStyle(metrics).gridTemplateColumns,
      tableOverflow: getComputedStyle(tableRegion).overflowX,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(layout.mastheadColumns.split(' ')).toHaveLength(1);
  expect(layout.metricColumns.split(' ')).toHaveLength(1);
  expect(['auto', 'scroll']).toContain(layout.tableOverflow);
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
});
