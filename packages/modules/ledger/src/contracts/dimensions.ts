/**
 * Dimensions Contracts
 * 
 * Analytical dimensions for multi-dimensional reporting
 * (department, campus, program, fund, project, etc.)
 */

export type DimensionType = 
  | 'campus'
  | 'department'
  | 'program'
  | 'fund'
  | 'project'
  | 'grant'
  | 'cost_center'
  | 'activity'
  | 'location'
  | 'custom';

export interface Dimension {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: DimensionType;
  readonly isRequired: boolean;
  readonly allowedValues: readonly string[];
  readonly hierarchy: readonly DimensionHierarchyNode[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DimensionHierarchyNode {
  readonly value: string;
  readonly label: string;
  readonly parent: string | null;
  readonly children: readonly DimensionHierarchyNode[];
}

export interface DimensionValue {
  readonly dimensionId: string;
  readonly value: string;
  readonly label: string;
  readonly isActive: boolean;
  readonly validFrom: Date;
  readonly validTo: Date | null;
}

export interface JournalLineDimensions {
  readonly [dimensionCode: string]: string;
}

export const STANDARD_DIMENSIONS: readonly DimensionType[] = [
  'campus',
  'department',
  'program',
  'fund',
  'project',
  'cost_center',
];

export function validateDimensions(
  dimensions: JournalLineDimensions,
  definitions: readonly Dimension[]
): { isValid: boolean; errors: readonly string[] } {
  const errors: string[] = [];
  
  for (const def of definitions) {
    if (def.isRequired && !dimensions[def.code]) {
      errors.push(`Required dimension missing: ${def.code}`);
    }
    
    const assignedValue = dimensions[def.code];
    if (assignedValue !== undefined && def.allowedValues.length > 0) {
      if (!def.allowedValues.includes(assignedValue)) {
        errors.push(`Invalid value for dimension ${def.code}: ${assignedValue}`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

export function getDimensionValue(
  dimensions: JournalLineDimensions,
  code: string
): string | undefined {
  return dimensions[code];
}

export function mergeDimensions(
  base: JournalLineDimensions,
  overrides: JournalLineDimensions
): JournalLineDimensions {
  return { ...base, ...overrides };
}