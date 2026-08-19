import { describe, expect, it } from 'vitest';

import {
  InMemoryOperationsAuditWriter,
  InMemoryOperationsEventPublisher,
  type OperationsPrincipal,
} from '../../packages/modules/hr/src/index.js';
import { InventoryAssetService } from '../../packages/modules/inventory-assets/src/index.js';

const scope = { tenantId: 'tenant-ops', legalEntityId: 'entity-school', campusId: 'campus-main' };

function principal(
  principalId: string,
  permissions: readonly string[],
  assurance: 'aal1' | 'aal2' = 'aal2',
): OperationsPrincipal {
  return {
    principalId,
    tenantId: scope.tenantId,
    campusIds: [scope.campusId],
    permissions,
    assurance,
  };
}

const operator = principal('inventory-operator', [
  'operations.inventory.catalog.write',
  'operations.inventory.location.write',
  'operations.inventory.movement.write',
  'operations.inventory.reservation.write',
  'operations.inventory.count.write',
  'operations.inventory.report.read',
  'operations.asset.register',
  'operations.asset.assign',
  'operations.asset.maintenance.write',
  'operations.asset.disposal.write',
  'operations.asset.report.read',
]);
const countApprover = principal('inventory-manager', ['operations.inventory.count.approve']);
const assetApprover = principal('asset-approver', ['operations.asset.disposal.approve']);

function setup(): InventoryAssetService {
  return new InventoryAssetService(
    scope,
    new InMemoryOperationsEventPublisher(),
    new InMemoryOperationsAuditWriter(),
    { now: () => new Date('2026-07-30T00:00:00.000Z') },
  );
}

function seedInventory(service: InventoryAssetService): void {
  service.registerItem(
    {
      id: 'item-1',
      sku: 'LAB-GLOVE',
      name: 'Laboratory gloves',
      unitCode: 'PAIR',
      standardCostMinor: 250,
      currency: 'BDT',
      reorderPoint: 20,
      trackSerial: false,
      active: true,
    },
    operator,
    'corr-item',
  );
  service.registerLocation(
    { id: 'loc-main', code: 'MAIN', name: 'Main store', kind: 'store', active: true },
    operator,
    'corr-loc-main',
  );
  service.registerLocation(
    { id: 'loc-lab', code: 'LAB', name: 'Science lab', kind: 'room', active: true },
    operator,
    'corr-loc-lab',
  );
}

function receive(service: InventoryAssetService, quantity = 50): void {
  service.recordMovement(
    {
      id: 'receipt-1',
      itemId: 'item-1',
      movementType: 'receipt',
      fromLocationId: null,
      toLocationId: 'loc-main',
      quantity,
      unitCostMinor: 250,
      sourceDocumentRef: 'source-receipt-1',
      occurredAt: '2026-07-28T12:00:00.000Z',
      idempotencyKey: 'receipt-key-1',
    },
    operator,
    'corr-receipt-1',
  );
}

function registerAsset(
  service: InventoryAssetService,
  id = 'asset-1',
  assetTag = 'AST-0001',
  overrides: Partial<Parameters<InventoryAssetService['registerAsset']>[0]> = {},
) {
  return service.registerAsset(
    {
      id,
      assetTag,
      category: 'ICT',
      description: `Asset ${id}`,
      acquiredOn: '2026-01-01',
      acquisitionCostMinor: 120_000,
      currency: 'BDT',
      usefulLifeMonths: 36,
      salvageValueMinor: 12_000,
      locationId: 'loc-main',
      ...overrides,
    },
    operator,
    `corr-${id}`,
  );
}

describe('inventory and asset integrity boundaries', () => {
  it('rejects duplicate catalogue/location identities and malformed stock movement shapes', () => {
    const service = setup();
    seedInventory(service);

    expect(() =>
      service.registerItem(
        {
          id: 'item-2',
          sku: ' lab-glove ',
          name: 'Duplicate gloves',
          unitCode: 'PAIR',
          standardCostMinor: 250,
          currency: 'BDT',
          reorderPoint: 20,
          trackSerial: false,
          active: true,
        },
        operator,
        'corr-duplicate-item',
      ),
    ).toThrow('OPS_DUPLICATE_ITEM');
    expect(() =>
      service.registerLocation(
        { id: 'loc-other', code: ' main ', name: 'Duplicate main', kind: 'store', active: true },
        operator,
        'corr-duplicate-location',
      ),
    ).toThrow('OPS_DUPLICATE_LOCATION');

    const base = {
      id: 'movement-invalid',
      itemId: 'item-1',
      quantity: 1,
      unitCostMinor: 250,
      sourceDocumentRef: 'source-invalid',
      occurredAt: '2026-07-28T12:00:00.000Z',
      idempotencyKey: 'invalid-key',
    } as const;
    expect(() =>
      service.recordMovement(
        { ...base, movementType: 'adjustment', fromLocationId: null, toLocationId: null },
        operator,
        'corr-no-location',
      ),
    ).toThrow('OPS_MOVEMENT_LOCATION_REQUIRED');
    expect(() =>
      service.recordMovement(
        { ...base, movementType: 'receipt', fromLocationId: 'loc-main', toLocationId: null },
        operator,
        'corr-receipt-no-destination',
      ),
    ).toThrow('OPS_RECEIPT_DESTINATION_REQUIRED');
    expect(() =>
      service.recordMovement(
        { ...base, movementType: 'issue', fromLocationId: null, toLocationId: 'loc-lab' },
        operator,
        'corr-issue-no-source',
      ),
    ).toThrow('OPS_ISSUE_SOURCE_REQUIRED');
    expect(() =>
      service.recordMovement(
        { ...base, movementType: 'transfer', fromLocationId: 'loc-main', toLocationId: null },
        operator,
        'corr-transfer-missing-destination',
      ),
    ).toThrow('OPS_TRANSFER_LOCATIONS_REQUIRED');
    expect(() =>
      service.transfer(
        {
          id: 'transfer-same',
          itemId: 'item-1',
          fromLocationId: 'loc-main',
          toLocationId: 'loc-main',
          quantity: 1,
          sourceDocumentRef: 'same-location',
          occurredAt: '2026-07-28T12:00:00.000Z',
          idempotencyKey: 'transfer-same',
        },
        operator,
        'corr-transfer-same',
      ),
    ).toThrow('OPS_TRANSFER_SAME_LOCATION');
  });

  it('prevents unavailable issues and keeps reservations scoped to unexpired available stock', () => {
    const service = setup();
    seedInventory(service);
    receive(service, 20);

    expect(() =>
      service.recordMovement(
        {
          id: 'issue-over',
          itemId: 'item-1',
          movementType: 'issue',
          fromLocationId: 'loc-main',
          toLocationId: null,
          quantity: 21,
          unitCostMinor: 250,
          sourceDocumentRef: 'issue-over',
          occurredAt: '2026-07-29T12:00:00.000Z',
          idempotencyKey: 'issue-over',
        },
        operator,
        'corr-issue-over',
      ),
    ).toThrow('OPS_STOCK_NOT_AVAILABLE');

    const expired = service.reserve(
      {
        id: 'reservation-expired',
        itemId: 'item-1',
        locationId: 'loc-main',
        quantity: 5,
        purposeRef: 'historical-purpose',
        expiresAt: '2026-07-29T00:00:00.000Z',
      },
      operator,
      'corr-reservation-expired',
    );
    expect(expired.status).toBe('active');
    expect(service.availability('item-1', 'loc-main')).toEqual({
      onHand: 20,
      reserved: 0,
      available: 20,
    });

    service.reserve(
      {
        id: 'reservation-active',
        itemId: 'item-1',
        locationId: 'loc-main',
        quantity: 8,
        purposeRef: 'trip-1',
        expiresAt: '2026-08-01T00:00:00.000Z',
      },
      operator,
      'corr-reservation-active',
    );
    expect(service.availability('item-1', 'loc-main')).toEqual({
      onHand: 20,
      reserved: 8,
      available: 12,
    });
    expect(() =>
      service.reserve(
        {
          id: 'reservation-active',
          itemId: 'item-1',
          locationId: 'loc-main',
          quantity: 1,
          purposeRef: 'duplicate-id',
          expiresAt: '2026-08-01T00:00:00.000Z',
        },
        operator,
        'corr-reservation-duplicate',
      ),
    ).toThrow('OPS_DUPLICATE_RESERVATION');
  });

  it('handles negative, positive and zero stock-count variances with independent approval', () => {
    const service = setup();
    seedInventory(service);
    receive(service, 50);

    const negative = service.recordCount(
      {
        id: 'count-negative',
        itemId: 'item-1',
        locationId: 'loc-main',
        countedQuantity: 47,
        countedAt: '2026-07-29T10:00:00.000Z',
        reason: 'Cycle count negative variance',
      },
      operator,
      'corr-count-negative',
    );
    expect(() => service.approveCountVariance(negative.id, operator, 'corr-count-self')).toThrow(
      'OPS_SOD_VIOLATION:stock-count-record-approve',
    );
    const approvedNegative = service.approveCountVariance(
      negative.id,
      countApprover,
      'corr-count-negative-approve',
    );
    expect(approvedNegative.adjustmentMovementId).toBe('count-adjustment:count-negative');
    expect(
      service.approveCountVariance(negative.id, countApprover, 'corr-count-negative-replay'),
    ).toEqual(approvedNegative);
    expect(service.balance('item-1', 'loc-main')).toBe(47);

    const positive = service.recordCount(
      {
        id: 'count-positive',
        itemId: 'item-1',
        locationId: 'loc-main',
        countedQuantity: 52,
        countedAt: '2026-07-29T11:00:00.000Z',
        reason: 'Cycle count positive variance',
      },
      operator,
      'corr-count-positive',
    );
    service.approveCountVariance(positive.id, countApprover, 'corr-count-positive-approve');
    expect(service.balance('item-1', 'loc-main')).toBe(52);

    const exact = service.recordCount(
      {
        id: 'count-exact',
        itemId: 'item-1',
        locationId: 'loc-main',
        countedQuantity: 52,
        countedAt: '2026-07-29T12:00:00.000Z',
        reason: 'Cycle count exact quantity',
      },
      operator,
      'corr-count-exact',
    );
    const approvedExact = service.approveCountVariance(
      exact.id,
      countApprover,
      'corr-count-exact-approve',
    );
    expect(approvedExact.adjustmentMovementId).toBeNull();
    expect(service.balance('item-1', 'loc-main')).toBe(52);
  });

  it('validates asset economics, assignment, maintenance and disposal guards', () => {
    const service = setup();

    expect(() =>
      registerAsset(service, 'asset-bad-salvage', 'AST-BAD', { salvageValueMinor: 120_000 }),
    ).toThrow('OPS_INVALID_ASSET_SALVAGE_VALUE');
    const asset = registerAsset(service);
    expect(() => registerAsset(service, 'asset-2', ' ast-0001 ')).toThrow('OPS_DUPLICATE_ASSET');

    service.assignAsset(
      { id: 'assignment-1', assetId: asset.id, custodianRef: 'staff-1', assignedOn: '2026-02-01' },
      operator,
      'corr-assignment-1',
    );
    expect(() =>
      service.assignAsset(
        {
          id: 'assignment-2',
          assetId: asset.id,
          custodianRef: 'staff-2',
          assignedOn: '2026-03-01',
        },
        operator,
        'corr-assignment-2',
      ),
    ).toThrow('OPS_ASSET_ALREADY_ASSIGNED');
    service.recordMaintenance(
      {
        id: 'maintenance-1',
        assetId: asset.id,
        performedOn: '2026-07-01',
        supplierRef: 'supplier-ict',
        costMinor: 5_000,
        description: 'Battery replacement',
      },
      operator,
      'corr-maintenance-1',
    );
    expect(() =>
      service.recordMaintenance(
        {
          id: 'maintenance-1',
          assetId: asset.id,
          performedOn: '2026-07-02',
          supplierRef: 'supplier-ict',
          costMinor: 1_000,
          description: 'Duplicate maintenance',
        },
        operator,
        'corr-maintenance-duplicate',
      ),
    ).toThrow('OPS_DUPLICATE_ASSET_MAINTENANCE');

    const disposal = service.requestDisposal(
      {
        id: 'disposal-1',
        assetId: asset.id,
        reason: 'Beyond economical repair',
        proceedsMinor: 10_000,
      },
      operator,
      'corr-disposal-1',
    );
    expect(() =>
      service.approveDisposal(disposal.id, assetApprover, 'corr-disposal-assigned'),
    ).toThrow('OPS_ASSET_STILL_ASSIGNED');
    expect(() =>
      service.requestDisposal(
        { id: 'disposal-short', assetId: asset.id, reason: 'bad', proceedsMinor: 0 },
        operator,
        'corr-disposal-short',
      ),
    ).toThrow('OPS_ASSET_DISPOSAL_REASON_REQUIRED');
  });

  it('approves disposal for an unassigned asset and blocks post-disposal mutations', () => {
    const service = setup();
    const asset = registerAsset(service);
    const disposal = service.requestDisposal(
      {
        id: 'disposal-1',
        assetId: asset.id,
        reason: 'Beyond economical repair',
        proceedsMinor: 10_000,
      },
      operator,
      'corr-disposal-request',
    );
    const approved = service.approveDisposal(disposal.id, assetApprover, 'corr-disposal-approve');
    expect(approved.status).toBe('approved');
    expect(service.approveDisposal(disposal.id, assetApprover, 'corr-disposal-replay')).toEqual(
      approved,
    );
    expect(() =>
      service.assignAsset(
        {
          id: 'assignment-after',
          assetId: asset.id,
          custodianRef: 'staff-1',
          assignedOn: '2026-08-01',
        },
        operator,
        'corr-assignment-after',
      ),
    ).toThrow('OPS_ASSET_DISPOSED');
    expect(() =>
      service.recordMaintenance(
        {
          id: 'maintenance-after',
          assetId: asset.id,
          performedOn: '2026-08-01',
          supplierRef: 'supplier-ict',
          costMinor: 100,
          description: 'Should not be recorded',
        },
        operator,
        'corr-maintenance-after',
      ),
    ).toThrow('OPS_ASSET_DISPOSED');
    expect(() =>
      service.requestDisposal(
        {
          id: 'disposal-after',
          assetId: asset.id,
          reason: 'Second disposal request',
          proceedsMinor: 0,
        },
        operator,
        'corr-disposal-after',
      ),
    ).toThrow('OPS_ASSET_DISPOSED');
  });

  it('preserves depreciation remainder and reports inventory/asset exception projections', () => {
    const service = setup();
    seedInventory(service);
    receive(service, 10);
    service.reserve(
      {
        id: 'reservation-1',
        itemId: 'item-1',
        locationId: 'loc-main',
        quantity: 4,
        purposeRef: 'trip-1',
        expiresAt: '2026-08-01T00:00:00.000Z',
      },
      operator,
      'corr-reservation-1',
    );
    const asset = registerAsset(service, 'asset-remainder', 'AST-REM', {
      acquisitionCostMinor: 1_001,
      salvageValueMinor: 1,
      usefulLifeMonths: 3,
    });
    service.recordMaintenance(
      {
        id: 'maintenance-remainder',
        assetId: asset.id,
        performedOn: '2026-07-01',
        supplierRef: 'supplier-ict',
        costMinor: 99,
        description: 'Minor maintenance',
      },
      operator,
      'corr-maintenance-remainder',
    );

    expect(service.depreciationSchedule(asset.id)).toEqual([
      { month: 1, depreciationMinor: 334, accumulatedMinor: 334, bookValueMinor: 667 },
      { month: 2, depreciationMinor: 333, accumulatedMinor: 667, bookValueMinor: 334 },
      { month: 3, depreciationMinor: 333, accumulatedMinor: 1_000, bookValueMinor: 1 },
    ]);
    expect(service.inventoryReport(operator)).toMatchObject({
      itemCount: 1,
      totalOnHand: 10,
      totalReserved: 4,
      inventoryValueMinor: 2_500,
      lowStockItemIds: ['item-1'],
      negativeStockItemIds: [],
    });
    expect(service.assetReport(operator)).toMatchObject({
      activeAssets: 1,
      assignedAssets: 0,
      disposedAssets: 0,
      acquisitionValueMinor: 1_001,
      maintenanceCostMinor: 99,
      unassignedAssetIds: ['asset-remainder'],
    });
  });
});
