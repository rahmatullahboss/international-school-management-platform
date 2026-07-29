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

export type ResidentCategory = 'boys' | 'girls' | 'mixed';
export type HostelAllocationStatus = 'active' | 'ended';
export type HostelIncidentCategory = 'safeguarding' | 'health' | 'discipline' | 'facility';
export type HostelIncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type HostelIncidentStatus = 'open' | 'resolved';
export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type MealBillingMode = 'included' | 'pay-per-meal';
export type MealOrderStatus = 'ordered' | 'served' | 'cancelled';

export interface HostelBuildingInput {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly residentCategory: ResidentCategory;
  readonly active: boolean;
}
export interface HostelBuilding extends HostelBuildingInput {
  readonly version: number;
  readonly createdAt: string;
}

export interface HostelBedInput {
  readonly id: string;
  readonly code: string;
}
export interface HostelBed extends HostelBedInput {
  readonly roomId: string;
  readonly active: boolean;
  readonly version: number;
  readonly createdAt: string;
}

export interface HostelRoomInput {
  readonly id: string;
  readonly buildingId: string;
  readonly code: string;
  readonly floor: number;
  readonly capacity: number;
  readonly beds: readonly HostelBedInput[];
  readonly active: boolean;
}
export interface HostelRoom extends Omit<HostelRoomInput, 'beds'> {
  readonly bedIds: readonly string[];
  readonly version: number;
  readonly createdAt: string;
}

export interface HostelAllocationInput {
  readonly id: string;
  readonly bedId: string;
  readonly residentRef: string;
  readonly guardianRef: string;
  readonly medicalNoteRef: string | null;
  readonly startsOn: string;
  readonly endsOn: string | null;
}
export interface HostelAllocation extends HostelAllocationInput {
  readonly status: HostelAllocationStatus;
  readonly allocatedBy: string;
  readonly checkedOutBy: string | null;
  readonly version: number;
  readonly createdAt: string;
}

export interface HostelVisitorInput {
  readonly id: string;
  readonly residentRef: string;
  readonly visitorName: string;
  readonly relationship: string;
  readonly checkedInAt: string;
  readonly checkedOutAt: string | null;
}
export interface HostelVisitor extends HostelVisitorInput {
  readonly recordedBy: string;
  readonly version: number;
}

export interface HostelIncidentInput {
  readonly id: string;
  readonly residentRef: string;
  readonly category: HostelIncidentCategory;
  readonly severity: HostelIncidentSeverity;
  readonly occurredAt: string;
  readonly description: string;
}
export interface HostelIncident extends HostelIncidentInput {
  readonly status: HostelIncidentStatus;
  readonly recordedBy: string;
  readonly resolvedAt: string | null;
  readonly version: number;
}

export interface HostelMaintenanceInput {
  readonly id: string;
  readonly roomId: string;
  readonly openedOn: string;
  readonly completedOn: string | null;
  readonly description: string;
  readonly supplierRef: string | null;
  readonly costMinor: number;
}
export interface HostelMaintenance extends HostelMaintenanceInput {
  readonly recordedBy: string;
  readonly version: number;
  readonly createdAt: string;
}

export interface HostelReport {
  readonly buildings: number;
  readonly rooms: number;
  readonly beds: number;
  readonly occupiedBeds: number;
  readonly availableBeds: number;
  readonly occupancyBasisPoints: number;
  readonly openVisitors: number;
  readonly openIncidents: number;
  readonly openSafeguardingIncidents: number;
  readonly openMaintenance: number;
}

export interface CafeteriaMenuItemInput {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly mealTypes: readonly MealType[];
  readonly allergenCodes: readonly string[];
  readonly priceMinor: number;
  readonly currency: string;
  readonly inventoryItemRefs: readonly string[];
  readonly active: boolean;
}
export interface CafeteriaMenuItem extends CafeteriaMenuItemInput {
  readonly version: number;
  readonly createdAt: string;
}

export interface MealPlanInput {
  readonly id: string;
  readonly personRef: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly entitledMealTypes: readonly MealType[];
  readonly excludedAllergenCodes: readonly string[];
  readonly maxMealsPerDay: number;
  readonly billingMode: MealBillingMode;
}
export interface MealPlan extends MealPlanInput {
  readonly version: number;
  readonly createdAt: string;
}

export interface MealOrderInput {
  readonly id: string;
  readonly personRef: string;
  readonly serviceDate: string;
  readonly mealType: MealType;
  readonly menuItemIds: readonly string[];
}
export interface MealOrder extends MealOrderInput {
  readonly mealPlanId: string;
  readonly status: MealOrderStatus;
  readonly totalMinor: number;
  readonly currency: string;
  readonly billingMode: MealBillingMode;
  readonly placedBy: string;
  readonly financeDocumentRef: string | null;
  readonly version: number;
  readonly createdAt: string;
}

export interface MealServiceInput {
  readonly id: string;
  readonly orderId: string;
  readonly servedAt: string;
  readonly idempotencyKey: string;
}
export interface MealService extends MealServiceInput {
  readonly servedBy: string;
  readonly version: number;
}

export interface CafeteriaChargeSourceDocument {
  readonly contractVersion: '1.0';
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly campusId: string;
  readonly sourceType: 'cafeteria-meal';
  readonly sourceId: string;
  readonly personRef: string;
  readonly serviceDate: string;
  readonly mealType: MealType;
  readonly amountMinor: number;
  readonly currency: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
}
export interface CafeteriaChargeGateway {
  submitChargeSource(document: CafeteriaChargeSourceDocument): string;
}
export class InMemoryCafeteriaChargeGateway implements CafeteriaChargeGateway {
  readonly #documents: CafeteriaChargeSourceDocument[] = [];
  readonly #references = new Map<string, string>();

  get documents(): readonly CafeteriaChargeSourceDocument[] {
    return Object.freeze([...this.#documents]);
  }

  submitChargeSource(document: CafeteriaChargeSourceDocument): string {
    const existing = this.#references.get(document.idempotencyKey);
    if (existing) return existing;
    const reference = `fin-cafeteria:${document.sourceId}`;
    this.#documents.push(Object.freeze({ ...document }));
    this.#references.set(document.idempotencyKey, reference);
    return reference;
  }
}

export interface CafeteriaReport {
  readonly activeMenuItems: number;
  readonly activeMealPlans: number;
  readonly orders: number;
  readonly servedOrders: number;
  readonly unservedOrders: number;
  readonly uptakeBasisPoints: number;
  readonly chargeableMinor: number;
  readonly allergenMenuItemIds: readonly string[];
}

interface Clock {
  now(): Date;
}
const systemClock: Clock = { now: () => new Date() };
function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}
function timestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`OPS_INVALID_TIMESTAMP:${field}`);
  return parsed.toISOString();
}
function assertMoney(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`OPS_INVALID_MONEY:${field}`);
}
function dateRangesOverlap(
  left: { readonly startsOn: string; readonly endsOn: string | null },
  right: { readonly startsOn: string; readonly endsOn: string | null },
): boolean {
  return (
    left.startsOn <= (right.endsOn ?? '9999-12-31') &&
    right.startsOn <= (left.endsOn ?? '9999-12-31')
  );
}
function activeOn(
  value: { readonly startsOn: string; readonly endsOn: string | null },
  date: string,
): boolean {
  return value.startsOn <= date && (value.endsOn === null || value.endsOn >= date);
}

export class ResidentialCateringService {
  readonly #scope: OperationsScope;
  readonly #events: OperationsEventPublisher;
  readonly #audit: OperationsAuditWriter;
  readonly #charges: CafeteriaChargeGateway;
  readonly #clock: Clock;
  readonly #buildings = new Map<string, HostelBuilding>();
  readonly #buildingCodes = new Set<string>();
  readonly #rooms = new Map<string, HostelRoom>();
  readonly #roomCodes = new Set<string>();
  readonly #beds = new Map<string, HostelBed>();
  readonly #bedCodes = new Set<string>();
  readonly #allocations = new Map<string, HostelAllocation>();
  readonly #visitors = new Map<string, HostelVisitor>();
  readonly #hostelIncidents = new Map<string, HostelIncident>();
  readonly #hostelMaintenance = new Map<string, HostelMaintenance>();
  readonly #menuItems = new Map<string, CafeteriaMenuItem>();
  readonly #menuCodes = new Set<string>();
  readonly #mealPlans = new Map<string, MealPlan>();
  readonly #orders = new Map<string, MealOrder>();
  readonly #mealServices = new Map<string, MealService>();
  readonly #serviceKeys = new Map<string, string>();

  constructor(
    scope: OperationsScope,
    events: OperationsEventPublisher,
    audit: OperationsAuditWriter,
    charges: CafeteriaChargeGateway,
    clock: Clock = systemClock,
  ) {
    this.#scope = frozen(scope);
    this.#events = events;
    this.#audit = audit;
    this.#charges = charges;
    this.#clock = clock;
  }

  registerHostelBuilding(
    input: HostelBuildingInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): HostelBuilding {
    authorizeOperations(principal, 'operations.hostel.structure.write', this.#scope);
    this.#correlation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      code: input.code,
      name: input.name,
    })) {
      assertIdentifier(value, `hostelBuilding.${field}`);
    }
    const code = input.code.trim().toUpperCase();
    if (this.#buildings.has(input.id) || this.#buildingCodes.has(code)) {
      throw new Error('OPS_DUPLICATE_HOSTEL_BUILDING');
    }
    const building: HostelBuilding = frozen({
      ...input,
      code,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#buildings.set(building.id, building);
    this.#buildingCodes.add(building.code);
    this.#record(
      'operations.hostel.building-registered.v1',
      'hostel-building',
      building.id,
      1,
      'operations.hostel.building.register',
      principal,
      correlationId,
      { code: building.code, residentCategory: building.residentCategory },
    );
    return building;
  }

  registerHostelRoom(
    input: HostelRoomInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): HostelRoom {
    authorizeOperations(principal, 'operations.hostel.structure.write', this.#scope);
    this.#correlation(correlationId);
    const building = this.#requireBuilding(input.buildingId);
    if (!building.active) throw new Error('OPS_HOSTEL_BUILDING_INACTIVE');
    assertIdentifier(input.id, 'hostelRoom.id');
    assertIdentifier(input.code, 'hostelRoom.code');
    if (!Number.isInteger(input.floor)) throw new Error('OPS_INVALID_HOSTEL_FLOOR');
    if (
      !Number.isInteger(input.capacity) ||
      input.capacity <= 0 ||
      input.beds.length !== input.capacity
    ) {
      throw new Error('OPS_HOSTEL_ROOM_CAPACITY_MISMATCH');
    }
    const code = input.code.trim().toUpperCase();
    if (this.#rooms.has(input.id) || this.#roomCodes.has(code)) {
      throw new Error('OPS_DUPLICATE_HOSTEL_ROOM');
    }
    const bedIds = new Set<string>();
    const bedCodes = new Set<string>();
    for (const bedInput of input.beds) {
      assertIdentifier(bedInput.id, 'hostelBed.id');
      assertIdentifier(bedInput.code, 'hostelBed.code');
      const bedCode = bedInput.code.trim().toUpperCase();
      if (
        bedIds.has(bedInput.id) ||
        bedCodes.has(bedCode) ||
        this.#beds.has(bedInput.id) ||
        this.#bedCodes.has(bedCode)
      ) {
        throw new Error('OPS_DUPLICATE_HOSTEL_BED');
      }
      bedIds.add(bedInput.id);
      bedCodes.add(bedCode);
    }
    const room: HostelRoom = frozen({
      id: input.id,
      buildingId: input.buildingId,
      code,
      floor: input.floor,
      capacity: input.capacity,
      active: input.active,
      bedIds: Object.freeze([...bedIds]),
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#rooms.set(room.id, room);
    this.#roomCodes.add(room.code);
    for (const bedInput of input.beds) {
      const bed: HostelBed = frozen({
        id: bedInput.id,
        code: bedInput.code.trim().toUpperCase(),
        roomId: room.id,
        active: input.active,
        version: 1,
        createdAt: this.#clock.now().toISOString(),
      });
      this.#beds.set(bed.id, bed);
      this.#bedCodes.add(bed.code);
    }
    this.#record(
      'operations.hostel.room-registered.v1',
      'hostel-room',
      room.id,
      1,
      'operations.hostel.room.register',
      principal,
      correlationId,
      { buildingId: room.buildingId, capacity: room.capacity },
    );
    return room;
  }

  allocateBed(
    input: HostelAllocationInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): HostelAllocation {
    authorizeOperations(principal, 'operations.hostel.allocation.write', this.#scope, {
      requireAal2: true,
    });
    this.#correlation(correlationId);
    const bed = this.#requireBed(input.bedId);
    const room = this.#requireRoom(bed.roomId);
    if (!bed.active || !room.active) throw new Error('OPS_HOSTEL_BED_UNAVAILABLE');
    for (const [field, value] of Object.entries({
      id: input.id,
      residentRef: input.residentRef,
      guardianRef: input.guardianRef,
    })) {
      assertIdentifier(value, `hostelAllocation.${field}`);
    }
    if (input.medicalNoteRef !== null) assertIdentifier(input.medicalNoteRef, 'medicalNoteRef');
    assertDate(input.startsOn, 'hostelAllocation.startsOn');
    if (input.endsOn !== null) {
      assertDate(input.endsOn, 'hostelAllocation.endsOn');
      if (input.endsOn < input.startsOn) throw new Error('OPS_INVALID_DATE_RANGE');
    }
    if (this.#allocations.has(input.id)) throw new Error('OPS_DUPLICATE_HOSTEL_ALLOCATION');
    const overlapping = [...this.#allocations.values()].filter(
      (allocation) => allocation.status === 'active' && dateRangesOverlap(allocation, input),
    );
    if (overlapping.some((allocation) => allocation.residentRef === input.residentRef)) {
      throw new Error('OPS_HOSTEL_RESIDENT_ALREADY_ALLOCATED');
    }
    if (overlapping.some((allocation) => allocation.bedId === input.bedId)) {
      throw new Error('OPS_HOSTEL_BED_UNAVAILABLE');
    }
    const allocation: HostelAllocation = frozen({
      ...input,
      status: 'active',
      allocatedBy: principal.principalId,
      checkedOutBy: null,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#allocations.set(allocation.id, allocation);
    this.#record(
      'operations.hostel.bed-allocated.v1',
      'hostel-allocation',
      allocation.id,
      1,
      'operations.hostel.allocation.create',
      principal,
      correlationId,
      { bedId: allocation.bedId, residentRef: allocation.residentRef },
    );
    return allocation;
  }

  checkoutResident(
    allocationId: string,
    endsOn: string,
    principal: OperationsPrincipal,
    correlationId: string,
  ): HostelAllocation {
    authorizeOperations(principal, 'operations.hostel.allocation.write', this.#scope, {
      requireAal2: true,
    });
    const allocation = this.#requireAllocation(allocationId);
    if (allocation.status === 'ended') return allocation;
    assertDate(endsOn, 'hostelAllocation.endsOn');
    if (endsOn < allocation.startsOn) throw new Error('OPS_INVALID_DATE_RANGE');
    const ended: HostelAllocation = frozen({
      ...allocation,
      endsOn,
      status: 'ended',
      checkedOutBy: principal.principalId,
      version: allocation.version + 1,
    });
    this.#allocations.set(ended.id, ended);
    this.#record(
      'operations.hostel.resident-checked-out.v1',
      'hostel-allocation',
      ended.id,
      ended.version,
      'operations.hostel.allocation.checkout',
      principal,
      correlationId,
      { residentRef: ended.residentRef, endsOn },
    );
    return ended;
  }

  logVisitor(
    input: HostelVisitorInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): HostelVisitor {
    authorizeOperations(principal, 'operations.hostel.visitor.write', this.#scope);
    this.#correlation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      residentRef: input.residentRef,
      visitorName: input.visitorName,
      relationship: input.relationship,
    })) {
      assertIdentifier(value, `hostelVisitor.${field}`);
    }
    const checkedInAt = timestamp(input.checkedInAt, 'hostelVisitor.checkedInAt');
    const checkedOutAt =
      input.checkedOutAt === null
        ? null
        : timestamp(input.checkedOutAt, 'hostelVisitor.checkedOutAt');
    if (checkedOutAt !== null && checkedOutAt < checkedInAt)
      throw new Error('OPS_INVALID_TIMESTAMP_ORDER');
    const serviceDate = checkedInAt.slice(0, 10);
    if (!this.#activeAllocationForResident(input.residentRef, serviceDate)) {
      throw new Error('OPS_HOSTEL_RESIDENT_NOT_ACTIVE');
    }
    if (this.#visitors.has(input.id)) throw new Error('OPS_DUPLICATE_HOSTEL_VISITOR');
    const visitor: HostelVisitor = frozen({
      ...input,
      checkedInAt,
      checkedOutAt,
      recordedBy: principal.principalId,
      version: 1,
    });
    this.#visitors.set(visitor.id, visitor);
    this.#record(
      'operations.hostel.visitor-logged.v1',
      'hostel-visitor',
      visitor.id,
      1,
      'operations.hostel.visitor.log',
      principal,
      correlationId,
      { residentRef: visitor.residentRef, checkedInAt },
    );
    return visitor;
  }

  recordHostelIncident(
    input: HostelIncidentInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): HostelIncident {
    authorizeOperations(principal, 'operations.hostel.incident.write', this.#scope);
    this.#correlation(correlationId);
    assertIdentifier(input.id, 'hostelIncident.id');
    assertIdentifier(input.residentRef, 'hostelIncident.residentRef');
    if (input.description.trim().length < 5)
      throw new Error('OPS_HOSTEL_INCIDENT_DESCRIPTION_REQUIRED');
    const occurredAt = timestamp(input.occurredAt, 'hostelIncident.occurredAt');
    if (!this.#activeAllocationForResident(input.residentRef, occurredAt.slice(0, 10))) {
      throw new Error('OPS_HOSTEL_RESIDENT_NOT_ACTIVE');
    }
    if (this.#hostelIncidents.has(input.id)) throw new Error('OPS_DUPLICATE_HOSTEL_INCIDENT');
    const incident: HostelIncident = frozen({
      ...input,
      occurredAt,
      description: input.description.trim(),
      status: 'open',
      recordedBy: principal.principalId,
      resolvedAt: null,
      version: 1,
    });
    this.#hostelIncidents.set(incident.id, incident);
    this.#record(
      input.category === 'safeguarding'
        ? 'operations.hostel.safeguarding-incident-recorded.v1'
        : 'operations.hostel.incident-recorded.v1',
      'hostel-incident',
      incident.id,
      1,
      'operations.hostel.incident.record',
      principal,
      correlationId,
      {
        residentRef: incident.residentRef,
        category: incident.category,
        severity: incident.severity,
      },
    );
    return incident;
  }

  scheduleHostelMaintenance(
    input: HostelMaintenanceInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): HostelMaintenance {
    authorizeOperations(principal, 'operations.hostel.maintenance.write', this.#scope);
    this.#correlation(correlationId);
    this.#requireRoom(input.roomId);
    assertIdentifier(input.id, 'hostelMaintenance.id');
    assertIdentifier(input.description, 'hostelMaintenance.description');
    if (input.supplierRef !== null)
      assertIdentifier(input.supplierRef, 'hostelMaintenance.supplierRef');
    assertDate(input.openedOn, 'hostelMaintenance.openedOn');
    if (input.completedOn !== null) {
      assertDate(input.completedOn, 'hostelMaintenance.completedOn');
      if (input.completedOn < input.openedOn) throw new Error('OPS_INVALID_DATE_RANGE');
    }
    assertMoney(input.costMinor, 'hostelMaintenance.costMinor');
    if (this.#hostelMaintenance.has(input.id)) throw new Error('OPS_DUPLICATE_HOSTEL_MAINTENANCE');
    const maintenance: HostelMaintenance = frozen({
      ...input,
      recordedBy: principal.principalId,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#hostelMaintenance.set(maintenance.id, maintenance);
    this.#record(
      'operations.hostel.maintenance-scheduled.v1',
      'hostel-maintenance',
      maintenance.id,
      1,
      'operations.hostel.maintenance.schedule',
      principal,
      correlationId,
      { roomId: maintenance.roomId, openedOn: maintenance.openedOn },
    );
    return maintenance;
  }

  hostelReport(asOf: string, principal: OperationsPrincipal): HostelReport {
    authorizeOperations(principal, 'operations.hostel.report.read', this.#scope);
    assertDate(asOf, 'hostelReport.asOf');
    const activeBeds = [...this.#beds.values()].filter((bed) => bed.active);
    const occupied = new Set(
      [...this.#allocations.values()]
        .filter((allocation) => activeOn(allocation, asOf))
        .map((allocation) => allocation.bedId),
    );
    return frozen({
      buildings: [...this.#buildings.values()].filter((building) => building.active).length,
      rooms: [...this.#rooms.values()].filter((room) => room.active).length,
      beds: activeBeds.length,
      occupiedBeds: occupied.size,
      availableBeds: activeBeds.length - occupied.size,
      occupancyBasisPoints:
        activeBeds.length === 0 ? 0 : Math.round((occupied.size * 10_000) / activeBeds.length),
      openVisitors: [...this.#visitors.values()].filter(
        (visitor) => visitor.checkedInAt.slice(0, 10) <= asOf && visitor.checkedOutAt === null,
      ).length,
      openIncidents: [...this.#hostelIncidents.values()].filter(
        (incident) => incident.status === 'open' && incident.occurredAt.slice(0, 10) <= asOf,
      ).length,
      openSafeguardingIncidents: [...this.#hostelIncidents.values()].filter(
        (incident) =>
          incident.status === 'open' &&
          incident.category === 'safeguarding' &&
          incident.occurredAt.slice(0, 10) <= asOf,
      ).length,
      openMaintenance: [...this.#hostelMaintenance.values()].filter(
        (maintenance) => maintenance.openedOn <= asOf && maintenance.completedOn === null,
      ).length,
    });
  }

  listHostelAllocations(): readonly HostelAllocation[] {
    return Object.freeze([...this.#allocations.values()]);
  }

  registerMenuItem(
    input: CafeteriaMenuItemInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): CafeteriaMenuItem {
    authorizeOperations(principal, 'operations.cafeteria.menu.write', this.#scope);
    this.#correlation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      code: input.code,
      name: input.name,
      currency: input.currency,
    })) {
      assertIdentifier(value, `cafeteriaMenuItem.${field}`);
    }
    if (input.mealTypes.length === 0) throw new Error('OPS_CAFETERIA_MEAL_TYPE_REQUIRED');
    if (input.inventoryItemRefs.length === 0)
      throw new Error('OPS_CAFETERIA_INVENTORY_REFERENCE_REQUIRED');
    for (const inventoryRef of input.inventoryItemRefs)
      assertIdentifier(inventoryRef, 'inventoryItemRef');
    assertMoney(input.priceMinor, 'cafeteriaMenuItem.priceMinor');
    const code = input.code.trim().toUpperCase();
    if (this.#menuItems.has(input.id) || this.#menuCodes.has(code)) {
      throw new Error('OPS_DUPLICATE_CAFETERIA_MENU_ITEM');
    }
    const menuItem: CafeteriaMenuItem = frozen({
      ...input,
      code,
      mealTypes: Object.freeze([...new Set(input.mealTypes)]),
      allergenCodes: Object.freeze(
        [...new Set(input.allergenCodes.map((allergen) => allergen.trim().toUpperCase()))].sort(),
      ),
      inventoryItemRefs: Object.freeze([...new Set(input.inventoryItemRefs)]),
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#menuItems.set(menuItem.id, menuItem);
    this.#menuCodes.add(menuItem.code);
    this.#record(
      'operations.cafeteria.menu-item-registered.v1',
      'cafeteria-menu-item',
      menuItem.id,
      1,
      'operations.cafeteria.menu.register',
      principal,
      correlationId,
      { code: menuItem.code, allergenCodes: menuItem.allergenCodes },
    );
    return menuItem;
  }

  createMealPlan(
    input: MealPlanInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): MealPlan {
    authorizeOperations(principal, 'operations.cafeteria.plan.write', this.#scope);
    this.#correlation(correlationId);
    assertIdentifier(input.id, 'mealPlan.id');
    assertIdentifier(input.personRef, 'mealPlan.personRef');
    assertDate(input.startsOn, 'mealPlan.startsOn');
    assertDate(input.endsOn, 'mealPlan.endsOn');
    if (input.endsOn < input.startsOn) throw new Error('OPS_INVALID_DATE_RANGE');
    if (input.entitledMealTypes.length === 0) throw new Error('OPS_CAFETERIA_ENTITLEMENT_REQUIRED');
    if (!Number.isInteger(input.maxMealsPerDay) || input.maxMealsPerDay <= 0) {
      throw new Error('OPS_CAFETERIA_INVALID_DAILY_LIMIT');
    }
    if (this.#mealPlans.has(input.id)) throw new Error('OPS_DUPLICATE_CAFETERIA_MEAL_PLAN');
    if (
      [...this.#mealPlans.values()].some(
        (plan) => plan.personRef === input.personRef && dateRangesOverlap(plan, input),
      )
    ) {
      throw new Error('OPS_CAFETERIA_OVERLAPPING_MEAL_PLAN');
    }
    const plan: MealPlan = frozen({
      ...input,
      entitledMealTypes: Object.freeze([...new Set(input.entitledMealTypes)]),
      excludedAllergenCodes: Object.freeze(
        [
          ...new Set(input.excludedAllergenCodes.map((allergen) => allergen.trim().toUpperCase())),
        ].sort(),
      ),
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#mealPlans.set(plan.id, plan);
    this.#record(
      'operations.cafeteria.meal-plan-created.v1',
      'cafeteria-meal-plan',
      plan.id,
      1,
      'operations.cafeteria.plan.create',
      principal,
      correlationId,
      { personRef: plan.personRef, billingMode: plan.billingMode },
    );
    return plan;
  }

  placeMealOrder(
    input: MealOrderInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): MealOrder {
    authorizeOperations(principal, 'operations.cafeteria.order.write', this.#scope);
    this.#correlation(correlationId);
    assertIdentifier(input.id, 'mealOrder.id');
    assertIdentifier(input.personRef, 'mealOrder.personRef');
    assertDate(input.serviceDate, 'mealOrder.serviceDate');
    if (input.menuItemIds.length === 0) throw new Error('OPS_CAFETERIA_MENU_ITEM_REQUIRED');
    if (this.#orders.has(input.id)) throw new Error('OPS_DUPLICATE_CAFETERIA_ORDER');
    const plan = [...this.#mealPlans.values()].find(
      (candidate) =>
        candidate.personRef === input.personRef && activeOn(candidate, input.serviceDate),
    );
    if (!plan) throw new Error('OPS_CAFETERIA_MEAL_PLAN_NOT_FOUND');
    if (!plan.entitledMealTypes.includes(input.mealType)) {
      throw new Error('OPS_CAFETERIA_MEAL_NOT_ENTITLED');
    }
    const dailyOrders = [...this.#orders.values()].filter(
      (order) =>
        order.personRef === input.personRef &&
        order.serviceDate === input.serviceDate &&
        order.status !== 'cancelled',
    ).length;
    if (dailyOrders >= plan.maxMealsPerDay) throw new Error('OPS_CAFETERIA_DAILY_LIMIT_EXCEEDED');
    const menuItems = input.menuItemIds.map((id) => this.#requireMenuItem(id));
    if (menuItems.some((item) => !item.active || !item.mealTypes.includes(input.mealType))) {
      throw new Error('OPS_CAFETERIA_MENU_ITEM_UNAVAILABLE');
    }
    const currencies = new Set(menuItems.map((item) => item.currency));
    if (currencies.size !== 1) throw new Error('OPS_CAFETERIA_CURRENCY_MISMATCH');
    const excluded = new Set(plan.excludedAllergenCodes);
    const conflict = [...new Set(menuItems.flatMap((item) => item.allergenCodes))]
      .filter((allergen) => excluded.has(allergen))
      .sort()[0];
    if (conflict) throw new Error(`OPS_CAFETERIA_ALLERGEN_CONFLICT:${conflict}`);
    const totalMinor = menuItems.reduce((sum, item) => sum + item.priceMinor, 0);
    const currency = menuItems[0]!.currency;
    let financeDocumentRef: string | null = null;
    if (plan.billingMode === 'pay-per-meal') {
      financeDocumentRef = this.#charges.submitChargeSource(
        frozen({
          contractVersion: '1.0',
          tenantId: this.#scope.tenantId,
          legalEntityId: this.#scope.legalEntityId,
          campusId: this.#scope.campusId,
          sourceType: 'cafeteria-meal',
          sourceId: input.id,
          personRef: input.personRef,
          serviceDate: input.serviceDate,
          mealType: input.mealType,
          amountMinor: totalMinor,
          currency,
          correlationId,
          idempotencyKey: `cafeteria-meal:${input.id}`,
        }),
      );
    }
    const order: MealOrder = frozen({
      ...input,
      menuItemIds: Object.freeze([...input.menuItemIds]),
      mealPlanId: plan.id,
      status: 'ordered',
      totalMinor,
      currency,
      billingMode: plan.billingMode,
      placedBy: principal.principalId,
      financeDocumentRef,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#orders.set(order.id, order);
    this.#record(
      'operations.cafeteria.meal-ordered.v1',
      'cafeteria-meal-order',
      order.id,
      1,
      'operations.cafeteria.order.place',
      principal,
      correlationId,
      { personRef: order.personRef, totalMinor, financeDocumentRef },
    );
    return order;
  }

  confirmMealService(
    input: MealServiceInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): MealService {
    authorizeOperations(principal, 'operations.cafeteria.service.write', this.#scope);
    this.#correlation(correlationId);
    const existingId = this.#serviceKeys.get(input.idempotencyKey);
    if (existingId) return this.#mealServices.get(existingId)!;
    const order = this.#requireOrder(input.orderId);
    if (order.status === 'cancelled') throw new Error('OPS_CAFETERIA_ORDER_CANCELLED');
    if (order.status === 'served') throw new Error('OPS_CAFETERIA_ORDER_ALREADY_SERVED');
    assertIdentifier(input.id, 'mealService.id');
    assertIdentifier(input.idempotencyKey, 'mealService.idempotencyKey');
    const servedAt = timestamp(input.servedAt, 'mealService.servedAt');
    if (servedAt.slice(0, 10) !== order.serviceDate) {
      throw new Error('OPS_CAFETERIA_SERVICE_DATE_MISMATCH');
    }
    if (this.#mealServices.has(input.id)) throw new Error('OPS_DUPLICATE_CAFETERIA_SERVICE');
    const service: MealService = frozen({
      ...input,
      servedAt,
      servedBy: principal.principalId,
      version: 1,
    });
    this.#mealServices.set(service.id, service);
    this.#serviceKeys.set(service.idempotencyKey, service.id);
    this.#orders.set(order.id, frozen({ ...order, status: 'served', version: order.version + 1 }));
    this.#record(
      'operations.cafeteria.meal-served.v1',
      'cafeteria-meal-service',
      service.id,
      1,
      'operations.cafeteria.service.confirm',
      principal,
      correlationId,
      { orderId: service.orderId, servedAt },
    );
    return service;
  }

  cafeteriaReport(serviceDate: string, principal: OperationsPrincipal): CafeteriaReport {
    authorizeOperations(principal, 'operations.cafeteria.report.read', this.#scope);
    assertDate(serviceDate, 'cafeteriaReport.serviceDate');
    const orders = [...this.#orders.values()].filter(
      (order) => order.serviceDate === serviceDate && order.status !== 'cancelled',
    );
    const servedOrders = orders.filter((order) => order.status === 'served').length;
    return frozen({
      activeMenuItems: [...this.#menuItems.values()].filter((item) => item.active).length,
      activeMealPlans: [...this.#mealPlans.values()].filter((plan) => activeOn(plan, serviceDate))
        .length,
      orders: orders.length,
      servedOrders,
      unservedOrders: orders.length - servedOrders,
      uptakeBasisPoints:
        orders.length === 0 ? 0 : Math.round((servedOrders * 10_000) / orders.length),
      chargeableMinor: orders
        .filter((order) => order.billingMode === 'pay-per-meal')
        .reduce((sum, order) => sum + order.totalMinor, 0),
      allergenMenuItemIds: Object.freeze(
        [...this.#menuItems.values()]
          .filter((item) => item.active && item.allergenCodes.length > 0)
          .map((item) => item.id)
          .sort(),
      ),
    });
  }

  #activeAllocationForResident(residentRef: string, date: string): HostelAllocation | undefined {
    return [...this.#allocations.values()].find(
      (allocation) => allocation.residentRef === residentRef && activeOn(allocation, date),
    );
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

  #correlation(value: string): void {
    assertIdentifier(value, 'correlationId');
  }
  #requireBuilding(id: string): HostelBuilding {
    const value = this.#buildings.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:hostel-building');
    return value;
  }
  #requireRoom(id: string): HostelRoom {
    const value = this.#rooms.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:hostel-room');
    return value;
  }
  #requireBed(id: string): HostelBed {
    const value = this.#beds.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:hostel-bed');
    return value;
  }
  #requireAllocation(id: string): HostelAllocation {
    const value = this.#allocations.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:hostel-allocation');
    return value;
  }
  #requireMenuItem(id: string): CafeteriaMenuItem {
    const value = this.#menuItems.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:cafeteria-menu-item');
    return value;
  }
  #requireOrder(id: string): MealOrder {
    const value = this.#orders.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:cafeteria-order');
    return value;
  }
}
