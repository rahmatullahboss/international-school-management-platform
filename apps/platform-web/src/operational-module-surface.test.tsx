import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { modulePages } from './pilot-data';
import { OperationalModuleSurface } from './operational-module-surface';
import type { PilotRole } from './portal-shared';

const routeCases = [
  ['/admin/sis', 'admin', 'Applicant register'],
  ['/admin/academics', 'admin', 'Attendance cut-off control'],
  ['/admin/finance', 'admin', 'Deposit reconciliation'],
  ['/admin/operations', 'admin', 'Route 6 live control'],
  ['/admin/student-support', 'admin', 'Purpose-bound work queue'],
  ['/admin/communications', 'admin', 'Publication queue'],
  ['/admin/integrations', 'admin', 'Connector registry'],
  ['/admin/reports', 'admin', 'Report catalogue'],
  ['/teacher/classes', 'teacher', 'Year 8A Mathematics roster'],
  ['/teacher/attendance', 'teacher', 'Year 8A attendance register'],
  ['/teacher/gradebook', 'teacher', 'Algebra checkpoint gradebook'],
  ['/teacher/students', 'teacher', 'Assigned student register'],
  ['/teacher/messages', 'teacher', 'Relationship context'],
  ['/teacher/resources', 'teacher', 'Resource register'],
  ['/family/applications', 'guardian', 'Application progress'],
  ['/family/children', 'guardian', 'Authorised profile'],
  ['/family/attendance', 'guardian', 'July 2026 attendance record'],
  ['/family/grades', 'guardian', 'Published subject results'],
  ['/family/finance', 'guardian', 'Current statement'],
  ['/family/forms', 'guardian', 'Science trip consent'],
  ['/family/documents', 'guardian', 'Document register'],
  ['/family/messages', 'guardian', 'Relationship context'],
  ['/student/timetable', 'student', 'Wednesday timetable'],
  ['/student/attendance', 'student', 'July 2026 attendance record'],
  ['/student/results', 'student', 'My subject results'],
  ['/student/documents', 'student', 'Document register'],
  ['/student/resources', 'student', 'Learning resource register'],
  ['/student/requests', 'student', 'Library book renewal'],
  ['/student/messages', 'student', 'Relationship context'],
] as const satisfies readonly (readonly [string, PilotRole, string])[];

function renderRoute(path: string, role: PilotRole): string {
  const page = modulePages[path];
  if (page === undefined) throw new Error(`Missing test page for ${path}`);
  return renderToStaticMarkup(<OperationalModuleSurface path={path} page={page} role={role} />);
}

describe('OperationalModuleSurface', () => {
  it.each(routeCases)('renders route-specific operational UI for %s', (path, role, marker) => {
    const markup = renderRoute(path, role);

    expect(markup).toContain(`data-route="${path}"`);
    expect(markup).toContain(marker);
    expect(markup).toContain('operational-metrics');
    expect(markup).not.toContain('pilot-module__heading');
  });

  it.each(['/family/documents', '/student/documents'] as const)(
    'keeps out-of-scope document rows fully generic on %s',
    (path) => {
      const role: PilotRole = path.startsWith('/family') ? 'guardian' : 'student';
      const markup = renderRoute(path, role);

      expect(markup).toContain('Not available in this scope');
      expect(markup).not.toContain('Medical Form Update');
      expect(markup).not.toContain('Medical Consent Form');
      expect(markup).not.toContain('Camp Medical Consent');
    },
  );

  it('uses touch-sized explicit attendance controls rather than a generic queue-only module', () => {
    const markup = renderRoute('/teacher/attendance', 'teacher');

    expect(markup).toContain('Present');
    expect(markup).toContain('Absent');
    expect(markup).toContain('Late');
    expect(markup).toContain('Review and finalise');
    expect(markup).toContain('Conflict example');
  });

  it('disables production-write controls until a safe route contract is wired', () => {
    const markup = renderRoute('/admin/reports', 'admin');

    expect(markup).toContain('operational-pilot-action-boundary');
    expect(markup).toContain('Approve with AAL2');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('existing safe route contract is wired');
  });

  it('does not present unavailable timetable days as working controls', () => {
    const markup = renderRoute('/student/timetable', 'student');

    expect(markup).toContain('Only Wednesday’s synthetic schedule is loaded');
    expect(markup).toContain('student-timetable-preview-boundary');
    expect(markup).toContain('disabled=""');
  });

  it('keeps messaging as ruled records with an authorised locked recipient', () => {
    const markup = renderRoute('/student/messages', 'student');

    expect(markup).toContain('operational-message-records');
    expect(markup).toContain('Recipient');
    expect(markup).toContain('Mr Karim · Science');
    expect(markup).toContain('Not available in this scope');
    expect(markup).toContain('aria-pressed="false"');
  });

  it.each([
    ['/admin/sis', 'admin'],
    ['/admin/academics', 'admin'],
  ] as const)('does not expose same-route actions as working links on %s', (path, role) => {
    const markup = renderRoute(path, role);

    expect(markup).not.toContain(`href="${path}"`);
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('operational-pilot-action-boundary');
  });

  it.each([
    ['/family/grades', 'guardian', 'Review mathematics feedback'],
    ['/student/timetable', 'student', 'Week view'],
  ] as const)('keeps residual same-route preview actions disabled on %s', (path, role, label) => {
    const markup = renderRoute(path, role);

    expect(markup).not.toContain(`href="${path}"`);
    expect(markup).toContain(label);
    expect(markup).toContain('disabled=""');
  });
});
