#!/usr/bin/env python3
from pathlib import Path

login = Path('packages/policy/src/oidc-login-flow.ts')
source = login.read_text(encoding='utf-8')
old_return = "): Promise<OidcVerificationResult | OidcSigningKeyResolution> {"
new_return = "): Promise<\n  | OidcVerificationResult\n  | Extract<OidcSigningKeyResolution, { readonly ok: false }>\n> {"
if old_return not in source:
    raise SystemExit('OIDC identity-resolution return type was not found.')
login.write_text(source.replace(old_return, new_return), encoding='utf-8')

cache = Path('packages/policy/src/oidc-provider-cache.ts')
source = cache.read_text(encoding='utf-8')
if source.count('Promise<unknown | undefined>') != 2:
    raise SystemExit('Expected two redundant unknown unions in cache store.')
source = source.replace('Promise<unknown | undefined>', 'Promise<unknown>')
if source.count('async () => response') != 2:
    raise SystemExit('Expected two delegated response callbacks.')
source = source.replace(
    'async () => response',
    'async () => {\n      await Promise.resolve();\n      return response;\n    }',
)
cache.write_text(source, encoding='utf-8')
