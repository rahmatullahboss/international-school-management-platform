import type { FinanceStatementEntry } from '@school/finance';

export interface FamilyInvoiceRow {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly issueDate: string;
  readonly dueDate: string;
  readonly status: string;
  readonly totalMinor: number;
  readonly balanceMinor: number;
  readonly currency: string;
  readonly downloadAvailable: boolean;
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

export function FamilyFinanceOverview({
  outstandingMinor,
  overdueMinor,
  unappliedMinor,
  nextDueDate,
  currency,
}: {
  readonly outstandingMinor: number;
  readonly overdueMinor: number;
  readonly unappliedMinor: number;
  readonly nextDueDate: string | null;
  readonly currency: string;
}) {
  return (
    <section aria-labelledby="family-finance-overview-title">
      <h1 id="family-finance-overview-title">Fees and payments</h1>
      <dl>
        <div>
          <dt>Outstanding</dt>
          <dd>
            <Money amountMinor={outstandingMinor} currency={currency} />
          </dd>
        </div>
        <div>
          <dt>Overdue</dt>
          <dd>
            <Money amountMinor={overdueMinor} currency={currency} />
          </dd>
        </div>
        <div>
          <dt>Unapplied credit</dt>
          <dd>
            <Money amountMinor={unappliedMinor} currency={currency} />
          </dd>
        </div>
        <div>
          <dt>Next due date</dt>
          <dd>
            {nextDueDate === null ? (
              'No payment due'
            ) : (
              <time dateTime={nextDueDate}>{nextDueDate}</time>
            )}
          </dd>
        </div>
      </dl>
      {overdueMinor > 0 ? (
        <p role="alert">
          An overdue balance is available for review. Open the invoice before making a payment.
        </p>
      ) : (
        <p role="status">No overdue balance.</p>
      )}
    </section>
  );
}

export function FamilyInvoiceList({
  invoices,
  onOpen,
  onDownload,
}: {
  readonly invoices: readonly FamilyInvoiceRow[];
  readonly onOpen?: (invoiceId: string) => void;
  readonly onDownload?: (invoiceId: string) => void;
}) {
  return (
    <section aria-labelledby="family-invoices-title">
      <h2 id="family-invoices-title">Invoices</h2>
      <table>
        <caption>Issued invoices, due dates and remaining balances</caption>
        <thead>
          <tr>
            <th scope="col">Invoice</th>
            <th scope="col">Issued</th>
            <th scope="col">Due</th>
            <th scope="col">Status</th>
            <th scope="col">Total</th>
            <th scope="col">Balance</th>
            <th scope="col">Documents</th>
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 ? (
            <tr>
              <td colSpan={7}>No invoices are available.</td>
            </tr>
          ) : (
            invoices.map((invoice) => (
              <tr key={invoice.id}>
                <th scope="row">
                  <button type="button" onClick={() => onOpen?.(invoice.id)}>
                    {invoice.invoiceNumber}
                  </button>
                </th>
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
                    disabled={!invoice.downloadAvailable}
                    onClick={() => onDownload?.(invoice.id)}
                  >
                    Download invoice
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

export function FamilyPaymentPanel({
  invoiceNumber,
  maximumMinor,
  currency,
  providerName,
  paymentPending,
  onPay,
}: {
  readonly invoiceNumber: string;
  readonly maximumMinor: number;
  readonly currency: string;
  readonly providerName: string;
  readonly paymentPending: boolean;
  readonly onPay?: () => void;
}) {
  return (
    <section aria-labelledby="family-payment-title">
      <h2 id="family-payment-title">Pay {invoiceNumber}</h2>
      <p>
        Maximum payable amount: <Money amountMinor={maximumMinor} currency={currency} />.
      </p>
      <p>
        Payments are securely processed by {providerName}. A receipt appears only after provider
        verification.
      </p>
      <button
        type="button"
        disabled={paymentPending || maximumMinor <= 0}
        aria-busy={paymentPending}
        onClick={onPay}
      >
        {paymentPending ? 'Payment pending verification' : 'Continue to payment'}
      </button>
    </section>
  );
}

export function FamilyStatement({
  entries,
  openingBalanceMinor,
  closingBalanceMinor,
  currency,
  asOf,
}: {
  readonly entries: readonly FinanceStatementEntry[];
  readonly openingBalanceMinor: number;
  readonly closingBalanceMinor: number;
  readonly currency: string;
  readonly asOf: string;
}) {
  return (
    <section aria-labelledby="family-statement-title">
      <h2 id="family-statement-title">Account statement</h2>
      <p>
        As of <time dateTime={asOf}>{asOf}</time>. Opening balance{' '}
        <Money amountMinor={openingBalanceMinor} currency={currency} />; closing balance{' '}
        <Money amountMinor={closingBalanceMinor} currency={currency} />.
      </p>
      <table>
        <caption>Invoices, credits, payments and refunds</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Document</th>
            <th scope="col">Type</th>
            <th scope="col">Debit</th>
            <th scope="col">Credit</th>
            <th scope="col">Balance</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={6}>No statement activity is available.</td>
            </tr>
          ) : (
            entries.map((entry) => (
              <tr key={`${entry.type}:${entry.documentId}`}>
                <td>
                  <time dateTime={entry.date}>{entry.date}</time>
                </td>
                <th scope="row">{entry.documentNumber}</th>
                <td>{entry.type}</td>
                <td>
                  <Money amountMinor={entry.debitMinor} currency={currency} />
                </td>
                <td>
                  <Money amountMinor={entry.creditMinor} currency={currency} />
                </td>
                <td>
                  <Money amountMinor={entry.runningBalanceMinor} currency={currency} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
