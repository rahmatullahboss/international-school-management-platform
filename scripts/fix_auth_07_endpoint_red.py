#!/usr/bin/env python3
from pathlib import Path

index_test = Path('apps/platform-api/src/index.test.ts')
source = index_test.read_text(encoding='utf-8')
source = source.replace('    }, testEnvironment);', '    }, environment);')
index_test.write_text(source, encoding='utf-8')

stub = Path('apps/platform-api/src/auth-backchannel.ts')
stub.write_text(
    """import type { OidcBackchannelLogoutProcessResult } from '@school/policy';

export type OidcBackchannelProcessor = (
  logoutToken: string,
) => Promise<OidcBackchannelLogoutProcessResult>;

export interface HandleOidcBackchannelLogoutRequestInput {
  readonly configured: boolean;
  readonly contentType: string | undefined;
  readonly rawBody: string;
  readonly processor: OidcBackchannelProcessor;
}

export async function handleOidcBackchannelLogoutRequest(
  _input: HandleOidcBackchannelLogoutRequestInput,
): Promise<{
  readonly ok: false;
  readonly status: 503;
  readonly code: string;
  readonly message: string;
}> {
  await Promise.resolve();
  return {
    ok: false,
    status: 503,
    code: 'backchannel_logout_not_implemented',
    message: 'Back-channel logout is not implemented.',
  };
}
""",
    encoding='utf-8',
)
