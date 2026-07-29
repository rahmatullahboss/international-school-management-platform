export type OperationsPermissionRisk = 'standard' | 'sensitive' | 'high';

export interface OperationsPermissionDefinition {
  readonly key: OperationsPermission;
  readonly domain: string;
  readonly description: string;
  readonly risk: OperationsPermissionRisk;
  readonly stepUpRequired: boolean;
}

export const operationsPermissionKeys = [
  'operations.hr.staff.write',
  'operations.hr.contract.write',
  'operations.hr.leave.write',
  'operations.hr.leave.approve',
  'operations.hr.attendance.write',
  'operations.hr.report.read',
  'operations.procurement.supplier.write',
  'operations.procurement.budget.write',
  'operations.procurement.requisition.write',
  'operations.procurement.requisition.approve',
  'operations.procurement.order.write',
  'operations.procurement.receipt.write',
  'operations.procurement.invoice.write',
  'operations.procurement.payable.approve',
  'operations.procurement.report.read',
  'operations.inventory.catalog.write',
  'operations.inventory.location.write',
  'operations.inventory.movement.write',
  'operations.inventory.reservation.write',
  'operations.inventory.count.write',
  'operations.inventory.count.approve',
  'operations.inventory.report.read',
  'operations.asset.register',
  'operations.asset.assign',
  'operations.asset.maintenance.write',
  'operations.asset.disposal.write',
  'operations.asset.disposal.approve',
  'operations.asset.report.read',
  'operations.library.catalog.write',
  'operations.library.copy.write',
  'operations.library.patron.write',
  'operations.library.circulation.write',
  'operations.library.hold.write',
  'operations.library.loss.write',
  'operations.library.report.read',
  'operations.transport.vehicle.write',
  'operations.transport.driver.write',
  'operations.transport.route.write',
  'operations.transport.assignment.write',
  'operations.transport.trip.write',
  'operations.transport.attendance.write',
  'operations.transport.incident.write',
  'operations.transport.maintenance.write',
  'operations.transport.report.read',
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
  'operations.activities.catalog.write',
  'operations.activities.enrolment.write',
  'operations.activities.trip.write',
  'operations.activities.consent.write',
  'operations.activities.attendance.write',
  'operations.activities.incident.write',
  'operations.activities.report.read',
  'operations.activities.risk.approve',
  'operations.activities.trip.approve',
] as const;

export type OperationsPermission = (typeof operationsPermissionKeys)[number];

const stepUpPermissions = new Set<OperationsPermission>([
  'operations.hr.contract.write',
  'operations.hr.leave.approve',
  'operations.procurement.budget.write',
  'operations.procurement.requisition.approve',
  'operations.procurement.order.write',
  'operations.procurement.payable.approve',
  'operations.inventory.count.approve',
  'operations.asset.disposal.approve',
  'operations.library.loss.write',
  'operations.hostel.allocation.write',
  'operations.activities.risk.approve',
  'operations.activities.trip.approve',
]);

function permissionDomain(permission: OperationsPermission): string {
  return permission.split('.')[1] ?? 'operations';
}

function permissionRisk(permission: OperationsPermission): OperationsPermissionRisk {
  if (stepUpPermissions.has(permission)) return 'high';
  if (
    permission.includes('.incident.') ||
    permission.includes('.attendance.') ||
    permission.includes('.consent.') ||
    permission.includes('.visitor.')
  ) {
    return 'sensitive';
  }
  return 'standard';
}

function permissionDescription(permission: OperationsPermission): string {
  return permission
    .replace('operations.', '')
    .split('.')
    .map((segment) => segment.replaceAll('-', ' '))
    .join(' · ');
}

export const operationsPermissionCatalog: readonly OperationsPermissionDefinition[] = Object.freeze(
  operationsPermissionKeys.map((key) =>
    Object.freeze({
      key,
      domain: permissionDomain(key),
      description: permissionDescription(key),
      risk: permissionRisk(key),
      stepUpRequired: stepUpPermissions.has(key),
    }),
  ),
);

export const operationsRoleBundles = Object.freeze({
  operationsAdministrator: Object.freeze([...operationsPermissionKeys]),
  operationsAuditor: Object.freeze(
    operationsPermissionKeys.filter((permission) => permission.endsWith('.report.read')),
  ),
  hrManager: Object.freeze([
    'operations.hr.staff.write',
    'operations.hr.contract.write',
    'operations.hr.leave.write',
    'operations.hr.leave.approve',
    'operations.hr.attendance.write',
    'operations.hr.report.read',
  ] satisfies OperationsPermission[]),
  procurementBuyer: Object.freeze([
    'operations.procurement.supplier.write',
    'operations.procurement.budget.write',
    'operations.procurement.requisition.write',
    'operations.procurement.order.write',
    'operations.procurement.receipt.write',
    'operations.procurement.invoice.write',
    'operations.procurement.report.read',
  ] satisfies OperationsPermission[]),
  procurementApprover: Object.freeze([
    'operations.procurement.requisition.approve',
    'operations.procurement.payable.approve',
    'operations.procurement.report.read',
  ] satisfies OperationsPermission[]),
  inventoryController: Object.freeze([
    'operations.inventory.catalog.write',
    'operations.inventory.location.write',
    'operations.inventory.movement.write',
    'operations.inventory.reservation.write',
    'operations.inventory.count.write',
    'operations.inventory.count.approve',
    'operations.inventory.report.read',
    'operations.asset.register',
    'operations.asset.assign',
    'operations.asset.maintenance.write',
    'operations.asset.disposal.write',
    'operations.asset.report.read',
  ] satisfies OperationsPermission[]),
  assetDisposalApprover: Object.freeze([
    'operations.asset.disposal.approve',
    'operations.asset.report.read',
  ] satisfies OperationsPermission[]),
  librarian: Object.freeze(
    operationsPermissionKeys.filter((permission) => permission.startsWith('operations.library.')),
  ),
  transportManager: Object.freeze(
    operationsPermissionKeys.filter((permission) => permission.startsWith('operations.transport.')),
  ),
  residentialManager: Object.freeze([
    ...operationsPermissionKeys.filter((permission) => permission.startsWith('operations.hostel.')),
    ...operationsPermissionKeys.filter((permission) =>
      permission.startsWith('operations.cafeteria.'),
    ),
  ]),
  activitiesCoordinator: Object.freeze([
    'operations.activities.catalog.write',
    'operations.activities.enrolment.write',
    'operations.activities.trip.write',
    'operations.activities.consent.write',
    'operations.activities.attendance.write',
    'operations.activities.incident.write',
    'operations.activities.report.read',
  ] satisfies OperationsPermission[]),
  activitiesApprover: Object.freeze([
    'operations.activities.risk.approve',
    'operations.activities.trip.approve',
    'operations.activities.report.read',
  ] satisfies OperationsPermission[]),
});

export function isOperationsPermission(value: string): value is OperationsPermission {
  return (operationsPermissionKeys as readonly string[]).includes(value);
}

export function requiresOperationsStepUp(permission: OperationsPermission): boolean {
  return stepUpPermissions.has(permission);
}
