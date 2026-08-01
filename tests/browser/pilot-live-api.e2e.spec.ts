import { expect, test, type Page } from '@playwright/test';

import type { PilotReadRole } from '../../apps/platform-api/src/pilot-read-models.js';

const liveApiUrl = 'http://127.0.0.1:8787';
const webOrigin = 'http://127.0.0.1:4173';

const roleRoots = {
  admin: '/admin',
  teacher: '/teacher',
  guardian: '/family',
  student: '/student',
} as const satisfies Readonly<Record<PilotReadRole, string>>;

async function configureLivePilotApi(page: Page): Promise<void> {
  await page.addInitScript((apiUrl) => {
    window.__PLATFORM_API_URL__ = apiUrl;
  }, liveApiUrl);
}

for (const [role, root] of Object.entries(roleRoots) as [PilotReadRole, string][]) {
  test(`${role} portal revalidates through the live local Worker`, async ({ page }) => {
    await configureLivePilotApi(page);

    const sessionResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${liveApiUrl}/pilot/v1/sessions/${role}` &&
        response.request().method() === 'POST',
    );
    const snapshotResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${liveApiUrl}/pilot/v1/snapshots/${role}` &&
        response.request().method() === 'GET',
    );

    await page.goto(root);

    const sessionResponse = await sessionResponsePromise;
    const snapshotResponse = await snapshotResponsePromise;
    expect(sessionResponse.status()).toBe(201);
    expect(snapshotResponse.status()).toBe(200);

    const snapshot = (await snapshotResponse.json()) as {
      readonly scope: {
        readonly tenantId: string;
        readonly campusId: string;
        readonly role: string;
        readonly subjectId: string;
      };
    };
    expect(snapshot.scope.tenantId).toBe('tenant-pilot-001');
    expect(snapshot.scope.campusId).toBe('campus-main');
    expect(snapshot.scope.role).toBe(role);
    expect(snapshot.scope.subjectId.length).toBeGreaterThan(0);
    await expect(page.getByText('Current from staging API')).toBeVisible();
  });
}

test('live pilot session is role-bound and cannot be replayed across portals', async ({
  request,
}) => {
  const sessionResponse = await request.post(`${liveApiUrl}/pilot/v1/sessions/teacher`, {
    headers: { origin: webOrigin },
  });
  expect(sessionResponse.status()).toBe(201);

  const session = (await sessionResponse.json()) as {
    readonly accessToken: string;
  };
  expect(session.accessToken.length).toBeGreaterThan(32);

  const allowed = await request.get(`${liveApiUrl}/pilot/v1/snapshots/teacher`, {
    headers: {
      origin: webOrigin,
      authorization: `Bearer ${session.accessToken}`,
    },
  });
  expect(allowed.status()).toBe(200);
  const etag = allowed.headers().etag;
  expect(etag).toBeTruthy();

  const denied = await request.get(`${liveApiUrl}/pilot/v1/snapshots/admin`, {
    headers: {
      origin: webOrigin,
      authorization: `Bearer ${session.accessToken}`,
    },
  });
  expect(denied.status()).toBe(401);
  const deniedBody: unknown = await denied.json();
  expect(deniedBody).toMatchObject({
    error: { code: 'pilot_session_invalid' },
  });

  const notModified = await request.get(`${liveApiUrl}/pilot/v1/snapshots/teacher`, {
    headers: {
      origin: webOrigin,
      authorization: `Bearer ${session.accessToken}`,
      'if-none-match': etag,
    },
  });
  expect(notModified.status()).toBe(304);
});

test('live pilot API rejects an untrusted browser origin', async ({ request }) => {
  const response = await request.post(`${liveApiUrl}/pilot/v1/sessions/admin`, {
    headers: { origin: 'https://untrusted.example' },
  });

  expect(response.status()).toBe(403);
  const responseBody: unknown = await response.json();
  expect(responseBody).toMatchObject({
    error: { code: 'pilot_origin_denied' },
  });
});
