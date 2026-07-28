import { describe, expect, it } from 'vitest';

import {
  InMemoryOperationsAuditWriter,
  InMemoryOperationsEventPublisher,
  type OperationsPrincipal,
} from '../../packages/modules/hr/src/index.js';
import {
  InMemoryCafeteriaChargeGateway,
  ResidentialCateringService,
} from '../../packages/modules/residential-catering/src/index.js';

const scope = { tenantId: 'tenant-ops', legalEntityId: 'entity-school', campusId: 'campus-main' };
const manager: OperationsPrincipal = {
  principalId: 'residential-manager',
  tenantId: scope.tenantId,
  campusIds: [scope.campusId],
  assurance: 'aal2',
  permissions: [
    'operations.hostel.structure.write',
    'operations.hostel.allocation.write',
    'operations.hostel.visitor.write',
    'operations.hostel.incident.write',
    'operations.hostel.maintenance.write',
    'operations.hostel.report.read',
    'operations.cafeteria.menu.write',
    'operations.cafeteria.plan.write',
    'operations.cafeteria.order.write',
    'operations.cafeteria.service.write',
    'operations.cafeteria.report.read',
  ],
};

function setup(): {
  service: ResidentialCateringService;
  charges: InMemoryCafeteriaChargeGateway;
} {
  const charges = new InMemoryCafeteriaChargeGateway();
  return {
    service: new ResidentialCateringService(
      scope,
      new InMemoryOperationsEventPublisher(),
      new InMemoryOperationsAuditWriter(),
      charges,
    ),
    charges,
  };
}

function seedHostel(service: ResidentialCateringService): void {
  service.registerHostelBuilding(
    {
      id: 'building-1',
      code: 'H-B',
      name: 'Boys Hostel',
      residentCategory: 'boys',
      active: true,
    },
    manager,
    'corr-building',
  );
  service.registerHostelRoom(
    {
      id: 'room-1',
      buildingId: 'building-1',
      code: 'B-101',
      floor: 1,
      capacity: 2,
      beds: [
        { id: 'bed-1', code: 'B-101-A' },
        { id: 'bed-2', code: 'B-101-B' },
      ],
      active: true,
    },
    manager,
    'corr-room',
  );
}

function seedCafeteria(service: ResidentialCateringService): void {
  service.registerMenuItem(
    {
      id: 'menu-rice',
      code: 'RICE',
      name: 'Rice and vegetables',
      mealTypes: ['lunch'],
      allergenCodes: [],
      priceMinor: 150,
      currency: 'BDT',
      inventoryItemRefs: ['inventory-rice', 'inventory-vegetable'],
      active: true,
    },
    manager,
    'corr-menu-rice',
  );
  service.registerMenuItem(
    {
      id: 'menu-milk',
      code: 'MILK',
      name: 'Milk drink',
      mealTypes: ['breakfast'],
      allergenCodes: ['MILK'],
      priceMinor: 100,
      currency: 'BDT',
      inventoryItemRefs: ['inventory-milk'],
      active: true,
    },
    manager,
    'corr-menu-milk',
  );
}

describe('OPS hostel and cafeteria', () => {
  it('allocates an available hostel bed and reports occupancy', () => {
    const { service } = setup();
    seedHostel(service);
    service.allocateBed(
      {
        id: 'allocation-1',
        bedId: 'bed-1',
        residentRef: 'sis-student-1',
        guardianRef: 'sis-guardian-1',
        medicalNoteRef: 'care-note-1',
        startsOn: '2026-07-01',
        endsOn: null,
      },
      manager,
      'corr-allocation',
    );
    expect(service.hostelReport('2026-07-28', manager)).toMatchObject({
      buildings: 1,
      rooms: 1,
      beds: 2,
      occupiedBeds: 1,
      availableBeds: 1,
      occupancyBasisPoints: 5_000,
    });
  });

  it('prevents double allocation of a resident or bed', () => {
    const { service } = setup();
    seedHostel(service);
    service.allocateBed(
      {
        id: 'allocation-1',
        bedId: 'bed-1',
        residentRef: 'sis-student-1',
        guardianRef: 'sis-guardian-1',
        medicalNoteRef: null,
        startsOn: '2026-07-01',
        endsOn: null,
      },
      manager,
      'corr-allocation',
    );
    expect(() =>
      service.allocateBed(
        {
          id: 'allocation-2',
          bedId: 'bed-2',
          residentRef: 'sis-student-1',
          guardianRef: 'sis-guardian-1',
          medicalNoteRef: null,
          startsOn: '2026-07-02',
          endsOn: null,
        },
        manager,
        'corr-double-resident',
      ),
    ).toThrow('OPS_HOSTEL_RESIDENT_ALREADY_ALLOCATED');
    expect(() =>
      service.allocateBed(
        {
          id: 'allocation-3',
          bedId: 'bed-1',
          residentRef: 'sis-student-2',
          guardianRef: 'sis-guardian-2',
          medicalNoteRef: null,
          startsOn: '2026-07-02',
          endsOn: null,
        },
        manager,
        'corr-double-bed',
      ),
    ).toThrow('OPS_HOSTEL_BED_UNAVAILABLE');
  });

  it('checks out residents while preserving allocation history', () => {
    const { service } = setup();
    seedHostel(service);
    service.allocateBed(
      {
        id: 'allocation-1',
        bedId: 'bed-1',
        residentRef: 'sis-student-1',
        guardianRef: 'sis-guardian-1',
        medicalNoteRef: null,
        startsOn: '2026-07-01',
        endsOn: null,
      },
      manager,
      'corr-allocation',
    );
    const ended = service.checkoutResident('allocation-1', '2026-07-31', manager, 'corr-checkout');
    expect(ended.status).toBe('ended');
    expect(service.listHostelAllocations()).toHaveLength(1);
    expect(service.hostelReport('2026-08-01', manager).occupiedBeds).toBe(0);
  });

  it('logs visitors and open safeguarding incidents', () => {
    const { service } = setup();
    seedHostel(service);
    service.allocateBed(
      {
        id: 'allocation-1',
        bedId: 'bed-1',
        residentRef: 'sis-student-1',
        guardianRef: 'sis-guardian-1',
        medicalNoteRef: null,
        startsOn: '2026-07-01',
        endsOn: null,
      },
      manager,
      'corr-allocation',
    );
    service.logVisitor(
      {
        id: 'visitor-1',
        residentRef: 'sis-student-1',
        visitorName: 'Guardian One',
        relationship: 'guardian',
        checkedInAt: '2026-07-28T10:00:00.000Z',
        checkedOutAt: null,
      },
      manager,
      'corr-visitor',
    );
    service.recordHostelIncident(
      {
        id: 'incident-1',
        residentRef: 'sis-student-1',
        category: 'safeguarding',
        severity: 'high',
        occurredAt: '2026-07-28T11:00:00.000Z',
        description: 'Unauthorised attempted collection',
      },
      manager,
      'corr-incident',
    );
    expect(service.hostelReport('2026-07-28', manager)).toMatchObject({
      openVisitors: 1,
      openIncidents: 1,
      openSafeguardingIncidents: 1,
    });
  });

  it('blocks cafeteria orders that conflict with the meal plan allergy profile', () => {
    const { service } = setup();
    seedCafeteria(service);
    service.createMealPlan(
      {
        id: 'plan-1',
        personRef: 'sis-student-1',
        startsOn: '2026-07-01',
        endsOn: '2026-12-31',
        entitledMealTypes: ['breakfast', 'lunch'],
        excludedAllergenCodes: ['MILK'],
        maxMealsPerDay: 2,
        billingMode: 'included',
      },
      manager,
      'corr-plan',
    );
    expect(() =>
      service.placeMealOrder(
        {
          id: 'order-1',
          personRef: 'sis-student-1',
          serviceDate: '2026-07-28',
          mealType: 'breakfast',
          menuItemIds: ['menu-milk'],
        },
        manager,
        'corr-order',
      ),
    ).toThrow('OPS_CAFETERIA_ALLERGEN_CONFLICT:MILK');
  });

  it('orders and idempotently confirms entitled meal service', () => {
    const { service } = setup();
    seedCafeteria(service);
    service.createMealPlan(
      {
        id: 'plan-1',
        personRef: 'sis-student-1',
        startsOn: '2026-07-01',
        endsOn: '2026-12-31',
        entitledMealTypes: ['lunch'],
        excludedAllergenCodes: [],
        maxMealsPerDay: 1,
        billingMode: 'included',
      },
      manager,
      'corr-plan',
    );
    const order = service.placeMealOrder(
      {
        id: 'order-1',
        personRef: 'sis-student-1',
        serviceDate: '2026-07-28',
        mealType: 'lunch',
        menuItemIds: ['menu-rice'],
      },
      manager,
      'corr-order',
    );
    const first = service.confirmMealService(
      {
        id: 'service-1',
        orderId: order.id,
        servedAt: '2026-07-28T12:30:00.000Z',
        idempotencyKey: 'scanner-main:order-1',
      },
      manager,
      'corr-service',
    );
    const replay = service.confirmMealService(
      {
        id: 'service-replay',
        orderId: order.id,
        servedAt: '2026-07-28T12:31:00.000Z',
        idempotencyKey: 'scanner-main:order-1',
      },
      manager,
      'corr-service-replay',
    );
    expect(replay.id).toBe(first.id);
    expect(service.cafeteriaReport('2026-07-28', manager)).toMatchObject({
      orders: 1,
      servedOrders: 1,
      unservedOrders: 0,
      uptakeBasisPoints: 10_000,
    });
  });

  it('exports pay-per-meal charges through an immutable FIN source contract', () => {
    const { service, charges } = setup();
    seedCafeteria(service);
    service.createMealPlan(
      {
        id: 'plan-1',
        personRef: 'sis-student-1',
        startsOn: '2026-07-01',
        endsOn: '2026-12-31',
        entitledMealTypes: ['lunch'],
        excludedAllergenCodes: [],
        maxMealsPerDay: 1,
        billingMode: 'pay-per-meal',
      },
      manager,
      'corr-plan',
    );
    service.placeMealOrder(
      {
        id: 'order-1',
        personRef: 'sis-student-1',
        serviceDate: '2026-07-28',
        mealType: 'lunch',
        menuItemIds: ['menu-rice'],
      },
      manager,
      'corr-order',
    );
    expect(charges.documents).toHaveLength(1);
    expect(charges.documents[0]).toMatchObject({
      sourceType: 'cafeteria-meal',
      personRef: 'sis-student-1',
      amountMinor: 150,
      currency: 'BDT',
    });
  });

  it('reports menus, active plans, orders and service uptake', () => {
    const { service } = setup();
    seedCafeteria(service);
    service.createMealPlan(
      {
        id: 'plan-1',
        personRef: 'sis-student-1',
        startsOn: '2026-07-01',
        endsOn: '2026-12-31',
        entitledMealTypes: ['lunch'],
        excludedAllergenCodes: [],
        maxMealsPerDay: 1,
        billingMode: 'included',
      },
      manager,
      'corr-plan',
    );
    expect(service.cafeteriaReport('2026-07-28', manager)).toEqual({
      activeMenuItems: 2,
      activeMealPlans: 1,
      orders: 0,
      servedOrders: 0,
      unservedOrders: 0,
      uptakeBasisPoints: 0,
      chargeableMinor: 0,
      allergenMenuItemIds: ['menu-milk'],
    });
  });
});
