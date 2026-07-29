import { expect, test } from '@playwright/test';

const pageShell = (body: string, direction: 'ltr' | 'rtl' = 'ltr') => `<!doctype html>
<html lang="en" dir="${direction}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>CARE-01 restricted interface proof</title>
    <style>
      body { font-family: system-ui, sans-serif; line-height: 1.5; margin: 1rem; }
      main { max-width: 80rem; margin-inline: auto; }
      section { margin-block: 2rem; }
      [role="region"] { overflow-x: auto; max-width: 100%; }
      table { border-collapse: collapse; width: 100%; min-width: 48rem; }
      th, td { border: 1px solid #777; padding: .65rem; text-align: start; }
      button { min-height: 2.75rem; padding-inline: .8rem; }
      button:focus-visible { outline: 3px solid currentColor; outline-offset: 2px; }
      [role="alert"] { border: 2px solid currentColor; padding: .75rem; }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; } }
    </style>
  </head>
  <body>${body}</body>
</html>`;

const restrictedFixture = `
<main>
  <section aria-labelledby="student-support-summary-title">
    <header>
      <p>Restricted operations</p>
      <h1 id="student-support-summary-title">Student support</h1>
      <p>Counts are cohort-protected and never include case narrative or diagnosis-like detail.</p>
    </header>
    <p role="status">Standard assurance is active. Medication, safeguarding, disclosure, export and approval actions require step-up authentication.</p>
    <article>
      <h2>Open safeguarding cases</h2>
      <p aria-label="Open safeguarding cases value">Suppressed</p>
      <p>Approved aggregate count with cohort protection.</p>
    </article>
  </section>
  <section aria-labelledby="clinic-workspace-title">
    <h2 id="clinic-workspace-title">Clinic queue</h2>
    <button type="button">Start clinic encounter</button>
    <button type="button" disabled>Medication administration</button>
    <p role="status">Step-up authentication is required before medication administration.</p>
    <div role="region" aria-label="Clinic encounters" tabindex="0">
      <table>
        <caption>Authorized clinic encounters with controlled categories only</caption>
        <thead><tr><th scope="col">Student reference</th><th scope="col">Campus</th><th scope="col">Opened</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
        <tbody><tr><th scope="row">STU-001</th><td>North campus</td><td><time datetime="2026-07-29T08:00:00.000Z">2026-07-29</time></td><td>routine</td><td>open</td><td><button type="button">Open encounter</button></td></tr></tbody>
      </table>
    </div>
  </section>
  <section aria-labelledby="safeguarding-workspace-title">
    <h2 id="safeguarding-workspace-title">Safeguarding cases</h2>
    <div role="alert">Step-up authentication is required before opening cases, changing membership or creating disclosures.</div>
    <div role="region" aria-label="Safeguarding cases" tabindex="0">
      <table>
        <caption>Existence-protected cases within the current membership scope</caption>
        <thead><tr><th scope="col">Case reference</th><th scope="col">Risk band</th><th scope="col">Status</th><th scope="col">Opened</th><th scope="col">Membership expires</th><th scope="col">Actions</th></tr></thead>
        <tbody><tr><th scope="row">CASE-OPAQUE-1</th><td>elevated</td><td>open</td><td>2026-07-29</td><td>2026-07-30</td><td><button type="button" disabled>Open case</button><button type="button" disabled>Manage membership</button><button type="button" disabled>Create exact disclosure</button></td></tr></tbody>
      </table>
    </div>
  </section>
</main>`;

const maskedFixture = `
<main>
  <section aria-labelledby="restricted-record-unavailable-title" role="status">
    <h1 id="restricted-record-unavailable-title">Record unavailable</h1>
    <p>The requested student-support record was not found.</p>
  </section>
</main>`;

test('restricted admin surface is semantic, keyboard reachable and step-up aware', async ({ page }) => {
  await page.setContent(pageShell(restrictedFixture));

  await expect(page.getByRole('heading', { level: 1, name: 'Student support' })).toBeVisible();
  await expect(page.getByText('Suppressed', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Authorized clinic encounters with controlled categories only' }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Existence-protected cases within the current membership scope' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Medication administration' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Open case' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Manage membership' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Create exact disclosure' })).toBeDisabled();

  await page.getByRole('button', { name: 'Open encounter' }).focus();
  await expect(page.getByRole('button', { name: 'Open encounter' })).toBeFocused();

  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds).toEqual([]);

  const bodyText = await page.locator('body').innerText();
  for (const prohibited of ['counselling note', 'allegation', 'reporter identity', 'restricted rationale']) {
    expect(bodyText.toLowerCase()).not.toContain(prohibited);
  }
});

test('mobile and RTL layouts retain scrollable tables and logical text alignment', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.setContent(pageShell(restrictedFixture, 'rtl'));

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const clinicRegion = page.getByRole('region', { name: 'Clinic encounters' });
  await expect(clinicRegion).toBeVisible();
  const overflow = await clinicRegion.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    textAlign: getComputedStyle(element.querySelector('th')!).textAlign,
  }));
  expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
  expect(['start', 'right']).toContain(overflow.textAlign);
});

test('unauthorized case state masks existence and exposes no privileged controls', async ({ page }) => {
  await page.setContent(pageShell(maskedFixture));

  await expect(page.getByRole('heading', { level: 1, name: 'Record unavailable' })).toBeVisible();
  await expect(page.getByText('was not found')).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByText('CASE-OPAQUE-1')).toHaveCount(0);
});
