import { expect, test } from '@playwright/test';

const pageShell = (body: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>FIN-01 browser proof</title>
    <style>
      body { font-family: system-ui, sans-serif; line-height: 1.5; margin: 2rem; }
      table { border-collapse: collapse; width: 100%; margin-block: 1rem; }
      th, td { border: 1px solid #bbb; padding: .5rem; text-align: left; }
      button:focus-visible { outline: 3px solid currentColor; outline-offset: 2px; }
      [role="alert"] { border: 2px solid currentColor; padding: .75rem; }
      section { margin-block: 2rem; }
    </style>
  </head>
  <body>${body}</body>
</html>`;

const adminFixture = `
<main>
  <section aria-labelledby="finance-dashboard-title">
    <header>
      <h1 id="finance-dashboard-title">Finance dashboard</h1>
      <p>Every amount links to a reproducible as-of report.</p>
    </header>
    <div role="alert"><strong>Reconciliation attention required.</strong> Receivable difference £1.00; unapplied-cash difference -£0.50.</div>
    <article>
      <h2>Outstanding receivables</h2>
      <p><data value="12500">£125.00</data></p>
      <p>Posted invoice totals less credits and active payment allocations as of the selected date.</p>
      <small>As of <time datetime="2026-07-28">2026-07-28</time> · billing invoices, credits, allocations and receivable control account</small>
    </article>
  </section>
  <section aria-labelledby="invoice-workspace-title">
    <header><h2 id="invoice-workspace-title">Invoices and receivables</h2></header>
    <button type="button" disabled>Create invoice</button>
    <button type="button" disabled>Export invoices</button>
    <table>
      <caption>Invoices with current balance and lifecycle status</caption>
      <thead><tr><th scope="col">Invoice</th><th scope="col">Account</th><th scope="col">Status</th><th scope="col">Balance</th><th scope="col">Actions</th></tr></thead>
      <tbody><tr><th scope="row">INV-000001</th><td>Family A</td><td>draft</td><td>£100.00</td><td><button type="button" disabled>Post</button></td></tr></tbody>
    </table>
  </section>
  <section aria-labelledby="payment-workspace-title">
    <h2 id="payment-workspace-title">Payments and unapplied cash</h2>
    <table>
      <caption>Verified receipts and allocation status</caption>
      <thead><tr><th scope="col">Receipt</th><th scope="col">Amount</th><th scope="col">Unapplied</th><th scope="col">Action</th></tr></thead>
      <tbody><tr><th scope="row">RCT-000001</th><td>£50.00</td><td>£20.00</td><td><button type="button">Allocate</button></td></tr></tbody>
    </table>
  </section>
  <section aria-labelledby="refund-queue-title">
    <h2 id="refund-queue-title">Refund approval queue</h2>
    <table>
      <caption>Refunds awaiting an independent approver</caption>
      <thead><tr><th scope="col">Refund</th><th scope="col">Receipt</th><th scope="col">Amount</th><th scope="col">Decision</th></tr></thead>
      <tbody><tr><th scope="row">RF-000001</th><td>RCT-000001</td><td>£10.00</td><td><button type="button" disabled>Approve</button><button type="button" disabled>Reject</button></td></tr></tbody>
    </table>
  </section>
</main>`;

const familyFixture = `
<main>
  <section aria-labelledby="family-finance-overview-title">
    <h1 id="family-finance-overview-title">Fees and payments</h1>
    <dl><div><dt>Outstanding</dt><dd>£80.00</dd></div><div><dt>Overdue</dt><dd>£20.00</dd></div><div><dt>Unapplied credit</dt><dd>£5.00</dd></div></dl>
    <p role="alert">An overdue balance is available for review. Open the invoice before making a payment.</p>
  </section>
  <section aria-labelledby="family-invoices-title">
    <h2 id="family-invoices-title">Invoices</h2>
    <table>
      <caption>Issued invoices, due dates and remaining balances</caption>
      <thead><tr><th scope="col">Invoice</th><th scope="col">Due</th><th scope="col">Status</th><th scope="col">Balance</th><th scope="col">Documents</th></tr></thead>
      <tbody><tr><th scope="row">INV-000001</th><td><time datetime="2026-08-01">2026-08-01</time></td><td>posted</td><td>£80.00</td><td><button type="button">Download invoice</button></td></tr></tbody>
    </table>
  </section>
  <section aria-labelledby="family-payment-title">
    <h2 id="family-payment-title">Pay INV-000001</h2>
    <p>Maximum payable amount: £80.00.</p>
    <p>Payments are securely processed by Completion Pay. A receipt appears only after provider verification.</p>
    <button type="button" disabled aria-busy="true">Payment pending verification</button>
  </section>
  <section aria-labelledby="family-statement-title">
    <h2 id="family-statement-title">Account statement</h2>
    <table>
      <caption>Invoices, credits, payments and refunds</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Document</th><th scope="col">Type</th><th scope="col">Debit</th><th scope="col">Credit</th><th scope="col">Balance</th></tr></thead>
      <tbody><tr><td>2026-07-01</td><th scope="row">INV-000001</th><td>invoice</td><td>£100.00</td><td>£0.00</td><td>£100.00</td></tr><tr><td>2026-07-28</td><th scope="row">RCT-000001</th><td>payment</td><td>£0.00</td><td>£20.00</td><td>£80.00</td></tr></tbody>
    </table>
  </section>
</main>`;

test('admin finance surfaces expose semantic structure, reconciliation alerts and permission-aware controls', async ({
  page,
}) => {
  await page.setContent(pageShell(adminFixture));

  await expect(page.getByRole('heading', { level: 1, name: 'Finance dashboard' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Reconciliation attention required');
  await expect(
    page.getByRole('table', { name: 'Invoices with current balance and lifecycle status' }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Verified receipts and allocation status' }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Refunds awaiting an independent approver' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create invoice' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Post' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Approve' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Allocate' })).toBeEnabled();

  await page.getByRole('button', { name: 'Allocate' }).focus();
  await expect(page.getByRole('button', { name: 'Allocate' })).toBeFocused();
  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds).toEqual([]);
});

test('family finance surfaces keep payment state, invoices and statement history understandable without privileged actions', async ({
  page,
}) => {
  await page.setContent(pageShell(familyFixture));

  await expect(page.getByRole('heading', { level: 1, name: 'Fees and payments' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('overdue balance');
  await expect(
    page.getByRole('table', { name: 'Issued invoices, due dates and remaining balances' }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Invoices, credits, payments and refunds' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Payment pending verification' })).toBeDisabled();
  await expect(page.getByText('A receipt appears only after provider verification.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Post' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Download invoice' }).focus();
  await expect(page.getByRole('button', { name: 'Download invoice' })).toBeFocused();
  const headingLevels = await page
    .locator('h1, h2, h3, h4, h5, h6')
    .evaluateAll((headings) => headings.map((heading) => Number(heading.tagName.slice(1))));
  expect(headingLevels[0]).toBe(1);
  expect(
    headingLevels.every((level, index) => index === 0 || level - headingLevels[index - 1]! <= 1),
  ).toBe(true);
});
