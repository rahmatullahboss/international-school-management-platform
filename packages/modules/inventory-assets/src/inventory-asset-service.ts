import {
  assertDate,
  assertIdentifier,
  authorizeOperations,
  createOperationsAudit,
  createOperationsEvent,
  type OperationsAuditWriter,
  type OperationsEventPublisher,
  type OperationsPrincipal,
  type OperationsScope,
} from '../../hr/src/index.js';

export type StockMovementType = 'receipt' | 'issue' | 'transfer' | 'adjustment';
export type InventoryLocationKind = 'store' | 'room' | 'vehicle' | 'hostel' | 'cafeteria';
export type ReservationStatus = 'active' | 'released' | 'consumed' | 'expired';
export type StockCountStatus = 'pending-approval' | 'approved' | 'rejected';
export type AssetStatus = 'active' | 'under-maintenance' | 'disposed';
export type AssetDisposalStatus = 'pending' | 'approved' | 'rejected';

export interface InventoryItemInput {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly unitCode: string;
  readonly standardCostMinor: number;
  readonly currency: string;
  readonly reorderPoint: number;
  readonly trackSerial: boolean;
  readonly active: boolean;
}

export interface InventoryItem extends InventoryItemInput {
  readonly version: number;
  readonly createdAt: string;
}

export interface InventoryLocationInput {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly kind: InventoryLocationKind;
  readonly active: boolean;
}

export interface InventoryLocation extends InventoryLocationInput {
  readonly version: number;
  readonly createdAt: string;
}

export interface StockMovementInput {
  readonly id: string;
  readonly itemId: string;
  readonly movementType: StockMovementType;
  readonly fromLocationId: string | null;
  readonly toLocationId: string | null;
  readonly quantity: number;
  readonly unitCostMinor: number;
  readonly sourceDocumentRef: string;
  readonly occurredAt: string;
  readonly idempotencyKey: string;
}

export interface StockMovement extends StockMovementInput {
  readonly recordedBy: string;
  readonly recordedAt: string;
  readonly version: number;
}

export interface StockTransferInput {
  readonly id: string;
  readonly itemId: string;
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly quantity: number;
  readonly sourceDocumentRef: string;
  readonly occurredAt: string;
  readonly idempotencyKey: string;
}

export interface StockReservationInput {
  readonly id: string;
  readonly itemId: string;
  readonly locationId: string;
  readonly quantity: number;
  readonly purposeRef: string;
  readonly expiresAt: string;
}

export interface StockReservation extends StockReservationInput {
  readonly status: ReservationStatus;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly version: number;
}

export interface StockAvailability {
  readonly onHand: number;
  readonly reserved: number;
  readonly available: number;
}

export interface StockCountInput {
  readonly id: string;
  readonly itemId: string;
  readonly locationId: string;
  readonly countedQuantity: number;
  readonly countedAt: string;
  readonly reason: string;
}

export interface StockCount extends StockCountInput {
  readonly expectedQuantity: number;
  readonly varianceQuantity: number;
  readonly status: StockCountStatus;
  readonly createdBy: string;
  readonly approvedBy: string | null;
  readonly adjustmentMovementId: string | null;
  readonly version: number;
  readonly createdAt: string;
}

export interface AssetInput {
  readonly id: string;
  readonly assetTag: string;
  readonly category: string;
  readonly description: string;
  readonly acquiredOn: string;
  readonly acquisitionCostMinor: number;
  readonly currency: string;
  readonly usefulLifeMonths: number;
  readonly salvageValueMinor: number;
  readonly locationId: string;
}

export interface Asset extends AssetInput {
  readonly status: AssetStatus;
  readonly version: number;
  readonly createdAt: string;
}

export interface AssetAssignmentInput {
  readonly id: string;
  readonly assetId: string;
  readonly custodianRef: string;
  readonly assignedOn: string;
}

export interface AssetAssignment extends AssetAssignmentInput {
  readonly returnedOn: string | null;
  readonly assignedBy: string;
  readonly version: number;
  readonly createdAt: string;
}

export interface AssetMaintenanceInput {
  readonly id: string;
  readonly assetId: string;
  readonly performedOn: string;
  readonly supplierRef: string;
  readonly costMinor: number;
  readonly description: string;
}

export interface AssetMaintenance extends AssetMaintenanceInput {
  readonly recordedBy: string;
  readonly version: number;
  readonly createdAt: string;
}

export interface AssetDisposalInput {
  readonly id: string;
  readonly assetId: string;
  readonly reason: string;
  readonly proceedsMinor: number;
}

export interface AssetDisposal extends AssetDisposalInput {
  readonly status: AssetDisposalStatus;
  readonly requestedBy: string;
  readonly approvedBy: string | null;
  readonly approvedAt: string | null;
  readonly version: number;
  readonly createdAt: string;
}

export interface DepreciationPeriod {
  readonly month: number;
  readonly depreciationMinor: number;
  readonly accumulatedMinor: number;
  readonly bookValueMinor: number;
}

export interface InventoryReport {
  readonly itemCount: number;
  readonly totalOnHand: number;
  readonly totalReserved: number;
  readonly inventoryValueMinor: number;
  readonly lowStockItemIds: readonly string[];
  readonly negativeStockItemIds: readonly string[];
}

export interface AssetReport {
  readonly activeAssets: number;
  readonly assignedAssets: number;
  readonly underMaintenanceAssets: number;
  readonly disposedAssets: number;
  readonly acquisitionValueMinor: number;
  readonly maintenanceCostMinor: number;
  readonly unassignedAssetIds: readonly string[];
}

interface Clock {
  now(): Date;
}

const systemClock: Clock = { now: () => new Date() };

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}

function assertPositiveInteger(value: number, field: string, allowZero = false): void {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`OPS_INVALID_INTEGER:${field}`);
  }
}

function assertTimestamp(value: string, field: string): void {
  if (Number.isNaN(Date.parse(value))) throw new Error(`OPS_INVALID_TIMESTAMP:${field}`);
}

export class InventoryAssetService {
  readonly #scope: OperationsScope;
  readonly #events: OperationsEventPublisher;
  readonly #audit: OperationsAuditWriter;
  readonly #clock: Clock;
  readonly #items = new Map<string, InventoryItem>();
  readonly #skus = new Set<string>();
  readonly #locations = new Map<string, InventoryLocation>();
  readonly #locationCodes = new Set<string>();
  readonly #movements = new Map<string, StockMovement>();
  readonly #movementKeys = new Map<string, string>();
  readonly #reservations = new Map<string, StockReservation>();
  readonly #counts = new Map<string, StockCount>();
  readonly #assets = new Map<string, Asset>();
  readonly #assetTags = new Set<string>();
  readonly #assignments = new Map<string, AssetAssignment>();
  readonly #maintenance = new Map<string, AssetMaintenance>();
  readonly #disposals = new Map<string, AssetDisposal>();

  constructor(
    scope: OperationsScope,
    events: OperationsEventPublisher,
    audit: OperationsAuditWriter,
    clock: Clock = systemClock,
  ) {
    this.#scope = frozen(scope);
    this.#events = events;
    this.#audit = audit;
    this.#clock = clock;
  }

  registerItem(
    input: InventoryItemInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): InventoryItem {
    authorizeOperations(principal, 'operations.inventory.catalog.write', this.#scope);
    this.#correlation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      sku: input.sku,
      name: input.name,
      unitCode: input.unitCode,
      currency: input.currency,
    })) {
      assertIdentifier(value, `item.${field}`);
    }
    assertPositiveInteger(input.standardCostMinor, 'item.standardCostMinor', true);
    assertPositiveInteger(input.reorderPoint, 'item.reorderPoint', true);
    const sku = input.sku.trim().toUpperCase();
    if (this.#items.has(input.id) || this.#skus.has(sku)) throw new Error('OPS_DUPLICATE_ITEM');
    const item: InventoryItem = frozen({
      ...input,
      sku,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#items.set(item.id, item);
    this.#skus.add(item.sku);
    this.#record(
      'operations.inventory.item-registered.v1',
      'inventory-item',
      item.id,
      1,
      'operations.inventory.item.register',
      principal,
      correlationId,
      { sku: item.sku },
    );
    return item;
  }

  registerLocation(
    input: InventoryLocationInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): InventoryLocation {
    authorizeOperations(principal, 'operations.inventory.location.write', this.#scope);
    this.#correlation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      code: input.code,
      name: input.name,
    })) {
      assertIdentifier(value, `location.${field}`);
    }
    const code = input.code.trim().toUpperCase();
    if (this.#locations.has(input.id) || this.#locationCodes.has(code)) {
      throw new Error('OPS_DUPLICATE_LOCATION');
    }
    const location: InventoryLocation = frozen({
      ...input,
      code,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#locations.set(location.id, location);
    this.#locationCodes.add(location.code);
    this.#record(
      'operations.inventory.location-registered.v1',
      'inventory-location',
      location.id,
      1,
      'operations.inventory.location.register',
      principal,
      correlationId,
      { code: location.code },
    );
    return location;
  }

  recordMovement(
    input: StockMovementInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): StockMovement {
    authorizeOperations(principal, 'operations.inventory.movement.write', this.#scope);
    this.#correlation(correlationId);
    const existingId = this.#movementKeys.get(input.idempotencyKey);
    if (existingId) return this.#movements.get(existingId)!;
    this.#validateMovement(input);
    if (this.#movements.has(input.id)) throw new Error('OPS_DUPLICATE_STOCK_MOVEMENT');
    if (
      input.fromLocationId &&
      this.availability(input.itemId, input.fromLocationId).available < input.quantity
    ) {
      throw new Error('OPS_STOCK_NOT_AVAILABLE');
    }
    const movement: StockMovement = frozen({
      ...input,
      recordedBy: principal.principalId,
      recordedAt: this.#clock.now().toISOString(),
      version: 1,
    });
    this.#movements.set(movement.id, movement);
    this.#movementKeys.set(movement.idempotencyKey, movement.id);
    this.#record(
      'operations.inventory.stock-movement-recorded.v1',
      'stock-movement',
      movement.id,
      1,
      'operations.inventory.movement.record',
      principal,
      correlationId,
      { itemId: movement.itemId, movementType: movement.movementType, quantity: movement.quantity },
    );
    return movement;
  }

  replaceMovement(movementId: string): never {
    void movementId;
    throw new Error('OPS_STOCK_MOVEMENT_IMMUTABLE');
  }

  transfer(
    input: StockTransferInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): StockMovement {
    if (input.fromLocationId === input.toLocationId) throw new Error('OPS_TRANSFER_SAME_LOCATION');
    return this.recordMovement(
      {
        ...input,
        movementType: 'transfer',
        unitCostMinor: this.#requireItem(input.itemId).standardCostMinor,
      },
      principal,
      correlationId,
    );
  }

  reserve(
    input: StockReservationInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): StockReservation {
    authorizeOperations(principal, 'operations.inventory.reservation.write', this.#scope);
    this.#correlation(correlationId);
    this.#requireItem(input.itemId);
    this.#requireLocation(input.locationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      purposeRef: input.purposeRef,
    })) {
      assertIdentifier(value, `reservation.${field}`);
    }
    assertPositiveInteger(input.quantity, 'reservation.quantity');
    assertTimestamp(input.expiresAt, 'reservation.expiresAt');
    if (this.#reservations.has(input.id)) throw new Error('OPS_DUPLICATE_RESERVATION');
    if (this.availability(input.itemId, input.locationId).available < input.quantity) {
      throw new Error('OPS_STOCK_NOT_AVAILABLE');
    }
    const reservation: StockReservation = frozen({
      ...input,
      status: 'active',
      createdBy: principal.principalId,
      createdAt: this.#clock.now().toISOString(),
      version: 1,
    });
    this.#reservations.set(reservation.id, reservation);
    this.#record(
      'operations.inventory.stock-reserved.v1',
      'stock-reservation',
      reservation.id,
      1,
      'operations.inventory.reservation.create',
      principal,
      correlationId,
      { itemId: reservation.itemId, quantity: reservation.quantity },
    );
    return reservation;
  }

  availability(itemId: string, locationId: string): StockAvailability {
    const onHand = this.balance(itemId, locationId);
    const reserved = [...this.#reservations.values()]
      .filter(
        (reservation) =>
          reservation.itemId === itemId &&
          reservation.locationId === locationId &&
          reservation.status === 'active' &&
          Date.parse(reservation.expiresAt) > this.#clock.now().getTime(),
      )
      .reduce((total, reservation) => total + reservation.quantity, 0);
    return frozen({ onHand, reserved, available: onHand - reserved });
  }

  recordCount(
    input: StockCountInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): StockCount {
    authorizeOperations(principal, 'operations.inventory.count.write', this.#scope);
    this.#correlation(correlationId);
    this.#requireItem(input.itemId);
    this.#requireLocation(input.locationId);
    assertIdentifier(input.id, 'stockCount.id');
    assertPositiveInteger(input.countedQuantity, 'stockCount.countedQuantity', true);
    assertTimestamp(input.countedAt, 'stockCount.countedAt');
    if (input.reason.trim().length < 3) throw new Error('OPS_STOCK_COUNT_REASON_REQUIRED');
    if (this.#counts.has(input.id)) throw new Error('OPS_DUPLICATE_STOCK_COUNT');
    const expectedQuantity = this.balance(input.itemId, input.locationId);
    const count: StockCount = frozen({
      ...input,
      reason: input.reason.trim(),
      expectedQuantity,
      varianceQuantity: input.countedQuantity - expectedQuantity,
      status: 'pending-approval',
      createdBy: principal.principalId,
      approvedBy: null,
      adjustmentMovementId: null,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#counts.set(count.id, count);
    this.#record(
      'operations.inventory.stock-count-recorded.v1',
      'stock-count',
      count.id,
      1,
      'operations.inventory.count.record',
      principal,
      correlationId,
      {
        expectedQuantity,
        countedQuantity: count.countedQuantity,
        varianceQuantity: count.varianceQuantity,
      },
    );
    return count;
  }

  approveCountVariance(
    countId: string,
    principal: OperationsPrincipal,
    correlationId: string,
  ): StockCount {
    const count = this.#requireCount(countId);
    if (count.createdBy === principal.principalId) {
      throw new Error('OPS_SOD_VIOLATION:stock-count-record-approve');
    }
    authorizeOperations(principal, 'operations.inventory.count.approve', this.#scope, {
      requireAal2: true,
    });
    if (count.status === 'approved') return count;
    if (count.status !== 'pending-approval') throw new Error('OPS_INVALID_STOCK_COUNT_STATE');
    let adjustmentMovementId: string | null = null;
    if (count.varianceQuantity !== 0) {
      const movementId = `count-adjustment:${count.id}`;
      const movement = this.recordMovement(
        {
          id: movementId,
          itemId: count.itemId,
          movementType: 'adjustment',
          fromLocationId: count.varianceQuantity < 0 ? count.locationId : null,
          toLocationId: count.varianceQuantity > 0 ? count.locationId : null,
          quantity: Math.abs(count.varianceQuantity),
          unitCostMinor: this.#requireItem(count.itemId).standardCostMinor,
          sourceDocumentRef: count.id,
          occurredAt: count.countedAt,
          idempotencyKey: movementId,
        },
        {
          ...principal,
          permissions: [...principal.permissions, 'operations.inventory.movement.write'],
        },
        correlationId,
      );
      adjustmentMovementId = movement.id;
    }
    const approved: StockCount = frozen({
      ...count,
      status: 'approved',
      approvedBy: principal.principalId,
      adjustmentMovementId,
      version: count.version + 1,
    });
    this.#counts.set(approved.id, approved);
    this.#record(
      'operations.inventory.stock-count-approved.v1',
      'stock-count',
      approved.id,
      approved.version,
      'operations.inventory.count.approve',
      principal,
      correlationId,
      { varianceQuantity: approved.varianceQuantity, adjustmentMovementId },
    );
    return approved;
  }

  balance(itemId: string, locationId: string): number {
    this.#requireItem(itemId);
    this.#requireLocation(locationId);
    let balance = 0;
    for (const movement of this.#movements.values()) {
      if (movement.itemId !== itemId) continue;
      if (movement.toLocationId === locationId) balance += movement.quantity;
      if (movement.fromLocationId === locationId) balance -= movement.quantity;
    }
    return balance;
  }

  totalOnHand(itemId: string): number {
    this.#requireItem(itemId);
    return [...this.#locations.keys()].reduce(
      (sum, locationId) => sum + this.balance(itemId, locationId),
      0,
    );
  }

  listMovements(): readonly StockMovement[] {
    return Object.freeze([...this.#movements.values()]);
  }

  registerAsset(input: AssetInput, principal: OperationsPrincipal, correlationId: string): Asset {
    authorizeOperations(principal, 'operations.asset.register', this.#scope);
    this.#correlation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      assetTag: input.assetTag,
      category: input.category,
      description: input.description,
      currency: input.currency,
      locationId: input.locationId,
    })) {
      assertIdentifier(value, `asset.${field}`);
    }
    assertDate(input.acquiredOn, 'asset.acquiredOn');
    assertPositiveInteger(input.acquisitionCostMinor, 'asset.acquisitionCostMinor');
    assertPositiveInteger(input.usefulLifeMonths, 'asset.usefulLifeMonths');
    assertPositiveInteger(input.salvageValueMinor, 'asset.salvageValueMinor', true);
    if (input.salvageValueMinor >= input.acquisitionCostMinor) {
      throw new Error('OPS_INVALID_ASSET_SALVAGE_VALUE');
    }
    const tag = input.assetTag.trim().toUpperCase();
    if (this.#assets.has(input.id) || this.#assetTags.has(tag))
      throw new Error('OPS_DUPLICATE_ASSET');
    const asset: Asset = frozen({
      ...input,
      assetTag: tag,
      status: 'active',
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#assets.set(asset.id, asset);
    this.#assetTags.add(asset.assetTag);
    this.#record(
      'operations.asset.registered.v1',
      'asset',
      asset.id,
      1,
      'operations.asset.register',
      principal,
      correlationId,
      { assetTag: asset.assetTag, acquisitionCostMinor: asset.acquisitionCostMinor },
    );
    return asset;
  }

  assignAsset(
    input: AssetAssignmentInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): AssetAssignment {
    authorizeOperations(principal, 'operations.asset.assign', this.#scope);
    this.#correlation(correlationId);
    const asset = this.#requireAsset(input.assetId);
    if (asset.status === 'disposed') throw new Error('OPS_ASSET_DISPOSED');
    for (const [field, value] of Object.entries({
      id: input.id,
      custodianRef: input.custodianRef,
    })) {
      assertIdentifier(value, `assetAssignment.${field}`);
    }
    assertDate(input.assignedOn, 'assetAssignment.assignedOn');
    if (this.currentCustodian(asset.id)) throw new Error('OPS_ASSET_ALREADY_ASSIGNED');
    const assignment: AssetAssignment = frozen({
      ...input,
      returnedOn: null,
      assignedBy: principal.principalId,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#assignments.set(assignment.id, assignment);
    this.#record(
      'operations.asset.assigned.v1',
      'asset-assignment',
      assignment.id,
      1,
      'operations.asset.assign',
      principal,
      correlationId,
      { assetId: assignment.assetId, custodianRef: assignment.custodianRef },
    );
    return assignment;
  }

  currentCustodian(assetId: string): string | null {
    this.#requireAsset(assetId);
    return (
      [...this.#assignments.values()].find(
        (assignment) => assignment.assetId === assetId && assignment.returnedOn === null,
      )?.custodianRef ?? null
    );
  }

  recordMaintenance(
    input: AssetMaintenanceInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): AssetMaintenance {
    authorizeOperations(principal, 'operations.asset.maintenance.write', this.#scope);
    this.#correlation(correlationId);
    const asset = this.#requireAsset(input.assetId);
    if (asset.status === 'disposed') throw new Error('OPS_ASSET_DISPOSED');
    for (const [field, value] of Object.entries({
      id: input.id,
      supplierRef: input.supplierRef,
      description: input.description,
    })) {
      assertIdentifier(value, `assetMaintenance.${field}`);
    }
    assertDate(input.performedOn, 'assetMaintenance.performedOn');
    assertPositiveInteger(input.costMinor, 'assetMaintenance.costMinor', true);
    if (this.#maintenance.has(input.id)) throw new Error('OPS_DUPLICATE_ASSET_MAINTENANCE');
    const maintenance: AssetMaintenance = frozen({
      ...input,
      recordedBy: principal.principalId,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#maintenance.set(maintenance.id, maintenance);
    this.#record(
      'operations.asset.maintenance-recorded.v1',
      'asset-maintenance',
      maintenance.id,
      1,
      'operations.asset.maintenance.record',
      principal,
      correlationId,
      { assetId: maintenance.assetId, costMinor: maintenance.costMinor },
    );
    return maintenance;
  }

  requestDisposal(
    input: AssetDisposalInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): AssetDisposal {
    authorizeOperations(principal, 'operations.asset.disposal.write', this.#scope);
    this.#correlation(correlationId);
    const asset = this.#requireAsset(input.assetId);
    if (asset.status === 'disposed') throw new Error('OPS_ASSET_DISPOSED');
    assertIdentifier(input.id, 'assetDisposal.id');
    if (input.reason.trim().length < 5) throw new Error('OPS_ASSET_DISPOSAL_REASON_REQUIRED');
    assertPositiveInteger(input.proceedsMinor, 'assetDisposal.proceedsMinor', true);
    if (this.#disposals.has(input.id)) throw new Error('OPS_DUPLICATE_ASSET_DISPOSAL');
    const disposal: AssetDisposal = frozen({
      ...input,
      reason: input.reason.trim(),
      status: 'pending',
      requestedBy: principal.principalId,
      approvedBy: null,
      approvedAt: null,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#disposals.set(disposal.id, disposal);
    this.#record(
      'operations.asset.disposal-requested.v1',
      'asset-disposal',
      disposal.id,
      1,
      'operations.asset.disposal.request',
      principal,
      correlationId,
      { assetId: disposal.assetId, proceedsMinor: disposal.proceedsMinor },
    );
    return disposal;
  }

  approveDisposal(
    disposalId: string,
    principal: OperationsPrincipal,
    correlationId: string,
  ): AssetDisposal {
    const disposal = this.#requireDisposal(disposalId);
    if (disposal.requestedBy === principal.principalId) {
      throw new Error('OPS_SOD_VIOLATION:asset-disposal-request-approve');
    }
    authorizeOperations(principal, 'operations.asset.disposal.approve', this.#scope, {
      requireAal2: true,
    });
    if (disposal.status === 'approved') return disposal;
    if (disposal.status !== 'pending') throw new Error('OPS_INVALID_ASSET_DISPOSAL_STATE');
    if (this.currentCustodian(disposal.assetId)) throw new Error('OPS_ASSET_STILL_ASSIGNED');
    const approvedAt = this.#clock.now().toISOString();
    const approved: AssetDisposal = frozen({
      ...disposal,
      status: 'approved',
      approvedBy: principal.principalId,
      approvedAt,
      version: disposal.version + 1,
    });
    this.#disposals.set(approved.id, approved);
    const asset = this.#requireAsset(approved.assetId);
    this.#assets.set(
      asset.id,
      frozen({ ...asset, status: 'disposed', version: asset.version + 1 }),
    );
    this.#record(
      'operations.asset.disposed.v1',
      'asset-disposal',
      approved.id,
      approved.version,
      'operations.asset.disposal.approve',
      principal,
      correlationId,
      { assetId: approved.assetId, proceedsMinor: approved.proceedsMinor },
    );
    return approved;
  }

  depreciationSchedule(assetId: string): readonly DepreciationPeriod[] {
    const asset = this.#requireAsset(assetId);
    const depreciable = asset.acquisitionCostMinor - asset.salvageValueMinor;
    const base = Math.floor(depreciable / asset.usefulLifeMonths);
    let remainder = depreciable - base * asset.usefulLifeMonths;
    let accumulated = 0;
    const periods: DepreciationPeriod[] = [];
    for (let month = 1; month <= asset.usefulLifeMonths; month += 1) {
      const depreciationMinor = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      accumulated += depreciationMinor;
      periods.push(
        frozen({
          month,
          depreciationMinor,
          accumulatedMinor: accumulated,
          bookValueMinor: asset.acquisitionCostMinor - accumulated,
        }),
      );
    }
    return Object.freeze(periods);
  }

  inventoryReport(principal: OperationsPrincipal): InventoryReport {
    authorizeOperations(principal, 'operations.inventory.report.read', this.#scope);
    const onHands = [...this.#items.values()].map((item) => ({
      item,
      quantity: this.totalOnHand(item.id),
    }));
    const totalReserved = [...this.#reservations.values()]
      .filter((reservation) => reservation.status === 'active')
      .reduce((sum, reservation) => sum + reservation.quantity, 0);
    return frozen({
      itemCount: this.#items.size,
      totalOnHand: onHands.reduce((sum, entry) => sum + entry.quantity, 0),
      totalReserved,
      inventoryValueMinor: onHands.reduce(
        (sum, entry) => sum + entry.quantity * entry.item.standardCostMinor,
        0,
      ),
      lowStockItemIds: Object.freeze(
        onHands
          .filter((entry) => entry.quantity <= entry.item.reorderPoint)
          .map((entry) => entry.item.id)
          .sort(),
      ),
      negativeStockItemIds: Object.freeze(
        onHands
          .filter((entry) => entry.quantity < 0)
          .map((entry) => entry.item.id)
          .sort(),
      ),
    });
  }

  assetReport(principal: OperationsPrincipal): AssetReport {
    authorizeOperations(principal, 'operations.asset.report.read', this.#scope);
    const assets = [...this.#assets.values()];
    const assigned = assets.filter((asset) => this.currentCustodian(asset.id) !== null);
    return frozen({
      activeAssets: assets.filter((asset) => asset.status === 'active').length,
      assignedAssets: assigned.length,
      underMaintenanceAssets: assets.filter((asset) => asset.status === 'under-maintenance').length,
      disposedAssets: assets.filter((asset) => asset.status === 'disposed').length,
      acquisitionValueMinor: assets.reduce((sum, asset) => sum + asset.acquisitionCostMinor, 0),
      maintenanceCostMinor: [...this.#maintenance.values()].reduce(
        (sum, maintenance) => sum + maintenance.costMinor,
        0,
      ),
      unassignedAssetIds: Object.freeze(
        assets
          .filter(
            (asset) => asset.status !== 'disposed' && this.currentCustodian(asset.id) === null,
          )
          .map((asset) => asset.id)
          .sort(),
      ),
    });
  }

  #validateMovement(input: StockMovementInput): void {
    this.#requireItem(input.itemId);
    for (const [field, value] of Object.entries({
      id: input.id,
      sourceDocumentRef: input.sourceDocumentRef,
      idempotencyKey: input.idempotencyKey,
    })) {
      assertIdentifier(value, `movement.${field}`);
    }
    assertTimestamp(input.occurredAt, 'movement.occurredAt');
    assertPositiveInteger(input.quantity, 'movement.quantity');
    assertPositiveInteger(input.unitCostMinor, 'movement.unitCostMinor', true);
    if (input.fromLocationId) this.#requireLocation(input.fromLocationId);
    if (input.toLocationId) this.#requireLocation(input.toLocationId);
    if (!input.fromLocationId && !input.toLocationId)
      throw new Error('OPS_MOVEMENT_LOCATION_REQUIRED');
    if (input.fromLocationId && input.toLocationId && input.fromLocationId === input.toLocationId) {
      throw new Error('OPS_TRANSFER_SAME_LOCATION');
    }
    if (input.movementType === 'receipt' && input.toLocationId === null) {
      throw new Error('OPS_RECEIPT_DESTINATION_REQUIRED');
    }
    if (input.movementType === 'issue' && input.fromLocationId === null) {
      throw new Error('OPS_ISSUE_SOURCE_REQUIRED');
    }
    if (input.movementType === 'transfer' && (!input.fromLocationId || !input.toLocationId)) {
      throw new Error('OPS_TRANSFER_LOCATIONS_REQUIRED');
    }
  }

  #record(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    aggregateVersion: number,
    action: string,
    principal: OperationsPrincipal,
    correlationId: string,
    payload: Readonly<Record<string, unknown>>,
  ): void {
    this.#correlation(correlationId);
    const occurredAt = this.#clock.now().toISOString();
    this.#events.publish(
      createOperationsEvent({
        eventType,
        scope: this.#scope,
        aggregateType,
        aggregateId,
        aggregateVersion,
        correlationId,
        actorId: principal.principalId,
        payload,
        occurredAt,
      }),
    );
    this.#audit.append(
      createOperationsAudit({
        scope: this.#scope,
        action,
        subjectType: aggregateType,
        subjectId: aggregateId,
        actorId: principal.principalId,
        correlationId,
        details: payload,
        occurredAt,
      }),
    );
  }

  #correlation(correlationId: string): void {
    assertIdentifier(correlationId, 'correlationId');
  }

  #requireItem(id: string): InventoryItem {
    const item = this.#items.get(id);
    if (!item) throw new Error('OPS_NOT_FOUND:inventory-item');
    return item;
  }

  #requireLocation(id: string): InventoryLocation {
    const location = this.#locations.get(id);
    if (!location) throw new Error('OPS_NOT_FOUND:inventory-location');
    return location;
  }

  #requireCount(id: string): StockCount {
    const count = this.#counts.get(id);
    if (!count) throw new Error('OPS_NOT_FOUND:stock-count');
    return count;
  }

  #requireAsset(id: string): Asset {
    const asset = this.#assets.get(id);
    if (!asset) throw new Error('OPS_NOT_FOUND:asset');
    return asset;
  }

  #requireDisposal(id: string): AssetDisposal {
    const disposal = this.#disposals.get(id);
    if (!disposal) throw new Error('OPS_NOT_FOUND:asset-disposal');
    return disposal;
  }
}
