import type { ComponentProps, ReactElement } from 'react';

import { ExperienceShell, type ExperienceNavigationItem } from '@school/documents-experience';
import '@school/documents-experience/shell.css';
import '@school/documents-experience/shell-ux.css';

const navigation: readonly ExperienceNavigationItem[] = [
  {
    id: 'overview',
    group: 'Start',
    icon: 'home',
    label: 'Overview',
    href: '/admin',
    description: 'Urgent work, approvals and school readiness',
    keywords: ['dashboard', 'home', 'priority'],
  },
  {
    id: 'people',
    group: 'Students',
    icon: 'people',
    label: 'Students & admissions',
    href: '/admin/sis',
    description: 'People, families, applications and enrolment',
    keywords: ['sis', 'guardians', 'households', 'enrolment'],
    capability: 'sis.read',
  },
  {
    id: 'academics',
    group: 'Teaching & learning',
    icon: 'learning',
    label: 'Academics & attendance',
    href: '/admin/academics',
    description: 'Curriculum, timetable, attendance and records',
    keywords: ['classes', 'gradebook', 'transcripts', 'reports'],
    capability: 'academics.read',
  },
  {
    id: 'finance',
    group: 'Money',
    icon: 'money',
    label: 'Fees & accounting',
    href: '/admin/finance',
    description: 'Billing, payments, ledger and reconciliation',
    keywords: ['invoices', 'receipts', 'refunds', 'banking'],
    capability: 'finance.read',
  },
  {
    id: 'operations',
    group: 'School services',
    icon: 'operations',
    label: 'School operations',
    href: '/admin/operations',
    description: 'Staff, assets, library, transport and services',
    keywords: ['hr', 'inventory', 'procurement', 'cafeteria'],
    capability: 'operations.read',
  },
  {
    id: 'care',
    group: 'Student support',
    icon: 'support',
    label: 'Health & support',
    href: '/admin/student-support',
    description: 'Health, wellbeing, safeguarding and learning support',
    keywords: ['care', 'behaviour', 'counselling', 'restricted'],
    capability: 'care.read',
  },
  {
    id: 'communications',
    group: 'Communication',
    icon: 'messages',
    label: 'Messages & notices',
    href: '/admin/communications',
    description: 'Announcements, messages and delivery evidence',
    keywords: ['email', 'sms', 'notifications', 'announcements'],
    capability: 'communications.read',
  },
  {
    id: 'integrations',
    group: 'System',
    icon: 'integrations',
    label: 'Imports & integrations',
    href: '/admin/integrations',
    description: 'Imports, connectors, country settings and SSO',
    keywords: ['oneroster', 'lti', 'webhooks', 'migration'],
    capability: 'integrations.read',
  },
  {
    id: 'reports',
    group: 'System',
    icon: 'reports',
    label: 'Reports & exports',
    href: '/admin/reports',
    description: 'Governed metrics, evidence and exports',
    keywords: ['analytics', 'data', 'audit'],
    capability: 'reports.read',
  },
];

type SharedShellProps = Omit<ComponentProps<typeof ExperienceShell>, 'persona' | 'navigation'>;

export function AdminExperienceShell(props: SharedShellProps): ReactElement {
  return <ExperienceShell {...props} persona="admin" navigation={navigation} />;
}
