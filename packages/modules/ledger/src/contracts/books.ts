/**
 * Accounting Books Contracts
 * 
 * Chart of accounts, accounting books, and book-level configuration
 * for multi-entity, multi-currency, multi-GAAP support.
 */

export type BookType = 'primary' | 'tax' | 'management' | 'consolidation' | 'statutory' | 'ifrs' | 'gaap';

export interface AccountingBook {
  readonly id: string;
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly code: string;
  readonly name: string;
  readonly type: BookType;
  readonly baseCurrency: string;
  readonly reportingCurrencies: readonly string[];
  readonly isActive: boolean;
  readonly allowManualEntries: boolean;
  readonly requiresApproval: boolean;
  readonly fiscalYearId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ChartOfAccounts {
  readonly bookId: string;
  readonly accounts: readonly Account[];
  readonly version: number;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
}

export interface Account {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
  readonly subtype: string | null;
  readonly naturalBalance: 'debit' | 'credit';
  readonly parentId: string | null;
  readonly isPostingAllowed: boolean;
  readonly isActive: boolean;
  readonly description: string | null;
  readonly controlAccount: boolean;
  readonly controlAccountType: string | null;
  readonly metadata: Record<string, unknown>;
}

export type AccountType = 
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'expense'
  | 'contra_asset'
  | 'contra_liability'
  | 'contra_equity'
  | 'contra_revenue'
  | 'contra_expense';

export const ACCOUNT_TYPE_NATURAL_BALANCE: Record<AccountType, 'debit' | 'credit'> = {
  asset: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
  expense: 'debit',
  contra_asset: 'credit',
  contra_liability: 'debit',
  contra_equity: 'debit',
  contra_revenue: 'debit',
  contra_expense: 'credit',
};

export function getNaturalBalance(type: AccountType): 'debit' | 'credit' {
  return ACCOUNT_TYPE_NATURAL_BALANCE[type];
}

export function isBalanceSheetAccount(type: AccountType): boolean {
  return ['asset', 'liability', 'equity', 'contra_asset', 'contra_liability', 'contra_equity'].includes(type);
}

export function isIncomeStatementAccount(type: AccountType): boolean {
  return ['revenue', 'expense', 'contra_revenue', 'contra_expense'].includes(type);
}

export interface BookValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
}

export function validateBook(book: Partial<AccountingBook>): BookValidationResult {
  const errors: string[] = [];
  
  if (!book.code || book.code.trim().length === 0) {
    errors.push('Book code is required');
  }
  
  if (!book.name || book.name.trim().length === 0) {
    errors.push('Book name is required');
  }
  
  if (!book.baseCurrency || book.baseCurrency.length !== 3) {
    errors.push('Valid base currency (ISO 4217) is required');
  }
  
  if (book.type === 'consolidation' && !book.legalEntityId) {
    errors.push('Consolidation book must have a legal entity');
  }
  
  return {
    isValid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

export function validateChartOfAccounts(chart: Partial<ChartOfAccounts>): BookValidationResult {
  const errors: string[] = [];
  
  if (!chart.accounts || chart.accounts.length === 0) {
    errors.push('Chart of accounts must have at least one account');
    return { isValid: false, errors: Object.freeze(errors) };
  }
  
  const codes = new Set<string>();
  const ids = new Set<string>();
  
  for (const account of chart.accounts) {
    if (codes.has(account.code)) {
      errors.push(`Duplicate account code: ${account.code}`);
    }
    codes.add(account.code);
    
    if (ids.has(account.id)) {
      errors.push(`Duplicate account ID: ${account.id}`);
    }
    ids.add(account.id);
    
    if (account.parentId && !ids.has(account.parentId)) {
      // Parent might be defined later in array
    }
    
    if (!ACCOUNT_TYPE_NATURAL_BALANCE[account.type]) {
      errors.push(`Invalid account type: ${account.type}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

export function findAccountByCode(accounts: readonly Account[], code: string): Account | undefined {
  return accounts.find(a => a.code === code);
}

export function getAccountHierarchy(accounts: readonly Account[]): readonly Account[] {
  // Return accounts sorted by hierarchy (parents before children)
  const sorted = [...accounts].sort((a, b) => {
    const depthA = getAccountDepth(a, accounts);
    const depthB = getAccountDepth(b, accounts);
    return depthA - depthB;
  });
  return sorted;
}

function getAccountDepth(account: Account, accounts: readonly Account[]): number {
  let depth = 0;
  let current: Account | undefined = account;
  while (current?.parentId) {
    const parentId: string = current.parentId;
    current = accounts.find((candidate) => candidate.id === parentId);
    depth++;
    if (depth > 100) break; // Prevent infinite loops
  }
  return depth;
}

export function getControlAccounts(accounts: readonly Account[]): readonly Account[] {
  return accounts.filter(a => a.controlAccount);
}