export type RoundingMode = 'half-even' | 'half-up' | 'half-down' | 'floor' | 'ceiling' | 'truncate';

export interface RoundingPolicy {
  readonly mode: RoundingMode;
  readonly precision: number;
}

export interface DecimalPrecision {
  readonly currency: string;
  readonly minorUnit: number;
  readonly roundingMode: RoundingMode;
}

export function createRoundingPolicy(mode: RoundingMode, precision: number): RoundingPolicy {
  if (!Number.isInteger(precision) || precision < 0 || precision > 10) throw new Error('Precision must be between 0 and 10 and use an integer value');
  return Object.freeze({ mode, precision });
}

function roundHalf(value: number, tieDirection: 'even' | 'up' | 'down'): number {
  const sign = value < 0 ? -1 : 1;
  const absolute = Math.abs(value);
  const floor = Math.floor(absolute);
  const fraction = absolute - floor;
  const delta = fraction - 0.5;
  if (delta < -Number.EPSILON * Math.max(1, absolute) * 4) return floor * sign;
  if (delta > Number.EPSILON * Math.max(1, absolute) * 4) return (floor + 1) * sign;
  if (tieDirection === 'even') return (floor % 2 === 0 ? floor : floor + 1) * sign;
  if (tieDirection === 'up') return (floor + 1) * sign;
  return floor * sign;
}

export function applyRounding(value: number, policy: RoundingPolicy): number {
  if (!Number.isFinite(value)) throw new Error('Value must be finite');
  const factor = 10 ** policy.precision;
  const scaled = value * factor;
  let rounded: number;
  switch (policy.mode) {
    case 'half-even': rounded = roundHalf(scaled, 'even'); break;
    case 'half-up': rounded = roundHalf(scaled, 'up'); break;
    case 'half-down': rounded = roundHalf(scaled, 'down'); break;
    case 'floor': rounded = Math.floor(scaled); break;
    case 'ceiling': rounded = Math.ceil(scaled); break;
    case 'truncate': rounded = Math.trunc(scaled); break;
  }
  return rounded / factor;
}

export function getCurrencyRoundingPolicy(currency: string): RoundingPolicy {
  const normalized = currency.trim().toUpperCase();
  const zeroDecimal = new Set(['IDR', 'JPY', 'VND']);
  const threeDecimal = new Set(['BHD', 'JOD', 'KWD', 'OMR']);
  if (zeroDecimal.has(normalized)) return createRoundingPolicy('half-even', 0);
  if (threeDecimal.has(normalized)) return createRoundingPolicy('half-even', 3);
  if (!/^[A-Z]{3}$/.test(normalized)) throw new Error(`Invalid currency code: ${currency}`);
  return createRoundingPolicy('half-even', 2);
}

export function roundMinorUnits(value: number, policy: RoundingPolicy): number {
  return Math.round(applyRounding(value, policy));
}
