import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  GuardianHouseholdWorkspace,
  resolveGuardianActiveChild,
  selectGuardianChildren,
  selectGuardianItems,
  type GuardianHouseholdWorkspaceProps,
} from '../../apps/web-family/src/features/experience/GuardianHouseholdWorkspace';

const children = [
  {
    childId: 'nadia',
    displayName: 'Nadia Rahman',
    preferredName: 'Nadia',
    yearLabel: 'Grade 8',
    campusLabel: 'Main campus',
    relationshipLabel: 'Daughter',
    profileHref: '/family/children/nadia',
    requiredCapability: 'student.household.read',
  },
  {
    childId: 'sami',
    displayName: 'Sami Rahman',
    yearLabel: 'Grade 4',
    campusLabel: 'Primary campus',
    relationshipLabel: 'Son',
    profileHref: '/family/children/sami',
    requiredCapability: 'student.household.read',
  },
  {
    childId: 'unlinked',
    displayName: 'Unlinked Student',
    yearLabel: 'Grade 10',
    campusLabel: 'Other campus',
    relationshipLabel: 'Not linked',
    profileHref: '/family/children/unlinked',
    requiredCapability: 'student.other-household.read',
  },
] as const;

const shared: GuardianHouseholdWorkspaceProps = {
  guardianName: 'Rahima Rahman',
  householdLabel: 'Rahman household',
  locale: 'en-BD',
  activeChildId: 'nadia',
  capabilities: [
    'student.household.read',
    'admissions.household.read',
    'attendance.household.read',
    'records.household.read',
    'finance.household.read',
    'forms.household.read',
    'documents.household.read',
    'messages.household.read',
  ],
  children,
  applications: [
    {
      id: 'application-nadia',
      childId: 'nadia',
      applicantName: 'Nadia Rahman',
      programmeLabel: 'Grade 9 transfer',
      statusLabel: 'Documents requested',
      nextAction: 'Upload previous school transcript',
      dueAt: '2026-08-05',
      href: '/family/applications/nadia',
      requiredCapability: 'admissions.household.read',
    },
    {
      id: 'application-sami',
      childId: 'sami',
      applicantName: 'Sami Rahman',
      programmeLabel: 'Primary continuation',
      statusLabel: 'Complete',
      href: '/family/applications/sami',
      requiredCapability: 'admissions.household.read',
    },
  ],
  attendance: [
    {
      id: 'attendance-nadia',
      childId: 'nadia',
      periodLabel: 'July 2026',
      presentCount: 18,
      absentCount: 1,
      lateCount: 2,
      publishedAt: '2026-07-29T12:00:00+06:00',
      notice: 'One absence is awaiting a household explanation.',
      href: '/family/attendance/nadia',
      requiredCapability: 'attendance.household.read',
    },
    {
      id: 'attendance-sami',
      childId: 'sami',
      periodLabel: 'July 2026',
      presentCount: 20,
      absentCount: 0,
      lateCount: 0,
      publishedAt: '2026-07-29T12:00:00+06:00',
      notice: 'Sami attendance notice must not leak into Nadia scope.',
      href: '/family/attendance/sami',
      requiredCapability: 'attendance.household.read',
    },
  ],
  grades: [
    {
      id: 'grade-nadia-science',
      childId: 'nadia',
      subjectLabel: 'Science',
      resultLabel: 'A-',
      teacherComment: 'Strong laboratory reasoning.',
      publicationState: 'published',
      publishedAt: '2026-07-28',
      href: '/family/grades/nadia/science',
      requiredCapability: 'records.household.read',
    },
    {
      id: 'grade-nadia-draft',
      childId: 'nadia',
      subjectLabel: 'Draft Mathematics Result',
      resultLabel: 'Unpublished',
      publicationState: 'unpublished',
      href: '/family/grades/nadia/maths',
      requiredCapability: 'records.household.read',
    },
    {
      id: 'grade-sami',
      childId: 'sami',
      subjectLabel: 'English',
      resultLabel: 'B+',
      publicationState: 'published',
      href: '/family/grades/sami/english',
      requiredCapability: 'records.household.read',
    },
  ],
  fees: [
    {
      id: 'fee-nadia',
      childId: 'nadia',
      label: 'Term 1 tuition balance',
      amountMinor: 125000,
      currency: 'BDT',
      balanceState: 'due',
      dueAt: '2026-08-10',
      statementHref: '/family/finance/nadia/statement',
      paymentHref: '/family/finance/nadia/pay',
      requiredCapability: 'finance.household.read',
    },
    {
      id: 'fee-household',
      label: 'Household transport credit',
      amountMinor: -5000,
      currency: 'BDT',
      balanceState: 'credit',
      statementHref: '/family/finance/household/statement',
      requiredCapability: 'finance.household.read',
    },
    {
      id: 'fee-sami',
      childId: 'sami',
      label: 'Sami activity charge',
      amountMinor: 20000,
      currency: 'BDT',
      balanceState: 'due',
      statementHref: '/family/finance/sami/statement',
      requiredCapability: 'finance.household.read',
    },
  ],
  forms: [
    {
      id: 'consent-nadia',
      childId: 'nadia',
      title: 'Science field trip consent',
      description: 'Review itinerary and provide consent.',
      state: 'due-soon',
      dueAt: '2026-08-02',
      requiresAssurance: 'aal2',
      href: '/family/forms/consent-nadia',
      requiredCapability: 'forms.household.read',
    },
    {
      id: 'form-sami',
      childId: 'sami',
      title: 'Sami dietary form',
      description: 'Sami form must not appear in Nadia scope.',
      state: 'ready',
      href: '/family/forms/form-sami',
      requiredCapability: 'forms.household.read',
    },
  ],
  documents: [
    {
      id: 'report-nadia',
      childId: 'nadia',
      title: 'Nadia Term 1 report card',
      category: 'Academic record',
      publishedAt: '2026-07-28',
      downloadHref: '/family/documents/report-nadia',
      requiredCapability: 'documents.household.read',
    },
  ],
  conversations: [
    {
      id: 'message-nadia',
      childId: 'nadia',
      subject: 'Science fieldwork preparation',
      participantLabel: 'Science teacher',
      lastMessageAt: '2026-07-29T08:30:00+06:00',
      unreadCount: 2,
      href: '/family/messages/message-nadia',
      requiredCapability: 'messages.household.read',
    },
    {
      id: 'restricted-message',
      childId: 'nadia',
      subject: 'Restricted safeguarding disclosure',
      participantLabel: 'Student support',
      lastMessageAt: '2026-07-29T09:00:00+06:00',
      unreadCount: 1,
      href: '/family/messages/restricted',
      requiredCapability: 'care.disclosure.read',
    },
  ],
};

describe('EXP-01 guardian household experience', () => {
  it('filters linked children and rejects an unavailable active child', () => {
    const linked = selectGuardianChildren(children, ['student.household.read']);
    expect(linked.map((child) => child.childId)).toEqual(['nadia', 'sami']);
    expect(resolveGuardianActiveChild(linked, 'nadia')?.displayName).toBe('Nadia Rahman');
    expect(resolveGuardianActiveChild(linked, 'unlinked')).toBeUndefined();
  });

  it('filters capability and child scope before rendering counts or records', () => {
    const visible = selectGuardianItems(shared.attendance, ['attendance.household.read'], 'nadia');
    expect(visible.map((item) => item.id)).toEqual(['attendance-nadia']);

    const markup = renderToStaticMarkup(<GuardianHouseholdWorkspace {...shared} />);
    expect(markup).toContain('Nadia');
    expect(markup).toContain('Sami');
    expect(markup).not.toContain('Unlinked Student');
    expect(markup).toContain('One absence is awaiting a household explanation.');
    expect(markup).not.toContain('Sami attendance notice must not leak');
    expect(markup).toContain('Science');
    expect(markup).toContain('A-');
    expect(markup).not.toContain('Draft Mathematics Result');
    expect(markup).not.toContain('English');
  });

  it('keeps money, form assurance, documents and messages attributed to the active child', () => {
    const markup = renderToStaticMarkup(<GuardianHouseholdWorkspace {...shared} />);
    expect(markup).toContain('Term 1 tuition balance');
    expect(markup).toContain('Household transport credit');
    expect(markup).not.toContain('Sami activity charge');
    expect(markup).toContain('Pay securely');
    expect(markup).toContain('Science field trip consent');
    expect(markup).toContain('Identity verification required');
    expect(markup).not.toContain('Sami dietary form');
    expect(markup).toContain('Nadia Term 1 report card');
    expect(markup).toContain('Science fieldwork preparation');
    expect(markup).toContain('2 unread');
    expect(markup).not.toContain('Restricted safeguarding disclosure');
  });

  it('switches all child-specific sections without retaining the previous child context', () => {
    const markup = renderToStaticMarkup(
      <GuardianHouseholdWorkspace {...shared} activeChildId="sami" />,
    );
    expect(markup).toContain('Sami attendance notice must not leak into Nadia scope.');
    expect(markup).toContain('English');
    expect(markup).toContain('Sami activity charge');
    expect(markup).toContain('Sami dietary form');
    expect(markup).not.toContain('One absence is awaiting a household explanation.');
    expect(markup).not.toContain('Strong laboratory reasoning.');
    expect(markup).not.toContain('Science field trip consent');
  });

  it('masks an unlinked requested child and preserves recoverable errors', () => {
    const masked = renderToStaticMarkup(
      <GuardianHouseholdWorkspace {...shared} activeChildId="unlinked" />,
    );
    expect(masked).toContain('This child profile is not available');
    expect(masked).toContain(
      'No linked child record is available in your current household scope.',
    );
    expect(masked).not.toContain('Unlinked Student');
    expect(masked).not.toContain('Nadia Rahman');

    const error = renderToStaticMarkup(
      <GuardianHouseholdWorkspace
        {...shared}
        state="error"
        errorMessage="Your saved consent and payment work is unchanged."
        retryHref="/family?retry=1"
      />,
    );
    expect(error).toContain('role="alert"');
    expect(error).toContain('Your saved consent and payment work is unchanged.');
    expect(error).toContain('href="/family?retry=1"');
  });
});
