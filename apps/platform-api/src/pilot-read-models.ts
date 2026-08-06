export type PilotReadRole = 'admin' | 'teacher' | 'guardian' | 'student';

export interface PilotReadScope {
  readonly tenantId: string;
  readonly campusId: string;
  readonly role: PilotReadRole;
  readonly subjectId: string;
  readonly capabilities: readonly string[];
}

export interface PilotReadSnapshot {
  readonly schemaVersion: 1;
  readonly sourceVersion: string;
  readonly generatedAt: string;
  readonly scope: PilotReadScope;
  readonly data: Readonly<Record<string, unknown>>;
}

export type PilotReadResolution =
  | {
      readonly ok: true;
      readonly snapshot: PilotReadSnapshot;
      readonly etag: string;
    }
  | {
      readonly ok: false;
      readonly status: 400 | 403 | 404;
      readonly code: string;
      readonly message: string;
    };

const PILOT_TENANT_ID = 'tenant-pilot-001';
const PILOT_CAMPUS_ID = 'campus-main';
const SOURCE_VERSION = 'pilot-read-v1-2026-07-30';
const timestamp = '2026-07-30T03:30:00+06:00';
const source = {
  label: 'Scoped staging read API',
  href: '/admin/reports',
  updatedAt: timestamp,
};

const roleDefinitions = {
  admin: {
    subjectId: 'principal-1',
    capabilities: [
      'sis.read',
      'academics.read',
      'finance.read',
      'operations.read',
      'care.read',
      'communications.read',
      'integrations.read',
      'reports.read',
      'attendance.manage',
      'attendance.bulk-remind',
      'records.approve',
      'student.read',
      'care.restricted.read',
    ],
    data: {
      metrics: [
        {
          id: 'students',
          label: 'Active students',
          value: 842,
          definition: 'Students with an active enrolment in the current academic year.',
          tone: 'stable',
          source,
          capability: 'sis.read',
        },
        {
          id: 'attendance',
          label: 'Registers ready',
          value: '42 / 44',
          definition: 'Finalised attendance registers for today’s scheduled sessions.',
          tone: 'warning',
          source,
          capability: 'academics.read',
        },
        {
          id: 'finance',
          label: 'Unreconciled receipts',
          value: 6,
          definition: 'Verified receipts waiting for deposit reconciliation.',
          tone: 'error',
          source,
          capability: 'finance.read',
        },
        {
          id: 'operations',
          label: 'Operational exceptions',
          value: 4,
          definition: 'Transport, inventory and staffing items requiring attention.',
          tone: 'information',
          source,
          capability: 'operations.read',
        },
      ],
      exceptions: [
        {
          id: 'attendance-1',
          area: 'Attendance',
          title: 'Two registers are not finalised',
          summary: 'Assigned classes remain open after the daily cut-off.',
          severity: 'warning',
          status: 'Open',
          href: '/admin/academics',
          source,
          dueAt: '2026-07-30T09:30:00+06:00',
          capability: 'attendance.manage',
          bulkGroup: 'attendance-finalisation',
          bulkCapability: 'attendance.bulk-remind',
        },
        {
          id: 'finance-1',
          area: 'Finance',
          title: 'Deposit reconciliation requires review',
          summary: 'Six verified receipts are not matched to a bank deposit.',
          severity: 'error',
          status: 'Review',
          href: '/admin/finance',
          source,
          capability: 'finance.read',
        },
      ],
      approvals: [
        {
          id: 'approval-1',
          title: 'Approve transcript correction',
          requestor: 'Records office',
          submittedAt: '2026-07-29T22:30:00+06:00',
          stage: 'Principal approval',
          href: '/admin/academics',
          capability: 'records.approve',
          requiredAssurance: 'aal2',
        },
      ],
      searchResults: [
        {
          id: 'student-1',
          kind: 'Student',
          label: 'Samira Noor',
          context: 'Year 8 · active enrolment',
          href: '/admin/sis',
          capability: 'student.read',
        },
      ],
      bulkActions: [
        {
          id: 'remind',
          label: 'Send reminder',
          group: 'attendance-finalisation',
          capability: 'attendance.bulk-remind',
          href: '/admin/academics',
        },
      ],
    },
  },
  teacher: {
    subjectId: 'teacher-1',
    capabilities: [
      'classes.assigned.read',
      'attendance.assigned.write',
      'gradebook.assigned.write',
      'student.assigned.read',
      'messages.teacher.read',
      'resources.teacher.read',
    ],
    data: {
      sessions: [
        {
          id: 'session-1',
          subject: 'Mathematics',
          section: 'Year 8A',
          startsAt: '2026-07-30T08:00:00+06:00',
          endsAt: '2026-07-30T08:45:00+06:00',
          room: 'Room 204',
          state: 'in-progress',
          href: '/teacher/classes',
          requiredCapability: 'classes.assigned.read',
        },
        {
          id: 'session-2',
          subject: 'Mathematics',
          section: 'Year 9B',
          startsAt: '2026-07-30T10:00:00+06:00',
          endsAt: '2026-07-30T10:45:00+06:00',
          room: 'Room 204',
          state: 'scheduled',
          href: '/teacher/classes',
          requiredCapability: 'classes.assigned.read',
        },
      ],
      attendance: [
        {
          id: 'attendance-1',
          classLabel: 'Year 8A · Mathematics',
          sessionAt: '2026-07-30T08:00:00+06:00',
          rosterCount: 28,
          markedCount: 28,
          state: 'synced',
          href: '/teacher/attendance',
          finaliseHref: '/teacher/attendance',
          requiredCapability: 'attendance.assigned.write',
        },
        {
          id: 'attendance-2',
          classLabel: 'Year 9B · Mathematics',
          sessionAt: '2026-07-30T10:00:00+06:00',
          rosterCount: 26,
          markedCount: 0,
          state: 'not-started',
          href: '/teacher/attendance',
          requiredCapability: 'attendance.assigned.write',
        },
      ],
      gradebook: [
        {
          id: 'gradebook-1',
          classLabel: 'Year 8A',
          assessmentLabel: 'Algebra checkpoint',
          dueAt: '2026-07-31T16:00:00+06:00',
          studentCount: 28,
          enteredCount: 23,
          publicationState: 'draft',
          href: '/teacher/gradebook',
          requiredCapability: 'gradebook.assigned.write',
        },
      ],
      studentContext: [
        {
          id: 'student-1',
          displayName: 'Samira Noor',
          classLabel: 'Year 8A',
          learningSummary: 'Strong recent progress in algebra; one current support adjustment.',
          permittedTags: ['Learning support', 'Parent contact'],
          nextAction: 'Review adjusted task before the next lesson.',
          href: '/teacher/students',
          requiredCapability: 'student.assigned.read',
        },
      ],
      conversations: [
        {
          id: 'conversation-1',
          subject: 'Year 8A algebra resources',
          participantLabel: 'Guardian of Samira Noor',
          lastMessageAt: '2026-07-29T21:20:00+06:00',
          unreadCount: 1,
          href: '/teacher/messages',
          requiredCapability: 'messages.teacher.read',
        },
      ],
    },
  },
  guardian: {
    subjectId: 'guardian-1',
    capabilities: [
      'admissions.household.read',
      'student.household.read',
      'attendance.household.read',
      'records.household.read',
      'finance.household.read',
      'forms.household.read',
      'documents.household.read',
      'messages.household.read',
    ],
    data: {
      children: [
        {
          childId: 'student-1',
          displayName: 'Samira Noor',
          preferredName: 'Samira',
          yearLabel: 'Year 8',
          campusLabel: 'Main Campus',
          relationshipLabel: 'Daughter',
          avatarText: 'SN',
          profileHref: '/family/children',
          requiredCapability: 'student.household.read',
        },
      ],
      applications: [
        {
          id: 'application-1',
          applicantName: 'Nabil Noor',
          programmeLabel: 'Year 3 · 2027 intake',
          statusLabel: 'Documents requested',
          nextAction: 'Upload birth certificate copy',
          dueAt: '2026-08-05T17:00:00+06:00',
          href: '/family/applications',
          requiredCapability: 'admissions.household.read',
        },
      ],
      attendance: [
        {
          id: 'attendance-1',
          childId: 'student-1',
          periodLabel: 'July 2026',
          presentCount: 18,
          absentCount: 1,
          lateCount: 2,
          publishedAt: timestamp,
          notice: 'One absence explanation is under review.',
          href: '/family/attendance',
          requiredCapability: 'attendance.household.read',
        },
      ],
      grades: [
        {
          id: 'grade-1',
          childId: 'student-1',
          subjectLabel: 'Mathematics',
          resultLabel: 'A-',
          teacherComment: 'Consistent progress; practise multi-step equations.',
          publicationState: 'published',
          publishedAt: '2026-07-28T15:00:00+06:00',
          href: '/family/grades',
          requiredCapability: 'records.household.read',
        },
      ],
      fees: [
        {
          id: 'fee-1',
          childId: 'student-1',
          label: 'August tuition instalment',
          amountMinor: 1850000,
          currency: 'BDT',
          balanceState: 'due',
          dueAt: '2026-08-10T23:59:00+06:00',
          statementHref: '/family/finance',
          paymentHref: '/family/finance',
          requiredCapability: 'finance.household.read',
        },
      ],
      forms: [
        {
          id: 'form-1',
          childId: 'student-1',
          title: 'Science trip consent',
          description: 'Review the itinerary and submit guardian consent.',
          state: 'due-soon',
          dueAt: '2026-08-02T17:00:00+06:00',
          requiresAssurance: 'aal1',
          href: '/family/forms',
          requiredCapability: 'forms.household.read',
        },
      ],
      documents: [
        {
          id: 'document-1',
          childId: 'student-1',
          title: 'Term 2 progress report',
          category: 'Report card',
          publishedAt: '2026-07-28T15:00:00+06:00',
          downloadHref: '/family/documents',
          requiredCapability: 'documents.household.read',
        },
      ],
      conversations: [
        {
          id: 'conversation-1',
          childId: 'student-1',
          subject: 'Algebra resources',
          participantLabel: 'Ms Rahman · Mathematics',
          lastMessageAt: '2026-07-29T21:20:00+06:00',
          unreadCount: 1,
          href: '/family/messages',
          requiredCapability: 'messages.household.read',
        },
      ],
    },
  },
  student: {
    subjectId: 'student-1',
    capabilities: [
      'timetable.self.read',
      'attendance.self.read',
      'records.self.read',
      'documents.self.read',
      'resources.self.read',
      'requests.self.write',
      'messages.student.read',
    ],
    data: {
      lessons: [
        {
          id: 'lesson-1',
          studentId: 'student-1',
          subject: 'Mathematics',
          teacherLabel: 'Ms Rahman',
          startsAt: '2026-07-30T08:00:00+06:00',
          endsAt: '2026-07-30T08:45:00+06:00',
          room: 'Room 204',
          state: 'current',
          href: '/student/timetable',
          requiredCapability: 'timetable.self.read',
        },
        {
          id: 'lesson-2',
          studentId: 'student-1',
          subject: 'Science',
          teacherLabel: 'Mr Karim',
          startsAt: '2026-07-30T09:00:00+06:00',
          endsAt: '2026-07-30T09:45:00+06:00',
          room: 'Lab 2',
          state: 'upcoming',
          href: '/student/timetable',
          requiredCapability: 'timetable.self.read',
        },
      ],
      attendance: [
        {
          id: 'attendance-1',
          studentId: 'student-1',
          periodLabel: 'July 2026',
          presentCount: 18,
          absentCount: 1,
          lateCount: 2,
          publicationState: 'published',
          publishedAt: timestamp,
          explanationStatus: 'One explanation is under review',
          href: '/student/attendance',
          requiredCapability: 'attendance.self.read',
        },
      ],
      results: [
        {
          id: 'result-1',
          studentId: 'student-1',
          subjectLabel: 'Mathematics',
          assessmentLabel: 'Algebra checkpoint',
          resultLabel: 'A-',
          feedback: 'Good method selection. Show the final verification step.',
          publicationState: 'published',
          publishedAt: '2026-07-28T15:00:00+06:00',
          href: '/student/results',
          requiredCapability: 'records.self.read',
        },
      ],
      resources: [
        {
          id: 'resource-1',
          studentId: 'student-1',
          subjectLabel: 'Mathematics',
          title: 'Multi-step equations practice',
          description: 'Practice set and worked example for tomorrow’s lesson.',
          resourceType: 'document',
          availableUntil: '2026-08-15T23:59:00+06:00',
          href: '/student/resources',
          requiredCapability: 'resources.self.read',
        },
      ],
      requests: [
        {
          id: 'request-1',
          studentId: 'student-1',
          title: 'Library book renewal',
          description: 'Request another seven days for the current loan.',
          state: 'in-review',
          submittedAt: '2026-07-29T18:15:00+06:00',
          nextAction: 'Wait for library approval.',
          href: '/student/requests',
          requiredCapability: 'requests.self.write',
        },
      ],
      documents: [
        {
          id: 'document-1',
          studentId: 'student-1',
          title: 'Term 2 progress report',
          category: 'Report card',
          publicationState: 'published',
          publishedAt: '2026-07-28T15:00:00+06:00',
          downloadHref: '/student/documents',
          requiredCapability: 'documents.self.read',
        },
      ],
      conversations: [
        {
          id: 'conversation-1',
          studentId: 'student-1',
          subject: 'Science trip preparation',
          participantLabel: 'Mr Karim · Science',
          lastMessageAt: '2026-07-29T19:30:00+06:00',
          unreadCount: 2,
          href: '/student/messages',
          requiredCapability: 'messages.student.read',
        },
      ],
    },
  },
} as const;

function isPilotRole(value: string): value is PilotReadRole {
  return value === 'admin' || value === 'teacher' || value === 'guardian' || value === 'student';
}

function requiredHeader(headers: Headers, name: string): string | undefined {
  const value = headers.get(name)?.trim();
  return value === '' ? undefined : value;
}

export function resolvePilotReadSnapshot(
  headers: Headers,
  roleValue: string,
  generatedAt = new Date().toISOString(),
): PilotReadResolution {
  if (!isPilotRole(roleValue)) {
    return {
      ok: false,
      status: 404,
      code: 'pilot_role_not_found',
      message: 'The requested pilot role is not available.',
    };
  }

  const tenantId = requiredHeader(headers, 'x-school-tenant-id');
  const campusId = requiredHeader(headers, 'x-school-campus-id');
  const declaredRole = requiredHeader(headers, 'x-school-role');
  const subjectId = requiredHeader(headers, 'x-school-subject-id');

  if (
    tenantId === undefined ||
    campusId === undefined ||
    declaredRole === undefined ||
    subjectId === undefined
  ) {
    return {
      ok: false,
      status: 400,
      code: 'pilot_scope_incomplete',
      message: 'Tenant, campus, role and subject scope are required.',
    };
  }

  const definition = roleDefinitions[roleValue];
  if (
    tenantId !== PILOT_TENANT_ID ||
    campusId !== PILOT_CAMPUS_ID ||
    declaredRole !== roleValue ||
    subjectId !== definition.subjectId
  ) {
    return {
      ok: false,
      status: 403,
      code: 'pilot_scope_denied',
      message: 'The requested pilot scope is not permitted.',
    };
  }

  const scope: PilotReadScope = {
    tenantId,
    campusId,
    role: roleValue,
    subjectId,
    capabilities: definition.capabilities,
  };
  const etag = `W/"${SOURCE_VERSION}:${tenantId}:${campusId}:${roleValue}:${subjectId}"`;

  return {
    ok: true,
    etag,
    snapshot: {
      schemaVersion: 1,
      sourceVersion: SOURCE_VERSION,
      generatedAt,
      scope,
      data: definition.data,
    },
  };
}

export function isAllowedPilotWebOrigin(origin: string | undefined): boolean {
  if (origin === undefined || origin === '') return false;
  if (origin === 'https://international-school-platform-web-staging.rahmatullahzisan.workers.dev') {
    return true;
  }
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/u.test(origin);
}
