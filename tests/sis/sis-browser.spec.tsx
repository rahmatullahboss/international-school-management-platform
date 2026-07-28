import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SisAdminWorkspace } from '../../.tmp/sis-browser-ui/apps/web-admin/src/features/sis/SisAdminWorkspace.js';
import { FamilyAdmissionsWorkspace } from '../../.tmp/sis-browser-ui/apps/web-family/src/features/admissions/FamilyAdmissionsWorkspace.js';

function documentFor(markup: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SIS browser test</title></head><body>${markup}</body></html>`;
}

test('admin can navigate queues, search people and inspect lifecycle status', async ({ page }) => {
  const markup = renderToStaticMarkup(
    createElement(SisAdminWorkspace, {
      schoolName: 'International School',
      metrics: [
        { label: 'Applications under review', value: 12, context: '3 awaiting documents' },
        { label: 'Active students', value: 640, context: 'Across 2 campuses' },
      ],
      queues: [
        {
          id: 'queue-1',
          queue: 'data-quality',
          title: 'Unverified portal authority',
          description: 'Guardian portal access needs verification.',
          status: 'Open',
          severity: 'critical',
          owner: 'Registrar',
          dueAt: '2026-07-29',
          href: '/sis/data-quality/queue-1',
        },
      ],
      applications: [
        {
          applicationId: 'application-1',
          applicationNumber: 'APP-1001',
          applicantName: 'Amina Rahman',
          programName: 'Primary Programme',
          status: 'under-review',
          checklistCompleted: 3,
          checklistTotal: 4,
          submittedAt: '2026-07-20',
          href: '/sis/applications/application-1',
        },
      ],
      students: [
        {
          studentProfileId: 'student-1',
          studentNumber: 'S-1001',
          displayName: 'Amina Rahman',
          campusName: 'Main Campus',
          programName: 'Primary Programme',
          academicYear: '2026–2027',
          enrollmentStatus: 'active',
          guardianStatus: 'Verified portal and communication authority',
          href: '/sis/students/student-1',
        },
      ],
      imports: [
        {
          batchId: 'batch-1',
          entity: 'person',
          filename: 'legacy-people.csv',
          status: 'completed-with-errors',
          validRows: 99,
          invalidRows: 1,
          appliedRows: 99,
          href: '/sis/imports/batch-1',
        },
      ],
      reportLinks: [
        {
          label: 'Admissions funnel',
          description: 'Status, conversion and decision-time measures.',
          href: '/sis/reports/admissions-funnel',
        },
      ],
    }),
  );
  await page.setContent(documentFor(markup));

  await expect(page.getByRole('heading', { level: 1, name: /SIS operations/u })).toBeVisible();
  await expect(page.getByRole('status').first()).toContainText(
    '1 critical or error-level SIS queue item',
  );
  await expect(page.getByRole('cell', { name: 'CRITICAL' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'active', exact: true })).toBeVisible();

  const search = page.getByRole('searchbox', { name: 'Name, identifier, email or phone' });
  await search.fill('Amina Rahman');
  await expect(search).toHaveValue('Amina Rahman');

  const reviewLink = page.getByRole('link', { name: 'Review item' });
  await reviewLink.focus();
  await expect(reviewLink).toBeFocused();
  await expect(reviewLink).toHaveAttribute('href', '/sis/data-quality/queue-1');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
});

test('family can review checklist, offer and contract without confidential staff data', async ({
  page,
}) => {
  const markup = renderToStaticMarkup(
    createElement(FamilyAdmissionsWorkspace, {
      guardianName: 'Nadia Rahman',
      applicantName: 'Amina Rahman',
      applicationNumber: 'APP-1001',
      applicationStatus: 'offered',
      checklist: [
        { id: 'passport', label: 'Passport', status: 'verified', required: true },
        {
          id: 'medical',
          label: 'Medical form',
          status: 'pending',
          required: true,
          actionHref: '/family/applications/APP-1001/documents/medical',
          actionLabel: 'Upload medical form',
        },
      ],
      timeline: [
        {
          id: 'submitted',
          title: 'Application submitted',
          description: 'The school received the application.',
          occurredAt: '2026-07-20',
        },
        {
          id: 'offer',
          title: 'Offer issued',
          description: 'Review and respond before the deadline.',
          occurredAt: '2026-07-28',
          current: true,
        },
      ],
      offer: {
        programName: 'Primary Programme',
        campusName: 'Main Campus',
        academicYear: '2026–2027',
        gradeLevel: 'Grade 5',
        expiresAt: '2026-08-10',
        status: 'issued',
        actionHref: '/family/applications/APP-1001/offer',
      },
      contract: {
        status: 'issued',
        actionHref: '/family/applications/APP-1001/contract',
      },
      depositStatus: 'pending',
      supportHref: '/family/support/admissions',
    }),
  );
  await page.setContent(documentFor(markup));

  await expect(
    page.getByRole('heading', { level: 1, name: "Amina Rahman's application" }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('1 required item still need attention');
  await expect(page.getByRole('link', { name: 'Upload medical form' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review and respond to offer' })).toHaveAttribute(
    'href',
    '/family/applications/APP-1001/offer',
  );
  await expect(page.getByRole('link', { name: 'Review and sign contract' })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText('Offer issued');

  const body = page.locator('body');
  await expect(body).not.toContainText('Confidential review');
  await expect(body).not.toContainText('reviewerAccountId');
  await expect(body).not.toContainText('restrictionReference');
});
