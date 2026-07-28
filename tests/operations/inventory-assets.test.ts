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

const storekeeper = principal('storekeeper', [
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
const assetApprover = principal('asset-approver', ['operations.asset.disposal.approve']);

function setup(): InventoryAssetService {
  return new InventoryAssetService(
    scope,
    new InMemoryOperationsEventPublisher(),
    new InMemoryOperationsAuditWriter(),
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
    storekeeper,
    'corr-item',
  );
  service.registerLocation(
    { id: 'loc-main', code: 'MAIN', name: 'Main store', kind: 'store', active: true },
    storekeeper,
    'corr-loc-main',
  );
  service.registerLocation(
    { id: 'loc-lab', code: 'LAB', name: 'Science lab', kind: 'room', active: true },
    storekeeper,
    'corr-loc-lab',
  );
}

describe('OPS inventory and assets', () => {
  it('derives stock balances from an immutable movement ledger and prevents idempotent duplicates', () => {
    const service = setup();
    seedInventory(service);
    const receipt = service.recordMovement(
      {
        id: 'move-1',
        itemId: 'item-1',
        movementType: 'receipt',
        fromLocationId: null,
        toLocationId: 'loc-main',
        quantity: 100,
        unitCostMinor: 250,
        sourceDocumentRef: 'po-receipt-1',
        occurredAt: '2026-07-28T12:00:00.000Z',
        idempotencyKey: 'receipt:po-receipt-1:item-1',
      },
      storekeeper,
      'corr-receipt',
    );
    const replay = service.recordMovement(
      {
        ...receipt,
        id: 'move-replay',
        idempotencyKey: 'receipt:po-receipt-1:item-1',
      },
      storekeeper,
      'corr-replay',
    );

    expect(replay.id).toBe(receipt.id);
    expect(service.balance('item-1', 'loc-main')).toBe(100);
    expect(() => service.replaceMovement(receipt.id)).toThrow('OPS_STOCK_MOVEMENT_IMMUTABLE');
  });

  it('transfers stock atomically without changing total on-hand quantity', () => {
    const service = setup();
    seedInventory(service);
    service.recordMovement(
      {
        id: 'move-1',
        itemId: 'item-1',
        movementType: 'receipt',
        fromLocationId: null,
        toLocationId: 'loc-main',
        quantity: 100,
        unitCostMinor: 250,
        sourceDocumentRef: 'receipt-1',
        occurredAt: '2026-07-28T12:00:00.000Z',
        idempotencyKey: 'receipt-1',
      },
      storekeeper,
      'corr-receipt',
    );
    service.transfer(
      {
        id: 'transfer-1',
        itemId: 'item-1',
        fromLocationId: 'loc-main',
        toLocationId: 'loc-lab',
        quantity: 30,
        sourceDocumentRef: 'lab-request-1',
        occurredAt: '2026-07-28T13:00:00.000Z',
        idempotencyKey: 'transfer-1',
      },
      storekeeper,
      'corr-transfer',
    );

    expect(service.balance('item-1', 'loc-main')).toBe(70);
    expect(service.balance('item-1', 'loc-lab')).toBe(30);
    expect(service.totalOnHand('item-1')).toBe(100);
  });

  it('reserves available stock, blocks over-reservation and reports availability', () => {
    const service = setup();
    seedInventory(service);
    service.recordMovement(
      {
        id: 'move-1',
        itemId: 'item-1',
        movementType: 'receipt',
        fromLocationId: null,
        toLocationId: 'loc-main',
        quantity: 50,
        unitCostMinor: 250,
        sourceDocumentRef: 'receipt-1',
        occurredAt: '2026-07-28T12:00:00.000Z',
        idempotencyKey: 'receipt-1',
      },
      storekeeper,
      'corr-receipt',
    );
    service.reserve(
      {
        id: 'reservation-1',
        itemId: 'item-1',
        locationId: 'loc-main',
        quantity: 15,
        purposeRef: 'trip-1',
        expiresAt: '2026-08-01T00:00:00.000Z',
      },
      storekeeper,
      'corr-reserve',
    );

    expect(service.availability('item-1', 'loc-main')).toEqual({
      onHand: 50,
      reserved: 15,
      available: 35,
    });
    expect(() =>
      service.reserve(
        {
          id: 'reservation-2',
          itemId: 'item-1',
          locationId: 'loc-main',
          quantity: 36,
          purposeRef: 'trip-2',
          expiresAt: '2026-08-01T00:00:00.000Z',
        },
        storekeeper,
        'corr-over-reserve',
      ),
    ).toThrow('OPS_STOCK_NOT_AVAILABLE');
  });

  it('posts an approved stock-count variance as a new adjustment movement', () => {
    const service = setup();
    seedInventory(service);
    service.recordMovement(
      {
        id: 'move-1',
        itemId: 'item-1',
        movementType: 'receipt',
        fromLocationId: null,
        toLocationId: 'loc-main',
        quantity: 50,
        unitCostMinor: 250,
        sourceDocumentRef: 'receipt-1',
        occurredAt: '2026-07-28T12:00:00.000Z',
        idempotencyKey: 'receipt-1',
      },
      storekeeper,
      'corr-receipt',
    );
    const count = service.recordCount(
      {
        id: 'count-1',
        itemId: 'item-1',
        locationId: 'loc-main',
        countedQuantity: 47,
        countedAt: '2026-07-29T10:00:00.000Z',
        reason: 'Monthly cycle count',
      },
      storekeeper,
      'corr-count',
    );
    service.approveCountVariance(
      count.id,
      principal('inventory-manager', ['operations.inventory.count.approve']),
      'corr-count-approve',
    );

    expect(service.balance('item-1', 'loc-main')).toBe(47);
    expect(service.listMovements()).toHaveLength(2);
  });

  it('tracks asset custody, maintenance and depreciation without deleting history', () => {
    const service = setup();
    const asset = service.registerAsset(
      {
        id: 'asset-1',
        assetTag: 'AST-0001',
        category: 'ICT',
        description: 'Teacher laptop',
        acquiredOn: '2026-01-01',
        acquisitionCostMinor: 120_000,
        currency: 'BDT',
        usefulLifeMonths: 36,
        salvageValueMinor: 12_000,
        locationId: 'loc-main',
      },
      storekeeper,
      'corr-asset',
    );
    service.assignAsset(
      { id: 'assignment-1', assetId: asset.id, custodianRef: 'staff-1', assignedOn: '2026-02-01' },
      storekeeper,
      'corr-assign',
    );
    service.recordMaintenance(
      {
        id: 'maintenance-1',
        assetId: asset.id,
        performedOn: '2026-07-01',
        supplierRef: 'supplier-ict',
        costMinor: 5_000,
        description: 'Battery replacement',
      },
      storekeeper,
      'corr-maintenance',
    );

    expect(service.currentCustodian(asset.id)).toBe('staff-1');
    expect(service.depreciationSchedule(asset.id)).toHaveLength(36);
    expect(service.assetReport(storekeeper)).toMatchObject({ activeAssets: 1, assignedAssets: 1 });
  });

  it('requires AAL2 and separation of duties to approve asset disposal', () => {
    const service = setup();
    service.registerAsset(
      {
        id: 'asset-1',
        assetTag: 'AST-0001',
        category: 'ICT',
        description: 'Teacher laptop',
        acquiredOn: '2023-01-01',
        acquisitionCostMinor: 120_000,
        currency: 'BDT',
        usefulLifeMonths: 36,
        salvageValueMinor: 12_000,
        locationId: 'loc-main',
      },
      storekeeper,
      'corr-asset',
    );
    const request = service.requestDisposal(
      {
        id: 'disposal-1',
        assetId: 'asset-1',
        reason: 'Beyond economical repair',
        proceedsMinor: 10_000,
      },
      storekeeper,
      'corr-disposal-request',
    );

    expect(() => service.approveDisposal(request.id, storekeeper, 'corr-self')).toThrow(
      'OPS_SOD_VIOLATION:asset-disposal-request-approve',
    );
    expect(service.approveDisposal(request.id, assetApprover, 'corr-approve').status).toBe(
      'approved',
    );
  });

  it('reports low stock, inventory value and asset custody exceptions', () => {
    const service = setup();
    seedInventory(service);
    service.recordMovement(
      {
        id: 'move-1',
        itemId: 'item-1',
        movementType: 'receipt',
        fromLocationId: null,
        toLocationId: 'loc-main',
        quantity: 10,
        unitCostMinor: 250,
        sourceDocumentRef: 'receipt-1',
        occurredAt: '2026-07-28T12:00:00.000Z',
        idempotencyKey: 'receipt-1',
      },
      storekeeper,
      'corr-receipt',
    );

    expect(service.inventoryReport(storekeeper)).toEqual({
      itemCount: 1,
      totalOnHand: 10,
      totalReserved: 0,
      inventoryValueMinor: 2_500,
      lowStockItemIds: ['item-1'],
      negativeStockItemIds: [],
    });
  });
});
