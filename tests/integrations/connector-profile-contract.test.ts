import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  ConnectorManifestRegistry,
  type ConnectorManifest,
} from '../../packages/modules/integrations/src/index.js';

const manifestPath = path.join(
  process.cwd(),
  'packages/modules/integrations/connectors/synthetic-lms-v1.json',
);

describe('connector profile artefact', () => {
  test('is accepted by the connector governance registry', async () => {
    const parsed: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
    const manifest = parsed as ConnectorManifest;
    const published = new ConnectorManifestRegistry().publish(manifest);

    expect(published).toMatchObject({
      connectorKey: 'synthetic-lms',
      version: 1,
      dataCategories: ['directory', 'enrollment'],
      requiredScopes: ['roster.read', 'roster.write'],
    });
    expect(published.subprocessor.privacyUrl).toMatch(/^https:/u);
  });
});
