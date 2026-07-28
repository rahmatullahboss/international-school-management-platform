/**
 * Chart of Accounts Contracts
 * 
 * Account types, natural balances, account hierarchy, and
 * posting rules for double-entry bookkeeping.
 */

export type AccountType = 
  | 'asset' 
  | 'liability' 
  | 'equity' 
  | 'revenue' 
  | 'expense' 
  | 'contra-asset' 
  | 'contra-liability' 
  | 'contra-equity' 
  | 'contra-revenue' 
  | 'contra-expense';

export type NaturalBalance = 'debit' | 'credit';

export const ACCOUNT_TYPE_NATURAL_BALANCE: ReadonlyMap<AccountType, NaturalBalance> = new Map([
  ['asset', 'debit'],
  ['liability', 'credit'],
  ['equity', 'credit'],
  ['revenue', 'credit'],
  ['expense', 'debit'],
  ['contra-asset', 'credit'],
  ['contra-liability', 'debit'],
  ['contra-equity', 'debit'],
  ['contra-revenue', 'debit'],
  ['contra-expense', 'credit'],
]);

export interface Account {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
  readonly naturalBalance: NaturalBalance;
  readonly parentId: string | null;
  readonly isActive: boolean;
  readonly isPostingAllowed: boolean;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AccountHierarchyNode {
  readonly account: Account;
  readonly children: readonly AccountHierarchyNode[];
  readonly depth: number;
  readonly path: readonly string[];
}

export function getNaturalBalance(type: AccountType): NaturalBalance {
  const balance = ACCOUNT_TYPE_NATURAL_BALANCE.get(type);
  if (!balance) {
    throw new Error(`Unknown account type: ${type}`);
  }
  return balance;
}

export function isBalanceSheetAccount(type: AccountType): boolean {
  return ['asset', 'liability', 'equity', 'contra-asset', 'contra-liability', 'contra-equity'].includes(type);
}

export function isIncomeStatementAccount(type: AccountType): boolean {
  return ['revenue', 'expense', 'contra-revenue', 'contra-expense'].includes(type);
}

export function isContraAccount(type: AccountType): boolean {
  return type.startsWith('contra-');
}

export function getContraType(type: AccountType): AccountType | null {
  const contraMap: Record<AccountType, AccountType | null> = {
    'asset': 'contra-asset',
    'liability': 'contra-liability',
    'equity': 'contra-equity',
    'revenue': 'contra-revenue',
    'expense': 'contra-expense',
    'contra-asset': 'asset',
    'contra-liability': 'liability',
    'contra-equity': 'equity',
    'contra-revenue': 'revenue',
    'contra-expense': 'expense',
  };
  return contraMap[type] ?? null;
}

export interface AccountValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
}

export function validateAccount(account: Partial<Account>): AccountValidationResult {
  const errors: string[] = [];
  
  if (!account.code || account.code.trim().length === 0) {
    errors.push('Account code is required');
  }
  
  if (!account.name || account.name.trim().length === 0) {
    errors.push('Account name is required');
  }
  
  if (account.type && !ACCOUNT_TYPE_NATURAL_BALANCE.has(account.type)) {
    errors.push(`Invalid account type: ${account.type}`);
  }
  
  if (account.parentId === account.id) {
    errors.push('Account cannot be its own parent');
  }
  
  return {
    isValid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}