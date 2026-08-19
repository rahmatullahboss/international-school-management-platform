import { describe, expect, it } from 'vitest';

import {
  InMemoryOperationsAuditWriter,
  InMemoryOperationsEventPublisher,
  type OperationsPrincipal,
} from '../../packages/modules/hr/src/index.js';
import { TransportService } from '../../packages/modules/transport/src/index.js';

const scope = { tenantId: 'tenant-ops', legalEntityId: 'entity-school', campusId: 'campus-main' };
const operator: OperationsPrincipal = {
  principalId: 'transport-manager',
  tenantId: scope.tenantId,
  campusIds: [scope.campusId],
  assurance: 'aal2',
  permissions: [
    'operations.transport.vehicle.write',
    'operations.transport.driver.write',
    'operations.transport.route.write',
    'operations.transport.assignment.write',
    'operations.transport.trip.write',
    'operations.transport.attendance.write',
    'operations.transport.incident.write',
    'operations.transport.maintenance.write',
    'operations.transport.report.read',
  ],
};

function setup(): TransportService {
  return new TransportService(
    scope,
    new InMemoryOperationsEventPublisher(),
    new InMemoryOperationsAuditWriter(),
    { now: () => new Date('2026-08-19T00:00:00.000Z') },
  );
}

function registerVehicle(
  service: TransportService,
  id = 'vehicle-1',
  registrationNumber = 'DHAKA-METRO-11-1111',
  overrides: Partial<Parameters<TransportService['registerVehicle']>[0]> = {},
) {
  return service.registerVehicle(
    {
      id,
      registrationNumber,
      capacity: 2,
      make: 'Toyota',
      model: 'Coaster',
      year: 2024,
      status: 'active',
      nextInspectionOn: '2026-12-01',
      ...overrides,
    },
    operator,
    `corr-${id}`,
  );
}

function registerDriver(
  service: TransportService,
  id = 'driver-1',
  licenceNumber = 'DL-001',
  overrides: Partial<Parameters<TransportService['registerDriver']>[0]> = {},
) {
  return service.registerDriver(
    {
      id,
      staffRef: `staff-${id}`,
      licenceNumber,
      licenceExpiresOn: '2027-01-01',
      active: true,
      ...overrides,
    },
    operator,
    `corr-${id}`,
  );
}

function createRoute(
  service: TransportService,
  id = 'route-1',
  code = 'R-01',
  overrides: Partial<Parameters<TransportService['createRoute']>[0]> = {},
) {
  return service.createRoute(
    {
      id,
      code,
      name: `Route ${id}`,
      direction: 'inbound',
      stops: [
        { id: `${id}-stop-1`, name: 'North Gate', sequence: 1, scheduledOffsetMinutes: 0 },
        { id: `${id}-stop-2`, name: 'Central Road', sequence: 2, scheduledOffsetMinutes: 15 },
        { id: `${id}-school`, name: 'School', sequence: 3, scheduledOffsetMinutes: 30 },
      ],
      active: true,
      ...overrides,
    },
    operator,
    `corr-${id}`,
  );
}

function seed(service: TransportService): void {
  registerVehicle(service);
  registerDriver(service);
  createRoute(service);
}

function assignRider(
  service: TransportService,
  id = 'assignment-1',
  riderRef = 'student-1',
  overrides: Partial<Parameters<TransportService['assignRider']>[0]> = {},
) {
  return service.assignRider(
    {
      id,
      routeId: 'route-1',
      vehicleId: 'vehicle-1',
      riderRef,
      guardianRef: `guardian-${riderRef}`,
      pickupStopId: 'route-1-stop-1',
      dropoffStopId: 'route-1-school',
      effectiveFrom: '2026-08-01',
      effectiveTo: null,
      ...overrides,
    },
    operator,
    `corr-${id}`,
  );
}

function startTrip(
  service: TransportService,
  id = 'trip-1',
  overrides: Partial<Parameters<TransportService['startTrip']>[0]> = {},
) {
  return service.startTrip(
    {
      id,
      routeId: 'route-1',
      vehicleId: 'vehicle-1',
      driverId: 'driver-1',
      serviceDate: '2026-08-19',
      startedAt: '2026-08-19T06:30:00.000Z',
      ...overrides,
    },
    operator,
    `corr-${id}`,
  );
}

describe('transport integrity boundaries', () => {
  it('rejects malformed or duplicate vehicle, driver and route identities', () => {
    const service = setup();

    expect(() => registerVehicle(service, 'vehicle-capacity', 'REG-CAP', { capacity: 0 })).toThrow(
      'OPS_INVALID_VEHICLE_CAPACITY',
    );
    expect(() => registerVehicle(service, 'vehicle-year', 'REG-YEAR', { year: 1899 })).toThrow(
      'OPS_INVALID_VEHICLE_YEAR',
    );
    registerVehicle(service);
    expect(() => registerVehicle(service, 'vehicle-2', ' dhaka-metro-11-1111 ')).toThrow(
      'OPS_DUPLICATE_VEHICLE',
    );

    registerDriver(service);
    expect(() => registerDriver(service, 'driver-2', ' dl-001 ')).toThrow('OPS_DUPLICATE_DRIVER');

    expect(() => createRoute(service, 'route-short', 'R-SHORT', { stops: [] })).toThrow(
      'OPS_TRANSPORT_ROUTE_STOPS_REQUIRED',
    );
    expect(() =>
      createRoute(service, 'route-sequence', 'R-SEQ', {
        stops: [
          { id: 's1', name: 'One', sequence: 1, scheduledOffsetMinutes: 0 },
          { id: 's2', name: 'Two', sequence: 3, scheduledOffsetMinutes: 10 },
        ],
      }),
    ).toThrow('OPS_TRANSPORT_INVALID_STOP_SEQUENCE');
    expect(() =>
      createRoute(service, 'route-offset', 'R-OFF', {
        stops: [
          { id: 's1', name: 'One', sequence: 1, scheduledOffsetMinutes: 5 },
          { id: 's2', name: 'Two', sequence: 2, scheduledOffsetMinutes: 5 },
        ],
      }),
    ).toThrow('OPS_TRANSPORT_INVALID_STOP_OFFSET');
    createRoute(service);
    expect(() => createRoute(service, 'route-2', ' r-01 ')).toThrow(
      'OPS_DUPLICATE_TRANSPORT_ROUTE',
    );
  });

  it('validates rider effective periods, ordered stops and overlapping assignments', () => {
    const service = setup();
    seed(service);

    expect(() =>
      assignRider(service, 'assignment-date', 'student-date', {
        effectiveFrom: '2026-08-20',
        effectiveTo: '2026-08-19',
      }),
    ).toThrow('OPS_INVALID_DATE_RANGE');
    expect(() =>
      assignRider(service, 'assignment-stops', 'student-stops', {
        pickupStopId: 'route-1-school',
        dropoffStopId: 'route-1-stop-1',
      }),
    ).toThrow('OPS_TRANSPORT_INVALID_RIDER_STOPS');

    const first = assignRider(service, 'assignment-1', 'student-1', { effectiveTo: '2026-08-31' });
    expect(() => assignRider(service, first.id, 'student-2')).toThrow(
      'OPS_DUPLICATE_RIDER_ASSIGNMENT',
    );
    expect(() =>
      assignRider(service, 'assignment-overlap', 'student-1', {
        effectiveFrom: '2026-08-15',
        effectiveTo: '2026-09-15',
      }),
    ).toThrow('OPS_DUPLICATE_RIDER_ASSIGNMENT');
    expect(
      assignRider(service, 'assignment-later', 'student-1', {
        effectiveFrom: '2026-09-01',
        effectiveTo: null,
      }).riderRef,
    ).toBe('student-1');
  });

  it('fails trip start closed for inactive routes, vehicle readiness, driver validity and resource conflicts', () => {
    const inactiveRoute = setup();
    registerVehicle(inactiveRoute);
    registerDriver(inactiveRoute);
    createRoute(inactiveRoute, 'route-1', 'R-01', { active: false });
    expect(() => startTrip(inactiveRoute)).toThrow('OPS_TRANSPORT_ROUTE_INACTIVE');

    const inspection = setup();
    registerVehicle(inspection, 'vehicle-1', 'REG-INSPECTION', { nextInspectionOn: '2026-08-18' });
    registerDriver(inspection);
    createRoute(inspection);
    expect(() => startTrip(inspection)).toThrow('OPS_TRANSPORT_VEHICLE_UNAVAILABLE');

    const driverInactive = setup();
    registerVehicle(driverInactive);
    registerDriver(driverInactive, 'driver-1', 'DL-INACTIVE', { active: false });
    createRoute(driverInactive);
    expect(() => startTrip(driverInactive)).toThrow('OPS_TRANSPORT_DRIVER_UNAVAILABLE');

    const driverExpired = setup();
    registerVehicle(driverExpired);
    registerDriver(driverExpired, 'driver-1', 'DL-EXPIRED', { licenceExpiresOn: '2026-08-18' });
    createRoute(driverExpired);
    expect(() => startTrip(driverExpired)).toThrow('OPS_TRANSPORT_DRIVER_UNAVAILABLE');

    const conflict = setup();
    seed(conflict);
    startTrip(conflict, 'trip-1');
    expect(() => startTrip(conflict, 'trip-1')).toThrow('OPS_DUPLICATE_TRANSPORT_TRIP');
    expect(() => startTrip(conflict, 'trip-2')).toThrow('OPS_TRANSPORT_RESOURCE_CONFLICT');
  });

  it('enforces the rider-event state machine and active assignment scope', () => {
    const service = setup();
    seed(service);
    assignRider(service);
    startTrip(service);

    expect(() =>
      service.recordRiderEvent(
        {
          id: 'event-invalid-stop',
          tripId: 'trip-1',
          riderRef: 'student-1',
          stopId: 'not-on-route',
          eventType: 'boarded',
          occurredAt: '2026-08-19T06:31:00.000Z',
        },
        operator,
        'corr-invalid-stop',
      ),
    ).toThrow('OPS_TRANSPORT_STOP_NOT_ON_ROUTE');
    expect(() =>
      service.recordRiderEvent(
        {
          id: 'event-unassigned',
          tripId: 'trip-1',
          riderRef: 'student-2',
          stopId: 'route-1-stop-1',
          eventType: 'boarded',
          occurredAt: '2026-08-19T06:31:00.000Z',
        },
        operator,
        'corr-unassigned',
      ),
    ).toThrow('OPS_TRANSPORT_RIDER_NOT_ASSIGNED');
    expect(() =>
      service.recordRiderEvent(
        {
          id: 'event-alight-first',
          tripId: 'trip-1',
          riderRef: 'student-1',
          stopId: 'route-1-school',
          eventType: 'alighted',
          occurredAt: '2026-08-19T06:32:00.000Z',
        },
        operator,
        'corr-alight-first',
      ),
    ).toThrow('OPS_TRANSPORT_INVALID_ALIGHT_EVENT');

    service.recordRiderEvent(
      {
        id: 'event-board',
        tripId: 'trip-1',
        riderRef: 'student-1',
        stopId: 'route-1-stop-1',
        eventType: 'boarded',
        occurredAt: '2026-08-19T06:33:00.000Z',
      },
      operator,
      'corr-board',
    );
    expect(() =>
      service.recordRiderEvent(
        {
          id: 'event-board-2',
          tripId: 'trip-1',
          riderRef: 'student-1',
          stopId: 'route-1-stop-1',
          eventType: 'boarded',
          occurredAt: '2026-08-19T06:34:00.000Z',
        },
        operator,
        'corr-board-2',
      ),
    ).toThrow('OPS_TRANSPORT_RIDER_ALREADY_BOARDED');
    service.recordRiderEvent(
      {
        id: 'event-alight',
        tripId: 'trip-1',
        riderRef: 'student-1',
        stopId: 'route-1-school',
        eventType: 'alighted',
        occurredAt: '2026-08-19T07:00:00.000Z',
      },
      operator,
      'corr-alight',
    );
    expect(() =>
      service.recordRiderEvent(
        {
          id: 'event-alight-2',
          tripId: 'trip-1',
          riderRef: 'student-1',
          stopId: 'route-1-school',
          eventType: 'alighted',
          occurredAt: '2026-08-19T07:01:00.000Z',
        },
        operator,
        'corr-alight-2',
      ),
    ).toThrow('OPS_TRANSPORT_INVALID_ALIGHT_EVENT');

    const completed = service.completeTrip(
      'trip-1',
      '2026-08-19T07:05:00.000Z',
      operator,
      'corr-complete',
    );
    expect(() =>
      service.recordRiderEvent(
        {
          id: 'event-after-complete',
          tripId: completed.id,
          riderRef: 'student-1',
          stopId: 'route-1-school',
          eventType: 'absent',
          occurredAt: '2026-08-19T07:06:00.000Z',
        },
        operator,
        'corr-after-complete',
      ),
    ).toThrow('OPS_TRANSPORT_TRIP_NOT_ACTIVE');
  });

  it('rejects invalid completion timestamps and makes successful completion idempotent', () => {
    const service = setup();
    seed(service);
    const trip = startTrip(service);

    expect(() =>
      service.completeTrip(trip.id, '2026-08-19T06:29:59.000Z', operator, 'corr-too-early'),
    ).toThrow('OPS_INVALID_TIMESTAMP_ORDER');
    const completed = service.completeTrip(
      trip.id,
      '2026-08-19T07:05:00.000Z',
      operator,
      'corr-complete',
    );
    expect(completed.status).toBe('completed');
    expect(
      service.completeTrip(trip.id, '2026-08-19T07:10:00.000Z', operator, 'corr-replay'),
    ).toEqual(completed);
  });

  it('validates incident and maintenance evidence and reports inactive capacity safely', () => {
    const service = setup();
    registerVehicle(service, 'vehicle-1', 'REG-1', { status: 'inactive' });
    registerDriver(service);
    createRoute(service, 'route-1', 'R-01', { active: false });

    expect(() =>
      service.recordIncident(
        {
          id: 'incident-short',
          vehicleId: 'vehicle-1',
          tripId: null,
          severity: 'low',
          occurredAt: '2026-08-19T12:00:00.000Z',
          description: 'bad',
          personsInvolvedRefs: [],
        },
        operator,
        'corr-incident-short',
      ),
    ).toThrow('OPS_TRANSPORT_INCIDENT_DESCRIPTION_REQUIRED');
    service.recordIncident(
      {
        id: 'incident-1',
        vehicleId: 'vehicle-1',
        tripId: null,
        severity: 'high',
        occurredAt: '2026-08-19T12:00:00.000Z',
        description: 'Operational warning recorded',
        personsInvolvedRefs: ['staff-1'],
      },
      operator,
      'corr-incident-1',
    );
    expect(() =>
      service.recordIncident(
        {
          id: 'incident-1',
          vehicleId: 'vehicle-1',
          tripId: null,
          severity: 'high',
          occurredAt: '2026-08-19T12:01:00.000Z',
          description: 'Duplicate operational warning',
          personsInvolvedRefs: [],
        },
        operator,
        'corr-incident-duplicate',
      ),
    ).toThrow('OPS_DUPLICATE_TRANSPORT_INCIDENT');

    expect(() =>
      service.scheduleMaintenance(
        {
          id: 'maintenance-date',
          vehicleId: 'vehicle-1',
          scheduledOn: '2026-08-20',
          completedOn: '2026-08-19',
          description: 'Completed before scheduled',
          supplierRef: 'garage-1',
          costMinor: 0,
        },
        operator,
        'corr-maintenance-date',
      ),
    ).toThrow('OPS_INVALID_DATE_RANGE');
    expect(() =>
      service.scheduleMaintenance(
        {
          id: 'maintenance-cost',
          vehicleId: 'vehicle-1',
          scheduledOn: '2026-08-20',
          completedOn: null,
          description: 'Invalid negative cost',
          supplierRef: 'garage-1',
          costMinor: -1,
        },
        operator,
        'corr-maintenance-cost',
      ),
    ).toThrow('OPS_INVALID_MONEY:vehicleMaintenance.costMinor');
    const maintenance = service.scheduleMaintenance(
      {
        id: 'maintenance-1',
        vehicleId: 'vehicle-1',
        scheduledOn: '2026-08-20',
        completedOn: '2026-08-21',
        description: 'Completed inspection',
        supplierRef: 'garage-1',
        costMinor: 1_000,
      },
      operator,
      'corr-maintenance-1',
    );
    expect(maintenance.completedOn).toBe('2026-08-21');
    expect(() =>
      service.scheduleMaintenance(
        {
          ...maintenance,
          completedOn: '2026-08-22',
        },
        operator,
        'corr-maintenance-duplicate',
      ),
    ).toThrow('OPS_DUPLICATE_VEHICLE_MAINTENANCE');

    expect(service.transportReport('2026-12-02', operator)).toMatchObject({
      activeVehicles: 0,
      activeRoutes: 0,
      activeAssignments: 0,
      capacitySeats: 0,
      assignedSeats: 0,
      utilisationBasisPoints: 0,
      openIncidents: 1,
      inspectionDueVehicleIds: ['vehicle-1'],
    });
    expect(service.findVehicle('missing')).toBeUndefined();
    expect(service.findDriver('missing')).toBeUndefined();
    expect(service.findRoute('missing')).toBeUndefined();
  });
});
