import { describe, expect, it } from 'vitest';

import {
  parseFamilyConversationPageQuery,
  parseFamilyMessageSend,
  parseFamilyReadReceipt,
} from './mobile-family-conversations.js';

describe('mobile Family conversation request contracts', () => {
  it('accepts bounded exact message and read-receipt commands', () => {
    expect(parseFamilyMessageSend('{"body":"Hello school"}')).toEqual({ body: 'Hello school' });
    expect(parseFamilyReadReceipt('{"messageId":"40000000-0000-4000-8000-000000000030"}')).toEqual({
      messageId: '40000000-0000-4000-8000-000000000030',
    });
  });

  it('rejects unknown fields, whitespace ambiguity and oversized message bodies', () => {
    expect(parseFamilyMessageSend('{"body":" Hello school"}')).toBeUndefined();
    expect(parseFamilyMessageSend('{"body":"Hello school","studentId":"leak"}')).toBeUndefined();
    expect(parseFamilyMessageSend(JSON.stringify({ body: 'x'.repeat(4001) }))).toBeUndefined();
    expect(
      parseFamilyReadReceipt(
        '{"messageId":"40000000-0000-4000-8000-000000000030","readAt":"client"}',
      ),
    ).toBeUndefined();
  });

  it('parses bounded opaque pagination cursors without accepting arbitrary query input', () => {
    const cursor = '20260821123456789.40000000-0000-4000-8000-000000000040';
    expect(parseFamilyConversationPageQuery(undefined, undefined, 25)).toEqual({ limit: 25 });
    expect(parseFamilyConversationPageQuery(cursor, '50', 25)).toEqual({ cursor, limit: 50 });
    expect(parseFamilyConversationPageQuery('not-a-cursor', '25', 25)).toBeUndefined();
    expect(
      parseFamilyConversationPageQuery(
        '20260821123456789.AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
        '25',
        25,
      ),
    ).toBeUndefined();
    expect(parseFamilyConversationPageQuery(undefined, '0', 25)).toBeUndefined();
    expect(parseFamilyConversationPageQuery(undefined, '101', 25)).toBeUndefined();
  });
});
