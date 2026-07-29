import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createOperationsEvent } from '../../packages/modules/hr/src/contracts.js';
import {
  assertOperationsEventContract,
  parseOperationsEventType,
} from '../../packages/modules/hr/src/event-contract.js';

async function typeScriptFiles(root: string): Promise<readonly string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await typeScriptFiles(path)));
    else if (extname(entry.name) === '.ts') files.push(path);
  }
  return files;
}

describe('OPS event contract', () => {
  it('creates a complete versioned event envelope', () => {
    const event = createOperationsEvent({
      eventType: 'operations.transport.trip-started.v1',
      scope: { tenantId: 'tenant-1', legalEntityId: 'entity-1', campusId: 'campus-1' },
      aggregateType: 'transport-trip',
      aggregateId: 'trip-1',
      aggregateVersion: 1,
      correlationId: 'corr-1',
      actorId: 'staff-1',
      occurredAt: '2026-07-29T00:00:00.000Z',
      payload: { routeId: 'route-1' },
    });

    expect(parseOperationsEventType(event.eventType)).toEqual({
      eventType: 'operations.transport.trip-started.v1',
      domain: 'transport',
      version: 1,
    });
    expect(event).toMatchObject({
      schemaVersion: 1,
      tenantId: 'tenant-1',
      legalEntityId: 'entity-1',
      campusId: 'campus-1',
      correlationId: 'corr-1',
      actorId: 'staff-1',
    });
  });

  it('rejects invalid event names and incomplete envelope fields', () => {
    expect(() => parseOperationsEventType('operations.transport.trip-started')).toThrow(
      'OPS_INVALID_EVENT_TYPE',
    );
    expect(() =>
      assertOperationsEventContract({
        eventId: 'event-1',
        eventType: 'operations.transport.trip-started.v1',
        tenantId: '',
        legalEntityId: 'entity-1',
        campusId: 'campus-1',
        aggregateType: 'transport-trip',
        aggregateId: 'trip-1',
        aggregateVersion: 1,
        correlationId: 'corr-1',
        actorId: 'staff-1',
        occurredAt: '2026-07-29T00:00:00.000Z',
      }),
    ).toThrow('OPS_EVENT_FIELD_REQUIRED:tenantId');
  });

  it('keeps every operations event literal versioned and parseable', async () => {
    const root = fileURLToPath(new URL('../../packages/modules/', import.meta.url));
    const files = await typeScriptFiles(root);
    const eventTypes = new Set<string>();
    const pattern = /['"](operations\.[a-z0-9.-]+\.v\d+)['"]/g;
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(pattern)) eventTypes.add(match[1]!);
    }

    expect(eventTypes.size).toBeGreaterThan(0);
    for (const eventType of eventTypes) {
      expect(() => parseOperationsEventType(eventType)).not.toThrow();
    }
  });
});
