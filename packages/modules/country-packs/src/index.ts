export type TextDirection = 'ltr' | 'rtl';

export interface AttendanceCodeDefinition {
  code: string;
  labelKey: string;
  present: boolean;
  excused: boolean;
}

export interface CountryPackManifest {
  schemaVersion: 1;
  packKey: string;
  version: number;
  countryCode: string;
  releaseStatus: 'draft' | 'released';
  locales: readonly string[];
  defaultLocale: string;
  timeZones: readonly string[];
  defaultTimeZone: string;
  currency: Readonly<{
    code: string;
    minorUnit: number;
  }>;
  address: Readonly<{
    requiredFields: readonly string[];
    postalCodePattern?: string;
  }>;
  academic: Readonly<{
    weekendDays: readonly number[];
    gradeLabels: Readonly<Record<string, string>>;
    attendanceCodes: readonly Readonly<AttendanceCodeDefinition>[];
  }>;
  requiredFields: Readonly<{
    student: readonly string[];
    staff: readonly string[];
  }>;
  retention: Readonly<{
    auditDays: number;
    integrationDeliveryDays: number;
  }>;
  templates: Readonly<Record<string, string>>;
  translations: Readonly<Record<string, Readonly<Record<string, string>>>>;
  invariants: Readonly<{
    security: 'foundation-v1';
    accounting: 'foundation-v1';
  }>;
}

export interface CountryPackValidationResult {
  valid: boolean;
  errors: readonly string[];
}

export interface CountryPackOverrides {
  locale?: string;
  timeZone?: string;
  gradeLabels?: Readonly<Record<string, string>>;
  attendanceLabels?: Readonly<Record<string, string>>;
  templates?: Readonly<Record<string, string>>;
}

export interface CountryPackActivationInput {
  tenantId: string;
  packKey: string;
  version: number;
  overrides?: CountryPackOverrides;
}

export interface CountryPackActivation {
  tenantId: string;
  exactVersion: string;
  activatedAt: Date;
  overrides: Readonly<CountryPackOverrides>;
  effective: Readonly<CountryPackManifest>;
}

export interface CountryPackDiffEntry {
  path: string;
  before: unknown;
  after: unknown;
}

export interface CountryPackUpgradePreview {
  packKey: string;
  fromVersion: number;
  toVersion: number;
  rollbackVersion: number;
  changes: readonly Readonly<CountryPackDiffEntry>[];
}

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function requireNonEmpty(value: string, field: string, errors: string[]): void {
  if (value.trim().length === 0) errors.push(`${field} is required`);
}

export function validateCountryPack(
  manifest: CountryPackManifest | Record<string, unknown>,
): CountryPackValidationResult {
  const pack = manifest as Partial<CountryPackManifest>;
  const errors: string[] = [];

  requireNonEmpty(pack.packKey ?? '', 'packKey', errors);
  requireNonEmpty(pack.countryCode ?? '', 'countryCode', errors);
  if (!Number.isInteger(pack.version) || (pack.version ?? 0) < 1) {
    errors.push('version must be a positive integer');
  }
  if (!pack.locales?.includes(pack.defaultLocale ?? '')) {
    errors.push('defaultLocale must be included in locales');
  }
  if (!pack.timeZones?.includes(pack.defaultTimeZone ?? '')) {
    errors.push('defaultTimeZone must be included in timeZones');
  }
  if (!pack.currency || !/^[A-Z]{3}$/.test(pack.currency.code)) {
    errors.push('currency code must be an ISO-style three-letter code');
  }
  if (!pack.currency || !Number.isInteger(pack.currency.minorUnit)) {
    errors.push('currency minorUnit must be an integer');
  }
  if (pack.invariants?.security !== 'foundation-v1') {
    errors.push('country packs cannot replace foundation security invariants');
  }
  if (pack.invariants?.accounting !== 'foundation-v1') {
    errors.push('country packs cannot replace foundation accounting invariants');
  }
  if (
    pack.locales &&
    new Set(pack.locales.map((locale) => locale.toLowerCase())).size !== pack.locales.length
  ) {
    errors.push('locales must be unique');
  }
  if (pack.academic?.weekendDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    errors.push('weekendDays must use integers from 0 to 6');
  }
  if (pack.defaultLocale && !pack.translations?.[pack.defaultLocale]) {
    errors.push('defaultLocale must have a translation catalogue');
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function collectDiff(before: unknown, after: unknown, path = ''): CountryPackDiffEntry[] {
  if (Object.is(before, after)) return [];
  const beforeIsObject = before !== null && typeof before === 'object' && !Array.isArray(before);
  const afterIsObject = after !== null && typeof after === 'object' && !Array.isArray(after);
  if (beforeIsObject && afterIsObject) {
    const beforeRecord = before as Record<string, unknown>;
    const afterRecord = after as Record<string, unknown>;
    const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
    return [...keys]
      .sort()
      .flatMap((key) =>
        collectDiff(beforeRecord[key], afterRecord[key], path.length > 0 ? `${path}.${key}` : key),
      );
  }
  if (stableStringify(before) === stableStringify(after)) return [];
  return [{ path, before, after }];
}

function validateOverrides(manifest: CountryPackManifest, overrides: CountryPackOverrides): void {
  if (overrides.locale && !manifest.locales.includes(overrides.locale)) {
    throw new Error('Override locale is not supported by the pack');
  }
  if (overrides.timeZone && !manifest.timeZones.includes(overrides.timeZone)) {
    throw new Error('Override timezone is not supported by the pack');
  }
  if (overrides.gradeLabels) {
    const supported = new Set(Object.keys(manifest.academic.gradeLabels));
    for (const gradeKey of Object.keys(overrides.gradeLabels)) {
      if (!supported.has(gradeKey)) throw new Error(`Unknown grade label override: ${gradeKey}`);
    }
  }
  if (overrides.attendanceLabels) {
    const supported = new Set(manifest.academic.attendanceCodes.map((code) => code.code));
    for (const attendanceCode of Object.keys(overrides.attendanceLabels)) {
      if (!supported.has(attendanceCode)) {
        throw new Error(`Unknown attendance label override: ${attendanceCode}`);
      }
    }
  }
}

function applyOverrides(
  manifest: CountryPackManifest,
  overrides: CountryPackOverrides,
): CountryPackManifest {
  const gradeLabels = { ...manifest.academic.gradeLabels, ...overrides.gradeLabels };
  const attendanceLabels = overrides.attendanceLabels ?? {};
  const attendanceCodes = manifest.academic.attendanceCodes.map((definition) => {
    const override = attendanceLabels[definition.code];
    return override ? { ...definition, labelKey: override } : definition;
  });
  return {
    ...manifest,
    defaultLocale: overrides.locale ?? manifest.defaultLocale,
    defaultTimeZone: overrides.timeZone ?? manifest.defaultTimeZone,
    academic: { ...manifest.academic, gradeLabels, attendanceCodes },
    templates: { ...manifest.templates, ...overrides.templates },
  };
}

export class CountryPackCatalog {
  readonly #versions = new Map<string, Readonly<CountryPackManifest>>();
  readonly #activations = new Map<string, Readonly<CountryPackActivation>>();

  publish(manifest: CountryPackManifest): Readonly<CountryPackManifest> {
    const validation = validateCountryPack(manifest);
    if (!validation.valid) throw new Error(`Invalid country pack: ${validation.errors.join('; ')}`);
    const key = `${manifest.packKey}@${manifest.version}`;
    if (this.#versions.has(key)) throw new Error('Country-pack version is immutable');
    const published = deepFreeze(deepClone(manifest));
    this.#versions.set(key, published);
    return published;
  }

  get(packKey: string, version: number): Readonly<CountryPackManifest> | undefined {
    return this.#versions.get(`${packKey}@${version}`);
  }

  activate(input: CountryPackActivationInput): Readonly<CountryPackActivation> {
    const manifest = this.get(input.packKey, input.version);
    if (!manifest) throw new Error('Unknown country-pack version');
    const overrides = input.overrides ?? {};
    validateOverrides(manifest, overrides);
    const activation = deepFreeze({
      tenantId: input.tenantId,
      exactVersion: `${input.packKey}@${input.version}`,
      activatedAt: new Date(),
      overrides: deepClone(overrides),
      effective: applyOverrides(manifest, overrides),
    });
    this.#activations.set(`${input.tenantId}:${input.packKey}`, activation);
    return activation;
  }

  activeFor(tenantId: string, packKey: string): Readonly<CountryPackActivation> | undefined {
    return this.#activations.get(`${tenantId}:${packKey}`);
  }

  previewUpgrade(
    packKey: string,
    fromVersion: number,
    toVersion: number,
  ): CountryPackUpgradePreview {
    const before = this.get(packKey, fromVersion);
    const after = this.get(packKey, toVersion);
    if (!before || !after) throw new Error('Unknown country-pack upgrade version');
    if (toVersion <= fromVersion)
      throw new Error('Upgrade target must be newer than current version');
    return deepFreeze({
      packKey,
      fromVersion,
      toVersion,
      rollbackVersion: fromVersion,
      changes: collectDiff(before, after),
    });
  }
}

const rtlLanguages = new Set(['ar', 'fa', 'he', 'ur']);

export class LocalizationCatalog {
  constructor(readonly manifest: Readonly<CountryPackManifest>) {}

  resolveLocale(requested: string): string {
    const exact = this.manifest.locales.find(
      (locale) => locale.toLowerCase() === requested.toLowerCase(),
    );
    if (exact) return exact;
    const requestedLanguage = requested.split('-')[0]?.toLowerCase();
    const genericLanguage = this.manifest.locales.find(
      (locale) => locale.toLowerCase() === requestedLanguage,
    );
    if (genericLanguage) return genericLanguage;
    const languageMatch = this.manifest.locales.find(
      (locale) => locale.split('-')[0]?.toLowerCase() === requestedLanguage,
    );
    return languageMatch ?? this.manifest.defaultLocale;
  }

  direction(locale: string): TextDirection {
    const language = locale.split('-')[0]?.toLowerCase() ?? '';
    return rtlLanguages.has(language) ? 'rtl' : 'ltr';
  }

  translate(locale: string, key: string, variables: Readonly<Record<string, string>> = {}): string {
    const resolved = this.resolveLocale(locale);
    const fallback = this.manifest.translations[this.manifest.defaultLocale] ?? {};
    const template = this.manifest.translations[resolved]?.[key] ?? fallback[key];
    if (!template) return key;
    return template.replace(
      /\{([A-Za-z0-9_.-]+)\}/g,
      (_match, variable: string) => variables[variable] ?? `{${variable}}`,
    );
  }
}

export interface CountryPackRegressionResult {
  passed: boolean;
  fingerprint: string;
  checks: Readonly<Record<string, boolean>>;
}

export function runCountryPackRegression(
  manifest: CountryPackManifest,
): Readonly<CountryPackRegressionResult> {
  const validation = validateCountryPack(manifest);
  const checks = {
    validManifest: validation.valid,
    releasedAndVersioned: manifest.releaseStatus === 'released' && manifest.version > 0,
    defaultTranslationAvailable: Boolean(manifest.translations[manifest.defaultLocale]),
    immutableInvariants:
      manifest.invariants.security === 'foundation-v1' &&
      manifest.invariants.accounting === 'foundation-v1',
    requiredAcademicConfiguration:
      Object.keys(manifest.academic.gradeLabels).length > 0 &&
      manifest.academic.attendanceCodes.length > 0,
  };
  return deepFreeze({
    passed: Object.values(checks).every(Boolean),
    fingerprint: fingerprint(manifest),
    checks,
  });
}

export function createBangladeshNationalPack(): CountryPackManifest {
  return {
    schemaVersion: 1,
    packKey: 'bd-national',
    version: 1,
    countryCode: 'BD',
    releaseStatus: 'released',
    locales: ['bn-BD', 'en-GB'],
    defaultLocale: 'en-GB',
    timeZones: ['Asia/Dhaka'],
    defaultTimeZone: 'Asia/Dhaka',
    currency: { code: 'BDT', minorUnit: 2 },
    address: {
      requiredFields: ['addressLine', 'district', 'division', 'countryCode'],
      postalCodePattern: '^[0-9]{4}$',
    },
    academic: {
      weekendDays: [5],
      gradeLabels: {
        'grade-1': 'Class One',
        'grade-5': 'Class Five',
        'grade-10': 'Secondary',
        'grade-12': 'Higher Secondary',
      },
      attendanceCodes: [
        { code: 'P', labelKey: 'attendance.present', present: true, excused: false },
        { code: 'A', labelKey: 'attendance.absent', present: false, excused: false },
        { code: 'L', labelKey: 'attendance.leave', present: false, excused: true },
      ],
    },
    requiredFields: {
      student: ['legalName', 'dateOfBirth', 'guardianRelationship'],
      staff: ['legalName', 'employmentStartDate'],
    },
    retention: { auditDays: 2555, integrationDeliveryDays: 180 },
    templates: {
      invoice: 'bd.invoice.v1',
      reportCard: 'bd.report-card.v1',
      consentNotice: 'bd.consent-notice.v1',
    },
    translations: {
      'en-GB': {
        'student.welcome': 'Welcome {name}',
        'attendance.present': 'Present',
        'attendance.absent': 'Absent',
        'attendance.leave': 'Leave',
      },
      'bn-BD': {
        'student.welcome': 'স্বাগতম {name}',
        'attendance.present': 'উপস্থিত',
        'attendance.absent': 'অনুপস্থিত',
        'attendance.leave': 'ছুটি',
      },
    },
    invariants: { security: 'foundation-v1', accounting: 'foundation-v1' },
  };
}

export function createSyntheticGulfPack(): CountryPackManifest {
  return {
    schemaVersion: 1,
    packKey: 'synthetic-gulf-validation',
    version: 1,
    countryCode: 'AE',
    releaseStatus: 'released',
    locales: ['ar-AE', 'ar', 'en-GB'],
    defaultLocale: 'en-GB',
    timeZones: ['Asia/Dubai'],
    defaultTimeZone: 'Asia/Dubai',
    currency: { code: 'AED', minorUnit: 2 },
    address: {
      requiredFields: ['addressLine', 'emirate', 'countryCode'],
    },
    academic: {
      weekendDays: [6, 0],
      gradeLabels: {
        'grade-1': 'Year 1',
        'grade-5': 'Year 5',
        'grade-10': 'Year 10',
        'grade-12': 'Year 12',
      },
      attendanceCodes: [
        { code: 'P', labelKey: 'attendance.present', present: true, excused: false },
        { code: 'UA', labelKey: 'attendance.unexcused', present: false, excused: false },
        { code: 'EA', labelKey: 'attendance.excused', present: false, excused: true },
      ],
    },
    requiredFields: {
      student: ['legalName', 'dateOfBirth', 'nationality', 'guardianRelationship'],
      staff: ['legalName', 'employmentStartDate', 'workPermitReference'],
    },
    retention: { auditDays: 3650, integrationDeliveryDays: 365 },
    templates: {
      invoice: 'synthetic-gulf.invoice.v1',
      reportCard: 'synthetic-gulf.report-card.v1',
      consentNotice: 'synthetic-gulf.consent-notice.v1',
    },
    translations: {
      'en-GB': {
        'student.welcome': 'Welcome {name}',
        'attendance.present': 'Present',
        'attendance.unexcused': 'Unexcused absence',
        'attendance.excused': 'Excused absence',
      },
      ar: {
        'student.welcome': 'مرحباً {name}',
        'attendance.present': 'حاضر',
        'attendance.unexcused': 'غياب بدون عذر',
        'attendance.excused': 'غياب بعذر',
      },
      'ar-AE': {
        'student.welcome': 'مرحباً {name}',
        'attendance.present': 'حاضر',
        'attendance.unexcused': 'غياب بدون عذر',
        'attendance.excused': 'غياب بعذر',
      },
    },
    invariants: { security: 'foundation-v1', accounting: 'foundation-v1' },
  };
}
