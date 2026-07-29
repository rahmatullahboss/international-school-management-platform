import type { ComponentProps, ReactElement } from 'react';

import { ExperienceShell, type ExperienceNavigationItem } from '@school/documents-experience';
import '@school/documents-experience/shell.css';

const navigation: readonly ExperienceNavigationItem[] = [
  { id: 'today', label: 'Today', href: '/student', description: 'Next lessons and current tasks' },
  {
    id: 'timetable',
    label: 'Timetable',
    href: '/student/timetable',
    description: 'Published schedule and changes',
    capability: 'timetable.self.read',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    href: '/student/attendance',
    description: 'Published attendance record',
    capability: 'attendance.self.read',
  },
  {
    id: 'results',
    label: 'Results',
    href: '/student/results',
    description: 'Published grades and reports',
    capability: 'records.self.read',
  },
  {
    id: 'documents',
    label: 'Documents',
    href: '/student/documents',
    description: 'Authorised school documents',
    capability: 'documents.self.read',
  },
  {
    id: 'resources',
    label: 'Resources',
    href: '/student/resources',
    description: 'Class materials and links',
    capability: 'resources.self.read',
  },
  {
    id: 'requests',
    label: 'Requests',
    href: '/student/requests',
    description: 'Forms and service requests',
    capability: 'requests.self.write',
  },
  {
    id: 'messages',
    label: 'Messages',
    href: '/student/messages',
    description: 'Secure school communication',
    capability: 'messages.student.read',
  },
];

type SharedShellProps = Omit<ComponentProps<typeof ExperienceShell>, 'persona' | 'navigation'>;

export function StudentExperienceShell(props: SharedShellProps): ReactElement {
  return <ExperienceShell {...props} persona="student" navigation={navigation} />;
}
