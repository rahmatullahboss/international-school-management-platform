import { StrictMode, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

import type { ProductionWorkspace } from './production-gateway';
import {
  newOperatorIdempotencyKey,
  submitProductionOperatorCommand,
  type ProductionOperatorCommandBody,
  type ProductionOperatorCommandResult,
} from './production-operator-command';
import {
  loadProductionOperatorWorkQueue,
  type ProductionOperatorWorkQueue,
} from './production-operator-work-queue';
import './pilot.css';
import './styles.css';

type OperatorRole = Extract<ProductionWorkspace['role'], 'admissions' | 'finance' | 'support'>;

type OperatorCommandConfig = {
  readonly command: ProductionOperatorCommandBody['command'];
  readonly permission: string;
};

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

function commandConfig(role: OperatorRole, pathname: string): OperatorCommandConfig | undefined {
  if (role === 'admissions' && pathname === '/admissions/applications') {
    return {
      command: 'admissions.application.review.record',
      permission: 'admissions.application.review',
    };
  }
  if (role === 'finance' && pathname === '/finance/reconciliation') {
    return {
      command: 'finance.bank-line.reconcile',
      permission: 'finance.reconciliation.write',
    };
  }
  if (role === 'support' && pathname === '/support/access') {
    return {
      command: 'support.break-glass.request',
      permission: 'support.break-glass.request',
    };
  }
  return undefined;
}

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

function queueMessage(queue: ProductionOperatorWorkQueue | undefined): ReactElement {
  if (queue === undefined) {
    return (
      <div className="pilot-demo-note" role="status">
        <strong>Loading current work queue…</strong>
        <span>Only database-owned candidates in the signed-in scope will be shown.</span>
      </div>
    );
  }
  if (queue.state !== 'ready') {
    return (
      <div className="pilot-demo-note" role="alert">
        <strong>Work queue unavailable</strong>
        <span>{queue.message}</span>
      </div>
    );
  }
  if (queue.items.length === 0) {
    return (
      <div className="pilot-demo-note" role="status">
        <strong>No current candidates</strong>
        <span>There is no eligible work in the current database-owned scope.</span>
      </div>
    );
  }
  return <></>;
}

function workQueueList(queue: ProductionOperatorWorkQueue | undefined): ReactElement | null {
  if (queue?.state !== 'ready' || queue.items.length === 0) return null;
  return (
    <section className="pilot-work-queue" aria-labelledby="production-work-queue-title">
      <div>
        <p>Current database work</p>
        <h3 id="production-work-queue-title">Work queue</h3>
        <span>Only candidates returned for the signed-in tenant and campus are actionable.</span>
      </div>
      <ol>
        {queue.role === 'admissions'
          ? queue.items.map((candidate) => (
              <li key={candidate.applicationId}>
                <div>
                  <strong>{candidate.applicationNumber}</strong>
                  <span>
                    {candidate.submittedAt === null
                      ? 'Submission time unavailable'
                      : `Submitted ${new Date(candidate.submittedAt).toLocaleString()}`}
                  </span>
                </div>
                <span className="pilot-status">{candidate.status}</span>
                <span>v{candidate.version}</span>
              </li>
            ))
          : queue.items.map((candidate) => (
              <li key={`${candidate.bankStatementLineId}:${candidate.paymentId}`}>
                <div>
                  <strong>{candidate.bookingDate}</strong>
                  <span>
                    Payment received {new Date(candidate.paymentReceivedAt).toLocaleString()}
                  </span>
                </div>
                <span className="pilot-status">Ready to match</span>
                <span>
                  {candidate.currency} {candidate.amountMinor} minor units
                </span>
              </li>
            ))}
      </ol>
    </section>
  );
}

function OperatorCommandPanel(props: {
  readonly role: OperatorRole;
  readonly pathname: string;
  readonly capabilities: readonly string[];
}): ReactElement | null {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ProductionOperatorCommandResult>();
  const [workQueue, setWorkQueue] = useState<ProductionOperatorWorkQueue>();
  const config = commandConfig(props.role, props.pathname);
  const command = config?.command;
  const permission = config?.permission;
  const allowed = permission !== undefined && props.capabilities.includes(permission);
  const needsWorkQueue =
    command === 'admissions.application.review.record' || command === 'finance.bank-line.reconcile';

  useEffect(() => {
    let cancelled = false;
    if (!allowed || !needsWorkQueue) {
      setWorkQueue(undefined);
      return () => {
        cancelled = true;
      };
    }
    setWorkQueue(undefined);
    void loadProductionOperatorWorkQueue().then((queue) => {
      if (!cancelled) setWorkQueue(queue);
    });
    return () => {
      cancelled = true;
    };
  }, [allowed, needsWorkQueue, props.pathname, props.role]);

  if (config === undefined || command === undefined || permission === undefined) return null;

  if (!allowed) {
    return (
      <section className="pilot-demo-note" aria-labelledby="operator-command-title">
        <strong id="operator-command-title">Action not granted</strong>
        <span>The current database role does not grant {permission}.</span>
      </section>
    );
  }

  const queueReadyForCommand =
    !needsWorkQueue ||
    (workQueue?.state === 'ready' &&
      ((command === 'admissions.application.review.record' && workQueue.role === 'admissions') ||
        (command === 'finance.bank-line.reconcile' && workQueue.role === 'finance')) &&
      workQueue.items.length > 0);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    let body: ProductionOperatorCommandBody;

    if (command === 'admissions.application.review.record') {
      if (workQueue?.state !== 'ready' || workQueue.role !== 'admissions') return;
      const applicationId = formString(form, 'candidate');
      const candidate = workQueue.items.find((item) => item.applicationId === applicationId);
      if (candidate === undefined) {
        setResult({
          state: 'unavailable',
          message: 'The selected application is no longer in the current work queue.',
        });
        return;
      }
      const scoreValue = formString(form, 'score');
      const notesValue = formString(form, 'notes');
      body = {
        command,
        applicationId: candidate.applicationId,
        expectedVersion: candidate.version,
        recommendation: formString(form, 'recommendation') as
          'admit' | 'waitlist' | 'decline' | 'more-information',
        score: scoreValue === '' ? null : Number(scoreValue),
        notes: notesValue === '' ? null : notesValue,
      };
    } else if (command === 'finance.bank-line.reconcile') {
      if (workQueue?.state !== 'ready' || workQueue.role !== 'finance') return;
      const candidateKey = formString(form, 'candidate');
      const candidate = workQueue.items.find(
        (item) => `${item.bankStatementLineId}:${item.paymentId}` === candidateKey,
      );
      if (candidate === undefined) {
        setResult({
          state: 'unavailable',
          message: 'The selected reconciliation candidate is no longer in the current work queue.',
        });
        return;
      }
      body = {
        command,
        bankStatementLineId: candidate.bankStatementLineId,
        paymentId: candidate.paymentId,
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
    if (nextResult.state === 'accepted' && needsWorkQueue) {
      setWorkQueue(await loadProductionOperatorWorkQueue());
    }
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
          The browser cannot choose tenant, campus, account, session or correlation scope.
          Admissions and Finance candidates are also loaded from the current server-owned database
          scope.
        </span>
      </div>
      {needsWorkQueue && !queueReadyForCommand ? queueMessage(workQueue) : null}
      {queueReadyForCommand ? workQueueList(workQueue) : null}
      <form className="pilot-demo-note" onSubmit={(event) => void submit(event)}>
        {command === 'admissions.application.review.record' ? (
          <>
            <label>
              Current application
              <select name="candidate" required defaultValue="" disabled={!queueReadyForCommand}>
                <option value="" disabled>
                  Select an eligible application
                </option>
                {workQueue?.state === 'ready' && workQueue.role === 'admissions'
                  ? workQueue.items.map((candidate) => (
                      <option key={candidate.applicationId} value={candidate.applicationId}>
                        {candidate.applicationNumber} · {candidate.status} · version{' '}
                        {candidate.version}
                      </option>
                    ))
                  : null}
              </select>
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
              Current reconciliation candidate
              <select name="candidate" required defaultValue="" disabled={!queueReadyForCommand}>
                <option value="" disabled>
                  Select an eligible bank-line/payment pair
                </option>
                {workQueue?.state === 'ready' && workQueue.role === 'finance'
                  ? workQueue.items.map((candidate) => (
                      <option
                        key={`${candidate.bankStatementLineId}:${candidate.paymentId}`}
                        value={`${candidate.bankStatementLineId}:${candidate.paymentId}`}
                      >
                        {candidate.bookingDate} · {candidate.currency} {candidate.amountMinor} minor
                        units
                      </option>
                    ))
                  : null}
              </select>
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
        <button type="submit" disabled={pending || !queueReadyForCommand}>
          {pending ? 'Submitting…' : 'Submit reviewed command'}
        </button>
      </form>
      {result === undefined ? null : resultMessage(result)}
    </section>
  );
}

export function ProductionOperatorPortal(props: {
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
    <div className="pilot-entry operator-entry" data-role={role}>
      <header className="pilot-entry__masthead">
        <div>
          <p className="pilot-kicker">Ozzyl International Demo School · Production workspace</p>
          <h1>{active?.label ?? config.title}</h1>
          <p>{active?.detail ?? config.description}</p>
        </div>
        <div className="pilot-entry__status">
          <strong>{role}</strong>
          <span>
            {props.workspace.assurance.toUpperCase()} · {props.workspace.capabilities.length}{' '}
            current grants
          </span>
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
            Only current database-owned work is actionable here. Approved writes use durable
            commands and server-owned scope; the browser cannot elevate its tenant, campus or role.
          </span>
        </section>
        <OperatorCommandPanel
          role={role}
          pathname={props.pathname}
          capabilities={props.workspace.capabilities}
        />
        <details className="pilot-demo-note" data-secondary-context="true">
          <summary>
            <strong>Access & security</strong>
            <span>
              {props.workspace.assurance.toUpperCase()} · {props.workspace.capabilities.length}{' '}
              current database grants
            </span>
          </summary>
          <p>
            Permission details are secondary context. Task controls above remain constrained by the
            signed-in database role, current assurance and server-owned scope.
          </p>
          <ul aria-label="Current database grants">
            {props.workspace.capabilities.map((capability) => (
              <li key={capability}>{capability}</li>
            ))}
          </ul>
        </details>
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
