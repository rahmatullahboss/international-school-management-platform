import { describe, expect, it } from 'vitest';

import {
  ApprovalWorkflow,
  CountryPackRegistry,
  DocumentRegistry,
  buildNotificationKey,
  localeDirection,
  resolveLocale,
} from './index.js';

const tenantId = '11111111-1111-4111-8111-111111111111';

describe('localization and shared workflow services', () => {
  it('keeps country-pack versions immutable and resolves active versions', () => {
    const registry = new CountryPackRegistry();
    registry.publish({
      packKey: 'INTL-BASE',
      version: 1,
      locales: ['en', 'bn', 'ar'],
      defaultLocale: 'en',
    });
    registry.activate(tenantId, 'INTL-BASE', 1);

    expect(registry.activeFor(tenantId, 'INTL-BASE')?.version).toBe(1);
    expect(() =>
      registry.publish({ packKey: 'INTL-BASE', version: 1, locales: ['en'], defaultLocale: 'en' }),
    ).toThrow('Country-pack version is immutable');
  });

  it('resolves locale fallbacks and direction', () => {
    expect(resolveLocale('bn-BD', ['en', 'bn'], 'en')).toBe('bn');
    expect(resolveLocale('fr-FR', ['en', 'bn'], 'en')).toBe('en');
    expect(localeDirection('ar')).toBe('rtl');
    expect(localeDirection('en')).toBe('ltr');
  });

  it('enforces valid approval transitions', () => {
    const workflow = new ApprovalWorkflow('request-1');
    expect(() => workflow.complete()).toThrow('Workflow requires a decision');
    workflow.approve('manager-1', 'Approved with evidence');
    workflow.complete();
    expect(workflow.snapshot().status).toBe('completed');
    expect(() => workflow.reject('manager-2', 'Too late')).toThrow('Workflow is already decided');
  });

  it('keeps documents unavailable until a successful scan', () => {
    const documents = new DocumentRegistry();
    const document = documents.register({
      tenantId,
      objectKey: `tenants/${tenantId}/docs/report.pdf`,
      contentType: 'application/pdf',
    });
    expect(documents.isAvailable(document.documentId)).toBe(false);
    documents.recordScan(document.documentId, 'clean');
    expect(documents.isAvailable(document.documentId)).toBe(true);
  });

  it('builds stable tenant-scoped notification keys', () => {
    expect(buildNotificationKey(tenantId, 'invoice-issued', 'invoice-1', 'guardian-1')).toBe(
      `${tenantId}:invoice-issued:invoice-1:guardian-1`,
    );
  });
});
