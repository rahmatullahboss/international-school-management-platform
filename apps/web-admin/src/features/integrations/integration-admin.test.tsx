import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { IntegrationAdminPanel, buildIntegrationAdminModel } from './integration-admin.js';

const input = {
  locale: 'ar-AE',
  countryPacks: [
    {
      packKey: 'synthetic-gulf-validation',
      version: 1,
      displayName: 'Synthetic Gulf Validation',
      status: 'active' as const,
      defaultLocale: 'ar-AE',
      defaultTimeZone: 'Asia/Dubai',
      upgradeChanges: 0,
    },
    {
      packKey: 'bd-national',
      version: 2,
      displayName: 'Bangladesh National',
      status: 'available' as const,
      defaultLocale: 'bn-BD',
      defaultTimeZone: 'Asia/Dhaka',
      upgradeChanges: 4,
    },
  ],
  connectors: [
    {
      connectionId: 'connection-1',
      displayName: 'Synthetic LMS',
      status: 'active' as const,
      health: 'degraded' as const,
      approvalStatus: 'approved' as const,
      sandboxPassed: true,
      scopes: ['roster.read'],
      dataCategories: ['directory', 'enrollment'],
      subprocessorName: 'Synthetic Provider Ltd',
      subprocessorCountryCode: 'GB',
      privacyUrl: 'https://provider.example.test/privacy',
      alertCount: 2,
      deadLetterCount: 1,
      lastCheckedAt: '2026-07-28T05:00:00.000Z',
      credentialReference: 'key ending 1234',
    },
  ],
};

describe('integration administration feature', () => {
  test('builds a credential-safe, capability-aware administration model', () => {
    const model = buildIntegrationAdminModel(input);

    expect(model.direction).toBe('rtl');
    expect(model.activeCountryPack?.packKey).toBe('synthetic-gulf-validation');
    expect(model.connectors[0]).toMatchObject({
      needsAttention: true,
      availableActions: ['test-connection', 'replay-dead-letters', 'rotate-credential'],
    });
    expect(JSON.stringify(model)).not.toContain('credentialValue');
  });

  test('renders semantic status, privacy and accessible actions', () => {
    const model = buildIntegrationAdminModel(input);
    const html = renderToStaticMarkup(
      <IntegrationAdminPanel
        model={model}
        onActivatePack={() => undefined}
        onTestConnection={() => undefined}
        onReplayDeadLetters={() => undefined}
        onRotateCredential={() => undefined}
      />,
    );

    expect(html).toContain('dir="rtl"');
    expect(html).toContain('<h1>Internationalisation and integrations</h1>');
    expect(html).toContain('aria-label="Country pack administration"');
    expect(html).toContain('Synthetic Gulf Validation');
    expect(html).toContain('Synthetic Provider Ltd');
    expect(html).toContain('https://provider.example.test/privacy');
    expect(html).toContain('Degraded — attention required');
    expect(html).toContain('Replay 1 dead-letter delivery');
    expect(html).toContain('Activate Bangladesh National version 2');
  });
});
