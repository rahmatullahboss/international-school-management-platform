import type { ComponentProps, ReactElement } from 'react';

import { ExperienceShell, type ExperienceNavigationItem } from '@school/documents-experience';
import '@school/documents-experience/shell.css';

const navigation: readonly ExperienceNavigationItem[] = [
  {
    id: 'today',
    label: 'Today',
    href: '/teacher',
    description: 'Teaching sequence and priority work',
  },
  {
    id: 'classes',
    label: 'My classes',
    href: '/teacher/classes',
    description: 'Sections, rosters and schedules',
    capability: 'classes.assigned.read',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    href: '/teacher/attendance',
    description: 'Capture, sync and finalise registers',
    capability: 'attendance.assigned.write',
  },
  {
    id: 'gradebook',
    label: 'Gradebook',
    href: '/teacher/gradebook',
    description: 'Assessments, evidence and comments',
    capability: 'gradebook.assigned.write',
  },
  {
    id: 'students',
    label: 'Student context',
    href: '/teacher/students',
    description: 'Permitted learning and support context',
    capability: 'student.assigned.read',
  },
  {
    id: 'messages',
    label: 'Messages',
    href: '/teacher/messages',
    description: 'Secure class and household communication',
    capability: 'messages.teacher.read',
  },
  {
    id: 'resources',
    label: 'Resources',
    href: '/teacher/resources',
    description: 'Published documents and materials',
    capability: 'resources.teacher.read',
  },
];

type SharedShellProps = Omit<ComponentProps<typeof ExperienceShell>, 'persona' | 'navigation'>;

export function TeacherExperienceShell(props: SharedShellProps): ReactElement {
  return <ExperienceShell {...props} persona="teacher" navigation={navigation} />;
}
