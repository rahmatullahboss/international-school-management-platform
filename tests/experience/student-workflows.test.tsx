import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  StudentDailyWorkspace,
  selectStudentItems,
  sortStudentLessons,
  type StudentDailyWorkspaceProps,
} from '../../apps/web-student/src/features/experience/StudentDailyWorkspace';

const shared: StudentDailyWorkspaceProps = {
  studentId: 'student-1',
  studentName: 'Nadia Rahman',
  schoolName: 'International Community School',
  yearLabel: 'Grade 8',
  locale: 'en-BD',
  date: '2026-07-29',
  ageBand: 'secondary',
  capabilities: [
    'timetable.self.read',
    'attendance.self.read',
    'records.self.read',
    'resources.self.read',
    'requests.self.write',
    'documents.self.read',
    'messages.student.read',
  ],
  lessons: [
    {
      id: 'lesson-math',
      studentId: 'student-1',
      subject: 'Mathematics',
      teacherLabel: 'Ms Karim',
      startsAt: '2026-07-29T10:00:00+06:00',
      endsAt: '2026-07-29T10:45:00+06:00',
      room: 'Room 204',
      state: 'upcoming',
      href: '/student/lessons/math',
      requiredCapability: 'timetable.self.read',
    },
    {
      id: 'lesson-science',
      studentId: 'student-1',
      subject: 'Science',
      teacherLabel: 'Mr Hasan',
      startsAt: '2026-07-29T09:00:00+06:00',
      endsAt: '2026-07-29T09:45:00+06:00',
      room: 'Laboratory 1',
      state: 'current',
      href: '/student/lessons/science',
      requiredCapability: 'timetable.self.read',
    },
    {
      id: 'other-student-lesson',
      studentId: 'student-2',
      subject: 'Other student subject',
      teacherLabel: 'Other teacher',
      startsAt: '2026-07-29T08:00:00+06:00',
      endsAt: '2026-07-29T08:45:00+06:00',
      state: 'current',
      href: '/student/lessons/other',
      requiredCapability: 'timetable.self.read',
    },
  ],
  attendance: [
    {
      id: 'attendance-published',
      studentId: 'student-1',
      periodLabel: 'July 2026',
      presentCount: 18,
      absentCount: 1,
      lateCount: 2,
      publicationState: 'published',
      publishedAt: '2026-07-29',
      explanationStatus: 'One absence explanation is being reviewed.',
      href: '/student/attendance/july',
      requiredCapability: 'attendance.self.read',
    },
    {
      id: 'attendance-draft',
      studentId: 'student-1',
      periodLabel: 'Draft teacher register',
      presentCount: 19,
      absentCount: 0,
      lateCount: 1,
      publicationState: 'unpublished',
      href: '/student/attendance/draft',
      requiredCapability: 'attendance.self.read',
    },
  ],
  results: [
    {
      id: 'result-science',
      studentId: 'student-1',
      subjectLabel: 'Science',
      assessmentLabel: 'Unit 3 quiz',
      resultLabel: 'A-',
      feedback: 'Strong laboratory reasoning.',
      publicationState: 'published',
      publishedAt: '2026-07-28',
      href: '/student/results/science',
      requiredCapability: 'records.self.read',
    },
    {
      id: 'result-draft',
      studentId: 'student-1',
      subjectLabel: 'Draft Mathematics',
      assessmentLabel: 'Internal marking sheet',
      resultLabel: 'Draft mark',
      feedback: 'Internal teacher note must not render.',
      publicationState: 'unpublished',
      href: '/student/results/draft',
      requiredCapability: 'records.self.read',
    },
  ],
  resources: [
    {
      id: 'resource-science',
      studentId: 'student-1',
      subjectLabel: 'Science',
      title: 'Fieldwork preparation guide',
      description: 'Review the checklist before the fieldwork session.',
      resourceType: 'document',
      availableUntil: '2026-08-05',
      href: '/student/resources/science-guide',
      requiredCapability: 'resources.self.read',
    },
    {
      id: 'resource-other',
      studentId: 'student-2',
      subjectLabel: 'Other subject',
      title: 'Other student resource',
      description: 'Must not render.',
      resourceType: 'document',
      href: '/student/resources/other',
      requiredCapability: 'resources.self.read',
    },
  ],
  requests: [
    {
      id: 'request-club',
      studentId: 'student-1',
      title: 'Join robotics club',
      description: 'Complete the age-appropriate activity request.',
      state: 'draft',
      nextAction: 'Add a short reason for joining',
      href: '/student/requests/robotics',
      requiredCapability: 'requests.self.write',
    },
    {
      id: 'request-card',
      studentId: 'student-1',
      title: 'Replacement ID card',
      description: 'The request is being reviewed.',
      state: 'in-review',
      submittedAt: '2026-07-28',
      href: '/student/requests/id-card',
      requiredCapability: 'requests.self.write',
    },
  ],
  documents: [
    {
      id: 'document-report',
      studentId: 'student-1',
      title: 'Term 1 report card',
      category: 'Academic record',
      publicationState: 'published',
      publishedAt: '2026-07-28',
      downloadHref: '/student/documents/report-card',
      requiredCapability: 'documents.self.read',
    },
    {
      id: 'document-draft',
      studentId: 'student-1',
      title: 'Draft internal letter',
      category: 'Internal',
      publicationState: 'unpublished',
      downloadHref: '/student/documents/draft',
      requiredCapability: 'documents.self.read',
    },
  ],
  conversations: [
    {
      id: 'conversation-class',
      studentId: 'student-1',
      subject: 'Science fieldwork preparation',
      participantLabel: 'Science teacher',
      lastMessageAt: '2026-07-29T08:30:00+06:00',
      unreadCount: 2,
      href: '/student/messages/science',
      requiredCapability: 'messages.student.read',
    },
    {
      id: 'conversation-restricted',
      studentId: 'student-1',
      subject: 'Restricted safeguarding disclosure',
      participantLabel: 'Student support',
      lastMessageAt: '2026-07-29T08:45:00+06:00',
      unreadCount: 1,
      href: '/student/messages/restricted',
      requiredCapability: 'care.disclosure.read',
    },
  ],
};

describe('EXP-01 student experience', () => {
  it('filters self-only records before sorting and counting', () => {
    const visible = selectStudentItems(
      shared.lessons,
      'student-1',
      ['timetable.self.read'],
    );
    expect(visible.map((lesson) => lesson.id)).toEqual(['lesson-math', 'lesson-science']);
    expect(sortStudentLessons(visible).map((lesson) => lesson.id)).toEqual([
      'lesson-science',
      'lesson-math',
    ]);
  });

  it('renders current lessons, published attendance/results and age-appropriate actions', () => {
    const markup = renderToStaticMarkup(<StudentDailyWorkspace {...shared} />);
    expect(markup).toContain('Science');
    expect(markup).toContain('Mathematics');
    expect(markup.indexOf('Science')).toBeLessThan(markup.indexOf('Mathematics'));
    expect(markup).toContain('Open current lesson');
    expect(markup).not.toContain('Other student subject');
    expect(markup).toContain('One absence explanation is being reviewed.');
    expect(markup).not.toContain('Draft teacher register');
    expect(markup).toContain('Unit 3 quiz');
    expect(markup).toContain('A-');
    expect(markup).toContain('Strong laboratory reasoning.');
    expect(markup).not.toContain('Draft Mathematics');
    expect(markup).not.toContain('Internal teacher note must not render.');
  });

  it('keeps resources, requests, documents and messages inside self capability scope', () => {
    const markup = renderToStaticMarkup(<StudentDailyWorkspace {...shared} />);
    expect(markup).toContain('Fieldwork preparation guide');
    expect(markup).not.toContain('Other student resource');
    expect(markup).toContain('Join robotics club');
    expect(markup).toContain('Continue request');
    expect(markup).toContain('Replacement ID card');
    expect(markup).toContain('View request');
    expect(markup).toContain('Term 1 report card');
    expect(markup).not.toContain('Draft internal letter');
    expect(markup).toContain('Science fieldwork preparation');
    expect(markup).toContain('2 unread');
    expect(markup).not.toContain('Restricted safeguarding disclosure');
  });

  it('uses non-disclosing empty states when a capability is absent', () => {
    const markup = renderToStaticMarkup(
      <StudentDailyWorkspace
        {...shared}
        capabilities={['timetable.self.read']}
      />,
    );
    expect(markup).toContain('No published attendance');
    expect(markup).toContain('No published results');
    expect(markup).toContain('No class resources');
    expect(markup).toContain('No student requests');
    expect(markup).toContain('No authorised documents');
    expect(markup).toContain('No authorised messages');
    expect(markup).not.toContain('Restricted safeguarding disclosure');
  });

  it('preserves saved work context in loading and recoverable error states', () => {
    const loading = renderToStaticMarkup(<StudentDailyWorkspace {...shared} state="loading" />);
    const error = renderToStaticMarkup(
      <StudentDailyWorkspace
        {...shared}
        state="error"
        errorMessage="Your saved request and message drafts are unchanged."
        retryHref="/student?retry=1"
      />,
    );
    expect(loading).toContain('Preparing your school day');
    expect(error).toContain('role="alert"');
    expect(error).toContain('Your saved request and message drafts are unchanged.');
    expect(error).toContain('href="/student?retry=1"');
  });
});
