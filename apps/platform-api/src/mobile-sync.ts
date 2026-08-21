const CANONICAL_CURSOR_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function parseMobileSyncCursor(value: string | undefined): string | null | undefined {
  if (value === undefined) return null;
  if (!CANONICAL_CURSOR_PATTERN.test(value)) return undefined;
  return value;
}
