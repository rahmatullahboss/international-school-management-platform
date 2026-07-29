import type { ComponentProps, ReactElement } from 'react';

import { ExperienceShell, type ExperienceNavigationItem } from '@school/documents-experience';
import '@school/documents-experience/shell.css';

const navigation: readonly ExperienceNavigationItem[] = [
  {
    id: 'home',
    label: 'Family home',
    href: '/family',
    description: 'Household tasks and school updates',
  },
  {
    id: 'applications',
    label: 'Applications',
    href: '/family/applications',
    description: 'Admissions forms and decisions',
    capability: 'admissions.household.read',
  },
  {
    id: 'children',
    label: 'My children',
    href: '/family/children',
    description: 'Profiles and current enrolments',
    capability: 'student.household.read',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    href: '/family/attendance',
    description: 'Published attendance and notices',
    capability: 'attendance.household.read',
  },
  {
    id: 'grades',
    label: 'Grades and reports',
    href: '/family/grades',
    description: 'Published results and report cards',
    capability: 'records.household.read',
  },
  {
    id: 'fees',
    label: 'Fees and payments',
    href: '/family/finance',
    description: 'Statements, receipts and payments',
    capability: 'finance.household.read',
  },
  {
    id: 'forms',
    label: 'Forms and consent',
    href: '/family/forms',
    description: 'Requests, consent and acknowledgements',
    capability: 'forms.household.read',
  },
  {
    id: 'documents',
    label: 'Documents',
    href: '/family/documents',
    description: 'Authorised school documents',
    capability: 'documents.household.read',
  },
  {
    id: 'messages',
    label: 'Messages',
    href: '/family/messages',
    description: 'Secure school communication',
    capability: 'messages.household.read',
  },
];

type SharedShellProps = Omit<ComponentProps<typeof ExperienceShell>, 'persona' | 'navigation'>;

export function GuardianExperienceShell(props: SharedShellProps): ReactElement {
  return <ExperienceShell {...props} persona="guardian" navigation={navigation} />;
}
