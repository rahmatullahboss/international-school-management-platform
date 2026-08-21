const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;

export function parseMobileFamilyDocumentLimit(value: string | undefined): number | undefined {
  if (value === undefined) return 25;
  if (!/^[1-9][0-9]{0,2}$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : undefined;
}

export function parseMobileFamilyDocumentCursor(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return UUID_PATTERN.test(value) ? value : undefined;
}

export function isMobileFamilyDocumentIdempotencyKey(value: string | undefined): value is string {
  return value !== undefined && IDEMPOTENCY_KEY_PATTERN.test(value);
}
