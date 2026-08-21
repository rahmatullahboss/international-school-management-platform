import { describe, expect, it } from 'vitest';

import { parseMobileSyncCursor } from './mobile-sync.js';

describe('mobile sync contract', () => {
  it('accepts no cursor or a canonical opaque cursor', () => {
    expect(parseMobileSyncCursor(undefined)).toBeNull();
    expect(parseMobileSyncCursor('40000000-0000-4000-8000-000000000001')).toBe(
      '40000000-0000-4000-8000-000000000001',
    );
  });

  it('rejects malformed or non-canonical cursors', () => {
    expect(parseMobileSyncCursor('')).toBeUndefined();
    expect(parseMobileSyncCursor('40000000-0000-4000-8000-00000000000A')).toBeUndefined();
    expect(parseMobileSyncCursor('not-a-cursor')).toBeUndefined();
  });
});
