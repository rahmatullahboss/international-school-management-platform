import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import type { PilotOperatorRole } from '../../apps/platform-api/src/pilot-operator-models.js';

const liveApiUrl = 'http://127.0.0.1:8787';
const webOrigin = 'http://127.0.0.1:4173';

const routeMatrix = {
  admissions: [
    { path: '/admissions', heading: 'Admissions workspace' },
    { path: '/admissions/enquiries', heading: 'Admissions enquiries' },
    { path: '/admissions/applications', heading: 'Application review queue' },
    { path: '/admissions/interviews', heading: 'Admissions interviews' },
  ],
  finance: [
    { path: '/finance', heading: 'Finance and cashier workspace' },
    { path: '/finance/invoices', heading: 'Invoices and statements' },
    { path: '/finance/cashier', heading: 'Cashier session' },
    { path: '/finance/reconciliation', heading: 'Reconciliation queue' },
  ],
  support: [
    { path: '/support', heading: 'Platform support workspace' },
    { path: '/support/tenants', heading: 'Tenant selection' },
    { path: '/support/health', heading: 'Deployment health' },
    { path: '/support/access', heading: 'Privileged access' },
  ],
} as const satisfies Readonly<
  Record<PilotOperatorRole, readonly { readonly path: string; readonly heading: string }[]>
>;

const operatorRoots = {
  admissions: '/admissions',
  finance: '/finance',
  support: '/support',
} as const satisfies Readonly<Record<PilotOperatorRole, string>>;

const commandByRole = {
  admissions: 'application.review.record',
  finance: 'cash-session.reconcile.record',
  support: 'tenant.diagnostics.capture',
} as const satisfies Readonly<Record<PilotOperatorRole, string>>;

const allowedPermissionByRole = {
  admissions: 'admissions.application.review',
  finance: 'finance.reconciliation.write',
  support: 'support.diagnostics.read',
} as const satisfies Readonly<Record<PilotOperatorRole, string>>;

const deniedPermissionByRole = {
  admissions: 'finance.receipt.create',
  finance: 'finance.refund.approve',
  support: 'care.restricted.read',
} as const satisfies Readonly<Record<PilotOperatorRole, string>>;

async function configureLivePilotApi(page: Page): Promise<void> {
  await page.addInitScript((apiUrl) => {
    window.__PLATFORM_API_URL__ = apiUrl;
  }, liveApiUrl);
}

async function issueSession(request: APIRequestContext, role: PilotOperatorRole): Promise<string> {
  const response = await request.post(`${liveApiUrl}/pilot/v1/sessions/${role}`, {
    headers: { origin: webOrigin },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { readonly accessToken: string };
  expect(body.accessToken.length).toBeGreaterThan(32);
  return body.accessToken;
}

test('role chooser exposes all seven principal personas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Who are you working as?' })).toBeVisible();
  await expect(page.locator('.pilot-role-row')).toHaveCount(4);
  await expect(page.locator('.pilot-operator-register a')).toHaveCount(3);
  await expect(page.getByRole('link', { name: /Go to admissions/u })).toBeVisible();
  await expect(page.getByRole('link', { name: /Go to finance/u })).toBeVisible();
  await expect(page.getByRole('link', { name: /Go to support/u })).toBeVisible();
});

for (const [role, routes] of Object.entries(routeMatrix) as [
  PilotOperatorRole,
  (typeof routeMatrix)[PilotOperatorRole],
][]) {
  test.describe(`${role} independent browser workspace`, () => {
    for (const route of routes) {
      test(`${route.path} renders the governed operator surface`, async ({ page }) => {
        await page.goto(route.path);
        await expect(page.getByRole('heading', { name: route.heading, exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Change role' })).toBeVisible();
        await expect(page.getByText('Page not available in this pilot')).toHaveCount(0);
      });
    }
  });
}

for (const [role, root] of Object.entries(operatorRoots) as [PilotOperatorRole, string][]) {
  test(`${role} browser obtains a live signed session and scoped snapshot`, async ({ page }) => {
    await configureLivePilotApi(page);
    const sessionResponse = page.waitForResponse(
      (response) => response.url() === `${liveApiUrl}/pilot/v1/sessions/${role}`,
    );
    const snapshotResponse = page.waitForResponse(
      (response) => response.url() === `${liveApiUrl}/pilot/v1/snapshots/${role}`,
    );

    await page.goto(root);
    expect((await sessionResponse).status()).toBe(201);
    expect((await snapshotResponse).status()).toBe(200);
    await expect(page.getByText('Current from staging API')).toBeVisible();
  });
}

test('operator sessions cannot be replayed across operator or core roles', async ({ request }) => {
  const admissionsToken = await issueSession(request, 'admissions');

  const financeReplay = await request.get(`${liveApiUrl}/pilot/v1/snapshots/finance`, {
    headers: { origin: webOrigin, authorization: `Bearer ${admissionsToken}` },
  });
  expect(financeReplay.status()).toBe(401);

  const adminReplay = await request.get(`${liveApiUrl}/pilot/v1/snapshots/admin`, {
    headers: { origin: webOrigin, authorization: `Bearer ${admissionsToken}` },
  });
  expect(adminReplay.status()).toBe(401);
});

for (const role of Object.keys(operatorRoots) as PilotOperatorRole[]) {
  test(`${role} permission boundary allows only explicit operator grants`, async ({ request }) => {
    const accessToken = await issueSession(request, role);
    const allowed = await request.post(`${liveApiUrl}/pilot/v1/authorize/${role}`, {
      headers: {
        origin: webOrigin,
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      data: { permission: allowedPermissionByRole[role] },
    });
    expect(allowed.status()).toBe(200);
    expect((await allowed.json()) as unknown).toMatchObject({
      decision: { allowed: true, reason: 'role-grant' },
    });

    const denied = await request.post(`${liveApiUrl}/pilot/v1/authorize/${role}`, {
      headers: {
        origin: webOrigin,
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      data: { permission: deniedPermissionByRole[role] },
    });
    expect(denied.status()).toBe(200);
    expect((await denied.json()) as unknown).toMatchObject({
      decision: { allowed: false, reason: 'permission-not-granted' },
    });
  });

  test(`${role} command is scoped, idempotent and auditable`, async ({ request }) => {
    const accessToken = await issueSession(request, role);
    const idempotencyKey = `e2e-${role}-${crypto.randomUUID()}`;
    const headers = {
      origin: webOrigin,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    };
    const data = {
      tenantId: 'tenant-pilot-001',
      campusId: 'campus-main',
      reason: `E2E ${role} controlled command`,
    };

    const accepted = await request.post(
      `${liveApiUrl}/pilot/v1/commands/${role}/${commandByRole[role]}`,
      { headers, data },
    );
    expect(accepted.status()).toBe(202);
    const acceptedBody = (await accepted.json()) as {
      readonly receipt: { readonly auditId: string; readonly idempotencyKey: string };
    };
    expect(acceptedBody.receipt.idempotencyKey).toBe(idempotencyKey);
    expect(acceptedBody.receipt.auditId.length).toBeGreaterThan(8);

    const replay = await request.post(
      `${liveApiUrl}/pilot/v1/commands/${role}/${commandByRole[role]}`,
      { headers, data },
    );
    expect(replay.status()).toBe(200);
    expect((await replay.json()) as unknown).toMatchObject({ replayed: true });

    const audit = await request.get(`${liveApiUrl}/pilot/v1/audit/${role}`, {
      headers: { origin: webOrigin, authorization: `Bearer ${accessToken}` },
    });
    expect(audit.status()).toBe(200);
    const auditBody = (await audit.json()) as {
      readonly entries: readonly { readonly idempotencyKey: string; readonly auditId: string }[];
    };
    expect(auditBody.entries.some((entry) => entry.idempotencyKey === idempotencyKey)).toBe(true);

    const wrongTenant = await request.post(
      `${liveApiUrl}/pilot/v1/commands/${role}/${commandByRole[role]}`,
      {
        headers: { ...headers, 'idempotency-key': `${idempotencyKey}-wrong-tenant` },
        data: { ...data, tenantId: 'tenant-other-999' },
      },
    );
    expect(wrongTenant.status()).toBe(403);
    expect((await wrongTenant.json()) as unknown).toMatchObject({
      error: { code: 'pilot_scope_denied' },
    });

    const wrongCampus = await request.post(
      `${liveApiUrl}/pilot/v1/commands/${role}/${commandByRole[role]}`,
      {
        headers: { ...headers, 'idempotency-key': `${idempotencyKey}-wrong-campus` },
        data: { ...data, campusId: 'campus-other' },
      },
    );
    expect(wrongCampus.status()).toBe(403);
    expect((await wrongCampus.json()) as unknown).toMatchObject({
      error: { code: 'pilot_scope_denied' },
    });
  });
}

test('finance browser action records controlled audit evidence', async ({ page }) => {
  await configureLivePilotApi(page);
  await page.goto('/finance');
  await expect(page.getByText('Current from staging API')).toBeVisible();
  await page.getByRole('button', { name: 'Record reconciliation evidence' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Audit receipt recorded' }),
  ).toBeVisible();
});
