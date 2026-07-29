export type InterfaceDirection = 'ltr' | 'rtl';

export interface SuppressedMetric {
  readonly label: string;
  readonly value: number | null;
  readonly suppressed: boolean;
  readonly definition: string;
  readonly asOf: string;
}

export interface HealthClinicQueueRow {
  readonly encounterId: string;
  readonly studentReference: string;
  readonly campusLabel: string;
  readonly openedAt: string;
  readonly reasonCategory: string;
  readonly status: 'open' | 'closed';
  readonly emergencyTransferRequired: boolean;
}

export interface BehaviorQueueRow {
  readonly incidentId: string;
  readonly studentReference: string;
  readonly occurredAt: string;
  readonly categoryLabel: string;
  readonly severity: 'low' | 'moderate' | 'high' | 'critical';
  readonly status: string;
  readonly followUpDueAt: string | null;
}

export interface WellbeingQueueRow {
  readonly referralId: string;
  readonly studentReference: string;
  readonly createdAt: string;
  readonly referralCategory: string;
  readonly urgency: 'routine' | 'priority' | 'urgent';
  readonly status: string;
  readonly assignedCounselorLabel: string | null;
}

export interface SafeguardingQueueRow {
  readonly caseReference: string;
  readonly riskBand: 'standard' | 'elevated' | 'critical';
  readonly status: 'open' | 'monitoring' | 'closed';
  readonly openedAt: string;
  readonly reviewDueAt: string | null;
  readonly membershipExpiresAt: string;
}

export interface LearningSupportQueueRow {
  readonly referralId: string;
  readonly studentReference: string;
  readonly referralCategory: string;
  readonly priority: 'routine' | 'priority' | 'urgent';
  readonly status: string;
  readonly activePlanVersion: number | null;
  readonly nextReviewAt: string | null;
}

function EmptyTableRow({ columns, message }: { readonly columns: number; readonly message: string }) {
  return (
    <tr>
      <td colSpan={columns}>{message}</td>
    </tr>
  );
}

function ResponsiveTableRegion({
  label,
  direction,
  children,
}: {
  readonly label: string;
  readonly direction: InterfaceDirection;
  readonly children: React.ReactNode;
}) {
  return (
    <div role="region" aria-label={label} tabIndex={0} dir={direction} data-overflow="scroll">
      {children}
    </div>
  );
}

export function RestrictedRecordBoundary({
  authorized,
  children,
}: {
  readonly authorized: boolean;
  readonly children: React.ReactNode;
}) {
  if (!authorized) {
    return (
      <section aria-labelledby="restricted-record-unavailable-title" role="status">
        <h2 id="restricted-record-unavailable-title">Record unavailable</h2>
        <p>The requested student-support record was not found.</p>
      </section>
    );
  }
  return <>{children}</>;
}

export function StudentSupportSummary({
  metrics,
  assurance,
  auditAvailable,
  direction = 'ltr',
  onOpenMetric,
}: {
  readonly metrics: readonly SuppressedMetric[];
  readonly assurance: 'aal1' | 'aal2';
  readonly auditAvailable: boolean;
  readonly direction?: InterfaceDirection;
  readonly onOpenMetric?: (label: string) => void;
}) {
  return (
    <section aria-labelledby="student-support-summary-title" dir={direction}>
      <header>
        <p>Restricted operations</p>
        <h1 id="student-support-summary-title">Student support</h1>
        <p>Counts are cohort-protected and never include case narrative or diagnosis-like detail.</p>
      </header>
      {!auditAvailable ? (
        <div role="alert">
          <strong>Restricted reads are unavailable.</strong> Immutable access evidence cannot be
          persisted. No sensitive record can be opened until audit service is restored.
        </div>
      ) : assurance === 'aal1' ? (
        <p role="status">
          Standard assurance is active. Medication, safeguarding, disclosure, export and approval
          actions require step-up authentication.
        </p>
      ) : (
        <p role="status">Step-up authentication is active for this session.</p>
      )}
      <ul aria-label="Student-support aggregate metrics">
        {metrics.map((metric) => (
          <li key={metric.label}>
            <article>
              <h2>{metric.label}</h2>
              <p aria-label={`${metric.label} value`}>
                {metric.suppressed ? 'Suppressed' : metric.value ?? 'Unavailable'}
              </p>
              <p>{metric.definition}</p>
              <small>
                As of <time dateTime={metric.asOf}>{metric.asOf}</time>
              </small>
              {onOpenMetric === undefined ? null : (
                <button
                  type="button"
                  disabled={metric.suppressed}
                  onClick={() => onOpenMetric(metric.label)}
                >
                  Open aggregate details for {metric.label}
                </button>
              )}
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HealthClinicWorkspace({
  rows,
  canOpen,
  canCreateEncounter,
  canAdministerMedication,
  assurance,
  direction = 'ltr',
  onOpen,
  onCreateEncounter,
  onOpenMedication,
}: {
  readonly rows: readonly HealthClinicQueueRow[];
  readonly canOpen: boolean;
  readonly canCreateEncounter: boolean;
  readonly canAdministerMedication: boolean;
  readonly assurance: 'aal1' | 'aal2';
  readonly direction?: InterfaceDirection;
  readonly onOpen?: (encounterId: string) => void;
  readonly onCreateEncounter?: () => void;
  readonly onOpenMedication?: () => void;
}) {
  const medicationEnabled = canAdministerMedication && assurance === 'aal2';
  return (
    <section aria-labelledby="clinic-workspace-title" dir={direction}>
      <header>
        <h2 id="clinic-workspace-title">Clinic queue</h2>
        <div>
          <button type="button" disabled={!canCreateEncounter} onClick={onCreateEncounter}>
            Start clinic encounter
          </button>{' '}
          <button type="button" disabled={!medicationEnabled} onClick={onOpenMedication}>
            Medication administration
          </button>
        </div>
      </header>
      {!canAdministerMedication ? null : assurance === 'aal2' ? null : (
        <p role="status">Step-up authentication is required before medication administration.</p>
      )}
      <ResponsiveTableRegion label="Clinic encounters" direction={direction}>
        <table>
          <caption>Authorized clinic encounters with controlled categories only</caption>
          <thead>
            <tr>
              <th scope="col">Student reference</th>
              <th scope="col">Campus</th>
              <th scope="col">Opened</th>
              <th scope="col">Category</th>
              <th scope="col">Status</th>
              <th scope="col">Priority</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyTableRow columns={7} message="No clinic encounters match the current scope." />
            ) : (
              rows.map((row) => (
                <tr key={row.encounterId}>
                  <th scope="row">{row.studentReference}</th>
                  <td>{row.campusLabel}</td>
                  <td>
                    <time dateTime={row.openedAt}>{row.openedAt}</time>
                  </td>
                  <td>{row.reasonCategory}</td>
                  <td>{row.status}</td>
                  <td>{row.emergencyTransferRequired ? 'Emergency review' : 'Routine'}</td>
                  <td>
                    <button type="button" disabled={!canOpen} onClick={() => onOpen?.(row.encounterId)}>
                      Open encounter
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ResponsiveTableRegion>
    </section>
  );
}

export function BehaviorSupportWorkspace({
  rows,
  canOpenRestrictedFollowUp,
  direction = 'ltr',
  onOpen,
}: {
  readonly rows: readonly BehaviorQueueRow[];
  readonly canOpenRestrictedFollowUp: boolean;
  readonly direction?: InterfaceDirection;
  readonly onOpen?: (incidentId: string) => void;
}) {
  return (
    <section aria-labelledby="behavior-workspace-title" dir={direction}>
      <h2 id="behavior-workspace-title">Behavior and restorative follow-up</h2>
      <ResponsiveTableRegion label="Behavior incidents" direction={direction}>
        <table>
          <caption>Incident workflow categories without source narrative</caption>
          <thead>
            <tr>
              <th scope="col">Student reference</th>
              <th scope="col">Occurred</th>
              <th scope="col">Category</th>
              <th scope="col">Severity</th>
              <th scope="col">Status</th>
              <th scope="col">Follow-up due</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyTableRow columns={7} message="No behavior items match the current scope." />
            ) : (
              rows.map((row) => (
                <tr key={row.incidentId}>
                  <th scope="row">{row.studentReference}</th>
                  <td>
                    <time dateTime={row.occurredAt}>{row.occurredAt}</time>
                  </td>
                  <td>{row.categoryLabel}</td>
                  <td>{row.severity}</td>
                  <td>{row.status}</td>
                  <td>
                    {row.followUpDueAt === null ? (
                      'Not scheduled'
                    ) : (
                      <time dateTime={row.followUpDueAt}>{row.followUpDueAt}</time>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={!canOpenRestrictedFollowUp}
                      onClick={() => onOpen?.(row.incidentId)}
                    >
                      Open authorized detail
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ResponsiveTableRegion>
    </section>
  );
}

export function WellbeingWorkspace({
  rows,
  canTriage,
  canOpenCounselling,
  direction = 'ltr',
  onTriage,
  onOpen,
}: {
  readonly rows: readonly WellbeingQueueRow[];
  readonly canTriage: boolean;
  readonly canOpenCounselling: boolean;
  readonly direction?: InterfaceDirection;
  readonly onTriage?: (referralId: string) => void;
  readonly onOpen?: (referralId: string) => void;
}) {
  return (
    <section aria-labelledby="wellbeing-workspace-title" dir={direction}>
      <h2 id="wellbeing-workspace-title">Pastoral and wellbeing referrals</h2>
      <ResponsiveTableRegion label="Wellbeing referrals" direction={direction}>
        <table>
          <caption>Relationship-scoped referral metadata; counselling notes are not listed</caption>
          <thead>
            <tr>
              <th scope="col">Student reference</th>
              <th scope="col">Created</th>
              <th scope="col">Category</th>
              <th scope="col">Urgency</th>
              <th scope="col">Status</th>
              <th scope="col">Assigned counselor</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyTableRow columns={7} message="No wellbeing referrals match the current scope." />
            ) : (
              rows.map((row) => (
                <tr key={row.referralId}>
                  <th scope="row">{row.studentReference}</th>
                  <td>
                    <time dateTime={row.createdAt}>{row.createdAt}</time>
                  </td>
                  <td>{row.referralCategory}</td>
                  <td>{row.urgency}</td>
                  <td>{row.status}</td>
                  <td>{row.assignedCounselorLabel ?? 'Unassigned'}</td>
                  <td>
                    <button type="button" disabled={!canTriage} onClick={() => onTriage?.(row.referralId)}>
                      Triage
                    </button>{' '}
                    <button
                      type="button"
                      disabled={!canOpenCounselling || row.assignedCounselorLabel === null}
                      onClick={() => onOpen?.(row.referralId)}
                    >
                      Open assigned case
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ResponsiveTableRegion>
    </section>
  );
}

export function SafeguardingWorkspace({
  rows,
  authorized,
  assurance,
  canChangeMembership,
  canDisclose,
  direction = 'ltr',
  onOpen,
  onManageMembership,
  onCreateDisclosure,
}: {
  readonly rows: readonly SafeguardingQueueRow[];
  readonly authorized: boolean;
  readonly assurance: 'aal1' | 'aal2';
  readonly canChangeMembership: boolean;
  readonly canDisclose: boolean;
  readonly direction?: InterfaceDirection;
  readonly onOpen?: (caseReference: string) => void;
  readonly onManageMembership?: (caseReference: string) => void;
  readonly onCreateDisclosure?: (caseReference: string) => void;
}) {
  return (
    <RestrictedRecordBoundary authorized={authorized}>
      <section aria-labelledby="safeguarding-workspace-title" dir={direction}>
        <header>
          <h2 id="safeguarding-workspace-title">Safeguarding cases</h2>
          <p>
            Case references are visible only within active case membership and the current approved
            purpose.
          </p>
        </header>
        {assurance === 'aal2' ? null : (
          <div role="alert">
            Step-up authentication is required before opening cases, changing membership or creating
            disclosures.
          </div>
        )}
        <ResponsiveTableRegion label="Safeguarding cases" direction={direction}>
          <table>
            <caption>Existence-protected cases within the current membership scope</caption>
            <thead>
              <tr>
                <th scope="col">Case reference</th>
                <th scope="col">Risk band</th>
                <th scope="col">Status</th>
                <th scope="col">Opened</th>
                <th scope="col">Review due</th>
                <th scope="col">Membership expires</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyTableRow columns={7} message="No cases were found in the current membership scope." />
              ) : (
                rows.map((row) => (
                  <tr key={row.caseReference}>
                    <th scope="row">{row.caseReference}</th>
                    <td>{row.riskBand}</td>
                    <td>{row.status}</td>
                    <td>
                      <time dateTime={row.openedAt}>{row.openedAt}</time>
                    </td>
                    <td>
                      {row.reviewDueAt === null ? (
                        'Not scheduled'
                      ) : (
                        <time dateTime={row.reviewDueAt}>{row.reviewDueAt}</time>
                      )}
                    </td>
                    <td>
                      <time dateTime={row.membershipExpiresAt}>{row.membershipExpiresAt}</time>
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={assurance !== 'aal2'}
                        onClick={() => onOpen?.(row.caseReference)}
                      >
                        Open case
                      </button>{' '}
                      <button
                        type="button"
                        disabled={assurance !== 'aal2' || !canChangeMembership}
                        onClick={() => onManageMembership?.(row.caseReference)}
                      >
                        Manage membership
                      </button>{' '}
                      <button
                        type="button"
                        disabled={assurance !== 'aal2' || !canDisclose}
                        onClick={() => onCreateDisclosure?.(row.caseReference)}
                      >
                        Create exact disclosure
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ResponsiveTableRegion>
      </section>
    </RestrictedRecordBoundary>
  );
}

export function LearningSupportWorkspace({
  rows,
  canOpenSource,
  canPublishProjection,
  assurance,
  direction = 'ltr',
  onOpen,
  onPublish,
}: {
  readonly rows: readonly LearningSupportQueueRow[];
  readonly canOpenSource: boolean;
  readonly canPublishProjection: boolean;
  readonly assurance: 'aal1' | 'aal2';
  readonly direction?: InterfaceDirection;
  readonly onOpen?: (referralId: string) => void;
  readonly onPublish?: (referralId: string) => void;
}) {
  return (
    <section aria-labelledby="learning-support-workspace-title" dir={direction}>
      <h2 id="learning-support-workspace-title">Learning support</h2>
      <ResponsiveTableRegion label="Learning-support referrals and plans" direction={direction}>
        <table>
          <caption>Referral and plan workflow metadata without findings or restricted rationale</caption>
          <thead>
            <tr>
              <th scope="col">Student reference</th>
              <th scope="col">Category</th>
              <th scope="col">Priority</th>
              <th scope="col">Status</th>
              <th scope="col">Active plan</th>
              <th scope="col">Next review</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyTableRow columns={7} message="No learning-support items match the current scope." />
            ) : (
              rows.map((row) => (
                <tr key={row.referralId}>
                  <th scope="row">{row.studentReference}</th>
                  <td>{row.referralCategory}</td>
                  <td>{row.priority}</td>
                  <td>{row.status}</td>
                  <td>{row.activePlanVersion === null ? 'None' : `Version ${row.activePlanVersion}`}</td>
                  <td>
                    {row.nextReviewAt === null ? (
                      'Not scheduled'
                    ) : (
                      <time dateTime={row.nextReviewAt}>{row.nextReviewAt}</time>
                    )}
                  </td>
                  <td>
                    <button type="button" disabled={!canOpenSource} onClick={() => onOpen?.(row.referralId)}>
                      Open authorized source
                    </button>{' '}
                    <button
                      type="button"
                      disabled={!canPublishProjection || assurance !== 'aal2'}
                      onClick={() => onPublish?.(row.referralId)}
                    >
                      Approve projection
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ResponsiveTableRegion>
    </section>
  );
}

export function BreakGlassReviewPanel({
  grantReference,
  reason,
  expiresAt,
  requesterLabel,
  approverLabel,
  canReview,
  onRevoke,
  onMarkReviewed,
}: {
  readonly grantReference: string;
  readonly reason: string;
  readonly expiresAt: string;
  readonly requesterLabel: string;
  readonly approverLabel: string;
  readonly canReview: boolean;
  readonly onRevoke?: () => void;
  readonly onMarkReviewed?: () => void;
}) {
  return (
    <section aria-labelledby="break-glass-review-title">
      <h2 id="break-glass-review-title">Emergency access review</h2>
      <dl>
        <div>
          <dt>Grant</dt>
          <dd>{grantReference}</dd>
        </div>
        <div>
          <dt>Requester</dt>
          <dd>{requesterLabel}</dd>
        </div>
        <div>
          <dt>Independent approver</dt>
          <dd>{approverLabel}</dd>
        </div>
        <div>
          <dt>Reason</dt>
          <dd>{reason}</dd>
        </div>
        <div>
          <dt>Expires</dt>
          <dd>
            <time dateTime={expiresAt}>{expiresAt}</time>
          </dd>
        </div>
      </dl>
      <button type="button" disabled={!canReview} onClick={onRevoke}>
        Revoke grant
      </button>{' '}
      <button type="button" disabled={!canReview} onClick={onMarkReviewed}>
        Mark review complete
      </button>
    </section>
  );
}

export function ExactDisclosureApprovalPanel({
  subjectCount,
  fieldCategories,
  recipientLabel,
  purposeLabel,
  expiresAt,
  assurance,
  requesterIsApprover,
  canApprove,
  onApprove,
}: {
  readonly subjectCount: number;
  readonly fieldCategories: readonly string[];
  readonly recipientLabel: string;
  readonly purposeLabel: string;
  readonly expiresAt: string;
  readonly assurance: 'aal1' | 'aal2';
  readonly requesterIsApprover: boolean;
  readonly canApprove: boolean;
  readonly onApprove?: () => void;
}) {
  const valid =
    assurance === 'aal2' &&
    !requesterIsApprover &&
    canApprove &&
    subjectCount > 0 &&
    fieldCategories.length > 0;
  return (
    <section aria-labelledby="exact-disclosure-title">
      <h2 id="exact-disclosure-title">Exact disclosure approval</h2>
      <p>This approval applies only to the listed subjects, fields, recipient, purpose and expiry.</p>
      <dl>
        <div>
          <dt>Subjects</dt>
          <dd>{subjectCount}</dd>
        </div>
        <div>
          <dt>Field categories</dt>
          <dd>{fieldCategories.length === 0 ? 'None selected' : fieldCategories.join(', ')}</dd>
        </div>
        <div>
          <dt>Recipient</dt>
          <dd>{recipientLabel}</dd>
        </div>
        <div>
          <dt>Purpose</dt>
          <dd>{purposeLabel}</dd>
        </div>
        <div>
          <dt>Expires</dt>
          <dd>
            <time dateTime={expiresAt}>{expiresAt}</time>
          </dd>
        </div>
      </dl>
      {requesterIsApprover ? (
        <p role="alert">The requester cannot approve the same disclosure.</p>
      ) : assurance === 'aal2' ? null : (
        <p role="status">Step-up authentication is required before approval.</p>
      )}
      <button type="button" disabled={!valid} onClick={onApprove}>
        Approve exact disclosure
      </button>
    </section>
  );
}
