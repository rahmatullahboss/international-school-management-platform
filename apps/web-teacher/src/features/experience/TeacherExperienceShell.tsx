import type { ComponentProps, ReactElement } from 'react';

import { ExperienceShell, type ExperienceNavigationItem } from '@school/documents-experience';
import '@school/documents-experience/shell.css';
import '@school/documents-experience/shell-ux.css';

const navigation: readonly ExperienceNavigationItem[] = [
  {
    id: 'today',
    group: 'Start',
    icon: 'home',
    label: 'Today',
    href: '/teacher',
    description: 'Your lessons, attendance and priority work',
    keywords: ['home', 'dashboard', 'schedule'],
  },
  {
    id: 'classes',
    group: 'Teaching',
    icon: 'calendar',
    label: 'My classes',
    href: '/teacher/classes',
    description: 'Class lists, lesson times and rooms',
    keywords: ['sections', 'rosters', 'timetable'],
    capability: 'classes.assigned.read',
  },
  {
    id: 'attendance',
    group: 'Teaching',
    icon: 'attendance',
    label: 'Take attendance',
    href: '/teacher/attendance',
    description: 'Mark, review and finalise class registers',
    keywords: ['present', 'absent', 'late', 'register'],
    capability: 'attendance.assigned.write',
  },
  {
    id: 'gradebook',
    group: 'Teaching',
    icon: 'gradebook',
    label: 'Grades & assessments',
    href: '/teacher/gradebook',
    description: 'Enter marks, evidence and comments',
    keywords: ['gradebook', 'results', 'marks'],
    capability: 'gradebook.assigned.write',
  },
  {
    id: 'students',
    group: 'Teaching',
    icon: 'people',
    label: 'My students',
    href: '/teacher/students',
    description: 'Permitted learning and support context',
    keywords: ['profiles', 'support', 'adjustments'],
    capability: 'student.assigned.read',
  },
  {
    id: 'messages',
    group: 'Communication',
    icon: 'messages',
    label: 'Messages',
    href: '/teacher/messages',
    description: 'Secure class and family communication',
    keywords: ['parents', 'guardians', 'students'],
    capability: 'messages.teacher.read',
  },
  {
    id: 'resources',
    group: 'Communication',
    icon: 'documents',
    label: 'Teaching resources',
    href: '/teacher/resources',
    description: 'Published documents, links and materials',
    keywords: ['files', 'lessons', 'documents'],
    capability: 'resources.teacher.read',
  },
];

type SharedShellProps = Omit<ComponentProps<typeof ExperienceShell>, 'persona' | 'navigation'>;

export function TeacherExperienceShell(props: SharedShellProps): ReactElement {
  return <ExperienceShell {...props} persona="teacher" navigation={navigation} />;
}
