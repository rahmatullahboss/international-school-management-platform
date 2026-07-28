import type { DashboardMetric, GeneralLedgerRow, TrialBalanceRow } from '@school/finance';

export interface AdminInvoiceRow {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly accountName: string;
  readonly issueDate: string;
  readonly dueDate: string;
  readonly status: string;
  readonly totalMinor: number;
  readonly balanceMinor: number;
  readonly currency: string;
}

export interface AdminPaymentRow {
  readonly id: string;
  readonly receiptNumber: string;
  readonly accountName: string;
  readonly receivedAt: string;
  readonly amountMinor: number;
  readonly allocatedMinor: number;
  readonly unappliedMinor: number;
  readonly currency: string;
}

export interface RefundApprovalRow {
  readonly id: string;
  readonly refundNumber: string;
  readonly receiptNumber: string;
  readonly requestedBy: string;
  readonly reason: string;
  readonly amountMinor: number;
  readonly currency: string;
}

export interface ReconciliationRow {
  readonly id: string;
  readonly bookingDate: string;
  readonly description: string;
  readonly externalReference: string | null;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: string;
  readonly matchedReceiptNumber: string | null;
}

function formatMinor(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amountMinor / 100);
}

function Money({
  amountMinor,
  currency,
}: {
  readonly amountMinor: number;
  readonly currency: string;
}) {
  return <data value={amountMinor}>{formatMinor(amountMinor, currency)}</data>;
}

function EmptyRow({ columns, message }: { readonly columns: number; readonly message: string }) {
  return (
    <tr>
      <td colSpan={columns}>{message}</td>
    </tr>
  );
}

export function FinanceDashboard({
  metrics,
  currency,
  receivableDifferenceMinor,
  unappliedDifferenceMinor,
  onOpenMetric,
}: {
  readonly metrics: readonly DashboardMetric[];
  readonly currency: string;
  readonly receivableDifferenceMinor: number;
  readonly unappliedDifferenceMinor: number;
  readonly onOpenMetric?: (metric: DashboardMetric) => void;
}) {
  const hasDifference = receivableDifferenceMinor !== 0 || unappliedDifferenceMinor !== 0;
  return (
    <section aria-labelledby="finance-dashboard-title">
      <header>
        <h1 id="finance-dashboard-title">Finance dashboard</h1>
        <p>Every amount links to a reproducible as-of report.</p>
      </header>
      {hasDifference ? (
        <div role="alert">
          <strong>Reconciliation attention required.</strong> Receivable difference{' '}
          <Money amountMinor={receivableDifferenceMinor} currency={currency} />; unapplied-cash
          difference <Money amountMinor={unappliedDifferenceMinor} currency={currency} />.
        </div>
      ) : (
        <p role="status">Receivable and unapplied-cash control accounts are reconciled.</p>
      )}
      <ul aria-label="Finance metrics">
        {metrics.map((metric) => (
          <li key={metric.id}>
            <article>
              <h2>{metric.label}</h2>
              <p>
                <Money amountMinor={metric.valueMinor} currency={currency} />
              </p>
              <p>{metric.definition}</p>
              <small>
                As of <time dateTime={metric.asOf}>{metric.asOf}</time> · {metric.source}
              </small>
              {onOpenMetric === undefined ? null : (
                <button type="button" onClick={() => onOpenMetric(metric)}>
                  Open details for {metric.label}
                </button>
              )}
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InvoiceWorkspace({
  invoices,
  canCreate,
  canPost,
  canExport,
  onCreate,
  onPost,
  onOpen,
  onExport,
}: {
  readonly invoices: readonly AdminInvoiceRow[];
  readonly canCreate: boolean;
  readonly canPost: boolean;
  readonly canExport: boolean;
  readonly onCreate?: () => void;
  readonly onPost?: (invoiceId: string) => void;
  readonly onOpen?: (invoiceId: string) => void;
  readonly onExport?: () => void;
}) {
  return (
    <section aria-labelledby="invoice-workspace-title">
      <header>
        <h2 id="invoice-workspace-title">Invoices and receivables</h2>
        <div>
          <button type="button" disabled={!canCreate} onClick={onCreate}>
            Create invoice
          </button>
          <button type="button" disabled={!canExport} onClick={onExport}>
            Export invoices
          </button>
        </div>
      </header>
      <table>
        <caption>Invoices with current balance and lifecycle status</caption>
        <thead>
          <tr>
            <th scope="col">Invoice</th>
            <th scope="col">Account</th>
            <th scope="col">Issued</th>
            <th scope="col">Due</th>
            <th scope="col">Status</th>
            <th scope="col">Total</th>
            <th scope="col">Balance</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 ? (
            <EmptyRow columns={8} message="No invoices match the current filters." />
          ) : (
            invoices.map((invoice) => (
              <tr key={invoice.id}>
                <th scope="row">
                  <button type="button" onClick={() => onOpen?.(invoice.id)}>
                    {invoice.invoiceNumber}
                  </button>
                </th>
                <td>{invoice.accountName}</td>
                <td>
                  <time dateTime={invoice.issueDate}>{invoice.issueDate}</time>
                </td>
                <td>
                  <time dateTime={invoice.dueDate}>{invoice.dueDate}</time>
                </td>
                <td>{invoice.status}</td>
                <td>
                  <Money amountMinor={invoice.totalMinor} currency={invoice.currency} />
                </td>
                <td>
                  <Money amountMinor={invoice.balanceMinor} currency={invoice.currency} />
                </td>
                <td>
                  <button
                    type="button"
                    disabled={!canPost || invoice.status !== 'draft'}
                    onClick={() => onPost?.(invoice.id)}
                  >
                    Post
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

export function PaymentWorkspace({
  payments,
  canAllocate,
  onOpen,
  onAllocate,
}: {
  readonly payments: readonly AdminPaymentRow[];
  readonly canAllocate: boolean;
  readonly onOpen?: (paymentId: string) => void;
  readonly onAllocate?: (paymentId: string) => void;
}) {
  return (
    <section aria-labelledby="payment-workspace-title">
      <h2 id="payment-workspace-title">Payments and unapplied cash</h2>
      <table>
        <caption>Verified receipts and allocation status</caption>
        <thead>
          <tr>
            <th scope="col">Receipt</th>
            <th scope="col">Account</th>
            <th scope="col">Received</th>
            <th scope="col">Amount</th>
            <th scope="col">Allocated</th>
            <th scope="col">Unapplied</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <EmptyRow columns={7} message="No verified payments are available." />
          ) : (
            payments.map((payment) => (
              <tr key={payment.id}>
                <th scope="row">
                  <button type="button" onClick={() => onOpen?.(payment.id)}>
                    {payment.receiptNumber}
                  </button>
                </th>
                <td>{payment.accountName}</td>
                <td>
                  <time dateTime={payment.receivedAt}>{payment.receivedAt.slice(0, 10)}</time>
                </td>
                <td>
                  <Money amountMinor={payment.amountMinor} currency={payment.currency} />
                </td>
                <td>
                  <Money amountMinor={payment.allocatedMinor} currency={payment.currency} />
                </td>
                <td>
                  <Money amountMinor={payment.unappliedMinor} currency={payment.currency} />
                </td>
                <td>
                  <button
                    type="button"
                    disabled={!canAllocate || payment.unappliedMinor === 0}
                    onClick={() => onAllocate?.(payment.id)}
                  >
                    Allocate
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

export function RefundApprovalQueue({
  refunds,
  canApprove,
  onApprove,
  onReject,
}: {
  readonly refunds: readonly RefundApprovalRow[];
  readonly canApprove: boolean;
  readonly onApprove?: (refundId: string) => void;
  readonly onReject?: (refundId: string) => void;
}) {
  return (
    <section aria-labelledby="refund-queue-title">
      <h2 id="refund-queue-title">Refund approval queue</h2>
      <table>
        <caption>Refunds awaiting an independent approver</caption>
        <thead>
          <tr>
            <th scope="col">Refund</th>
            <th scope="col">Receipt</th>
            <th scope="col">Requester</th>
            <th scope="col">Reason</th>
            <th scope="col">Amount</th>
            <th scope="col">Decision</th>
          </tr>
        </thead>
        <tbody>
          {refunds.length === 0 ? (
            <EmptyRow columns={6} message="No refund requests await approval." />
          ) : (
            refunds.map((refund) => (
              <tr key={refund.id}>
                <th scope="row">{refund.refundNumber}</th>
                <td>{refund.receiptNumber}</td>
                <td>{refund.requestedBy}</td>
                <td>{refund.reason}</td>
                <td>
                  <Money amountMinor={refund.amountMinor} currency={refund.currency} />
                </td>
                <td>
                  <button
                    type="button"
                    disabled={!canApprove}
                    onClick={() => onApprove?.(refund.id)}
                  >
                    Approve
                  </button>{' '}
                  <button
                    type="button"
                    disabled={!canApprove}
                    onClick={() => onReject?.(refund.id)}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

export function CashierClosePanel({
  expectedMinor,
  countedMinor,
  currency,
  varianceMinor,
  canClose,
  canApproveDeposit,
  onClose,
  onApproveDeposit,
}: {
  readonly expectedMinor: number;
  readonly countedMinor: number | null;
  readonly currency: string;
  readonly varianceMinor: number | null;
  readonly canClose: boolean;
  readonly canApproveDeposit: boolean;
  readonly onClose?: () => void;
  readonly onApproveDeposit?: () => void;
}) {
  return (
    <section aria-labelledby="cashier-close-title">
      <h2 id="cashier-close-title">Cashier close</h2>
      <dl>
        <div>
          <dt>Expected cash</dt>
          <dd>
            <Money amountMinor={expectedMinor} currency={currency} />
          </dd>
        </div>
        <div>
          <dt>Counted cash</dt>
          <dd>
            {countedMinor === null ? (
              'Not counted'
            ) : (
              <Money amountMinor={countedMinor} currency={currency} />
            )}
          </dd>
        </div>
        <div>
          <dt>Variance</dt>
          <dd>
            {varianceMinor === null ? (
              'Pending count'
            ) : (
              <Money amountMinor={varianceMinor} currency={currency} />
            )}
          </dd>
        </div>
      </dl>
      <button type="button" disabled={!canClose || countedMinor === null} onClick={onClose}>
        Close session
      </button>{' '}
      <button
        type="button"
        disabled={!canApproveDeposit || countedMinor === null}
        onClick={onApproveDeposit}
      >
        Approve deposit
      </button>
      <p>Session closer and deposit approver must be different principals.</p>
    </section>
  );
}

export function ReconciliationWorkspace({
  rows,
  canMatch,
  canApprove,
  onMatch,
  onApprove,
}: {
  readonly rows: readonly ReconciliationRow[];
  readonly canMatch: boolean;
  readonly canApprove: boolean;
  readonly onMatch?: (lineId: string) => void;
  readonly onApprove?: (lineId: string) => void;
}) {
  return (
    <section aria-labelledby="reconciliation-title">
      <h2 id="reconciliation-title">Bank reconciliation</h2>
      <table>
        <caption>Imported statement lines and payment matches</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col">Reference</th>
            <th scope="col">Amount</th>
            <th scope="col">Status</th>
            <th scope="col">Match</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow columns={7} message="No bank statement lines are available." />
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <time dateTime={row.bookingDate}>{row.bookingDate}</time>
                </td>
                <td>{row.description}</td>
                <td>{row.externalReference ?? '—'}</td>
                <td>
                  <Money amountMinor={row.amountMinor} currency={row.currency} />
                </td>
                <td>{row.status}</td>
                <td>{row.matchedReceiptNumber ?? 'Unmatched'}</td>
                <td>
                  {row.status === 'unmatched' ? (
                    <button type="button" disabled={!canMatch} onClick={() => onMatch?.(row.id)}>
                      Match
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canApprove || row.status !== 'matched'}
                      onClick={() => onApprove?.(row.id)}
                    >
                      Reconcile
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

export function LedgerExplorer({
  rows,
  accountName,
  currency,
}: {
  readonly rows: readonly GeneralLedgerRow[];
  readonly accountName: string;
  readonly currency: string;
}) {
  return (
    <section aria-labelledby="ledger-explorer-title">
      <h2 id="ledger-explorer-title">General ledger · {accountName}</h2>
      <table>
        <caption>Posted journal lines with source-document trace</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Source</th>
            <th scope="col">Description</th>
            <th scope="col">Debit</th>
            <th scope="col">Credit</th>
            <th scope="col">Running balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow columns={6} message="No posted journal lines match this range." />
          ) : (
            rows.map((row) => (
              <tr key={`${row.journalEntryId}:${row.sourceDocumentId}`}>
                <td>{row.entryDate}</td>
                <td>
                  {row.sourceDocumentType} · {row.sourceDocumentId}
                </td>
                <td>{row.description}</td>
                <td>
                  <Money amountMinor={row.debitMinor} currency={currency} />
                </td>
                <td>
                  <Money amountMinor={row.creditMinor} currency={currency} />
                </td>
                <td>
                  <Money amountMinor={row.runningBalanceMinor} currency={currency} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

export function FinanceReports({
  trialBalance,
  asOf,
  currency,
  canExport,
  onExport,
}: {
  readonly trialBalance: readonly TrialBalanceRow[];
  readonly asOf: string;
  readonly currency: string;
  readonly canExport: boolean;
  readonly onExport?: () => void;
}) {
  return (
    <section aria-labelledby="finance-reports-title">
      <header>
        <h2 id="finance-reports-title">Financial reports</h2>
        <button type="button" disabled={!canExport} onClick={onExport}>
          Export report
        </button>
      </header>
      <p>
        Trial balance as of <time dateTime={asOf}>{asOf}</time>.
      </p>
      <table>
        <caption>Trial balance by account</caption>
        <thead>
          <tr>
            <th scope="col">Code</th>
            <th scope="col">Account</th>
            <th scope="col">Debit</th>
            <th scope="col">Credit</th>
            <th scope="col">Balance</th>
          </tr>
        </thead>
        <tbody>
          {trialBalance.length === 0 ? (
            <EmptyRow columns={5} message="No posted balances are available." />
          ) : (
            trialBalance.map((row) => (
              <tr key={row.accountId}>
                <th scope="row">{row.accountCode}</th>
                <td>{row.accountName}</td>
                <td>
                  <Money amountMinor={row.debitMinor} currency={currency} />
                </td>
                <td>
                  <Money amountMinor={row.creditMinor} currency={currency} />
                </td>
                <td>
                  <Money amountMinor={row.balanceMinor} currency={currency} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
