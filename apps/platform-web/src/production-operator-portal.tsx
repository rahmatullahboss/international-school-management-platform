import { StrictMode, useState, type FormEvent, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

import type { ProductionWorkspace } from './production-gateway';
import {
  newOperatorIdempotencyKey,
  submitProductionOperatorCommand,
  type ProductionOperatorCommandBody,
  type ProductionOperatorCommandResult,
} from './production-operator-command';
import './pilot.css';
import './styles.css';

type OperatorRole = Extract<ProductionWorkspace['role'], 'admissions' | 'finance' | 'support'>;

const operatorConfig: Readonly<
  Record<
    OperatorRole,
    {
      readonly title: string;
      readonly description: string;
      readonly routes: readonly {
        readonly href: string;
        readonly label: string;
        readonly detail: string;
      }[];
    }
  >
> = {
  admissions: {
    title: 'Admissions workspace',
    description:
      'Review enquiries, applications and enrolment work within the current school scope.',
    routes: [
      {
        href: '/admissions/enquiries',
        label: 'Enquiries',
        detail: 'Prospective-family enquiry workflow',
      },
      {
        href: '/admissions/applications',
        label: 'Applications',
        detail: 'Application review and evidence',
      },
      {
        href: '/admissions/interviews',
        label: 'Interviews',
        detail: 'Interview scheduling and review',
      },
    ],
  },
  finance: {
    title: 'Finance and cashier workspace',
    description: 'Work with invoices, cashier sessions and reconciliation under explicit grants.',
    routes: [
      { href: '/finance/invoices', label: 'Invoices', detail: 'Invoice and statement context' },
      { href: '/finance/cashier', label: 'Cashier', detail: 'Receipt and cashier-session work' },
      {
        href: '/finance/reconciliation',
        label: 'Reconciliation',
        detail: 'Reviewed payment matching',
      },
    ],
  },
  support: {
    title: 'Platform support workspace',
    description: 'Use tenant-scoped diagnostics and audited privileged-access requests.',
    routes: [
      {
        href: '/support/tenants',
        label: 'Tenant scope',
        detail: 'Explicit support tenant selection',
      },
      {
        href: '/support/health',
        label: 'Deployment health',
        detail: 'Approved operational diagnostics',
      },
      {
        href: '/support/access',
        label: 'Privileged access',
        detail: 'Purpose-bound AAL2 support access',
      },
    ],
  },
};

function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function resultMessage(result: ProductionOperatorCommandResult): ReactElement {
  if (result.state === 'accepted') {
    return (
      <div className="pilot-demo-note" role="status">
        <strong>{result.replayed ? 'Existing receipt verified' : 'Command accepted'}</strong>
        <span>Command {result.commandId}</span>
        <span>Evidence {result.evidenceId}</span>
        <span>{new Date(result.acceptedAt).toLocaleString()}</span>
      </div>
    );
  }
  if (result.state === 'rejected') {
    return (
      <div className="pilot-demo-note" role="alert">
        <strong>{result.message}</strong>
        <span>Code: {result.code}</span>
        {result.requiredAssurance === 'aal2' ? (
          <span>Fresh AAL2 authentication is required before this privileged request.</span>
        ) : null}
        {result.currentVersion === undefined ? null : (
          <span>Current record version: {result.currentVersion}</span>
        )}
      </div>
    );
  }
  return (
    <div className="pilot-demo-note" role="alert">
      <strong>Command unavailable</strong>
      <span>{result.message}</span>
    </div>
  );
}

function OperatorCommandPanel(props: {
  readonly role: OperatorRole;
  readonly pathname: string;
  readonly capabilities: readonly string[];
}): ReactElement | null {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ProductionOperatorCommandResult>();

  let command: ProductionOperatorCommandBody['command'] | undefined;
  let permission: string | undefined;
  if (props.role === 'admissions' && props.pathname === '/admissions/applications') {
    command = 'admissions.application.review.record';
    permission = 'admissions.application.review';
  } else if (props.role === 'finance' && props.pathname === '/finance/reconciliation') {
    command = 'finance.bank-line.reconcile';
    permission = 'finance.reconciliation.write';
  } else if (props.role === 'support' && props.pathname === '/support/access') {
    command = 'support.break-glass.request';
    permission = 'support.break-glass.request';
  }
  if (command === undefined || permission === undefined) return null;

  const allowed = props.capabilities.includes(permission);
  if (!allowed) {
    return (
      <section className="pilot-demo-note" aria-labelledby="operator-command-title">
        <strong id="operator-command-title">Action not granted</strong>
        <span>The current database role does not grant {permission}.</span>
      </section>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    let body: ProductionOperatorCommandBody;

    if (command === 'admissions.application.review.record') {
      const scoreValue = formString(form, 'score');
      const notesValue = formString(form, 'notes');
      body = {
        command,
        applicationId: formString(form, 'applicationId'),
        expectedVersion: Number(formString(form, 'expectedVersion')),
        recommendation: formString(form, 'recommendation') as
          'admit' | 'waitlist' | 'decline' | 'more-information',
        score: scoreValue === '' ? null : Number(scoreValue),
        notes: notesValue === '' ? null : notesValue,
      };
    } else if (command === 'finance.bank-line.reconcile') {
      body = {
        command,
        bankStatementLineId: formString(form, 'bankStatementLineId'),
        paymentId: formString(form, 'paymentId'),
        reason: formString(form, 'reason'),
      };
    } else {
      body = {
        command,
        reason: formString(form, 'reason'),
        requestedMinutes: Number(formString(form, 'requestedMinutes')),
      };
    }

    setPending(true);
    setResult(undefined);
    const nextResult = await submitProductionOperatorCommand(
      body,
      newOperatorIdempotencyKey(command),
    );
    setResult(nextResult);
    setPending(false);
  };

  return (
    <section className="pilot-coverage" aria-labelledby="operator-command-title">
      <div className="pilot-section-heading">
        <p>Reviewed database command</p>
        <h2 id="operator-command-title">
          {command === 'admissions.application.review.record'
            ? 'Record application review'
            : command === 'finance.bank-line.reconcile'
              ? 'Reconcile bank statement line'
              : 'Request privileged support access'}
        </h2>
        <span>
          The browser cannot choose tenant, campus, account, session or correlation scope. Those are
          resolved server-side from the current durable session.
        </span>
      </div>
      <form className="pilot-demo-note" onSubmit={(event) => void submit(event)}>
        {command === 'admissions.application.review.record' ? (
          <>
            <label>
              Application ID
              <input name="applicationId" required autoComplete="off" />
            </label>
            <label>
              Expected version
              <input
                name="expectedVersion"
                type="number"
                min="1"
                step="1"
                defaultValue="1"
                required
              />
            </label>
            <label>
              Recommendation
              <select name="recommendation" defaultValue="more-information">
                <option value="admit">Admit</option>
                <option value="waitlist">Waitlist</option>
                <option value="decline">Decline</option>
                <option value="more-information">More information</option>
              </select>
            </label>
            <label>
              Score (optional)
              <input name="score" type="number" min="0" max="100" step="0.1" />
            </label>
            <label>
              Confidential review notes (optional)
              <textarea name="notes" maxLength={2000} />
            </label>
          </>
        ) : command === 'finance.bank-line.reconcile' ? (
          <>
            <label>
              Bank statement line ID
              <input name="bankStatementLineId" required autoComplete="off" />
            </label>
            <label>
              Payment ID
              <input name="paymentId" required autoComplete="off" />
            </label>
            <label>
              Reconciliation reason
              <textarea name="reason" minLength={8} maxLength={500} required />
            </label>
          </>
        ) : (
          <>
            <label>
              Purpose
              <textarea name="reason" minLength={8} maxLength={500} required />
            </label>
            <label>
              Requested minutes
              <input
                name="requestedMinutes"
                type="number"
                min="5"
                max="30"
                step="1"
                defaultValue="15"
                required
              />
            </label>
            <span>Support access remains pending and requires fresh AAL2 authorization.</span>
          </>
        )}
        <button type="submit" disabled={pending}>
          {pending ? 'Submitting…' : 'Submit reviewed command'}
        </button>
      </form>
      {result === undefined ? null : resultMessage(result)}
    </section>
  );
}

function ProductionOperatorPortal(props: {
  readonly workspace: ProductionWorkspace;
  readonly pathname: string;
}): ReactElement {
  const role = props.workspace.role as OperatorRole;
  const config = operatorConfig[role];
  const active = config.routes.find((route) => route.href === props.pathname);
  const signOut = (): void => {
    void fetch('/auth/v1/logout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'current' }),
    }).finally(() => window.location.assign('/'));
  };

  return (
    <div className="pilot-entry" data-role={role}>
      <header className="pilot-entry__masthead">
        <div>
          <p className="pilot-kicker">
            Ozzyl International Demo School · authenticated production QA
          </p>
          <h1>{active?.label ?? config.title}</h1>
          <p>{active?.detail ?? config.description}</p>
        </div>
        <div className="pilot-entry__status">
          <strong>{role}</strong>
          <span>{props.workspace.capabilities.length} current database capabilities</span>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="pilot-entry__main" id="main-content" tabIndex={-1}>
        <nav className="pilot-actions" aria-label={`${config.title} navigation`}>
          {config.routes.map((route) => (
            <a
              href={route.href}
              key={route.href}
              aria-current={route.href === props.pathname ? 'page' : undefined}
            >
              {route.label}
            </a>
          ))}
        </nav>
        <section className="pilot-demo-note">
          <strong>Database-authorized production surface</strong>
          <span>
            Synthetic pilot sessions and synthetic operator metrics are disabled here. Approved
            writes use the durable database command contracts and current server-resolved scope.
          </span>
        </section>
        <OperatorCommandPanel
          role={role}
          pathname={props.pathname}
          capabilities={props.workspace.capabilities}
        />
        <section className="pilot-coverage" aria-labelledby="capability-title">
          <div className="pilot-section-heading">
            <p>Current grants</p>
            <h2 id="capability-title">Capabilities for this signed-in account</h2>
          </div>
          <div className="pilot-coverage__grid">
            {props.workspace.capabilities.map((capability) => (
              <article key={capability}>
                <h3>{capability}</h3>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export function mountProductionOperatorPortal(
  workspace: ProductionWorkspace,
  pathname: string,
): void {
  const root = document.getElementById('root');
  if (root === null) throw new Error('Root element not found');
  createRoot(root).render(
    <StrictMode>
      <ProductionOperatorPortal workspace={workspace} pathname={pathname} />
    </StrictMode>,
  );
}
