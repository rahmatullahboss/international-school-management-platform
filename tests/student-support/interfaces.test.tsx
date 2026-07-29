import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import {
  ExactDisclosureApprovalPanel,
  HealthClinicWorkspace,
  LearningSupportWorkspace,
  RestrictedRecordBoundary,
  SafeguardingWorkspace,
  StudentSupportSummary,
} from '../../apps/web-admin/src/features/student-support/index.js';

describe('CARE restricted admin interfaces', () => {
  test('renders suppressed aggregate metrics without inferred values', () => {
    const html = renderToStaticMarkup(
      <StudentSupportSummary
        assurance="aal1"
        auditAvailable
        metrics={[
          {
            label: 'Open safeguarding cases',
            value: null,
            suppressed: true,
            definition: 'Approved aggregate count with cohort protection.',
            asOf: '2026-07-29T08:00:00.000Z',
          },
        ]}
      />,
    );
    expect(html).toContain('Suppressed');
    expect(html).not.toContain('null');
    expect(html).toContain('Step-up authentication');
  });

  test('masks existence when restricted record access is denied', () => {
    const html = renderToStaticMarkup(
      <RestrictedRecordBoundary authorized={false}>
        <p>Secret case exists</p>
      </RestrictedRecordBoundary>,
    );
    expect(html).toContain('Record unavailable');
    expect(html).toContain('was not found');
    expect(html).not.toContain('Secret case exists');
  });

  test('renders clinic categories but no narrative field', () => {
    const html = renderToStaticMarkup(
      <HealthClinicWorkspace
        rows={[
          {
            encounterId: 'encounter-1',
            studentReference: 'STU-001',
            campusLabel: 'North campus',
            openedAt: '2026-07-29T08:00:00.000Z',
            reasonCategory: 'routine',
            status: 'open',
            emergencyTransferRequired: false,
          },
        ]}
        canOpen
        canCreateEncounter
        canAdministerMedication
        assurance="aal1"
      />,
    );
    expect(html).toContain('routine');
    expect(html).toContain('Step-up authentication is required');
    expect(html).not.toContain('narrative');
    expect(html).not.toContain('diagnosis');
  });

  test('supports RTL and disables safeguarding actions without AAL2', () => {
    const html = renderToStaticMarkup(
      <SafeguardingWorkspace
        rows={[
          {
            caseReference: 'CASE-OPAQUE-1',
            riskBand: 'elevated',
            status: 'open',
            openedAt: '2026-07-29T08:00:00.000Z',
            reviewDueAt: null,
            membershipExpiresAt: '2026-07-30T08:00:00.000Z',
          },
        ]}
        authorized
        assurance="aal1"
        canChangeMembership
        canDisclose
        direction="rtl"
      />,
    );
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('CASE-OPAQUE-1');
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).not.toContain('student');
    expect(html).not.toContain('allegation');
  });

  test('learning-support queue exposes workflow metadata, not findings or rationale', () => {
    const html = renderToStaticMarkup(
      <LearningSupportWorkspace
        rows={[
          {
            referralId: 'referral-1',
            studentReference: 'STU-001',
            referralCategory: 'classroom-access',
            priority: 'priority',
            status: 'accepted',
            activePlanVersion: 2,
            nextReviewAt: '2026-09-01T00:00:00.000Z',
          },
        ]}
        canOpenSource
        canPublishProjection
        assurance="aal2"
      />,
    );
    expect(html).toContain('Version 2');
    expect(html).not.toContain('restrictedFindings');
    expect(html).not.toContain('restrictedRationale');
    expect(html).not.toContain('needCategories');
  });

  test('requires independent AAL2 disclosure approval and exact visible scope', () => {
    const blocked = renderToStaticMarkup(
      <ExactDisclosureApprovalPanel
        subjectCount={1}
        fieldCategories={['student-identifier']}
        recipientLabel="Approved authority"
        purposeLabel="Mandatory reporting"
        expiresAt="2026-07-29T09:00:00.000Z"
        assurance="aal2"
        requesterIsApprover
        canApprove
      />,
    );
    expect(blocked).toContain('requester cannot approve');
    expect(blocked).toContain('disabled=""');

    const allowed = renderToStaticMarkup(
      <ExactDisclosureApprovalPanel
        subjectCount={1}
        fieldCategories={['student-identifier']}
        recipientLabel="Approved authority"
        purposeLabel="Mandatory reporting"
        expiresAt="2026-07-29T09:00:00.000Z"
        assurance="aal2"
        requesterIsApprover={false}
        canApprove
      />,
    );
    expect(allowed).toContain('student-identifier');
    expect(allowed).not.toContain('disabled=""');
  });
});
