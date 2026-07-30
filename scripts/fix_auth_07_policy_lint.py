#!/usr/bin/env python3
from pathlib import Path

path = Path('packages/policy/src/oidc-backchannel-logout.test.ts')
source = path.read_text(encoding='utf-8')
replacements = {
    "resolveJwks: async () => jwksResult([publicJwk]),": "resolveJwks: async () => {\n        await Promise.resolve();\n        return jwksResult([publicJwk]);\n      },",
    "consumeToken: async () => {\n          throw new Error('database unavailable');\n        },": "consumeToken: async () => {\n          await Promise.resolve();\n          throw new Error('database unavailable');\n        },",
    "revokeSessions: async () => 0,": "revokeSessions: async () => {\n          await Promise.resolve();\n          return 0;\n        },",
    "consumeToken: async () => true,": "consumeToken: async () => {\n          await Promise.resolve();\n          return true;\n        },",
    "revokeSessions: async () => {\n          throw new Error('database unavailable');\n        },": "revokeSessions: async () => {\n          await Promise.resolve();\n          throw new Error('database unavailable');\n        },",
}
for old, new in replacements.items():
    count = source.count(old)
    if count == 0:
        continue
    source = source.replace(old, new)
path.write_text(source, encoding='utf-8')
