import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ProductionWorkspace } from './production-gateway';
import { ProductionOperatorPortal } from './production-operator-portal';

const cases = [
  ['finance', '/finance/reconciliation', 'Reconciliation', 'Reconcile bank statement line'],
  ['support', '/support/access', 'Privileged access', 'Request privileged support access'],
] as const satisfies readonly (readonly [ProductionWorkspace['role'], string, string, string])[];

describe('ProductionOperatorPortal', () => {
  it('uses the dedicated server-owned lifecycle panel for admissions applications', () => {
    const workspace: ProductionWorkspace = {
      role: 'admissions',
      path: '/admissions/applications',
      assurance: 'aal1',
      expiresAt: '2099-01-01T00:00:00.000Z',
      capabilities: [
        'admissions.application.review',
        'admissions.application.offer.issue',
        'admissions.application.offer.accept',
        'admissions.application.applicant.convert',
      ],
    };
    const markup = renderToStaticMarkup(
      <ProductionOperatorPortal workspace={workspace} pathname="/admissions/applications" />,
    );

    expect(markup).toContain('<h1>Applications</h1>');
    expect(markup).toContain('Server-owned admissions lifecycle');
    expect(markup).toContain('Applications requiring action');
    expect(markup).toContain('browser cannot submit arbitrary placement IDs');
    expect(markup).toContain('Loading admissions lifecycle');
    expect(markup).not.toContain('Record application review</button>');
  });

  it.each(cases)('keeps %s production work task-led', (role, path, heading, command) => {
    const workspace: ProductionWorkspace = {
      role,
      path,
      assurance: 'aal2',
      expiresAt: '2099-01-01T00:00:00.000Z',
      capabilities:
        role === 'finance' ? ['finance.reconciliation.write'] : ['support.break-glass.request'],
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
    expect(markup).not.toContain('Database-authorized production surface');
  });
});
