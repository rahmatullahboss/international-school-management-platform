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

export type VehicleStatus = 'active' | 'maintenance' | 'inactive';
export type RouteDirection = 'inbound' | 'outbound';
export type TripStatus = 'in-progress' | 'completed' | 'cancelled';
export type RiderEventType = 'boarded' | 'alighted' | 'absent';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'resolved';

export interface VehicleInput {
  readonly id: string;
  readonly registrationNumber: string;
  readonly capacity: number;
  readonly make: string;
  readonly model: string;
  readonly year: number;
  readonly status: VehicleStatus;
  readonly nextInspectionOn: string;
}
export interface Vehicle extends VehicleInput {
  readonly version: number;
  readonly createdAt: string;
}

export interface DriverInput {
  readonly id: string;
  readonly staffRef: string;
  readonly licenceNumber: string;
  readonly licenceExpiresOn: string;
  readonly active: boolean;
}
export interface Driver extends DriverInput {
  readonly version: number;
  readonly createdAt: string;
}

export interface RouteStop {
  readonly id: string;
  readonly name: string;
  readonly sequence: number;
  readonly scheduledOffsetMinutes: number;
}
export interface RouteInput {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly direction: RouteDirection;
  readonly stops: readonly RouteStop[];
  readonly active: boolean;
}
export interface Route extends Omit<RouteInput, 'stops'> {
  readonly stops: readonly RouteStop[];
  readonly version: number;
  readonly createdAt: string;
}

export interface RiderAssignmentInput {
  readonly id: string;
  readonly routeId: string;
  readonly vehicleId: string;
  readonly riderRef: string;
  readonly guardianRef: string;
  readonly pickupStopId: string;
  readonly dropoffStopId: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
}
export interface RiderAssignment extends RiderAssignmentInput {
  readonly version: number;
  readonly createdAt: string;
}

export interface TripInput {
  readonly id: string;
  readonly routeId: string;
  readonly vehicleId: string;
  readonly driverId: string;
  readonly serviceDate: string;
  readonly startedAt: string;
}
export interface TripRun extends TripInput {
  readonly status: TripStatus;
  readonly completedAt: string | null;
  readonly unreconciledRiderRefs: readonly string[];
  readonly version: number;
  readonly startedBy: string;
}

export interface RiderEventInput {
  readonly id: string;
  readonly tripId: string;
  readonly riderRef: string;
  readonly stopId: string;
  readonly eventType: RiderEventType;
  readonly occurredAt: string;
}
export interface RiderEvent extends RiderEventInput {
  readonly recordedBy: string;
  readonly version: number;
}

export interface TransportIncidentInput {
  readonly id: string;
  readonly vehicleId: string;
  readonly tripId: string | null;
  readonly severity: IncidentSeverity;
  readonly occurredAt: string;
  readonly description: string;
  readonly personsInvolvedRefs: readonly string[];
}
export interface TransportIncident extends TransportIncidentInput {
  readonly category: 'operational' | 'safeguarding';
  readonly status: IncidentStatus;
  readonly recordedBy: string;
  readonly resolvedAt: string | null;
  readonly version: number;
}

export interface VehicleMaintenanceInput {
  readonly id: string;
  readonly vehicleId: string;
  readonly scheduledOn: string;
  readonly completedOn: string | null;
  readonly description: string;
  readonly supplierRef: string;
  readonly costMinor: number;
}
export interface VehicleMaintenance extends VehicleMaintenanceInput {
  readonly recordedBy: string;
  readonly version: number;
  readonly createdAt: string;
}

export interface TransportReport {
  readonly activeVehicles: number;
  readonly activeRoutes: number;
  readonly activeAssignments: number;
  readonly capacitySeats: number;
  readonly assignedSeats: number;
  readonly utilisationBasisPoints: number;
  readonly activeTrips: number;
  readonly completedTrips: number;
  readonly openIncidents: number;
  readonly openSafeguardingExceptions: number;
  readonly inspectionDueVehicleIds: readonly string[];
}

interface Clock {
  now(): Date;
}
const systemClock: Clock = { now: () => new Date() };
function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}
function timestamp(value: string, field: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`OPS_INVALID_TIMESTAMP:${field}`);
  return date.toISOString();
}
function activeOn(
  value: { readonly effectiveFrom: string; readonly effectiveTo: string | null },
  date: string,
): boolean {
  return value.effectiveFrom <= date && (value.effectiveTo === null || value.effectiveTo >= date);
}

export class TransportService {
  readonly #scope: OperationsScope;
  readonly #events: OperationsEventPublisher;
  readonly #audit: OperationsAuditWriter;
  readonly #clock: Clock;
  readonly #vehicles = new Map<string, Vehicle>();
  readonly #registrationNumbers = new Set<string>();
  readonly #drivers = new Map<string, Driver>();
  readonly #licences = new Set<string>();
  readonly #routes = new Map<string, Route>();
  readonly #routeCodes = new Set<string>();
  readonly #assignments = new Map<string, RiderAssignment>();
  readonly #trips = new Map<string, TripRun>();
  readonly #riderEvents = new Map<string, RiderEvent>();
  readonly #incidents = new Map<string, TransportIncident>();
  readonly #maintenance = new Map<string, VehicleMaintenance>();

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

  registerVehicle(
    input: VehicleInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): Vehicle {
    authorizeOperations(principal, 'operations.transport.vehicle.write', this.#scope);
    this.#correlation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      registrationNumber: input.registrationNumber,
      make: input.make,
      model: input.model,
    })) {
      assertIdentifier(value, `vehicle.${field}`);
    }
    assertDate(input.nextInspectionOn, 'vehicle.nextInspectionOn');
    if (!Number.isInteger(input.capacity) || input.capacity <= 0) {
      throw new Error('OPS_INVALID_VEHICLE_CAPACITY');
    }
    if (!Number.isInteger(input.year) || input.year < 1900 || input.year > 9999) {
      throw new Error('OPS_INVALID_VEHICLE_YEAR');
    }
    const registrationNumber = input.registrationNumber.trim().toUpperCase();
    if (this.#vehicles.has(input.id) || this.#registrationNumbers.has(registrationNumber)) {
      throw new Error('OPS_DUPLICATE_VEHICLE');
    }
    const vehicle: Vehicle = frozen({
      ...input,
      registrationNumber,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#vehicles.set(vehicle.id, vehicle);
    this.#registrationNumbers.add(vehicle.registrationNumber);
    this.#record(
      'operations.transport.vehicle-registered.v1',
      'transport-vehicle',
      vehicle.id,
      1,
      'operations.transport.vehicle.register',
      principal,
      correlationId,
      { registrationNumber, capacity: vehicle.capacity },
    );
    return vehicle;
  }

  registerDriver(
    input: DriverInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): Driver {
    authorizeOperations(principal, 'operations.transport.driver.write', this.#scope);
    this.#correlation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      staffRef: input.staffRef,
      licenceNumber: input.licenceNumber,
    })) {
      assertIdentifier(value, `driver.${field}`);
    }
    assertDate(input.licenceExpiresOn, 'driver.licenceExpiresOn');
    const licenceNumber = input.licenceNumber.trim().toUpperCase();
    if (this.#drivers.has(input.id) || this.#licences.has(licenceNumber)) {
      throw new Error('OPS_DUPLICATE_DRIVER');
    }
    const driver: Driver = frozen({
      ...input,
      licenceNumber,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#drivers.set(driver.id, driver);
    this.#licences.add(driver.licenceNumber);
    this.#record(
      'operations.transport.driver-registered.v1',
      'transport-driver',
      driver.id,
      1,
      'operations.transport.driver.register',
      principal,
      correlationId,
      { staffRef: driver.staffRef, licenceExpiresOn: driver.licenceExpiresOn },
    );
    return driver;
  }

  createRoute(input: RouteInput, principal: OperationsPrincipal, correlationId: string): Route {
    authorizeOperations(principal, 'operations.transport.route.write', this.#scope);
    this.#correlation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      code: input.code,
      name: input.name,
    })) {
      assertIdentifier(value, `route.${field}`);
    }
    if (input.stops.length < 2) throw new Error('OPS_TRANSPORT_ROUTE_STOPS_REQUIRED');
    const sorted = [...input.stops].sort((left, right) => left.sequence - right.sequence);
    const stopIds = new Set<string>();
    sorted.forEach((stop, index) => {
      assertIdentifier(stop.id, 'routeStop.id');
      assertIdentifier(stop.name, 'routeStop.name');
      if (stopIds.has(stop.id) || stop.sequence !== index + 1) {
        throw new Error('OPS_TRANSPORT_INVALID_STOP_SEQUENCE');
      }
      if (!Number.isInteger(stop.scheduledOffsetMinutes) || stop.scheduledOffsetMinutes < 0) {
        throw new Error('OPS_TRANSPORT_INVALID_STOP_OFFSET');
      }
      if (index > 0 && stop.scheduledOffsetMinutes <= sorted[index - 1]!.scheduledOffsetMinutes) {
        throw new Error('OPS_TRANSPORT_INVALID_STOP_OFFSET');
      }
      stopIds.add(stop.id);
    });
    const code = input.code.trim().toUpperCase();
    if (this.#routes.has(input.id) || this.#routeCodes.has(code)) {
      throw new Error('OPS_DUPLICATE_TRANSPORT_ROUTE');
    }
    const route: Route = frozen({
      ...input,
      code,
      stops: Object.freeze(sorted.map((stop) => frozen(stop))),
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#routes.set(route.id, route);
    this.#routeCodes.add(route.code);
    this.#record(
      'operations.transport.route-created.v1',
      'transport-route',
      route.id,
      1,
      'operations.transport.route.create',
      principal,
      correlationId,
      { code, stopCount: route.stops.length },
    );
    return route;
  }

  assignRider(
    input: RiderAssignmentInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): RiderAssignment {
    authorizeOperations(principal, 'operations.transport.assignment.write', this.#scope);
    this.#correlation(correlationId);
    const route = this.#requireRoute(input.routeId);
    const vehicle = this.#requireVehicle(input.vehicleId);
    for (const [field, value] of Object.entries({
      id: input.id,
      riderRef: input.riderRef,
      guardianRef: input.guardianRef,
    })) {
      assertIdentifier(value, `riderAssignment.${field}`);
    }
    assertDate(input.effectiveFrom, 'riderAssignment.effectiveFrom');
    if (input.effectiveTo !== null) {
      assertDate(input.effectiveTo, 'riderAssignment.effectiveTo');
      if (input.effectiveTo < input.effectiveFrom) throw new Error('OPS_INVALID_DATE_RANGE');
    }
    const pickupIndex = route.stops.findIndex((stop) => stop.id === input.pickupStopId);
    const dropoffIndex = route.stops.findIndex((stop) => stop.id === input.dropoffStopId);
    if (pickupIndex < 0 || dropoffIndex < 0 || pickupIndex >= dropoffIndex) {
      throw new Error('OPS_TRANSPORT_INVALID_RIDER_STOPS');
    }
    if (this.#assignments.has(input.id)) throw new Error('OPS_DUPLICATE_RIDER_ASSIGNMENT');
    if (
      [...this.#assignments.values()].some(
        (assignment) =>
          assignment.riderRef === input.riderRef &&
          assignment.routeId === input.routeId &&
          this.#dateRangesOverlap(assignment, input),
      )
    ) {
      throw new Error('OPS_DUPLICATE_RIDER_ASSIGNMENT');
    }
    const overlappingAssignments = [...this.#assignments.values()].filter(
      (assignment) =>
        assignment.vehicleId === vehicle.id && this.#dateRangesOverlap(assignment, input),
    ).length;
    if (overlappingAssignments >= vehicle.capacity) {
      throw new Error('OPS_TRANSPORT_CAPACITY_EXCEEDED');
    }
    const assignment: RiderAssignment = frozen({
      ...input,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#assignments.set(assignment.id, assignment);
    this.#record(
      'operations.transport.rider-assigned.v1',
      'transport-rider-assignment',
      assignment.id,
      1,
      'operations.transport.assignment.create',
      principal,
      correlationId,
      {
        riderRef: assignment.riderRef,
        routeId: assignment.routeId,
        vehicleId: assignment.vehicleId,
      },
    );
    return assignment;
  }

  startTrip(input: TripInput, principal: OperationsPrincipal, correlationId: string): TripRun {
    authorizeOperations(principal, 'operations.transport.trip.write', this.#scope);
    this.#correlation(correlationId);
    const route = this.#requireRoute(input.routeId);
    const vehicle = this.#requireVehicle(input.vehicleId);
    const driver = this.#requireDriver(input.driverId);
    assertIdentifier(input.id, 'trip.id');
    assertDate(input.serviceDate, 'trip.serviceDate');
    timestamp(input.startedAt, 'trip.startedAt');
    if (!route.active) throw new Error('OPS_TRANSPORT_ROUTE_INACTIVE');
    if (
      vehicle.status !== 'active' ||
      vehicle.nextInspectionOn < input.serviceDate ||
      [...this.#maintenance.values()].some(
        (maintenance) => maintenance.vehicleId === vehicle.id && maintenance.completedOn === null,
      )
    ) {
      throw new Error('OPS_TRANSPORT_VEHICLE_UNAVAILABLE');
    }
    if (!driver.active || driver.licenceExpiresOn < input.serviceDate) {
      throw new Error('OPS_TRANSPORT_DRIVER_UNAVAILABLE');
    }
    if (this.#trips.has(input.id)) throw new Error('OPS_DUPLICATE_TRANSPORT_TRIP');
    if (
      [...this.#trips.values()].some(
        (trip) =>
          trip.serviceDate === input.serviceDate &&
          trip.status === 'in-progress' &&
          (trip.vehicleId === input.vehicleId || trip.driverId === input.driverId),
      )
    ) {
      throw new Error('OPS_TRANSPORT_RESOURCE_CONFLICT');
    }
    const trip: TripRun = frozen({
      ...input,
      startedAt: timestamp(input.startedAt, 'trip.startedAt'),
      status: 'in-progress',
      completedAt: null,
      unreconciledRiderRefs: Object.freeze([]),
      version: 1,
      startedBy: principal.principalId,
    });
    this.#trips.set(trip.id, trip);
    this.#record(
      'operations.transport.trip-started.v1',
      'transport-trip',
      trip.id,
      1,
      'operations.transport.trip.start',
      principal,
      correlationId,
      { routeId: trip.routeId, vehicleId: trip.vehicleId, serviceDate: trip.serviceDate },
    );
    return trip;
  }

  recordRiderEvent(
    input: RiderEventInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): RiderEvent {
    authorizeOperations(principal, 'operations.transport.attendance.write', this.#scope);
    this.#correlation(correlationId);
    const trip = this.#requireTrip(input.tripId);
    if (trip.status !== 'in-progress') throw new Error('OPS_TRANSPORT_TRIP_NOT_ACTIVE');
    const route = this.#requireRoute(trip.routeId);
    if (!route.stops.some((stop) => stop.id === input.stopId)) {
      throw new Error('OPS_TRANSPORT_STOP_NOT_ON_ROUTE');
    }
    const assignment = [...this.#assignments.values()].find(
      (candidate) =>
        candidate.routeId === trip.routeId &&
        candidate.vehicleId === trip.vehicleId &&
        candidate.riderRef === input.riderRef &&
        activeOn(candidate, trip.serviceDate),
    );
    if (!assignment) throw new Error('OPS_TRANSPORT_RIDER_NOT_ASSIGNED');
    assertIdentifier(input.id, 'riderEvent.id');
    timestamp(input.occurredAt, 'riderEvent.occurredAt');
    if (this.#riderEvents.has(input.id)) throw new Error('OPS_DUPLICATE_RIDER_EVENT');
    const events = this.#eventsForRider(trip.id, input.riderRef);
    if (input.eventType === 'boarded' && events.some((event) => event.eventType === 'boarded')) {
      throw new Error('OPS_TRANSPORT_RIDER_ALREADY_BOARDED');
    }
    if (
      input.eventType === 'alighted' &&
      (!events.some((event) => event.eventType === 'boarded') ||
        events.some((event) => event.eventType === 'alighted'))
    ) {
      throw new Error('OPS_TRANSPORT_INVALID_ALIGHT_EVENT');
    }
    const event: RiderEvent = frozen({
      ...input,
      occurredAt: timestamp(input.occurredAt, 'riderEvent.occurredAt'),
      recordedBy: principal.principalId,
      version: 1,
    });
    this.#riderEvents.set(event.id, event);
    this.#record(
      'operations.transport.rider-event-recorded.v1',
      'transport-rider-event',
      event.id,
      1,
      'operations.transport.attendance.record',
      principal,
      correlationId,
      { tripId: event.tripId, riderRef: event.riderRef, eventType: event.eventType },
    );
    return event;
  }

  completeTrip(
    tripId: string,
    completedAt: string,
    principal: OperationsPrincipal,
    correlationId: string,
  ): TripRun {
    authorizeOperations(principal, 'operations.transport.trip.write', this.#scope);
    const trip = this.#requireTrip(tripId);
    if (trip.status === 'completed') return trip;
    if (trip.status !== 'in-progress') throw new Error('OPS_TRANSPORT_TRIP_NOT_ACTIVE');
    const completedTimestamp = timestamp(completedAt, 'trip.completedAt');
    if (completedTimestamp < trip.startedAt) throw new Error('OPS_INVALID_TIMESTAMP_ORDER');
    const boarded = new Set(
      [...this.#riderEvents.values()]
        .filter((event) => event.tripId === trip.id && event.eventType === 'boarded')
        .map((event) => event.riderRef),
    );
    const alighted = new Set(
      [...this.#riderEvents.values()]
        .filter((event) => event.tripId === trip.id && event.eventType === 'alighted')
        .map((event) => event.riderRef),
    );
    const unreconciled = [...boarded].filter((riderRef) => !alighted.has(riderRef)).sort();
    if (unreconciled.length > 0) {
      const incidentId = `safeguarding:${trip.id}`;
      if (!this.#incidents.has(incidentId)) {
        this.#recordIncidentInternal(
          {
            id: incidentId,
            vehicleId: trip.vehicleId,
            tripId: trip.id,
            severity: 'critical',
            occurredAt: completedTimestamp,
            description:
              'Trip completion blocked because boarded riders were not reconciled as alighted',
            personsInvolvedRefs: unreconciled,
          },
          'safeguarding',
          principal,
          correlationId,
        );
      }
      this.#trips.set(
        trip.id,
        frozen({
          ...trip,
          unreconciledRiderRefs: Object.freeze(unreconciled),
          version: trip.version + 1,
        }),
      );
      throw new Error(`OPS_TRANSPORT_UNRECONCILED_RIDERS:${unreconciled.join(',')}`);
    }
    const completed: TripRun = frozen({
      ...trip,
      status: 'completed',
      completedAt: completedTimestamp,
      unreconciledRiderRefs: Object.freeze([]),
      version: trip.version + 1,
    });
    this.#trips.set(completed.id, completed);
    this.#record(
      'operations.transport.trip-completed.v1',
      'transport-trip',
      completed.id,
      completed.version,
      'operations.transport.trip.complete',
      principal,
      correlationId,
      { completedAt: completed.completedAt },
    );
    return completed;
  }

  recordIncident(
    input: TransportIncidentInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): TransportIncident {
    authorizeOperations(principal, 'operations.transport.incident.write', this.#scope);
    return this.#recordIncidentInternal(input, 'operational', principal, correlationId);
  }

  scheduleMaintenance(
    input: VehicleMaintenanceInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): VehicleMaintenance {
    authorizeOperations(principal, 'operations.transport.maintenance.write', this.#scope);
    this.#correlation(correlationId);
    const vehicle = this.#requireVehicle(input.vehicleId);
    assertIdentifier(input.id, 'vehicleMaintenance.id');
    assertIdentifier(input.description, 'vehicleMaintenance.description');
    assertIdentifier(input.supplierRef, 'vehicleMaintenance.supplierRef');
    assertDate(input.scheduledOn, 'vehicleMaintenance.scheduledOn');
    if (input.completedOn !== null) {
      assertDate(input.completedOn, 'vehicleMaintenance.completedOn');
      if (input.completedOn < input.scheduledOn) throw new Error('OPS_INVALID_DATE_RANGE');
    }
    if (!Number.isSafeInteger(input.costMinor) || input.costMinor < 0) {
      throw new Error('OPS_INVALID_MONEY:vehicleMaintenance.costMinor');
    }
    if (this.#maintenance.has(input.id)) throw new Error('OPS_DUPLICATE_VEHICLE_MAINTENANCE');
    const maintenance: VehicleMaintenance = frozen({
      ...input,
      recordedBy: principal.principalId,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#maintenance.set(maintenance.id, maintenance);
    if (maintenance.completedOn === null) {
      this.#vehicles.set(
        vehicle.id,
        frozen({ ...vehicle, status: 'maintenance', version: vehicle.version + 1 }),
      );
    }
    this.#record(
      'operations.transport.maintenance-scheduled.v1',
      'transport-maintenance',
      maintenance.id,
      1,
      'operations.transport.maintenance.schedule',
      principal,
      correlationId,
      { vehicleId: vehicle.id, scheduledOn: maintenance.scheduledOn },
    );
    return maintenance;
  }

  transportReport(asOf: string, principal: OperationsPrincipal): TransportReport {
    authorizeOperations(principal, 'operations.transport.report.read', this.#scope);
    assertDate(asOf, 'transportReport.asOf');
    const activeVehicles = [...this.#vehicles.values()].filter(
      (vehicle) => vehicle.status === 'active',
    );
    const activeAssignments = [...this.#assignments.values()].filter((assignment) =>
      activeOn(assignment, asOf),
    );
    const capacitySeats = activeVehicles.reduce((sum, vehicle) => sum + vehicle.capacity, 0);
    const assignedSeats = activeAssignments.filter((assignment) =>
      activeVehicles.some((vehicle) => vehicle.id === assignment.vehicleId),
    ).length;
    return frozen({
      activeVehicles: activeVehicles.length,
      activeRoutes: [...this.#routes.values()].filter((route) => route.active).length,
      activeAssignments: activeAssignments.length,
      capacitySeats,
      assignedSeats,
      utilisationBasisPoints:
        capacitySeats === 0 ? 0 : Math.round((assignedSeats * 10_000) / capacitySeats),
      activeTrips: [...this.#trips.values()].filter((trip) => trip.status === 'in-progress').length,
      completedTrips: [...this.#trips.values()].filter(
        (trip) => trip.status === 'completed' && trip.serviceDate <= asOf,
      ).length,
      openIncidents: [...this.#incidents.values()].filter(
        (incident) => incident.status === 'open' && incident.category === 'operational',
      ).length,
      openSafeguardingExceptions: [...this.#incidents.values()].filter(
        (incident) => incident.status === 'open' && incident.category === 'safeguarding',
      ).length,
      inspectionDueVehicleIds: Object.freeze(
        [...this.#vehicles.values()]
          .filter((vehicle) => vehicle.nextInspectionOn < asOf)
          .map((vehicle) => vehicle.id)
          .sort(),
      ),
    });
  }

  findVehicle(id: string): Vehicle | undefined {
    return this.#vehicles.get(id);
  }
  findDriver(id: string): Driver | undefined {
    return this.#drivers.get(id);
  }
  findRoute(id: string): Route | undefined {
    return this.#routes.get(id);
  }

  #recordIncidentInternal(
    input: TransportIncidentInput,
    category: TransportIncident['category'],
    principal: OperationsPrincipal,
    correlationId: string,
  ): TransportIncident {
    this.#correlation(correlationId);
    this.#requireVehicle(input.vehicleId);
    if (input.tripId !== null) this.#requireTrip(input.tripId);
    assertIdentifier(input.id, 'transportIncident.id');
    if (input.description.trim().length < 5)
      throw new Error('OPS_TRANSPORT_INCIDENT_DESCRIPTION_REQUIRED');
    const occurredAt = timestamp(input.occurredAt, 'transportIncident.occurredAt');
    if (this.#incidents.has(input.id)) throw new Error('OPS_DUPLICATE_TRANSPORT_INCIDENT');
    const incident: TransportIncident = frozen({
      ...input,
      personsInvolvedRefs: Object.freeze([...input.personsInvolvedRefs]),
      occurredAt,
      category,
      status: 'open',
      recordedBy: principal.principalId,
      resolvedAt: null,
      version: 1,
    });
    this.#incidents.set(incident.id, incident);
    this.#record(
      category === 'safeguarding'
        ? 'operations.transport.safeguarding-exception-raised.v1'
        : 'operations.transport.incident-recorded.v1',
      'transport-incident',
      incident.id,
      1,
      category === 'safeguarding'
        ? 'operations.transport.safeguarding.raise'
        : 'operations.transport.incident.record',
      principal,
      correlationId,
      { vehicleId: incident.vehicleId, tripId: incident.tripId, severity: incident.severity },
    );
    return incident;
  }

  #eventsForRider(tripId: string, riderRef: string): readonly RiderEvent[] {
    return [...this.#riderEvents.values()].filter(
      (event) => event.tripId === tripId && event.riderRef === riderRef,
    );
  }

  #dateRangesOverlap(
    left: { readonly effectiveFrom: string; readonly effectiveTo: string | null },
    right: { readonly effectiveFrom: string; readonly effectiveTo: string | null },
  ): boolean {
    return (
      left.effectiveFrom <= (right.effectiveTo ?? '9999-12-31') &&
      right.effectiveFrom <= (left.effectiveTo ?? '9999-12-31')
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
  #requireVehicle(id: string): Vehicle {
    const value = this.#vehicles.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:transport-vehicle');
    return value;
  }
  #requireDriver(id: string): Driver {
    const value = this.#drivers.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:transport-driver');
    return value;
  }
  #requireRoute(id: string): Route {
    const value = this.#routes.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:transport-route');
    return value;
  }
  #requireTrip(id: string): TripRun {
    const value = this.#trips.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:transport-trip');
    return value;
  }
}
