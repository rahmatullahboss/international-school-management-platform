import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ProductionWorkspace } from './production-gateway';
import { ProductionOperatorPortal } from './production-operator-portal';

const cases = [
  ['admissions', '/admissions/applications', 'Applications', 'Record application review'],
  ['finance', '/finance/reconciliation', 'Reconciliation', 'Reconcile bank statement line'],
  ['support', '/support/access', 'Privileged access', 'Request privileged support access'],
] as const satisfies readonly (readonly [ProductionWorkspace['role'], string, string, string])[];

describe('ProductionOperatorPortal', () => {
  it.each(cases)('keeps %s production work task-led', (role, path, heading, command) => {
    const workspace: ProductionWorkspace = {
      role,
      path,
      assurance: 'aal2',
      expiresAt: '2099-01-01T00:00:00.000Z',
      capabilities:
        role === 'admissions'
          ? ['admissions.application.review']
          : role === 'finance'
            ? ['finance.reconciliation.write']
            : ['support.break-glass.request'],
    };
    const markup = renderToStaticMarkup(
      <ProductionOperatorPortal workspace={workspace} pathname={path} />,
    );

    expect(markup).toContain('operator-entry');
    expect(markup).toContain('Production workspace');
    expect(markup).toContain(`<h1>${heading}</h1>`);
    expect(markup).toContain(command);
    expect(markup).toContain('data-secondary-context="true"');
    expect(markup).toContain('Access &amp; security');
    expect(markup).not.toContain('Capabilities for this signed-in account');
    expect(markup).not.toContain('authenticated production QA');
  });
});
