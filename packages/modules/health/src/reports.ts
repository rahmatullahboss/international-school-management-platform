import type {
  ClinicEncounter,
  HealthProfile,
  MedicationAdministration,
} from './domain.js';

export interface HealthOperationalReportInput {
  tenantId: string;
  profiles: readonly HealthProfile[];
  encounters: readonly ClinicEncounter[];
  administrations: readonly MedicationAdministration[];
  from: Date;
  to: Date;
  minimumCohortSize?: number;
}

export interface SuppressedCount {
  value: number | null;
  suppressed: boolean;
}

export interface HealthOperationalReport {
  tenantId: string;
  from: Date;
  to: Date;
  activeProfiles: SuppressedCount;
  clinicEncounters: SuppressedCount;
  returnedToClass: SuppressedCount;
  sentHome: SuppressedCount;
  emergencyTransfers: SuppressedCount;
  medicationAdministrations: SuppressedCount;
  refusedOrOmittedAdministrations: SuppressedCount;
}

function count(value: number, minimum: number): SuppressedCount {
  return value === 0 || value >= minimum
    ? { value, suppressed: false }
    : { value: null, suppressed: true };
}

export function buildHealthOperationalReport(
  input: HealthOperationalReportInput,
): HealthOperationalReport {
  if (input.to < input.from) throw new Error('Report end must not precede start');
  const minimum = input.minimumCohortSize ?? 5;
  if (minimum < 3) throw new Error('Minimum cohort size must be at least 3');

  const profiles = input.profiles.filter((item) => item.tenantId === input.tenantId);
  const encounters = input.encounters.filter(
    (item) =>
      item.tenantId === input.tenantId &&
      item.openedAt >= input.from &&
      item.openedAt <= input.to,
  );
  const administrations = input.administrations.filter(
    (item) =>
      item.tenantId === input.tenantId &&
      item.administeredAt >= input.from &&
      item.administeredAt <= input.to,
  );

  return {
    tenantId: input.tenantId,
    from: input.from,
    to: input.to,
    activeProfiles: count(
      profiles.filter((profile) => profile.status === 'active').length,
      minimum,
    ),
    clinicEncounters: count(encounters.length, minimum),
    returnedToClass: count(
      encounters.filter((encounter) => encounter.disposition === 'returned-to-class').length,
      minimum,
    ),
    sentHome: count(
      encounters.filter((encounter) => encounter.disposition === 'sent-home').length,
      minimum,
    ),
    emergencyTransfers: count(
      encounters.filter((encounter) => encounter.disposition === 'emergency-transfer').length,
      minimum,
    ),
    medicationAdministrations: count(administrations.length, minimum),
    refusedOrOmittedAdministrations: count(
      administrations.filter(
        (administration) =>
          administration.outcome === 'refused' || administration.outcome === 'omitted',
      ).length,
      minimum,
    ),
  };
}
