import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SisAdminWorkspace } from '../../apps/web-admin/src/features/sis/SisAdminWorkspace.js';
import { FamilyAdmissionsWorkspace } from '../../apps/web-family/src/features/admissions/FamilyAdmissionsWorkspace.js';

describe('SIS user interfaces', () => {
  it('renders an actionable, accessible admin workspace', () => {
    const html = renderToStaticMarkup(
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

    expect(html).toContain('<main id="main-content" tabindex="-1">');
    expect(html).toContain('aria-label="SIS sections"');
    expect(html).toContain('aria-label="Severity: critical"');
    expect(html).toContain('<caption>Admissions, lifecycle, import and data-quality work</caption>');
    expect(html).toContain('<label for="sis-person-search">Name, identifier, email or phone</label>');
    expect(html).toContain('Review item');
    expect(html).toContain('Open application');
    expect(html).toContain('Open student record');
    expect(html).toContain('Review import');
  });

  it('renders a privacy-safe family application view without confidential staff data', () => {
    const html = renderToStaticMarkup(
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

    expect(html).toContain('Family admissions portal');
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('Review and respond to offer');
    expect(html).toContain('Review and sign contract');
    expect(html).not.toContain('reviewerAccountId');
    expect(html).not.toContain('Confidential review');
    expect(html).not.toContain('restrictionReference');
  });
});
