import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  isOperationsPermission,
  operationsPermissionCatalog,
  operationsPermissionKeys,
  operationsRoleBundles,
  requiresOperationsStepUp,
} from '../../packages/modules/hr/src/permissions.js';

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

describe('OPS permission catalogue', () => {
  it('contains every domain authorization permission exactly once', async () => {
    const root = fileURLToPath(new URL('../../packages/modules/', import.meta.url));
    const files = await typeScriptFiles(root);
    const used = new Set<string>();
    const pattern = /authorizeOperations\(\s*principal,\s*['"]([^'"]+)['"]/g;
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(pattern)) used.add(match[1]!);
    }

    expect(new Set(operationsPermissionKeys).size).toBe(operationsPermissionKeys.length);
    expect([...used].filter((permission) => !isOperationsPermission(permission))).toEqual([]);
    expect(operationsPermissionKeys.filter((permission) => !used.has(permission))).toEqual([]);
  });

  it('marks high-risk permissions as requiring step-up authentication', () => {
    const highRisk = operationsPermissionCatalog.filter((definition) => definition.risk === 'high');
    expect(highRisk.length).toBeGreaterThan(0);
    expect(highRisk.every((definition) => definition.stepUpRequired)).toBe(true);
    expect(requiresOperationsStepUp('operations.procurement.payable.approve')).toBe(true);
    expect(requiresOperationsStepUp('operations.activities.trip.approve')).toBe(true);
    expect(requiresOperationsStepUp('operations.hr.report.read')).toBe(false);
  });

  it('keeps requester/processor and approver role bundles separated', () => {
    expect(operationsRoleBundles.procurementBuyer).not.toContain(
      'operations.procurement.requisition.approve',
    );
    expect(operationsRoleBundles.procurementBuyer).not.toContain(
      'operations.procurement.payable.approve',
    );
    expect(operationsRoleBundles.procurementApprover).not.toContain(
      'operations.procurement.requisition.write',
    );
    expect(operationsRoleBundles.activitiesCoordinator).not.toContain(
      'operations.activities.risk.approve',
    );
    expect(operationsRoleBundles.activitiesApprover).not.toContain(
      'operations.activities.trip.write',
    );
    expect(operationsRoleBundles.assetDisposalApprover).not.toContain(
      'operations.asset.disposal.write',
    );
  });

  it('provides read-only reporting permissions to the auditor bundle', () => {
    expect(operationsRoleBundles.operationsAuditor.length).toBeGreaterThan(0);
    expect(
      operationsRoleBundles.operationsAuditor.every((permission) => permission.endsWith('.report.read')),
    ).toBe(true);
  });
});
