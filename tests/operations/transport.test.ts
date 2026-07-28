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
  );
}

function seed(service: TransportService, capacity = 2): void {
  service.registerVehicle(
    {
      id: 'vehicle-1',
      registrationNumber: 'DHAKA-METRO-11-1111',
      capacity,
      make: 'Toyota',
      model: 'Coaster',
      year: 2024,
      status: 'active',
      nextInspectionOn: '2026-12-01',
    },
    operator,
    'corr-vehicle',
  );
  service.registerDriver(
    {
      id: 'driver-1',
      staffRef: 'staff-driver-1',
      licenceNumber: 'DL-001',
      licenceExpiresOn: '2027-01-01',
      active: true,
    },
    operator,
    'corr-driver',
  );
  service.createRoute(
    {
      id: 'route-1',
      code: 'R-01',
      name: 'North Route',
      direction: 'inbound',
      stops: [
        { id: 'stop-1', name: 'North Gate', sequence: 1, scheduledOffsetMinutes: 0 },
        { id: 'stop-2', name: 'Central Road', sequence: 2, scheduledOffsetMinutes: 15 },
        { id: 'stop-school', name: 'School', sequence: 3, scheduledOffsetMinutes: 30 },
      ],
      active: true,
    },
    operator,
    'corr-route',
  );
}

describe('OPS transport', () => {
  it('registers vehicles, licensed drivers and ordered route stops', () => {
    const service = setup();
    seed(service);
    expect(service.findVehicle('vehicle-1')).toMatchObject({ capacity: 2, status: 'active' });
    expect(service.findDriver('driver-1')).toMatchObject({ staffRef: 'staff-driver-1' });
    expect(service.findRoute('route-1')?.stops.map((stop) => stop.sequence)).toEqual([1, 2, 3]);
  });

  it('enforces route capacity for opaque SIS rider assignments', () => {
    const service = setup();
    seed(service, 1);
    service.assignRider(
      {
        id: 'assignment-1',
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        riderRef: 'sis-student-1',
        guardianRef: 'sis-guardian-1',
        pickupStopId: 'stop-1',
        dropoffStopId: 'stop-school',
        effectiveFrom: '2026-07-01',
        effectiveTo: null,
      },
      operator,
      'corr-assignment-1',
    );
    expect(() =>
      service.assignRider(
        {
          id: 'assignment-2',
          routeId: 'route-1',
          vehicleId: 'vehicle-1',
          riderRef: 'sis-student-2',
          guardianRef: 'sis-guardian-2',
          pickupStopId: 'stop-1',
          dropoffStopId: 'stop-school',
          effectiveFrom: '2026-07-01',
          effectiveTo: null,
        },
        operator,
        'corr-assignment-2',
      ),
    ).toThrow('OPS_TRANSPORT_CAPACITY_EXCEEDED');
  });

  it('runs a trip and reconciles boarding/alighting attendance', () => {
    const service = setup();
    seed(service);
    service.assignRider(
      {
        id: 'assignment-1',
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        riderRef: 'sis-student-1',
        guardianRef: 'sis-guardian-1',
        pickupStopId: 'stop-1',
        dropoffStopId: 'stop-school',
        effectiveFrom: '2026-07-01',
        effectiveTo: null,
      },
      operator,
      'corr-assignment',
    );
    const trip = service.startTrip(
      {
        id: 'trip-1',
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        serviceDate: '2026-07-28',
        startedAt: '2026-07-28T06:30:00.000Z',
      },
      operator,
      'corr-trip-start',
    );
    service.recordRiderEvent(
      {
        id: 'event-1',
        tripId: trip.id,
        riderRef: 'sis-student-1',
        stopId: 'stop-1',
        eventType: 'boarded',
        occurredAt: '2026-07-28T06:31:00.000Z',
      },
      operator,
      'corr-board',
    );
    service.recordRiderEvent(
      {
        id: 'event-2',
        tripId: trip.id,
        riderRef: 'sis-student-1',
        stopId: 'stop-school',
        eventType: 'alighted',
        occurredAt: '2026-07-28T07:00:00.000Z',
      },
      operator,
      'corr-alight',
    );
    const completed = service.completeTrip(
      trip.id,
      '2026-07-28T07:05:00.000Z',
      operator,
      'corr-complete',
    );
    expect(completed.status).toBe('completed');
    expect(completed.unreconciledRiderRefs).toEqual([]);
  });

  it('blocks completion and raises a safeguarding exception when a rider has not alighted', () => {
    const service = setup();
    seed(service);
    service.assignRider(
      {
        id: 'assignment-1',
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        riderRef: 'sis-student-1',
        guardianRef: 'sis-guardian-1',
        pickupStopId: 'stop-1',
        dropoffStopId: 'stop-school',
        effectiveFrom: '2026-07-01',
        effectiveTo: null,
      },
      operator,
      'corr-assignment',
    );
    service.startTrip(
      {
        id: 'trip-1',
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        serviceDate: '2026-07-28',
        startedAt: '2026-07-28T06:30:00.000Z',
      },
      operator,
      'corr-trip-start',
    );
    service.recordRiderEvent(
      {
        id: 'event-1',
        tripId: 'trip-1',
        riderRef: 'sis-student-1',
        stopId: 'stop-1',
        eventType: 'boarded',
        occurredAt: '2026-07-28T06:31:00.000Z',
      },
      operator,
      'corr-board',
    );
    expect(() =>
      service.completeTrip('trip-1', '2026-07-28T07:05:00.000Z', operator, 'corr-complete'),
    ).toThrow('OPS_TRANSPORT_UNRECONCILED_RIDERS:sis-student-1');
    expect(service.transportReport('2026-07-28', operator).openSafeguardingExceptions).toBe(1);
  });

  it('records incidents and maintenance, blocking an unavailable vehicle from trips', () => {
    const service = setup();
    seed(service);
    service.recordIncident(
      {
        id: 'incident-1',
        vehicleId: 'vehicle-1',
        tripId: null,
        severity: 'high',
        occurredAt: '2026-07-28T12:00:00.000Z',
        description: 'Brake warning light',
        personsInvolvedRefs: [],
      },
      operator,
      'corr-incident',
    );
    service.scheduleMaintenance(
      {
        id: 'maintenance-1',
        vehicleId: 'vehicle-1',
        scheduledOn: '2026-07-29',
        completedOn: null,
        description: 'Brake inspection',
        supplierRef: 'supplier-garage',
        costMinor: 0,
      },
      operator,
      'corr-maintenance',
    );
    expect(() =>
      service.startTrip(
        {
          id: 'trip-1',
          routeId: 'route-1',
          vehicleId: 'vehicle-1',
          driverId: 'driver-1',
          serviceDate: '2026-07-29',
          startedAt: '2026-07-29T06:30:00.000Z',
        },
        operator,
        'corr-trip-start',
      ),
    ).toThrow('OPS_TRANSPORT_VEHICLE_UNAVAILABLE');
  });

  it('reports capacity utilisation, active trips, incidents and inspection exceptions', () => {
    const service = setup();
    seed(service, 2);
    service.assignRider(
      {
        id: 'assignment-1',
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        riderRef: 'sis-student-1',
        guardianRef: 'sis-guardian-1',
        pickupStopId: 'stop-1',
        dropoffStopId: 'stop-school',
        effectiveFrom: '2026-07-01',
        effectiveTo: null,
      },
      operator,
      'corr-assignment',
    );
    expect(service.transportReport('2026-07-28', operator)).toEqual({
      activeVehicles: 1,
      activeRoutes: 1,
      activeAssignments: 1,
      capacitySeats: 2,
      assignedSeats: 1,
      utilisationBasisPoints: 5_000,
      activeTrips: 0,
      completedTrips: 0,
      openIncidents: 0,
      openSafeguardingExceptions: 0,
      inspectionDueVehicleIds: [],
    });
  });
});
