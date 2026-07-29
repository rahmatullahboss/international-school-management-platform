import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AcademicAdminWorkspace } from '../../apps/web-admin/src/features/academics/AcademicAdminWorkspace.js';
import { TeacherAcademicWorkspace } from '../../apps/web-teacher/src/features/academics/TeacherAcademicWorkspace.js';

const adminBase = {
  schoolName: 'International School',
  locale: 'en-GB',
  metrics: [
    {
      label: 'Publication blockers',
      value: 2,
      context: 'One timetable conflict and one unmoderated gradebook.',
      status: 'blocked' as const,
    },
  ],
  readiness: [
    {
      id: 'ready-1',
      area: 'timetable' as const,
      title: 'Teacher conflict',
      description: 'Two meetings overlap for the same teacher.',
      status: 'Open',
      severity: 'error' as const,
      owner: 'Scheduler',
      dueAt: '2026-08-01',
      href: '/academics/conflicts/ready-1',
    },
  ],
  publications: [
    {
      id: 'pub-1',
      kind: 'timetable' as const,
      name: 'Term 1 timetable',
      version: '2026.1',
      campus: 'Main campus',
      state: 'blocked' as const,
      blocker: '1 teacher conflict',
      href: '/academics/timetables/pub-1',
    },
  ],
  conflicts: [
    {
      conflictId: 'conflict-1',
      date: '2026-08-03',
      time: '08:00–09:00',
      resourceType: 'teacher' as const,
      resourceLabel: 'Teacher A',
      leftMeeting: 'Mathematics Grade 5',
      rightMeeting: 'Science Grade 5',
      severity: 'blocking' as const,
      href: '/academics/conflicts/conflict-1',
    },
  ],
  attendanceExceptions: [
    {
      sessionId: 'session-1',
      date: '2026-08-03',
      section: 'G5-A',
      teacher: 'Teacher A',
      missingStudents: 2,
      offlinePending: 1,
      state: 'incomplete' as const,
      href: '/academics/attendance/session-1',
    },
  ],
  gradebookReadiness: [
    {
      sectionId: 'section-1',
      section: 'G5-A Mathematics',
      reportingPeriod: 'Term 1',
      assessments: 6,
      unmoderated: 1,
      missingResults: 2,
      lockState: 'open' as const,
      href: '/academics/gradebooks/section-1',
    },
  ],
  recordsQueue: [
    {
      id: 'record-1',
      student: 'Student A',
      artifact: 'report card' as const,
      reportingPeriod: 'Term 1',
      status: 'Awaiting approval',
      approver: 'Principal',
      href: '/academics/records/record-1',
    },
  ],
  reports: [
    {
      label: 'Attendance exceptions',
      description: 'Students and sessions that require attendance follow-up.',
      href: '/academics/reports/attendance-exceptions',
      updatedAt: '23:00',
    },
  ],
  imports: [
    {
      batchId: 'batch-1',
      entity: 'course',
      filename: 'courses.csv',
      status: 'blocked' as const,
      acceptedRows: 10,
      rejectedRows: 1,
      duplicateRows: 2,
      href: '/academics/imports/batch-1',
    },
  ],
};

const teacherBase = {
  teacherName: 'Teacher A',
  locale: 'en-GB',
  timezone: 'Asia/Dhaka',
  sync: {
    state: 'offline' as const,
    pendingChanges: 2,
    lastSuccessfulSync: '22:45',
    retryAction: '/academics/sync/retry',
  },
  schedule: [
    {
      scheduledMeetingId: 'meeting-1',
      localDate: '2026-08-03',
      startsAt: '08:00',
      endsAt: '09:00',
      section: 'G5-A',
      course: 'Mathematics Grade 5',
      room: 'Room 101',
      status: 'next' as const,
      href: '/academics/meetings/meeting-1',
    },
  ],
  attendance: {
    sessionId: 'session-1',
    section: 'G5-A',
    course: 'Mathematics Grade 5',
    localDate: '2026-08-03',
    startsAt: '08:00',
    endsAt: '09:00',
    state: 'incomplete' as const,
    missingStudents: 1,
    students: [
      {
        studentProfileId: 'student-a',
        displayName: 'Student A',
        rollNumber: '05',
      },
    ],
    codeOptions: [
      {
        id: 'code-present',
        code: 'P',
        label: 'Present',
        requiresReason: false,
      },
    ],
    captureAction: '/academics/attendance/capture',
    finalizeAction: '/academics/attendance/finalize',
  },
  assessments: [
    {
      assessmentId: 'assessment-1',
      title: 'Algebra investigation',
      category: 'Coursework',
      dueAt: '2026-08-10',
      maximumPoints: 50,
      resultCount: 10,
      rosterCount: 20,
      state: 'published' as const,
      moderation: 'pending' as const,
      href: '/academics/assessments/assessment-1',
    },
  ],
  selectedAssessment: {
    assessmentId: 'assessment-1',
    title: 'Algebra investigation',
    students: [
      {
        studentProfileId: 'student-a',
        displayName: 'Student A',
        resultState: 'not-entered' as const,
        maximumPoints: 50,
        saveAction: '/academics/gradebook/save',
      },
    ],
  },
  reportCardComments: [
    {
      reportCardId: 'report-card-1',
      student: 'Student A',
      reportingPeriod: 'Term 1',
      courseGrade: 'A',
      state: 'draft' as const,
      saveAction: '/academics/report-cards/comment',
    },
  ],
};

describe('ACAD-01 academic workspaces', () => {
  it('renders an exception-first admin workspace with semantic tables and permission-gated actions', () => {
    const html = renderToStaticMarkup(<AcademicAdminWorkspace {...adminBase} />);

    expect(html).toContain('<main class="acad-workspace"');
    expect(html).toContain('Academic readiness exceptions');
    expect(html).toContain('Unresolved timetable conflicts');
    expect(html).toContain('Attendance sessions requiring action');
    expect(html).toContain('Section gradebook readiness');
    expect(html).toContain('Academic artifacts awaiting action');
    expect(html).not.toContain('Create academic structure');
    expect(html).not.toContain('Stage import');
    expect(html).not.toContain('Create export');
    expect(html.match(/<caption>/gu)?.length).toBeGreaterThanOrEqual(6);
  });

  it('renders admin loading, error and RTL states without losing landmark structure', () => {
    const loading = renderToStaticMarkup(<AcademicAdminWorkspace {...adminBase} state="loading" />);
    const error = renderToStaticMarkup(
      <AcademicAdminWorkspace
        {...adminBase}
        state="error"
        errorMessage="Academic read model is unavailable."
        direction="rtl"
        locale="ar"
      />,
    );

    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('Loading current academic readiness');
    expect(error).toContain('dir="rtl"');
    expect(error).toContain('role="alert"');
    expect(error).toContain('Academic read model is unavailable.');
  });

  it('renders teacher offline integrity, labelled forms and guarded finalization', () => {
    const html = renderToStaticMarkup(
      <TeacherAcademicWorkspace
        {...teacherBase}
        canCaptureAttendance
        canFinalizeAttendance
        canWriteGradebook
        canCommentOnReportCards
      />,
    );

    expect(html).toContain('Working offline');
    expect(html).toContain('2 pending changes');
    expect(html).toContain('Attendance results for G5-A');
    expect(html).toContain('Attendance result for Student A');
    expect(html).toContain('Raw score for Student A, maximum 50');
    expect(html).toContain('Report-card comment for Student A');
    expect(html).toContain('disabled=""');
    expect(html.match(/<form/gu)?.length).toBeGreaterThanOrEqual(4);
  });

  it('hides teacher mutation forms without permissions and supports RTL', () => {
    const html = renderToStaticMarkup(
      <TeacherAcademicWorkspace {...teacherBase} direction="rtl" locale="ar" />,
    );

    expect(html).toContain('dir="rtl"');
    expect(html).not.toContain('Save result');
    expect(html).not.toContain('Save grade');
    expect(html).not.toContain('Save comment');
    expect(html).not.toContain('Finalize attendance');
    expect(html).toContain('View result');
  });

  it('renders teacher loading and recoverable error states', () => {
    const loading = renderToStaticMarkup(
      <TeacherAcademicWorkspace {...teacherBase} state="loading" />,
    );
    const error = renderToStaticMarkup(
      <TeacherAcademicWorkspace
        {...teacherBase}
        state="error"
        errorMessage="Teacher read model is unavailable."
      />,
    );

    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('Loading schedule, attendance and gradebook data.');
    expect(error).toContain('role="alert"');
    expect(error).toContain('Teacher read model is unavailable.');
    expect(error).toContain('Retry loading the teacher workspace');
  });

  it('records responsive, focus, high-contrast and logical-property safeguards in CSS', () => {
    const adminCss = readFileSync(
      new URL('../../apps/web-admin/src/features/academics/academics.css', import.meta.url),
      'utf8',
    );
    const teacherCss = readFileSync(
      new URL(
        '../../apps/web-teacher/src/features/academics/teacher-academics.css',
        import.meta.url,
      ),
      'utf8',
    );
    const combined = `${adminCss}\n${teacherCss}`;

    expect(combined).toContain(':focus-visible');
    expect(combined).toContain('@media (forced-colors: active)');
    expect(combined).toContain('@media (max-width:');
    expect(combined).toContain('padding-inline');
    expect(combined).toContain('margin-inline');
    expect(combined).toContain('inset-block-start');
    expect(combined).not.toMatch(/margin-left|margin-right|padding-left|padding-right/gu);
    expect(adminCss).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
