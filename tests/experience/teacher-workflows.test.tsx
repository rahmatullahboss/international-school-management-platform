import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  TeacherDailyWorkspace,
  selectTeacherItems,
  sortTeacherSessions,
  type TeacherClassSession,
  type TeacherDailyWorkspaceProps,
} from '../../apps/web-teacher/src/features/experience/TeacherDailyWorkspace';

const sessions: readonly TeacherClassSession[] = [
  {
    id: 'math-7b',
    subject: 'Mathematics',
    section: 'Grade 7B',
    startsAt: '2026-07-29T10:00:00+06:00',
    endsAt: '2026-07-29T10:45:00+06:00',
    room: 'Room 204',
    state: 'scheduled',
    href: '/teacher/classes/math-7b',
    requiredCapability: 'classes.assigned.read',
  },
  {
    id: 'science-8a',
    subject: 'Science',
    section: 'Grade 8A',
    startsAt: '2026-07-29T09:00:00+06:00',
    endsAt: '2026-07-29T09:45:00+06:00',
    state: 'in-progress',
    href: '/teacher/classes/science-8a',
    requiredCapability: 'classes.assigned.read',
  },
  {
    id: 'restricted-class',
    subject: 'Unassigned class',
    section: 'Grade 12X',
    startsAt: '2026-07-29T08:00:00+06:00',
    endsAt: '2026-07-29T08:45:00+06:00',
    state: 'scheduled',
    href: '/teacher/classes/restricted',
    requiredCapability: 'classes.other.read',
  },
];

const shared: TeacherDailyWorkspaceProps = {
  teacherName: 'Amina Rahman',
  schoolName: 'International Community School',
  locale: 'en-BD',
  date: '2026-07-29',
  connectivity: 'online',
  pendingChanges: 0,
  capabilities: [
    'classes.assigned.read',
    'attendance.assigned.write',
    'gradebook.assigned.write',
    'student.assigned.read',
    'messages.teacher.read',
  ],
  sessions,
  attendance: [
    {
      id: 'science-register',
      classLabel: 'Science · Grade 8A',
      sessionAt: '2026-07-29T09:00:00+06:00',
      rosterCount: 24,
      markedCount: 24,
      state: 'synced',
      href: '/teacher/attendance/science-register',
      finaliseHref: '/teacher/attendance/science-register/finalise',
      requiredCapability: 'attendance.assigned.write',
    },
    {
      id: 'math-register',
      classLabel: 'Mathematics · Grade 7B',
      sessionAt: '2026-07-29T10:00:00+06:00',
      rosterCount: 28,
      markedCount: 21,
      state: 'draft-local',
      href: '/teacher/attendance/math-register',
      retryHref: '/teacher/attendance/math-register/sync',
      requiredCapability: 'attendance.assigned.write',
    },
  ],
  gradebook: [
    {
      id: 'science-quiz',
      classLabel: 'Science · Grade 8A',
      assessmentLabel: 'Unit 3 quiz',
      dueAt: '2026-07-30',
      studentCount: 24,
      enteredCount: 22,
      publicationState: 'draft',
      href: '/teacher/gradebook/science-quiz',
      requiredCapability: 'gradebook.assigned.write',
    },
    {
      id: 'math-project',
      classLabel: 'Mathematics · Grade 7B',
      assessmentLabel: 'Geometry project',
      studentCount: 28,
      enteredCount: 28,
      publicationState: 'published',
      href: '/teacher/gradebook/math-project',
      requiredCapability: 'gradebook.assigned.write',
    },
  ],
  studentContext: [
    {
      id: 'student-nadia',
      displayName: 'Nadia Rahman',
      classLabel: 'Grade 8A',
      learningSummary: 'Prefers written instructions before independent laboratory work.',
      permittedTags: ['Seating plan', 'Learning preference'],
      nextAction: 'Check the laboratory instruction sheet',
      href: '/teacher/students/nadia',
      requiredCapability: 'student.assigned.read',
    },
    {
      id: 'restricted-context',
      displayName: 'Restricted safeguarding record',
      classLabel: 'Purpose-bound',
      learningSummary: 'This narrative must never render for a broad teacher.',
      permittedTags: ['Restricted'],
      href: '/teacher/students/restricted',
      requiredCapability: 'care.restricted.read',
    },
  ],
  conversations: [
    {
      id: 'household-thread',
      subject: 'Science fieldwork preparation',
      participantLabel: 'Nadia Rahman household',
      lastMessageAt: '2026-07-29T08:30:00+06:00',
      unreadCount: 2,
      href: '/teacher/messages/household-thread',
      requiredCapability: 'messages.teacher.read',
    },
    {
      id: 'restricted-thread',
      subject: 'Restricted student-support disclosure',
      participantLabel: 'Student-support team',
      lastMessageAt: '2026-07-29T08:45:00+06:00',
      unreadCount: 1,
      href: '/teacher/messages/restricted-thread',
      requiredCapability: 'care.disclosure.read',
    },
  ],
};

describe('EXP-01 teacher experience', () => {
  it('filters assigned items before sorting the teaching sequence', () => {
    const visible = selectTeacherItems(sessions, ['classes.assigned.read']);
    expect(visible.map((session) => session.id)).toEqual(['math-7b', 'science-8a']);
    expect(sortTeacherSessions(visible).map((session) => session.id)).toEqual([
      'science-8a',
      'math-7b',
    ]);
  });

  it('renders assigned classes, attendance progress, gradebook state and secure conversations', () => {
    const markup = renderToStaticMarkup(<TeacherDailyWorkspace {...shared} />);

    expect(markup).toContain('Science');
    expect(markup).toContain('Mathematics');
    expect(markup.indexOf('Science')).toBeLessThan(markup.indexOf('Mathematics'));
    expect(markup).not.toContain('Unassigned class');
    expect(markup).toContain('24 of 24 marked');
    expect(markup).toContain('Review and finalise');
    expect(markup).toContain('21 of 28 marked');
    expect(markup).toContain('Retry sync');
    expect(markup).toContain('Unit 3 quiz');
    expect(markup).toContain('draft');
    expect(markup).toContain('Geometry project');
    expect(markup).toContain('View results');
    expect(markup).toContain('Science fieldwork preparation');
    expect(markup).toContain('2 unread');
  });

  it('keeps restricted support narratives and conversations masked from broad teachers', () => {
    const markup = renderToStaticMarkup(<TeacherDailyWorkspace {...shared} />);

    expect(markup).toContain('Nadia Rahman');
    expect(markup).toContain('Prefers written instructions');
    expect(markup).not.toContain('Restricted safeguarding record');
    expect(markup).not.toContain('This narrative must never render');
    expect(markup).not.toContain('Restricted student-support disclosure');
  });

  it('keeps offline attendance work actionable and explains pending local changes', () => {
    const markup = renderToStaticMarkup(
      <TeacherDailyWorkspace {...shared} connectivity="offline" pendingChanges={3} />,
    );

    expect(markup).toContain('Working offline');
    expect(markup).toContain('3 pending changes');
    expect(markup).toContain('duplicate-safe sync succeeds');
    expect(markup).toContain('Continue on this device');
    expect(markup).not.toContain('Review and finalise');
  });

  it('uses a non-disclosing empty state when assigned student capability is absent', () => {
    const markup = renderToStaticMarkup(
      <TeacherDailyWorkspace
        {...shared}
        capabilities={['classes.assigned.read', 'attendance.assigned.write']}
      />,
    );

    expect(markup).toContain('No authorised student context');
    expect(markup).toContain(
      'No matching student record is available in your current assigned scope.',
    );
    expect(markup).not.toContain('Nadia Rahman');
    expect(markup).not.toContain('Restricted safeguarding record');
  });

  it('preserves saved work context in recoverable loading and error states', () => {
    const loading = renderToStaticMarkup(<TeacherDailyWorkspace {...shared} state="loading" />);
    const error = renderToStaticMarkup(
      <TeacherDailyWorkspace
        {...shared}
        state="error"
        errorMessage="Your saved local attendance and grade drafts are unchanged."
        retryHref="/teacher?retry=1"
      />,
    );

    expect(loading).toContain('Preparing today’s teaching workspace');
    expect(error).toContain('role="alert"');
    expect(error).toContain('Your saved local attendance and grade drafts are unchanged.');
    expect(error).toContain('href="/teacher?retry=1"');
  });
});
