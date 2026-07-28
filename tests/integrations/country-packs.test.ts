import { describe, expect, test } from 'vitest';

import {
  CountryPackCatalog,
  LocalizationCatalog,
  createBangladeshNationalPack,
  createSyntheticGulfPack,
  runCountryPackRegression,
  validateCountryPack,
} from '../../packages/modules/country-packs/src/index.js';

describe('country-pack engine', () => {
  test('publishes immutable versioned manifests and rejects duplicate versions', () => {
    const catalog = new CountryPackCatalog();
    const pack = createBangladeshNationalPack();

    const published = catalog.publish(pack);

    expect(published.packKey).toBe('bd-national');
    expect(published.version).toBe(1);
    expect(Object.isFrozen(published)).toBe(true);
    expect(() => catalog.publish(pack)).toThrow('Country-pack version is immutable');
  });

  test('validates locale, timezone and invariant declarations', () => {
    const invalid = {
      ...createBangladeshNationalPack(),
      defaultLocale: 'fr-FR',
      defaultTimeZone: 'Europe/Paris',
      invariants: { security: 'custom', accounting: 'custom' },
    };

    const result = validateCountryPack(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('defaultLocale must be included in locales');
    expect(result.errors).toContain('defaultTimeZone must be included in timeZones');
    expect(result.errors).toContain('country packs cannot replace foundation security invariants');
    expect(result.errors).toContain(
      'country packs cannot replace foundation accounting invariants',
    );
  });

  test('activates a pack with only validated tenant overrides', () => {
    const catalog = new CountryPackCatalog();
    catalog.publish(createBangladeshNationalPack());

    const activation = catalog.activate({
      tenantId: 'tenant-1',
      packKey: 'bd-national',
      version: 1,
      overrides: {
        locale: 'bn-BD',
        timeZone: 'Asia/Dhaka',
        gradeLabels: { 'grade-1': 'প্রথম শ্রেণি' },
      },
    });

    expect(activation.exactVersion).toBe('bd-national@1');
    expect(activation.effective.defaultLocale).toBe('bn-BD');
    expect(activation.effective.academic.gradeLabels['grade-1']).toBe('প্রথম শ্রেণি');
    expect(() =>
      catalog.activate({
        tenantId: 'tenant-2',
        packKey: 'bd-national',
        version: 1,
        overrides: { locale: 'ar-AE' },
      }),
    ).toThrow('Override locale is not supported by the pack');
  });

  test('previews an upgrade with an auditable diff and rollback version', () => {
    const catalog = new CountryPackCatalog();
    const v1 = createBangladeshNationalPack();
    const v2 = {
      ...v1,
      version: 2,
      retention: { ...v1.retention, auditDays: 3650 },
      academic: {
        ...v1.academic,
        gradeLabels: { ...v1.academic.gradeLabels, 'grade-12': 'Class Twelve' },
      },
    };
    catalog.publish(v1);
    catalog.publish(v2);

    const preview = catalog.previewUpgrade('bd-national', 1, 2);

    expect(preview.rollbackVersion).toBe(1);
    expect(preview.changes.some((change) => change.path === 'retention.auditDays')).toBe(true);
    expect(preview.changes.some((change) => change.path === 'academic.gradeLabels.grade-12')).toBe(
      true,
    );
  });

  test('resolves translations with language fallback, interpolation and RTL direction', () => {
    const localization = new LocalizationCatalog(createSyntheticGulfPack());

    expect(localization.translate('ar-AE', 'student.welcome', { name: 'ليان' })).toBe(
      'مرحباً ليان',
    );
    expect(localization.resolveLocale('ar-SA')).toBe('ar');
    expect(localization.direction('ar-AE')).toBe('rtl');
    expect(localization.direction('en-GB')).toBe('ltr');
  });

  test('passes regression harness for materially different launch and validation packs', () => {
    const bangladesh = runCountryPackRegression(createBangladeshNationalPack());
    const gulf = runCountryPackRegression(createSyntheticGulfPack());

    expect(bangladesh.passed).toBe(true);
    expect(gulf.passed).toBe(true);
    expect(bangladesh.fingerprint).not.toBe(gulf.fingerprint);
    expect(createBangladeshNationalPack().currency.code).toBe('BDT');
    expect(createSyntheticGulfPack().currency.code).toBe('AED');
    expect(createBangladeshNationalPack().academic.weekendDays).not.toEqual(
      createSyntheticGulfPack().academic.weekendDays,
    );
  });
});
