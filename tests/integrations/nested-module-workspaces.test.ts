import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, test } from 'vitest';

const root = process.cwd();
const checker = path.join(root, 'scripts/check-architecture-boundaries.mjs');
const temporaryDirectories: string[] = [];

async function createFixture(): Promise<string> {
  const fixture = await mkdtemp(path.join(tmpdir(), 'school-boundaries-'));
  temporaryDirectories.push(fixture);
  await mkdir(path.join(fixture, 'apps'), { recursive: true });
  await mkdir(path.join(fixture, 'packages/modules/demo/src'), { recursive: true });
  await writeFile(
    path.join(fixture, 'packages/modules/demo/package.json'),
    JSON.stringify({ name: '@school/demo', type: 'module' }),
  );
  await writeFile(
    path.join(fixture, 'packages/modules/demo/src/index.ts'),
    'export const demo = true;\n',
  );
  return fixture;
}

function runChecker(cwd: string) {
  return spawnSync(process.execPath, [checker], { cwd, encoding: 'utf8' });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('nested module workspace contract', () => {
  test('registers nested module packages as npm workspaces', async () => {
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
      workspaces?: string[];
    };
    const countryPackManifest = JSON.parse(
      await readFile(path.join(root, 'packages/modules/country-packs/package.json'), 'utf8'),
    ) as { name?: string; scripts?: Record<string, string> };

    expect(manifest.workspaces).toContain('packages/modules/*');
    expect(countryPackManifest.name).toBe('@school/country-packs');
    expect(countryPackManifest.scripts?.typecheck).toBe('tsc -b');
  });

  test('validates a nested package while ignoring namespace-only directories', async () => {
    const fixture = await createFixture();

    const result = runChecker(fixture);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('architecture boundary validation: PASS');
  });

  test('rejects an undeclared workspace dependency inside a nested package', async () => {
    const fixture = await createFixture();
    await writeFile(
      path.join(fixture, 'packages/modules/demo/src/index.ts'),
      "import { value } from '@school/other';\nexport { value };\n",
    );

    const result = runChecker(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('imports undeclared workspace dependency @school/other');
  });

  test('rejects relative imports that cross a nested package boundary', async () => {
    const fixture = await createFixture();
    await mkdir(path.join(fixture, 'packages/modules/other'), { recursive: true });
    await writeFile(
      path.join(fixture, 'packages/modules/other/value.ts'),
      'export const value = 1;\n',
    );
    await writeFile(
      path.join(fixture, 'packages/modules/demo/src/index.ts'),
      "import { value } from '../../other/value.js';\nexport { value };\n",
    );

    const result = runChecker(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('crosses its package boundary');
  });
});
