import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  IntegrationAdminPanel,
  buildIntegrationAdminModel,
} from '../../../apps/web-admin/dist/features/integrations/integration-admin.js';

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

test('integration administration is navigable and exposes text status', async ({ page }) => {
  const markup = renderToStaticMarkup(
    createElement(IntegrationAdminPanel, {
      model,
      onActivatePack: () => undefined,
      onTestConnection: () => undefined,
      onReplayDeadLetters: () => undefined,
      onRotateCredential: () => undefined,
    }),
  );
  await page.setContent(`<!doctype html><html lang="en"><body>${markup}</body></html>`);

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
