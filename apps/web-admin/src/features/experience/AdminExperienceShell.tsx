import type { ComponentProps, ReactElement } from 'react';

import { ExperienceShell, type ExperienceNavigationItem } from '@school/documents-experience';
import '@school/documents-experience/shell.css';

const navigation: readonly ExperienceNavigationItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    href: '/admin',
    description: 'Priority work and school readiness',
  },
  {
    id: 'people',
    label: 'People and admissions',
    href: '/admin/sis',
    description: 'Families, applications and enrolment',
    capability: 'sis.read',
  },
  {
    id: 'academics',
    label: 'Academics',
    href: '/admin/academics',
    description: 'Structure, attendance and records',
    capability: 'academics.read',
  },
  {
    id: 'finance',
    label: 'Finance',
    href: '/admin/finance',
    description: 'Billing, payments and reconciliation',
    capability: 'finance.read',
  },
  {
    id: 'operations',
    label: 'Operations',
    href: '/admin/operations',
    description: 'Staff, assets and school services',
    capability: 'operations.read',
  },
  {
    id: 'care',
    label: 'Student support',
    href: '/admin/student-support',
    description: 'Restricted health and support work',
    capability: 'care.read',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    href: '/admin/integrations',
    description: 'Imports, connectors and country packs',
    capability: 'integrations.read',
  },
  {
    id: 'reports',
    label: 'Reports',
    href: '/admin/reports',
    description: 'Governed metrics and exports',
    capability: 'reports.read',
  },
];

type SharedShellProps = Omit<ComponentProps<typeof ExperienceShell>, 'persona' | 'navigation'>;

export function AdminExperienceShell(props: SharedShellProps): ReactElement {
  return <ExperienceShell {...props} persona="admin" navigation={navigation} />;
}
