export interface PilotModuleMetric {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export interface PilotModuleQueueItem {
  readonly title: string;
  readonly detail: string;
  readonly status: string;
  readonly href: string;
}

export interface PilotModulePage {
  readonly title: string;
  readonly description: string;
  readonly eyebrow: string;
  readonly metrics: readonly PilotModuleMetric[];
  readonly queue: readonly PilotModuleQueueItem[];
  readonly actions: readonly { readonly label: string; readonly href: string }[];
}

export const schoolName = 'International Community School';
export const campusName = 'Main Campus';
export const pilotTimestamp = '2026-07-30T00:45:00+06:00';

export const adminCapabilities = [
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
] as const;

export const teacherCapabilities = [
  'classes.assigned.read',
  'attendance.assigned.write',
  'gradebook.assigned.write',
  'student.assigned.read',
  'messages.teacher.read',
  'resources.teacher.read',
] as const;

export const guardianCapabilities = [
  'admissions.household.read',
  'student.household.read',
  'attendance.household.read',
  'records.household.read',
  'finance.household.read',
  'forms.household.read',
  'documents.household.read',
  'messages.household.read',
] as const;

export const studentCapabilities = [
  'timetable.self.read',
  'attendance.self.read',
  'records.self.read',
  'documents.self.read',
  'resources.self.read',
  'requests.self.write',
  'messages.student.read',
] as const;

const source = {
  label: 'Pilot readiness projection',
  href: '/admin/reports',
  updatedAt: pilotTimestamp,
};

export const adminOverview = {
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
      value: '41 / 44',
      definition: 'Finalised attendance registers for today’s scheduled sessions.',
      tone: 'warning',
      source,
      capability: 'academics.read',
    },
    {
      id: 'finance',
      label: 'Unreconciled receipts',
      value: 7,
      definition: 'Verified receipts waiting for deposit reconciliation.',
      tone: 'error',
      source,
      capability: 'finance.read',
    },
    {
      id: 'operations',
      label: 'Operational exceptions',
      value: 5,
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
      title: 'Three registers are not finalised',
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
      summary: 'Seven verified receipts are not matched to a bank deposit.',
      severity: 'error',
      status: 'Review',
      href: '/admin/finance',
      source,
      capability: 'finance.read',
    },
    {
      id: 'care-1',
      area: 'Student support',
      title: 'Restricted support task needs verified access',
      summary: 'Open the restricted workspace after step-up identity verification.',
      severity: 'critical',
      status: 'Restricted',
      href: '/admin/student-support',
      source,
      capability: 'care.restricted.read',
      requiredAssurance: 'aal2',
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
} as const;

export const teacherOverview = {
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
      enteredCount: 21,
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
} as const;

export const guardianOverview = {
  children: [
    {
      childId: 'student-1',
      displayName: 'Samira Noor',
      preferredName: 'Samira',
      yearLabel: 'Year 8',
      campusLabel: campusName,
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
      presentCount: 17,
      absentCount: 1,
      lateCount: 2,
      publishedAt: pilotTimestamp,
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
} as const;

export const studentOverview = {
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
      presentCount: 17,
      absentCount: 1,
      lateCount: 2,
      publicationState: 'published',
      publishedAt: pilotTimestamp,
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
} as const;

export const modulePages: Readonly<Record<string, PilotModulePage>> = {
  '/admin/sis': {
    eyebrow: 'Core SIS and admissions',
    title: 'People, admissions and enrolment',
    description: 'Manage households, applications, profiles, offers and active enrolments.',
    metrics: [
      { label: 'Active students', value: '842', detail: 'Across all current campuses' },
      { label: 'Open applications', value: '63', detail: '18 require family action' },
      { label: 'Offers awaiting response', value: '12', detail: 'For the 2027 intake' },
    ],
    queue: [
      { title: 'Review 9 completed applications', detail: 'Admissions verification is complete.', status: 'Ready', href: '/admin/sis' },
      { title: 'Resolve 3 duplicate household warnings', detail: 'Possible identity matches need review.', status: 'Attention', href: '/admin/sis' },
    ],
    actions: [{ label: 'Open applicant register', href: '/admin/sis' }, { label: 'Create student record', href: '/admin/sis' }],
  },
  '/admin/academics': {
    eyebrow: 'Academics, attendance and records',
    title: 'Academic operations',
    description: 'Control curriculum, timetables, attendance, assessments, gradebook and records.',
    metrics: [
      { label: 'Classes today', value: '44', detail: '41 attendance registers finalised' },
      { label: 'Assessments open', value: '18', detail: 'Across 9 year groups' },
      { label: 'Report cards pending', value: '74', detail: 'Awaiting review or publication' },
    ],
    queue: [
      { title: 'Finalise three attendance registers', detail: 'Daily cut-off is approaching.', status: 'Due now', href: '/admin/academics' },
      { title: 'Approve transcript correction', detail: 'Evidence and audit trail are attached.', status: 'Approval', href: '/admin/academics' },
    ],
    actions: [{ label: 'Open timetable', href: '/admin/academics' }, { label: 'Review report cards', href: '/admin/academics' }],
  },
  '/admin/finance': {
    eyebrow: 'Billing and accounting',
    title: 'Finance command centre',
    description: 'Review billing, payments, refunds, journals, reconciliation and finance reports.',
    metrics: [
      { label: 'Receivables due', value: 'BDT 2.84m', detail: 'Current and overdue household balances' },
      { label: 'Receipts today', value: 'BDT 486k', detail: '63 verified payment receipts' },
      { label: 'Unreconciled', value: '7', detail: 'Receipts waiting for bank matching' },
    ],
    queue: [
      { title: 'Match seven verified receipts', detail: 'Deposit evidence is available.', status: 'Review', href: '/admin/finance' },
      { title: 'Approve two refund requests', detail: 'Original allocations and reasons are attached.', status: 'Approval', href: '/admin/finance' },
    ],
    actions: [{ label: 'Open reconciliation', href: '/admin/finance' }, { label: 'View general ledger', href: '/admin/finance' }],
  },
  '/admin/operations': {
    eyebrow: 'School operations ERP',
    title: 'Operations and services',
    description: 'Coordinate staff, procurement, assets, library, transport, catering and activities.',
    metrics: [
      { label: 'Staff on duty', value: '126', detail: 'Four approved absences' },
      { label: 'Open purchase orders', value: '17', detail: 'Five deliveries due this week' },
      { label: 'Transport routes', value: '12', detail: 'One route has a delay notice' },
    ],
    queue: [
      { title: 'Approve science lab requisition', detail: 'Budget and supplier comparison are attached.', status: 'Approval', href: '/admin/operations' },
      { title: 'Review delayed transport route', detail: 'Route 6 is running 18 minutes late.', status: 'Live', href: '/admin/operations' },
    ],
    actions: [{ label: 'Open inventory', href: '/admin/operations' }, { label: 'View transport control', href: '/admin/operations' }],
  },
  '/admin/student-support': {
    eyebrow: 'Health, wellbeing and safeguarding',
    title: 'Restricted student support',
    description: 'Purpose-bound access to health, behaviour, wellbeing, safeguarding and learning support.',
    metrics: [
      { label: 'Open support plans', value: '31', detail: 'Capability-scoped and purpose-bound' },
      { label: 'Reviews due', value: '6', detail: 'Due within the next seven days' },
      { label: 'Restricted tasks', value: '2', detail: 'Require verified session access' },
    ],
    queue: [
      { title: 'Verify identity to open restricted task', detail: 'Sensitive details remain hidden until step-up.', status: 'Restricted', href: '/admin/student-support' },
      { title: 'Review learning support adjustment', detail: 'Teacher evidence and family consent are available.', status: 'Review', href: '/admin/student-support' },
    ],
    actions: [{ label: 'Open permitted support work', href: '/admin/student-support' }],
  },
  '/admin/communications': {
    eyebrow: 'Communications and forms',
    title: 'School communications',
    description: 'Publish announcements, manage secure conversations, forms and delivery evidence.',
    metrics: [
      { label: 'Announcements scheduled', value: '4', detail: 'For today and tomorrow' },
      { label: 'Unread priority threads', value: '11', detail: 'Across permitted workspaces' },
      { label: 'Forms due this week', value: '96', detail: 'Household acknowledgements outstanding' },
    ],
    queue: [
      { title: 'Review weather closure draft', detail: 'Audience and translations are prepared.', status: 'Draft', href: '/admin/communications' },
      { title: 'Follow up undelivered messages', detail: 'Eight recipients need an alternate channel.', status: 'Attention', href: '/admin/communications' },
    ],
    actions: [{ label: 'Create announcement', href: '/admin/communications' }, { label: 'Open message centre', href: '/admin/communications' }],
  },
  '/admin/integrations': {
    eyebrow: 'Internationalisation and integrations',
    title: 'Integration platform',
    description: 'Govern country packs, imports, external IDs, OneRoster, LTI, SSO and webhooks.',
    metrics: [
      { label: 'Healthy connectors', value: '8 / 9', detail: 'One connector is degraded' },
      { label: 'Import jobs today', value: '14', detail: '13 completed, one needs review' },
      { label: 'Webhook delivery', value: '99.8%', detail: 'Across the last 24 hours' },
    ],
    queue: [
      { title: 'Review SIS import conflict', detail: 'Two external records map to one student.', status: 'Conflict', href: '/admin/integrations' },
      { title: 'Rotate sandbox connector secret', detail: 'Scheduled credential maintenance.', status: 'Due soon', href: '/admin/integrations' },
    ],
    actions: [{ label: 'Open connector registry', href: '/admin/integrations' }, { label: 'Start import', href: '/admin/integrations' }],
  },
  '/admin/reports': {
    eyebrow: 'Governed reporting',
    title: 'Reports and evidence',
    description: 'Review governed metrics, exports, report definitions and evidence timestamps.',
    metrics: [
      { label: 'Published reports', value: '26', detail: 'Across academic and operational domains' },
      { label: 'Scheduled exports', value: '7', detail: 'All within policy' },
      { label: 'Definitions updated', value: '3', detail: 'Awaiting reviewer acknowledgement' },
    ],
    queue: [
      { title: 'Review attendance definition update', detail: 'The proposed calculation change is documented.', status: 'Review', href: '/admin/reports' },
      { title: 'Approve board pack export', detail: 'Sensitive fields are excluded by policy.', status: 'Approval', href: '/admin/reports' },
    ],
    actions: [{ label: 'Open report catalogue', href: '/admin/reports' }, { label: 'Create governed export', href: '/admin/reports' }],
  },
  '/teacher/classes': {
    eyebrow: 'Assigned teaching',
    title: 'My classes',
    description: 'View assigned sections, rosters, timetable context and lesson links.',
    metrics: [
      { label: 'Classes today', value: '4', detail: 'Two completed, two upcoming' },
      { label: 'Students assigned', value: '108', detail: 'Across four class sections' },
      { label: 'Room changes', value: '1', detail: 'Science lesson moved to Lab 2' },
    ],
    queue: [{ title: 'Prepare Year 9B lesson', detail: 'The lesson starts at 10:00.', status: 'Next', href: '/teacher/classes' }],
    actions: [{ label: 'Open class roster', href: '/teacher/classes' }],
  },
  '/teacher/attendance': {
    eyebrow: 'Attendance',
    title: 'Assigned registers',
    description: 'Capture, sync, reconcile and finalise attendance for assigned classes.',
    metrics: [
      { label: 'Registers today', value: '4', detail: 'Two finalised, one ready, one upcoming' },
      { label: 'Pending on device', value: '0', detail: 'All local changes are synced' },
      { label: 'Conflicts', value: '0', detail: 'No reconciliation required' },
    ],
    queue: [{ title: 'Finalise Year 8A register', detail: 'All 28 students are marked.', status: 'Ready', href: '/teacher/attendance' }],
    actions: [{ label: 'Open current register', href: '/teacher/attendance' }],
  },
  '/teacher/gradebook': {
    eyebrow: 'Assessment and gradebook',
    title: 'Gradebook tasks',
    description: 'Enter evidence, comments and grades before governed publication.',
    metrics: [
      { label: 'Entries complete', value: '21 / 28', detail: 'Algebra checkpoint' },
      { label: 'Draft assessments', value: '3', detail: 'Across assigned classes' },
      { label: 'Ready to publish', value: '1', detail: 'Subject lead review complete' },
    ],
    queue: [{ title: 'Complete seven algebra results', detail: 'Due tomorrow at 16:00.', status: 'Due soon', href: '/teacher/gradebook' }],
    actions: [{ label: 'Open gradebook', href: '/teacher/gradebook' }],
  },
  '/teacher/students': {
    eyebrow: 'Permitted student context',
    title: 'Student learning context',
    description: 'See only assigned student information needed for current teaching work.',
    metrics: [
      { label: 'Assigned students', value: '108', detail: 'Across four sections' },
      { label: 'Support adjustments', value: '9', detail: 'Visible only when relevant to teaching' },
      { label: 'Follow-ups due', value: '4', detail: 'Teacher-owned next actions' },
    ],
    queue: [{ title: 'Review Samira’s adjusted task', detail: 'Before the next mathematics lesson.', status: 'Next action', href: '/teacher/students' }],
    actions: [{ label: 'Open assigned roster', href: '/teacher/students' }],
  },
  '/teacher/messages': {
    eyebrow: 'Secure communication',
    title: 'Teacher messages',
    description: 'Communicate with permitted students, households and colleagues.',
    metrics: [
      { label: 'Unread threads', value: '3', detail: 'One marked priority' },
      { label: 'Awaiting reply', value: '5', detail: 'Across assigned classes' },
      { label: 'Delivery failures', value: '0', detail: 'All recent messages delivered' },
    ],
    queue: [{ title: 'Reply about algebra resources', detail: 'Guardian message received last night.', status: 'Unread', href: '/teacher/messages' }],
    actions: [{ label: 'Open inbox', href: '/teacher/messages' }],
  },
  '/teacher/resources': {
    eyebrow: 'Teaching resources',
    title: 'Class resources',
    description: 'Publish and manage materials for assigned classes.',
    metrics: [
      { label: 'Published resources', value: '42', detail: 'Across assigned subjects' },
      { label: 'Draft resources', value: '6', detail: 'Not visible to students' },
      { label: 'Expiring soon', value: '2', detail: 'Within seven days' },
    ],
    queue: [{ title: 'Publish equations practice set', detail: 'Ready for Year 8A.', status: 'Draft', href: '/teacher/resources' }],
    actions: [{ label: 'Add resource', href: '/teacher/resources' }],
  },
  '/family/applications': {
    eyebrow: 'Admissions',
    title: 'Family applications',
    description: 'Track applications, requested documents, decisions and next actions.',
    metrics: [
      { label: 'Active applications', value: '1', detail: 'Year 3 · 2027 intake' },
      { label: 'Documents required', value: '1', detail: 'Birth certificate copy' },
      { label: 'Messages', value: '0', detail: 'No unread admissions messages' },
    ],
    queue: [{ title: 'Upload requested document', detail: 'Due 5 August.', status: 'Action required', href: '/family/applications' }],
    actions: [{ label: 'Continue application', href: '/family/applications' }],
  },
  '/family/children': {
    eyebrow: 'Household student records',
    title: 'My children',
    description: 'Review authorised profile and current enrolment information.',
    metrics: [
      { label: 'Children linked', value: '1', detail: 'Samira Noor · Year 8' },
      { label: 'Current enrolments', value: '1', detail: 'Main Campus' },
      { label: 'Profile updates pending', value: '0', detail: 'No action required' },
    ],
    queue: [{ title: 'Review emergency contact details', detail: 'Annual confirmation opens next month.', status: 'Upcoming', href: '/family/children' }],
    actions: [{ label: 'Open student profile', href: '/family/children' }],
  },
  '/family/attendance': {
    eyebrow: 'Published attendance',
    title: 'Attendance record',
    description: 'Review published attendance, notices and submitted explanations.',
    metrics: [
      { label: 'Present days', value: '17', detail: 'July 2026' },
      { label: 'Absences', value: '1', detail: 'Explanation under review' },
      { label: 'Late arrivals', value: '2', detail: 'Published record' },
    ],
    queue: [{ title: 'Track absence explanation', detail: 'The school is reviewing the submission.', status: 'In review', href: '/family/attendance' }],
    actions: [{ label: 'View attendance details', href: '/family/attendance' }],
  },
  '/family/grades': {
    eyebrow: 'Published academic records',
    title: 'Grades and reports',
    description: 'View published results, teacher comments and report cards.',
    metrics: [
      { label: 'New results', value: '1', detail: 'Mathematics · Algebra checkpoint' },
      { label: 'Published reports', value: '1', detail: 'Term 2 progress report' },
      { label: 'Revised items', value: '0', detail: 'No revisions since publication' },
    ],
    queue: [{ title: 'Review mathematics feedback', detail: 'The result and comment are published.', status: 'New', href: '/family/grades' }],
    actions: [{ label: 'Open progress report', href: '/family/grades' }],
  },
  '/family/finance': {
    eyebrow: 'Fees and payments',
    title: 'Household finance',
    description: 'Review statements, balances, receipts and permitted payment actions.',
    metrics: [
      { label: 'Balance due', value: 'BDT 18,500', detail: 'August tuition instalment' },
      { label: 'Next due date', value: '10 Aug', detail: 'No overdue balance' },
      { label: 'Receipts this term', value: '3', detail: 'All verified' },
    ],
    queue: [{ title: 'August tuition instalment', detail: 'Due 10 August.', status: 'Due', href: '/family/finance' }],
    actions: [{ label: 'View statement', href: '/family/finance' }, { label: 'Open payment options', href: '/family/finance' }],
  },
  '/family/forms': {
    eyebrow: 'Forms and consent',
    title: 'Household forms',
    description: 'Complete requests, consent and acknowledgements for authorised children.',
    metrics: [
      { label: 'Open forms', value: '1', detail: 'Science trip consent' },
      { label: 'Due soon', value: '1', detail: 'Due 2 August' },
      { label: 'Submitted this term', value: '6', detail: 'All acknowledged' },
    ],
    queue: [{ title: 'Science trip consent', detail: 'Review itinerary and submit consent.', status: 'Due soon', href: '/family/forms' }],
    actions: [{ label: 'Open consent form', href: '/family/forms' }],
  },
  '/family/documents': {
    eyebrow: 'Authorised documents',
    title: 'Family documents',
    description: 'Download report cards, letters and authorised school records.',
    metrics: [
      { label: 'New documents', value: '1', detail: 'Term 2 progress report' },
      { label: 'Available documents', value: '12', detail: 'Across linked children' },
      { label: 'Expiring links', value: '0', detail: 'No action required' },
    ],
    queue: [{ title: 'Term 2 progress report', detail: 'Published 28 July.', status: 'Available', href: '/family/documents' }],
    actions: [{ label: 'Open document library', href: '/family/documents' }],
  },
  '/family/messages': {
    eyebrow: 'Secure communication',
    title: 'Family messages',
    description: 'Communicate with permitted teachers, admissions and school teams.',
    metrics: [
      { label: 'Unread threads', value: '1', detail: 'Mathematics resources' },
      { label: 'Open conversations', value: '4', detail: 'Across school teams' },
      { label: 'Delivery failures', value: '0', detail: 'All recent messages delivered' },
    ],
    queue: [{ title: 'Algebra resources', detail: 'Ms Rahman replied last night.', status: 'Unread', href: '/family/messages' }],
    actions: [{ label: 'Open inbox', href: '/family/messages' }],
  },
  '/student/timetable': {
    eyebrow: 'Published schedule',
    title: 'My timetable',
    description: 'See today’s lessons, room changes and published schedule updates.',
    metrics: [
      { label: 'Lessons today', value: '6', detail: 'One currently in progress' },
      { label: 'Room changes', value: '1', detail: 'Science moved to Lab 2' },
      { label: 'Cancelled lessons', value: '0', detail: 'No cancellations today' },
    ],
    queue: [{ title: 'Science in Lab 2', detail: 'Starts at 09:00.', status: 'Next', href: '/student/timetable' }],
    actions: [{ label: 'Open full timetable', href: '/student/timetable' }],
  },
  '/student/attendance': {
    eyebrow: 'Published attendance',
    title: 'My attendance',
    description: 'Review the attendance record published for your own enrolment.',
    metrics: [
      { label: 'Present days', value: '17', detail: 'July 2026' },
      { label: 'Absences', value: '1', detail: 'Explanation under review' },
      { label: 'Late arrivals', value: '2', detail: 'Published record' },
    ],
    queue: [{ title: 'Absence explanation', detail: 'The school is reviewing it.', status: 'In review', href: '/student/attendance' }],
    actions: [{ label: 'View attendance details', href: '/student/attendance' }],
  },
  '/student/results': {
    eyebrow: 'Published results',
    title: 'My results',
    description: 'See published grades, feedback and report cards without internal notes.',
    metrics: [
      { label: 'New result', value: 'A-', detail: 'Mathematics · Algebra checkpoint' },
      { label: 'Published subjects', value: '8', detail: 'Current reporting period' },
      { label: 'Revised results', value: '0', detail: 'No revisions since publication' },
    ],
    queue: [{ title: 'Read mathematics feedback', detail: 'Show the final verification step.', status: 'New', href: '/student/results' }],
    actions: [{ label: 'Open result details', href: '/student/results' }],
  },
  '/student/documents': {
    eyebrow: 'Authorised documents',
    title: 'My documents',
    description: 'Open documents that are published and authorised for your account.',
    metrics: [
      { label: 'New documents', value: '1', detail: 'Term 2 progress report' },
      { label: 'Available documents', value: '7', detail: 'Current enrolment only' },
      { label: 'Pending publication', value: '0', detail: 'Drafts remain hidden' },
    ],
    queue: [{ title: 'Term 2 progress report', detail: 'Published 28 July.', status: 'Available', href: '/student/documents' }],
    actions: [{ label: 'Open document library', href: '/student/documents' }],
  },
  '/student/resources': {
    eyebrow: 'Class resources',
    title: 'My resources',
    description: 'Open materials and links published for your current classes.',
    metrics: [
      { label: 'New resources', value: '1', detail: 'Mathematics practice set' },
      { label: 'Available resources', value: '23', detail: 'Across current classes' },
      { label: 'Due activities', value: '2', detail: 'This week' },
    ],
    queue: [{ title: 'Multi-step equations practice', detail: 'Prepare before tomorrow’s lesson.', status: 'New', href: '/student/resources' }],
    actions: [{ label: 'Open resources', href: '/student/resources' }],
  },
  '/student/requests': {
    eyebrow: 'Student requests',
    title: 'My requests',
    description: 'Submit and track permitted service requests and forms.',
    metrics: [
      { label: 'Open requests', value: '1', detail: 'Library renewal' },
      { label: 'Completed this term', value: '3', detail: 'All closed' },
      { label: 'Drafts', value: '0', detail: 'Nothing waiting on this device' },
    ],
    queue: [{ title: 'Library book renewal', detail: 'Waiting for library approval.', status: 'In review', href: '/student/requests' }],
    actions: [{ label: 'Create request', href: '/student/requests' }],
  },
  '/student/messages': {
    eyebrow: 'Secure communication',
    title: 'My messages',
    description: 'Read and send messages within your permitted school conversations.',
    metrics: [
      { label: 'Unread messages', value: '2', detail: 'Science trip preparation' },
      { label: 'Open conversations', value: '3', detail: 'Teachers and school services' },
      { label: 'Delivery failures', value: '0', detail: 'All recent messages delivered' },
    ],
    queue: [{ title: 'Science trip preparation', detail: 'Mr Karim sent two messages.', status: 'Unread', href: '/student/messages' }],
    actions: [{ label: 'Open inbox', href: '/student/messages' }],
  },
};
