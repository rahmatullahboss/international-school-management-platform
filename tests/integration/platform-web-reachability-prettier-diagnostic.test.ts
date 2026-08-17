import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { format, resolveConfig } from 'prettier';
import { expect, it } from 'vitest';

it('prints canonical platform web reachability checker formatting', async () => {
  const filePath = path.resolve('scripts/check-platform-web-reachability.mjs');
  const source = await readFile(filePath, 'utf8');
  const config = (await resolveConfig(filePath)) ?? {};
  const formatted = await format(source, { ...config, filepath: filePath });

  console.log('PRETTIER_REACHABILITY_BEGIN');
  console.log(formatted);
  console.log('PRETTIER_REACHABILITY_END');
  expect(formatted.length).toBeGreaterThan(0);
});
