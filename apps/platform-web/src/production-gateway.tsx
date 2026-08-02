import { StrictMode, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

import './pilot.css';
import './styles.css';

export const PRODUCTION_WEB_HOST =
  'international-school-platform-web-production.rahmatullahzisan.workers.dev';

type ProductionRole =
  | 'admin'
  | 'teacher'
  | 'guardian'
  | 'student'
  | 'admissions'
  | 'finance'
  | 'support';

export interface ProductionWorkspace {
  readonly role: ProductionRole;
  readonly path: string;
  readonly assurance: 'aal1' | 'aal2';
  readonly expiresAt: number;
  readonly capabilities: readonly string[];
}

interface WorkspaceResponse {
  readonly schemaVersion: 1;
  readonly workspace: ProductionWorkspace;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProductionRole(value: unknown): value is ProductionRole {
  return (
    value === 'admin' ||
    value === 'teacher' ||
    value === 'guardian' ||
    value === 'student' ||
    value === 'admissions' ||
    value === 'finance' ||
    value === 'support'
  );
}

function isWorkspaceResponse(value: unknown): value is WorkspaceResponse {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.workspace)) return false;
  return (
    isProductionRole(value.workspace.role) &&
    typeof value.workspace.path === 'string' &&
    value.workspace.path.startsWith('/') &&
    (value.workspace.assurance === 'aal1' || value.workspace.assurance === 'aal2') &&
    typeof value.workspace.expiresAt === 'number' &&
    Array.isArray(value.workspace.capabilities) &&
    value.workspace.capabilities.every((capability) => typeof capability === 'string')
  );
}

export function isProductionWebHost(): boolean {
  return window.location.hostname === PRODUCTION_WEB_HOST;
}

export async function resolveProductionWorkspace(): Promise<
  | { readonly state: 'current'; readonly workspace: ProductionWorkspace }
  | { readonly state: 'anonymous' }
  | { readonly state: 'unavailable' }
> {
  try {
    const response = await fetch('/auth/v1/workspace', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
    if (response.status === 401) return { state: 'anonymous' };
    if (!response.ok) return { state: 'unavailable' };
    const value: unknown = await response.json();
    if (!isWorkspaceResponse(value)) return { state: 'unavailable' };
    return { state: 'current', workspace: value.workspace };
  } catch {
    return { state: 'unavailable' };
  }
}

function ProductionGate(props: {
  readonly state: 'anonymous' | 'unavailable' | 'denied';
  readonly workspace?: ProductionWorkspace;
}): ReactElement {
  const denied = props.state === 'denied';
  return (
    <div className="pilot-entry">
      <main className="pilot-entry__main" id="main-content" tabIndex={-1}>
        <section className="pilot-demo-note" aria-labelledby="production-gate-title">
          <p className="pilot-kicker">Ozzyl International Demo School · production QA</p>
          <h1 id="production-gate-title">
            {denied
              ? 'This account cannot open that workspace'
              : props.state === 'anonymous'
                ? 'Sign in to continue'
                : 'Production sign-in is not configured yet'}
          </h1>
          <p>
            {denied
              ? 'Workspace access is derived from the current database role assignment.'
              : props.state === 'anonymous'
                ? 'Use the reviewed school identity provider. The browser cannot choose or elevate its role.'
                : 'The production surface remains fail-closed until the reviewed identity provider and secrets are available.'}
          </p>
          {props.state === 'anonymous' ? (
            <a className="pilot-role-card" href="/auth/v1/login?returnTo=%2F">
              Sign in with school account
            </a>
          ) : null}
          {denied && props.workspace !== undefined ? (
            <a className="pilot-role-card" href={props.workspace.path}>
              Open my authorized workspace
            </a>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export function mountProductionGate(
  state: 'anonymous' | 'unavailable' | 'denied',
  workspace?: ProductionWorkspace,
): void {
  const root = document.getElementById('root');
  if (root === null) throw new Error('Root element not found');
  createRoot(root).render(
    <StrictMode>
      <ProductionGate state={state} {...(workspace === undefined ? {} : { workspace })} />
    </StrictMode>,
  );
}

export function pathBelongsToWorkspace(pathname: string, workspacePath: string): boolean {
  return pathname === workspacePath || pathname.startsWith(`${workspacePath}/`);
}
