export type CurrencyCode = string & { readonly __brand: 'currency-code' };
export type MinorUnit = number & { readonly __brand: 'minor-unit' };

export interface Money {
  readonly amount: MinorUnit;
  readonly currency: CurrencyCode;
}

const CURRENCY_MINOR_UNITS: Readonly<Record<string, number>> = Object.freeze({
  AED: 2, AUD: 2, BDT: 2, BHD: 3, CAD: 2, CHF: 2, CNY: 2, EUR: 2, GBP: 2,
  HKD: 2, IDR: 0, INR: 2, JOD: 3, JPY: 0, KWD: 3, MYR: 2, NZD: 2,
  OMR: 3, QAR: 2, SAR: 2, SGD: 2, THB: 2, USD: 2, VND: 0,
});

export class MoneyPrecisionError extends Error {
  constructor(readonly currency: CurrencyCode, readonly expected: number, readonly received: number) {
    super(`Currency ${currency} requires ${expected} decimal places, received ${received}`);
    this.name = 'MoneyPrecisionError';
  }
}

export class MoneyCurrencyMismatchError extends Error {
  constructor(readonly left: CurrencyCode, readonly right: CurrencyCode) {
    super(`Currency mismatch: ${left} !== ${right}`);
    this.name = 'MoneyCurrencyMismatchError';
  }
}

export function currencyCode(value: string): CurrencyCode {
  const normalized = value.trim().toUpperCase();
  if (!(normalized in CURRENCY_MINOR_UNITS)) throw new Error(`Unsupported currency: ${value}`);
  return normalized as CurrencyCode;
}

export function minorUnit(value: number): MinorUnit {
  if (!Number.isSafeInteger(value)) throw new Error(`Minor unit must be a safe integer, got ${value}`);
  return value as MinorUnit;
}

export function parseMoney(value: string, currency: CurrencyCode): Money {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new Error(`Invalid monetary amount: ${value}`);
  const precision = CURRENCY_MINOR_UNITS[currency];
  if (precision === undefined) throw new Error(`Unsupported currency: ${currency}`);
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  if (fraction.length > precision) throw new MoneyPrecisionError(currency, precision, fraction.length);
  const padded = fraction.padEnd(precision, '0');
  const fractional = padded.length === 0 ? 0 : Number(padded);
  const amount = Number(whole) * 10 ** precision + fractional;
  return { amount: minorUnit(negative ? -amount : amount), currency };
}

export function moneyZero(currency: CurrencyCode): Money {
  return { amount: minorUnit(0), currency };
}

function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) throw new MoneyCurrencyMismatchError(left.currency, right.currency);
}

export function moneyAdd(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return { amount: minorUnit(left.amount + right.amount), currency: left.currency };
}

export function moneySubtract(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return { amount: minorUnit(left.amount - right.amount), currency: left.currency };
}

export function moneyMultiply(value: Money, factor: number): Money {
  if (!Number.isFinite(factor)) throw new Error('Factor must be finite');
  return { amount: minorUnit(Math.round(value.amount * factor)), currency: value.currency };
}

export function moneyDivide(value: Money, divisor: number): Money {
  if (!Number.isFinite(divisor) || divisor === 0) throw new Error('Divisor must be finite and non-zero');
  return { amount: minorUnit(Math.round(value.amount / divisor)), currency: value.currency };
}

export function moneyEquals(left: Money, right: Money): boolean {
  assertSameCurrency(left, right);
  return left.amount === right.amount;
}

export function moneyCompare(left: Money, right: Money): -1 | 0 | 1 {
  assertSameCurrency(left, right);
  return left.amount < right.amount ? -1 : left.amount > right.amount ? 1 : 0;
}

export function moneyAbsolute(value: Money): Money {
  return { amount: minorUnit(Math.abs(value.amount)), currency: value.currency };
}

export function moneyNegate(value: Money): Money {
  return { amount: minorUnit(-Number(value.amount)), currency: value.currency };
}

export function moneyIsPositive(value: Money): boolean { return value.amount > 0; }
export function moneyIsNegative(value: Money): boolean { return value.amount < 0; }
export function moneyIsZero(value: Money): boolean { return value.amount === 0; }

export function allocateMoney(total: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) return [];
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) throw new Error('Weights must be finite and non-negative');
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) throw new Error('Weights must sum to a positive value');
  const sign = total.amount < 0 ? -1 : 1;
  const absolute = Math.abs(total.amount);
  const raw = weights.map((weight) => absolute * weight / totalWeight);
  const floors = raw.map(Math.floor);
  let remainder = absolute - floors.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, fraction: value - floors[index]! }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (const item of order) {
    if (remainder === 0) break;
    floors[item.index] = floors[item.index]! + 1;
    remainder -= 1;
  }
  return floors.map((value) => ({ amount: minorUnit(value * sign), currency: total.currency }));
}

export function moneyToNumber(value: Money): number {
  const precision = CURRENCY_MINOR_UNITS[value.currency];
  if (precision === undefined) throw new Error(`Unsupported currency: ${value.currency}`);
  return value.amount / 10 ** precision;
}

export function formatMoney(value: Money, locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: value.currency }).format(moneyToNumber(value));
}
