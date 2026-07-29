import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AdminExperienceShell } from '../../apps/web-admin/src/features/experience/AdminExperienceShell';
import { GuardianExperienceShell } from '../../apps/web-family/src/features/experience/GuardianExperienceShell';
import { StudentExperienceShell } from '../../apps/web-student/src/features/experience/StudentExperienceShell';
import { TeacherExperienceShell } from '../../apps/web-teacher/src/features/experience/TeacherExperienceShell';
import {
  filterExperienceActions,
  filterExperienceNavigation,
  resolveExperienceDirection,
  type ExperienceNavigationItem,
} from '../../packages/modules/documents-experience/src/index';

const session = {
  assurance: 'aal2' as const,
  deviceLabel: 'School-managed Chromebook',
  expiresAt: '2026-07-29T18:00:00+06:00',
};

const online = {
  state: 'online' as const,
  pendingChanges: 0,
  lastSyncedAt: '2026-07-29T14:00:00+06:00',
};

const shared = {
  schoolName: 'International Community School',
  userName: 'Amina Rahman',
  locale: 'en-BD',
  pageTitle: 'Today at school',
  pageDescription: 'Current work, trusted state and the next action for this role.',
  activeHref: '/',
  capabilities: [] as string[],
  session,
  connectivity: online,
  children: <p>Current task surface</p>,
};

describe('EXP-01 persona experience foundation', () => {
  it('filters navigation and utility actions by explicit capability', () => {
    const navigation: readonly ExperienceNavigationItem[] = [
      { id: 'home', label: 'Home', href: '/', description: 'Always visible' },
      {
        id: 'restricted',
        label: 'Restricted',
        href: '/restricted',
        description: 'Permission required',
        capability: 'restricted.read',
      },
    ];

    expect(filterExperienceNavigation(navigation, [])).toHaveLength(1);
    expect(filterExperienceNavigation(navigation, ['restricted.read'])).toHaveLength(2);
    expect(
      filterExperienceActions(
        [
          { label: 'Help', href: '/help' },
          { label: 'Export', href: '/export', capability: 'reports.export' },
        ],
        [],
      ),
    ).toEqual([{ label: 'Help', href: '/help' }]);
  });

  it('derives RTL direction from locale while respecting an explicit override', () => {
    expect(resolveExperienceDirection('ar-AE')).toBe('rtl');
    expect(resolveExperienceDirection('en-GB')).toBe('ltr');
    expect(resolveExperienceDirection('ar-AE', 'ltr')).toBe('ltr');
  });

  it('renders capability-scoped admin navigation and verified session context', () => {
    const markup = renderToStaticMarkup(
      <AdminExperienceShell
        {...shared}
        activeHref="/admin/finance"
        capabilities={['finance.read', 'reports.read']}
      />,
    );

    expect(markup).toContain('Fees &amp; accounting');
    expect(markup).toContain('Reports &amp; exports');
    expect(markup).not.toContain('Health &amp; support');
    expect(markup).toContain('Verified session');
    expect(markup).toContain('aria-current="page"');
  });

  it('renders offline teacher guidance without exposing ungranted student context', () => {
    const markup = renderToStaticMarkup(
      <TeacherExperienceShell
        {...shared}
        activeHref="/teacher/attendance"
        capabilities={['attendance.assigned.write']}
        connectivity={{ state: 'offline', pendingChanges: 3, retryHref: '/teacher/sync' }}
      />,
    );

    expect(markup).toContain('Working offline');
    expect(markup).toContain('Approved changes will stay on this device');
    expect(markup).toContain('Take attendance');
    expect(markup).not.toContain('My students');
  });

  it('keeps guardian and student portals separate and purpose-bound', () => {
    const guardian = renderToStaticMarkup(
      <GuardianExperienceShell
        {...shared}
        activeHref="/family/children"
        capabilities={['student.household.read', 'finance.household.read']}
      />,
    );
    const student = renderToStaticMarkup(
      <StudentExperienceShell
        {...shared}
        activeHref="/student/results"
        capabilities={['records.self.read', 'timetable.self.read']}
      />,
    );

    expect(guardian).toContain('My children');
    expect(guardian).toContain('Fees &amp; payments');
    expect(guardian).not.toContain('Grades &amp; assessments');
    expect(student).toContain('Results &amp; reports');
    expect(student).toContain('Timetable');
    expect(student).not.toContain('Fees &amp; payments');
  });

  it('renders loading and recoverable error states with explicit copy', () => {
    const loading = renderToStaticMarkup(<StudentExperienceShell {...shared} state="loading" />);
    const error = renderToStaticMarkup(
      <StudentExperienceShell
        {...shared}
        state="error"
        errorTitle="Published results could not be loaded"
        errorDetail="Your saved requests are unchanged."
        retryHref="/student/results"
      />,
    );

    expect(loading).toContain('Updating this section');
    expect(loading).toContain('Your current workspace stays available');
    expect(error).toContain('Published results could not be loaded');
    expect(error).toContain('Your saved requests are unchanged.');
    expect(error).toContain('Try again');
  });
});
