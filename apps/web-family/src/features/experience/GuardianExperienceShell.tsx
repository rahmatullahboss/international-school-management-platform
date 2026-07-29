import type { ComponentProps, ReactElement } from 'react';

import { ExperienceShell, type ExperienceNavigationItem } from '@school/documents-experience';
import '@school/documents-experience/shell.css';

const navigation: readonly ExperienceNavigationItem[] = [
  {
    id: 'home',
    group: 'Start',
    icon: 'home',
    label: 'Family home',
    href: '/family',
    description: 'Children, tasks, payments and school updates',
    keywords: ['dashboard', 'overview'],
  },
  {
    id: 'children',
    group: 'My family',
    icon: 'people',
    label: 'My children',
    href: '/family/children',
    description: 'Profiles and current school enrolments',
    keywords: ['students', 'profiles', 'enrolment'],
    capability: 'student.household.read',
  },
  {
    id: 'applications',
    group: 'My family',
    icon: 'requests',
    label: 'Applications',
    href: '/family/applications',
    description: 'Admissions forms, progress and decisions',
    keywords: ['admissions', 'apply', 'offers'],
    capability: 'admissions.household.read',
  },
  {
    id: 'attendance',
    group: 'School progress',
    icon: 'attendance',
    label: 'Attendance',
    href: '/family/attendance',
    description: 'Published attendance and absence notices',
    keywords: ['present', 'absent', 'late'],
    capability: 'attendance.household.read',
  },
  {
    id: 'grades',
    group: 'School progress',
    icon: 'gradebook',
    label: 'Grades & reports',
    href: '/family/grades',
    description: 'Published results and report cards',
    keywords: ['marks', 'results', 'progress'],
    capability: 'records.household.read',
  },
  {
    id: 'fees',
    group: 'Account',
    icon: 'money',
    label: 'Fees & payments',
    href: '/family/finance',
    description: 'Statements, receipts and payment history',
    keywords: ['invoices', 'balance', 'receipt'],
    capability: 'finance.household.read',
  },
  {
    id: 'forms',
    group: 'Forms & communication',
    icon: 'requests',
    label: 'Forms & consent',
    href: '/family/forms',
    description: 'Complete requests, consent and acknowledgements',
    keywords: ['permission', 'signature', 'requests'],
    capability: 'forms.household.read',
  },
  {
    id: 'documents',
    group: 'Forms & communication',
    icon: 'documents',
    label: 'Documents',
    href: '/family/documents',
    description: 'School letters, files and authorised records',
    keywords: ['letters', 'files', 'downloads'],
    capability: 'documents.household.read',
  },
  {
    id: 'messages',
    group: 'Forms & communication',
    icon: 'messages',
    label: 'Messages',
    href: '/family/messages',
    description: 'Secure communication with the school',
    keywords: ['teachers', 'notices', 'inbox'],
    capability: 'messages.household.read',
  },
];

type SharedShellProps = Omit<ComponentProps<typeof ExperienceShell>, 'persona' | 'navigation'>;

export function GuardianExperienceShell(props: SharedShellProps): ReactElement {
  return <ExperienceShell {...props} persona="guardian" navigation={navigation} />;
}
