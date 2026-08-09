import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

import { OperatorRouteWorkspace } from './operator-route-workspace';
import './operator-route-workspace.css';
import { PilotDataStatus, UnknownRoute } from './portal-shared';
import './pilot.css';
import './pilot-resource.css';
import './pilot-ux.css';
import './styles.css';

export type OperatorRole = 'admissions' | 'finance' | 'support';

interface OperatorMetric {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

interface OperatorWorkItem {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly status: string;
  readonly href: string;
  readonly requiredCapability: string;
}

interface OperatorAction {
  readonly label: string;
  readonly href: string;
}

interface OperatorData {
  readonly metrics: readonly OperatorMetric[];
  readonly workItems: readonly OperatorWorkItem[];
  readonly actions: readonly OperatorAction[];
}

interface OperatorSnapshot {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly scope: {
    readonly tenantId: string;
    readonly campusId: string;
    readonly role: OperatorRole;
    readonly subjectId: string;
    readonly assurance: 'aal1' | 'aal2';
    readonly capabilities: readonly string[];
  };
  readonly data: OperatorData;
}

interface OperatorSession {
  readonly schemaVersion: 1;
  readonly tokenType: 'Bearer';
  readonly accessToken: string;
  readonly expiresAt: string;
  readonly scope: {
    readonly tenantId: string;
    readonly campusId: string;
    readonly role: OperatorRole;
    readonly subjectId: string;
    readonly assurance: 'aal1' | 'aal2';
  };
}

interface OperatorConfig {
  readonly root: string;
  readonly title: string;
  readonly description: string;
  readonly userName: string;
  readonly subjectId: string;
  readonly capabilities: readonly string[];
  readonly data: OperatorData;
  readonly pages: Readonly<
    Record<string, { readonly title: string; readonly description: string }>
  >;
  readonly command: string;
  readonly commandLabel: string;
  readonly commandReason: string;
}

const operatorConfigs: Readonly<Record<OperatorRole, OperatorConfig>> = {
  admissions: {
    root: '/admissions',
    title: 'Admissions workspace',
    description:
      'Process enquiries, applications, interviews and enrolment conversion without finance or restricted-care access.',
    userName: 'Farhana Islam · Admissions Officer',
    subjectId: 'admissions-1',
    capabilities: [
      'admissions.enquiry.read',
      'admissions.application.read',
      'admissions.application.review',
      'admissions.interview.manage',
      'admissions.offer.prepare',
      'admissions.enrolment.convert',
    ],
    data: {
      metrics: [
        { label: 'Open enquiries', value: '18', detail: 'Six require first response today' },
        { label: 'Applications in review', value: '27', detail: 'Across current intake cycles' },
        { label: 'Interviews scheduled', value: '9', detail: 'Next seven days' },
      ],
      workItems: [
        {
          id: 'application-1',
          title: 'Review Nabil Noor application',
          detail: 'Required documents are complete and ready for admissions review.',
          status: 'Ready',
          href: '/admissions/applications',
          requiredCapability: 'admissions.application.review',
        },
      ],
      actions: [
        { label: 'Open applications', href: '/admissions/applications' },
        { label: 'Review interviews', href: '/admissions/interviews' },
      ],
    },
    pages: {
      '/admissions/enquiries': {
        title: 'Admissions enquiries',
        description: 'Respond to prospective families and track enquiry follow-up.',
      },
      '/admissions/applications': {
        title: 'Application review queue',
        description: 'Review applications, documents and readiness without finance access.',
      },
      '/admissions/interviews': {
        title: 'Admissions interviews',
        description: 'Schedule and record permitted interview workflow evidence.',
      },
    },
    command: 'application.review.record',
    commandLabel: 'Record application review evidence',
    commandReason: 'E2E admissions review evidence',
  },
  finance: {
    root: '/finance',
    title: 'Finance and cashier workspace',
    description:
      'Issue receipts, manage a cashier session and reconcile payments with least-privilege controls.',
    userName: 'Nusrat Jahan · Cashier',
    subjectId: 'cashier-1',
    capabilities: [
      'finance.invoice.read',
      'finance.receipt.create',
      'finance.cash-session.manage',
      'finance.reconciliation.write',
      'finance.statement.read',
    ],
    data: {
      metrics: [
        { label: 'Receipts today', value: '63', detail: 'BDT 486k verified' },
        { label: 'Open cash session', value: '1', detail: 'Counter A · balanced so far' },
        { label: 'Unreconciled receipts', value: '7', detail: 'Waiting for deposit matching' },
      ],
      workItems: [
        {
          id: 'cash-1',
          title: 'Reconcile Counter A cash session',
          detail: 'Receipt total and counted cash are ready for review.',
          status: 'Ready',
          href: '/finance/cashier',
          requiredCapability: 'finance.cash-session.manage',
        },
      ],
      actions: [
        { label: 'Open cashier', href: '/finance/cashier' },
        { label: 'Open reconciliation', href: '/finance/reconciliation' },
      ],
    },
    pages: {
      '/finance/invoices': {
        title: 'Invoices and statements',
        description: 'Review issued invoices and household statement context.',
      },
      '/finance/cashier': {
        title: 'Cashier session',
        description: 'Record receipts and balance the active cashier session.',
      },
      '/finance/reconciliation': {
        title: 'Reconciliation queue',
        description: 'Match verified receipts to deposit evidence without refund approval rights.',
      },
    },
    command: 'cash-session.reconcile.record',
    commandLabel: 'Record reconciliation evidence',
    commandReason: 'E2E cashier reconciliation evidence',
  },
  support: {
    root: '/support',
    title: 'Platform support workspace',
    description:
      'Diagnose tenant and deployment health through time-bound audited access without implicit student-data access.',
    userName: 'Platform Support · Verified operator',
    subjectId: 'support-operator-1',
    capabilities: [
      'platform.tenant.select',
      'platform.deployment-health.read',
      'support.diagnostics.read',
      'support.access.request',
      'support.break-glass.request',
    ],
    data: {
      metrics: [
        { label: 'Healthy tenants', value: '24 / 24', detail: 'No active deployment incidents' },
        { label: 'Open support cases', value: '3', detail: 'All tenant-scoped and audited' },
        { label: 'Privileged grants', value: '0', detail: 'No active break-glass access' },
      ],
      workItems: [
        {
          id: 'support-1',
          title: 'Capture tenant diagnostics',
          detail: 'Read-only deployment and projection health for the selected tenant.',
          status: 'Diagnostic',
          href: '/support/health',
          requiredCapability: 'support.diagnostics.read',
        },
      ],
      actions: [
        { label: 'Select tenant', href: '/support/tenants' },
        { label: 'Open deployment health', href: '/support/health' },
      ],
    },
    pages: {
      '/support/tenants': {
        title: 'Tenant selection',
        description: 'Select an explicit tenant scope before support diagnostics are available.',
      },
      '/support/health': {
        title: 'Deployment health',
        description:
          'Inspect approved operational health signals without tenant-owned record mutation.',
      },
      '/support/access': {
        title: 'Privileged access',
        description: 'Request purpose-bound support access with AAL2, expiry and audit evidence.',
      },
    },
    command: 'tenant.diagnostics.capture',
    commandLabel: 'Capture diagnostic evidence',
    commandReason: 'E2E support diagnostic evidence',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveApiBase(): string | undefined {
  const runtimeOverride = window.__PLATFORM_API_URL__?.trim();
  if (runtimeOverride !== undefined && runtimeOverride !== '')
    return runtimeOverride.replace(/\/$/u, '');
  const buildValue = (import.meta.env.VITE_PLATFORM_API_URL as string | undefined)?.trim();
  if (buildValue !== undefined && buildValue !== '') return buildValue.replace(/\/$/u, '');
  if (
    window.location.hostname ===
    'international-school-platform-web-staging.rahmatullahzisan.workers.dev'
  ) {
    return 'https://international-school-platform-api-staging.rahmatullahzisan.workers.dev';
  }
  return undefined;
}

function isMatchingSession(value: unknown, role: OperatorRole): value is OperatorSession {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.tokenType !== 'Bearer') return false;
  if (
    typeof value.accessToken !== 'string' ||
    value.accessToken.length < 32 ||
    !isRecord(value.scope)
  )
    return false;
  return (
    value.scope.tenantId === 'tenant-pilot-001' &&
    value.scope.campusId === 'campus-main' &&
    value.scope.role === role &&
    value.scope.subjectId === operatorConfigs[role].subjectId &&
    (value.scope.assurance === 'aal1' || value.scope.assurance === 'aal2')
  );
}

function isMatchingSnapshot(value: unknown, role: OperatorRole): value is OperatorSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.generatedAt !== 'string')
    return false;
  if (!isRecord(value.scope) || !isRecord(value.data)) return false;
  return (
    value.scope.tenantId === 'tenant-pilot-001' &&
    value.scope.campusId === 'campus-main' &&
    value.scope.role === role &&
    value.scope.subjectId === operatorConfigs[role].subjectId &&
    Array.isArray(value.scope.capabilities)
  );
}

function useOperatorResource(role: OperatorRole) {
  const config = operatorConfigs[role];
  const apiBase = useMemo(resolveApiBase, []);
  const [data, setData] = useState<OperatorData>(config.data);
  const [capabilities, setCapabilities] = useState<readonly string[]>(config.capabilities);
  const [updatedAt, setUpdatedAt] = useState('2026-08-01T14:00:00+06:00');
  const [state, setState] = useState<'seed' | 'refreshing' | 'current' | 'stale'>('seed');
  const [message, setMessage] = useState<string>();
  const [accessToken, setAccessToken] = useState<string>();
  const [commandStatus, setCommandStatus] = useState<string>();

  const refresh = useCallback((): void => {
    if (apiBase === undefined || !navigator.onLine) return;
    setState('refreshing');
    setMessage(undefined);
    void (async () => {
      const sessionResponse = await fetch(`${apiBase}/pilot/v1/sessions/${role}`, {
        method: 'POST',
        cache: 'no-store',
      });
      if (!sessionResponse.ok)
        throw new Error(`Staging session returned ${sessionResponse.status}.`);
      const sessionValue: unknown = await sessionResponse.json();
      if (!isMatchingSession(sessionValue, role))
        throw new Error('Staging session scope is invalid.');
      const snapshotResponse = await fetch(`${apiBase}/pilot/v1/snapshots/${role}`, {
        headers: { authorization: `Bearer ${sessionValue.accessToken}` },
        cache: 'no-store',
      });
      if (!snapshotResponse.ok)
        throw new Error(`Staging data returned ${snapshotResponse.status}.`);
      const snapshotValue: unknown = await snapshotResponse.json();
      if (!isMatchingSnapshot(snapshotValue, role))
        throw new Error('Staging data scope is invalid.');
      setAccessToken(sessionValue.accessToken);
      setData(snapshotValue.data);
      setCapabilities(snapshotValue.scope.capabilities);
      setUpdatedAt(snapshotValue.generatedAt);
      setState('current');
    })().catch((error: unknown) => {
      setState('stale');
      setMessage(error instanceof Error ? error.message : 'The staging API could not be reached.');
    });
  }, [apiBase, role]);

  useEffect(() => refresh(), [refresh]);

  const submitControlledAction = useCallback((): void => {
    if (apiBase === undefined || accessToken === undefined) return;
    const idempotencyKey = `pilot-${role}-${crypto.randomUUID()}`;
    setCommandStatus('Recording controlled evidence…');
    void fetch(`${apiBase}/pilot/v1/commands/${role}/${config.command}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        tenantId: 'tenant-pilot-001',
        campusId: 'campus-main',
        reason: config.commandReason,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Controlled action returned ${response.status}.`);
        const body: unknown = await response.json();
        if (
          !isRecord(body) ||
          !isRecord(body.receipt) ||
          typeof body.receipt.auditId !== 'string'
        ) {
          throw new Error('Controlled action did not return audit evidence.');
        }
        setCommandStatus(`Audit receipt recorded · ${body.receipt.auditId}`);
      })
      .catch((error: unknown) => {
        setCommandStatus(error instanceof Error ? error.message : 'Controlled action failed.');
      });
  }, [accessToken, apiBase, config.command, config.commandReason, role]);

  return {
    apiBase,
    data,
    capabilities,
    updatedAt,
    state,
    message,
    refresh,
    submitControlledAction,
    commandStatus,
  };
}

export function operatorRoleForPath(pathname: string): OperatorRole | undefined {
  const normalized = pathname === '/' ? pathname : pathname.replace(/\/+$/u, '');
  return (Object.entries(operatorConfigs) as [OperatorRole, OperatorConfig][]).find(
    ([, config]) => normalized === config.root || normalized.startsWith(`${config.root}/`),
  )?.[0];
}

function OperatorHome(props: {
  readonly role: OperatorRole;
  readonly data: OperatorData;
}): ReactElement {
  return (
    <>
      <section
        className="pilot-metrics"
        aria-label={`${operatorConfigs[props.role].title} summary`}
      >
        {props.data.metrics.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="pilot-work-queue" aria-labelledby={`${props.role}-work-title`}>
        <div>
          <p>Permission-scoped work</p>
          <h2 id={`${props.role}-work-title`}>Priority work</h2>
          <span>Only actions granted to this persona are shown.</span>
        </div>
        <ol>
          {props.data.workItems.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
              <span className="pilot-status">{item.status}</span>
              <a href={item.href}>Open task</a>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

export function OperatorPortal(props: {
  readonly role: OperatorRole;
  readonly path: string;
}): ReactElement {
  const config = operatorConfigs[props.role];
  const page = config.pages[props.path];
  const isHome = props.path === config.root;
  const known = isHome || page !== undefined;
  const title = isHome ? config.title : (page?.title ?? config.title);
  const description = isHome ? config.description : (page?.description ?? config.description);
  const resource = useOperatorResource(props.role);

  return (
    <div className="pilot-entry operator-entry" data-role={props.role}>
      <a className="pilot-skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="pilot-entry__masthead">
        <div>
          <p className="pilot-kicker">Ozzyl International Demo School · Staging workspace</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="pilot-entry__status">
          <strong>{config.userName}</strong>
          <span>{resource.capabilities.length} explicit capabilities</span>
          <a href="/">Change role</a>
        </div>
      </header>

      <main id="main-content" className="pilot-entry__main" tabIndex={-1}>
        <PilotDataStatus
          state={resource.state}
          apiConfigured={resource.apiBase !== undefined}
          updatedAt={resource.updatedAt}
          message={resource.message}
          onRefresh={resource.refresh}
        />

        {!known ? (
          <UnknownRoute homeHref={config.root} />
        ) : (
          <>
            <nav className="pilot-actions" aria-label={`${config.title} navigation`}>
              <a href={config.root} aria-current={isHome ? 'page' : undefined}>
                Overview
              </a>
              {Object.entries(config.pages).map(([href, route]) => (
                <a href={href} key={href} aria-current={href === props.path ? 'page' : undefined}>
                  {route.title}
                </a>
              ))}
            </nav>

            {isHome ? (
              <OperatorHome role={props.role} data={resource.data} />
            ) : (
              <OperatorRouteWorkspace role={props.role} path={props.path} />
            )}

            {isHome ? (
              <section className="pilot-demo-note" aria-label="Controlled pilot mutation">
                <strong>Environment audit evidence</strong>
                <span>
                  This control records staging audit evidence only. It does not change school
                  finance or student records.
                </span>
                <button
                  type="button"
                  onClick={resource.submitControlledAction}
                  disabled={resource.apiBase === undefined}
                >
                  {config.commandLabel}
                </button>
                {resource.commandStatus === undefined ? null : (
                  <p role="status">{resource.commandStatus}</p>
                )}
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

export function mountOperatorPortal(role: OperatorRole): void {
  const root = document.getElementById('root');
  if (root === null) throw new Error('Root element not found');
  createRoot(root).render(
    <OperatorPortal role={role} path={window.location.pathname.replace(/\/+$/u, '') || '/'} />,
  );
}
