import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';
import { expect, it } from 'vitest';

it('prints canonical command coverage formatting', async () => {
  const filePath = fileURLToPath(
    new URL('./production-operator-command-api-coverage.test.ts', import.meta.url),
  );
  const source = await readFile(filePath, 'utf8');
  const config = (await resolveConfig(filePath)) ?? {};
  const formatted = await format(source, { ...config, filepath: filePath });

  console.log('PRETTIER_CANONICAL_BEGIN');
  console.log(formatted);
  console.log('PRETTIER_CANONICAL_END');
  expect(formatted.length).toBeGreaterThan(0);
});
