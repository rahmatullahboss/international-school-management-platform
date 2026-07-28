import { expect, test } from '@playwright/test';

import { buildIntegrationAdminModel } from '../../../apps/web-admin/src/features/integrations/integration-admin-model.js';

const model = buildIntegrationAdminModel({
  locale: 'en-GB',
  countryPacks: [
    {
      packKey: 'bd-national',
      version: 1,
      displayName: 'Bangladesh National',
      status: 'active',
      defaultLocale: 'bn-BD',
      defaultTimeZone: 'Asia/Dhaka',
      upgradeChanges: 0,
    },
    {
      packKey: 'synthetic-gulf-validation',
      version: 2,
      displayName: 'Synthetic Gulf Validation',
      status: 'available',
      defaultLocale: 'ar-AE',
      defaultTimeZone: 'Asia/Dubai',
      upgradeChanges: 3,
    },
  ],
  connectors: [
    {
      connectionId: 'connection-1',
      displayName: 'Synthetic LMS',
      status: 'active',
      health: 'degraded',
      approvalStatus: 'approved',
      sandboxPassed: true,
      scopes: ['roster.read'],
      dataCategories: ['directory'],
      subprocessorName: 'Synthetic Provider Ltd',
      subprocessorCountryCode: 'GB',
      privacyUrl: 'https://provider.example.test/privacy',
      alertCount: 1,
      deadLetterCount: 1,
      lastCheckedAt: '2026-07-28T05:00:00.000Z',
      credentialReference: 'key ending 1234',
    },
  ],
});

function renderBrowserFixture(): string {
  const availablePack = model.countryPacks.find((pack) => pack.status === 'available');
  const connector = model.connectors[0];
  if (!availablePack || !connector)
    throw new Error('Browser fixture requires a pack and connector');

  return `<!doctype html>
<html lang="${model.locale}" dir="${model.direction}">
  <body>
    <main>
      <h1>Internationalisation and integrations</h1>
      <section aria-label="Country pack administration">
        <h2>Country packs</h2>
        <button type="button">Activate ${availablePack.displayName} version ${availablePack.version}</button>
      </section>
      <section aria-label="Connector administration">
        <h2>Connectors</h2>
        <table>
          <caption>Approved tenant connectors, operational health and privacy metadata</caption>
          <tbody>
            <tr>
              <th scope="row">${connector.displayName}</th>
              <td>${connector.healthLabel}</td>
              <td><a href="${connector.privacyUrl}">${connector.privacyUrl}</a></td>
              <td><button type="button">Replay ${connector.deadLetterCount} dead-letter delivery</button></td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  </body>
</html>`;
}

test('integration administration is navigable and exposes text status', async ({ page }) => {
  await page.setContent(renderBrowserFixture());

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Internationalisation and integrations',
  );
  await expect(page.getByRole('region', { name: 'Country pack administration' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Connector administration' })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Degraded — attention required');
  await expect(
    page.getByRole('link', { name: 'https://provider.example.test/privacy' }),
  ).toHaveAttribute('href', 'https://provider.example.test/privacy');

  const firstAction = page.getByRole('button').first();
  await firstAction.focus();
  await expect(firstAction).toBeFocused();
  await expect(page.getByRole('button', { name: 'Replay 1 dead-letter delivery' })).toBeVisible();
});
