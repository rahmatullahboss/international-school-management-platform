#!/usr/bin/env python3
from pathlib import Path

path = Path('apps/platform-api/src/auth-durable-store.test.ts')
source = path.read_text(encoding='utf-8')
source = source.replace(
    '  providerSessionId: identity.providerSessionId,\n  tenantId: ids.tenant,',
    "  providerSessionId: 'provider-session-abc',\n  tenantId: ids.tenant,",
)
source = source.replace(
    '      providerSessionId: identity.providerSessionId,\n      tokenId:',
    "      providerSessionId: 'provider-session-abc',\n      tokenId:",
)
path.write_text(source, encoding='utf-8')
