import { describe, expect, it, vi } from 'vitest';

import {
  handleOidcBackchannelLogoutRequest,
  type OidcBackchannelProcessor,
} from './auth-backchannel.js';

const token = 'header.claims.signature';

function successProcessor(): OidcBackchannelProcessor {
  return vi.fn<OidcBackchannelProcessor>(async () => {
    await Promise.resolve();
    return {
      ok: true,
      replayed: false,
      revokedSessions: 2,
      claims: {
        issuer: 'https://identity.school.test',
        subject: 'provider-user-123',
        providerSessionId: 'provider-session-abc',
        tokenId: 'logout-token-123',
        issuedAt: 1_785_382_400,
        expiresAt: 1_785_382_700,
      },
    };
  });
}

describe('OIDC back-channel HTTP boundary', () => {
  it('accepts one form-encoded Logout Token and returns an empty success', async () => {
    const processor = successProcessor();
    await expect(
      handleOidcBackchannelLogoutRequest({
        configured: true,
        contentType: 'application/x-www-form-urlencoded',
        rawBody: `logout_token=${encodeURIComponent(token)}`,
        processor,
      }),
    ).resolves.toEqual({ ok: true, status: 200 });
    expect(processor).toHaveBeenCalledOnce();
    expect(processor).toHaveBeenCalledWith(token);
  });

  it('rejects wrong content types, duplicate, unknown, empty and oversized fields before processing', async () => {
    const processor = successProcessor();
    for (const input of [
      { contentType: 'application/json', rawBody: `logout_token=${token}` },
      { contentType: 'application/x-www-form-urlencoded', rawBody: 'logout_token=' },
      {
        contentType: 'application/x-www-form-urlencoded',
        rawBody: `logout_token=${token}&logout_token=${token}`,
      },
      {
        contentType: 'application/x-www-form-urlencoded',
        rawBody: `logout_token=${token}&state=browser-controlled`,
      },
      {
        contentType: 'application/x-www-form-urlencoded',
        rawBody: `logout_token=${'x'.repeat(16 * 1024 + 1)}`,
      },
    ]) {
      await expect(
        handleOidcBackchannelLogoutRequest({ configured: true, ...input, processor }),
      ).resolves.toEqual({
        ok: false,
        status: 400,
        code: 'backchannel_logout_request_invalid',
        message: 'The back-channel logout request is invalid.',
      });
    }
    expect(processor).not.toHaveBeenCalled();
  });

  it('fails closed before token processing when durable configuration is absent', async () => {
    const processor = successProcessor();
    await expect(
      handleOidcBackchannelLogoutRequest({
        configured: false,
        contentType: 'application/x-www-form-urlencoded',
        rawBody: `logout_token=${token}`,
        processor,
      }),
    ).resolves.toEqual({
      ok: false,
      status: 503,
      code: 'backchannel_logout_configuration_invalid',
      message: 'Back-channel logout is not configured.',
    });
    expect(processor).not.toHaveBeenCalled();
  });

  it('sanitizes invalid tokens and durable processing outages', async () => {
    const invalid: OidcBackchannelProcessor = async () => {
      await Promise.resolve();
      return {
        ok: false,
        code: 'oidc_backchannel_signature_invalid',
        message: 'internal signature detail',
      };
    };
    const unavailable: OidcBackchannelProcessor = async () => {
      await Promise.resolve();
      return {
        ok: false,
        code: 'oidc_backchannel_replay_unavailable',
        message: 'internal database detail',
      };
    };
    const request = {
      configured: true,
      contentType: 'application/x-www-form-urlencoded',
      rawBody: `logout_token=${token}`,
    };
    await expect(
      handleOidcBackchannelLogoutRequest({ ...request, processor: invalid }),
    ).resolves.toEqual({
      ok: false,
      status: 400,
      code: 'backchannel_logout_token_invalid',
      message: 'The Logout Token is invalid.',
    });
    await expect(
      handleOidcBackchannelLogoutRequest({ ...request, processor: unavailable }),
    ).resolves.toEqual({
      ok: false,
      status: 503,
      code: 'backchannel_logout_unavailable',
      message: 'Back-channel logout is unavailable.',
    });
  });
});
