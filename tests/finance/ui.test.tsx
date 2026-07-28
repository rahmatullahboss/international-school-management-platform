import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  CashierClosePanel,
  FinanceDashboard,
  FinanceReports,
  InvoiceWorkspace,
  PaymentWorkspace,
  ReconciliationWorkspace,
  RefundApprovalQueue,
} from '../../apps/web-admin/src/features/finance/index.js';
import {
  FamilyFinanceOverview,
  FamilyInvoiceList,
  FamilyPaymentPanel,
  FamilyStatement,
} from '../../apps/web-family/src/features/finance/index.js';

const metric = {
  id: 'outstanding-receivables' as const,
  label: 'Outstanding receivables',
  valueMinor: 12500,
  definition: 'Posted invoices less credits and active allocations as of the selected date.',
  source: 'billing and ledger reconciliation',
  asOf: '2026-07-28',
  drillDown: { report: 'aging', asOf: '2026-07-28' },
};

describe('FIN-01 role-aware finance UI', () => {
  it('renders dashboard definitions and reconciliation status accessibly', () => {
    const reconciled = renderToStaticMarkup(
      <FinanceDashboard
        metrics={[metric]}
        currency="GBP"
        receivableDifferenceMinor={0}
        unappliedDifferenceMinor={0}
      />,
    );
    expect(reconciled).toContain('Finance dashboard');
    expect(reconciled).toContain('role="status"');
    expect(reconciled).toContain('Every amount links to a reproducible as-of report');
    expect(reconciled).toContain('£125.00');

    const difference = renderToStaticMarkup(
      <FinanceDashboard
        metrics={[metric]}
        currency="GBP"
        receivableDifferenceMinor={100}
        unappliedDifferenceMinor={-50}
      />,
    );
    expect(difference).toContain('role="alert"');
    expect(difference).toContain('Reconciliation attention required');
  });

  it('disables high-risk admin actions when permissions are absent', () => {
    const invoiceHtml = renderToStaticMarkup(
      <InvoiceWorkspace
        invoices={[
          {
            id: 'invoice-1',
            invoiceNumber: 'INV-000001',
            accountName: 'Family A',
            issueDate: '2026-07-01',
            dueDate: '2026-07-31',
            status: 'draft',
            totalMinor: 10000,
            balanceMinor: 10000,
            currency: 'GBP',
          },
        ]}
        canCreate={false}
        canPost={false}
        canExport={false}
      />,
    );
    expect(invoiceHtml.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
    expect(invoiceHtml).toContain(
      '<caption>Invoices with current balance and lifecycle status</caption>',
    );

    const refundHtml = renderToStaticMarkup(
      <RefundApprovalQueue
        refunds={[
          {
            id: 'refund-1',
            refundNumber: 'RF-000001',
            receiptNumber: 'RCT-000001',
            requestedBy: 'cashier-a',
            reason: 'Duplicate receipt refund',
            amountMinor: 5000,
            currency: 'GBP',
          },
        ]}
        canApprove={false}
      />,
    );
    expect(refundHtml).toContain('Refunds awaiting an independent approver');
    expect(refundHtml.match(/disabled=""/g)).toHaveLength(2);
  });

  it('renders payment, cashier and reconciliation workspaces with trace fields', () => {
    const paymentHtml = renderToStaticMarkup(
      <PaymentWorkspace
        payments={[
          {
            id: 'payment-1',
            receiptNumber: 'RCT-000001',
            accountName: 'Family A',
            receivedAt: '2026-07-28T10:00:00.000Z',
            amountMinor: 12000,
            allocatedMinor: 10000,
            unappliedMinor: 2000,
            currency: 'GBP',
          },
        ]}
        canAllocate
      />,
    );
    expect(paymentHtml).toContain('Payments and unapplied cash');
    expect(paymentHtml).toContain('RCT-000001');
    expect(paymentHtml).toContain('£20.00');

    const cashierHtml = renderToStaticMarkup(
      <CashierClosePanel
        expectedMinor={10000}
        countedMinor={9900}
        varianceMinor={-100}
        currency="GBP"
        canClose
        canApproveDeposit={false}
      />,
    );
    expect(cashierHtml).toContain(
      'Session closer and deposit approver must be different principals',
    );
    expect(cashierHtml).toContain('-£1.00');

    const reconciliationHtml = renderToStaticMarkup(
      <ReconciliationWorkspace
        rows={[
          {
            id: 'line-1',
            bookingDate: '2026-07-28',
            description: 'Fee payment',
            externalReference: 'provider-1',
            amountMinor: 12000,
            currency: 'GBP',
            status: 'matched',
            matchedReceiptNumber: 'RCT-000001',
          },
        ]}
        canMatch
        canApprove={false}
      />,
    );
    expect(reconciliationHtml).toContain('Imported statement lines and payment matches');
    expect(reconciliationHtml).toContain('RCT-000001');
    expect(reconciliationHtml).toContain('disabled=""');
  });

  it('renders finance reports with as-of provenance', () => {
    const html = renderToStaticMarkup(
      <FinanceReports
        asOf="2026-07-28"
        currency="GBP"
        canExport={false}
        trialBalance={[
          {
            accountId: 'receivable',
            accountCode: '1100',
            accountName: 'Accounts receivable',
            accountType: 'asset',
            naturalBalance: 'debit',
            debitMinor: 20000,
            creditMinor: 5000,
            balanceMinor: 15000,
            currency: 'GBP',
          },
        ]}
      />,
    );
    expect(html).toContain('Trial balance as of');
    expect(html).toContain('Accounts receivable');
    expect(html).toContain('£150.00');
    expect(html).toContain('disabled=""');
  });

  it('renders family invoice, payment and statement flows without exposing privileged actions', () => {
    const overview = renderToStaticMarkup(
      <FamilyFinanceOverview
        outstandingMinor={10000}
        overdueMinor={2000}
        unappliedMinor={500}
        nextDueDate="2026-08-01"
        currency="GBP"
      />,
    );
    expect(overview).toContain('role="alert"');
    expect(overview).toContain('Fees and payments');

    const invoices = renderToStaticMarkup(
      <FamilyInvoiceList
        invoices={[
          {
            id: 'invoice-1',
            invoiceNumber: 'INV-000001',
            issueDate: '2026-07-01',
            dueDate: '2026-08-01',
            status: 'posted',
            totalMinor: 10000,
            balanceMinor: 8000,
            currency: 'GBP',
            downloadAvailable: true,
          },
        ]}
      />,
    );
    expect(invoices).toContain('Issued invoices, due dates and remaining balances');
    expect(invoices).not.toContain('Post</button>');
    expect(invoices).not.toContain('Approve');

    const payment = renderToStaticMarkup(
      <FamilyPaymentPanel
        invoiceNumber="INV-000001"
        maximumMinor={8000}
        currency="GBP"
        providerName="Test Pay"
        paymentPending
      />,
    );
    expect(payment).toContain('aria-busy="true"');
    expect(payment).toContain('receipt appears only after provider verification');

    const statement = renderToStaticMarkup(
      <FamilyStatement
        openingBalanceMinor={0}
        closingBalanceMinor={8000}
        currency="GBP"
        asOf="2026-07-28"
        entries={[
          {
            date: '2026-07-01',
            type: 'invoice',
            documentId: 'invoice-1',
            documentNumber: 'INV-000001',
            debitMinor: 10000,
            creditMinor: 0,
            runningBalanceMinor: 10000,
          },
          {
            date: '2026-07-28',
            type: 'payment',
            documentId: 'payment-1',
            documentNumber: 'RCT-000001',
            debitMinor: 0,
            creditMinor: 2000,
            runningBalanceMinor: 8000,
          },
        ]}
      />,
    );
    expect(statement).toContain('Invoices, credits, payments and refunds');
    expect(statement).toContain('RCT-000001');
  });

  it('keeps UI source free from database clients and direct SQL', () => {
    const adminSource = readFileSync('apps/web-admin/src/features/finance/index.tsx', 'utf8');
    const familySource = readFileSync('apps/web-family/src/features/finance/index.tsx', 'utf8');
    for (const source of [adminSource, familySource]) {
      expect(source).not.toMatch(/from ['"].*(postgres|drizzle|prisma|database)/i);
      expect(source).not.toMatch(/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
    }
  });
});
