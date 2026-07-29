import type { ComponentProps, ReactElement } from 'react';

import { ExperienceShell, type ExperienceNavigationItem } from '@school/documents-experience';
import '@school/documents-experience/shell.css';

const navigation: readonly ExperienceNavigationItem[] = [
  {
    id: 'today',
    group: 'Start',
    icon: 'home',
    label: 'Today',
    href: '/student',
    description: 'Your next lessons, deadlines and updates',
    keywords: ['home', 'dashboard', 'tasks'],
  },
  {
    id: 'timetable',
    group: 'My school day',
    icon: 'calendar',
    label: 'Timetable',
    href: '/student/timetable',
    description: 'Lesson times, rooms and schedule changes',
    keywords: ['classes', 'schedule', 'lessons'],
    capability: 'timetable.self.read',
  },
  {
    id: 'attendance',
    group: 'My school day',
    icon: 'attendance',
    label: 'Attendance',
    href: '/student/attendance',
    description: 'Your published attendance record',
    keywords: ['present', 'absent', 'late'],
    capability: 'attendance.self.read',
  },
  {
    id: 'results',
    group: 'Learning',
    icon: 'gradebook',
    label: 'Results & reports',
    href: '/student/results',
    description: 'Published grades, feedback and reports',
    keywords: ['marks', 'progress', 'gradebook'],
    capability: 'records.self.read',
  },
  {
    id: 'resources',
    group: 'Learning',
    icon: 'learning',
    label: 'Learning resources',
    href: '/student/resources',
    description: 'Class materials, documents and links',
    keywords: ['files', 'homework', 'lessons'],
    capability: 'resources.self.read',
  },
  {
    id: 'documents',
    group: 'School services',
    icon: 'documents',
    label: 'Documents',
    href: '/student/documents',
    description: 'School letters and authorised records',
    keywords: ['files', 'letters', 'downloads'],
    capability: 'documents.self.read',
  },
  {
    id: 'requests',
    group: 'School services',
    icon: 'requests',
    label: 'Requests & forms',
    href: '/student/requests',
    description: 'Send permitted forms and service requests',
    keywords: ['forms', 'help', 'services'],
    capability: 'requests.self.write',
  },
  {
    id: 'messages',
    group: 'School services',
    icon: 'messages',
    label: 'Messages',
    href: '/student/messages',
    description: 'Secure communication with the school',
    keywords: ['inbox', 'teachers', 'notices'],
    capability: 'messages.student.read',
  },
];

type SharedShellProps = Omit<ComponentProps<typeof ExperienceShell>, 'persona' | 'navigation'>;

export function StudentExperienceShell(props: SharedShellProps): ReactElement {
  return <ExperienceShell {...props} persona="student" navigation={navigation} />;
}
