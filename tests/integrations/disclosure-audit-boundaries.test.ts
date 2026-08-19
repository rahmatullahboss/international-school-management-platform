import { describe, expect, it } from 'vitest';

import { IntegrationDisclosureAudit } from '../../packages/modules/integrations/src/disclosure-audit.js';

function disclosureInput(
  overrides: Partial<Parameters<IntegrationDisclosureAudit['append']>[0]> = {},
) {
  return {
    tenantId: 'tenant-1',
    connectionId: 'connection-1',
    direction: 'outbound' as const,
    destination: 'https://lms.example.test/webhooks',
    dataCategories: ['directory', 'enrollment'],
    purpose: 'Roster synchronization',
    recordCount: 25,
    status: 'delivered' as const,
    correlationId: 'correlation-1',
    occurredAt: new Date('2026-08-19T12:00:00.000Z'),
    ...overrides,
  };
}

describe('IntegrationDisclosureAudit boundaries', () => {
  it('records immutable evidence and deduplicates disclosed data categories', () => {
    const audit = new IntegrationDisclosureAudit({ idFactory: () => 'disclosure-1' });
    const entry = audit.append(
      disclosureInput({ dataCategories: ['directory', 'enrollment', 'directory'] }),
    );

    expect(entry).toMatchObject({
      disclosureId: 'disclosure-1',
      tenantId: 'tenant-1',
      connectionId: 'connection-1',
      dataCategories: ['directory', 'enrollment'],
      recordCount: 25,
      status: 'delivered',
    });
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.dataCategories)).toBe(true);
  });

  it('fails closed when purpose, categories or record-count evidence is invalid', () => {
    const audit = new IntegrationDisclosureAudit();

    expect(() => audit.append(disclosureInput({ purpose: '   ' }))).toThrow(
      'Disclosure purpose is required',
    );
    expect(() => audit.append(disclosureInput({ dataCategories: [] }))).toThrow(
      'Disclosure data categories are required',
    );
    for (const recordCount of [-1, 1.5]) {
      expect(() => audit.append(disclosureInput({ recordCount }))).toThrow(
        'Disclosure record count must be a non-negative integer',
      );
    }
    expect(audit.append(disclosureInput()).disclosureId).toBeTruthy();
  });

  it('keeps tenant audit queries isolated while preserving append order', () => {
    const ids = ['disclosure-1', 'disclosure-2', 'disclosure-3'];
    const audit = new IntegrationDisclosureAudit({ idFactory: () => ids.shift() ?? 'generated' });
    const first = audit.append(disclosureInput({ correlationId: 'correlation-1' }));
    audit.append(
      disclosureInput({
        tenantId: 'tenant-2',
        connectionId: 'connection-2',
        correlationId: 'correlation-2',
      }),
    );
    const third = audit.append(
      disclosureInput({
        connectionId: 'connection-3',
        correlationId: 'correlation-3',
        status: 'failed',
      }),
    );

    expect(audit.entriesForTenant('tenant-1')).toEqual([first, third]);
    expect(audit.entriesForTenant('tenant-2')).toHaveLength(1);
    expect(audit.entriesForTenant('tenant-missing')).toEqual([]);
  });
});
