import type { ReactElement } from 'react';

export interface FamilyChecklistItem {
  id: string;
  label: string;
  status: 'pending' | 'received' | 'verified' | 'waived' | 'rejected';
  required: boolean;
  actionHref?: string;
  actionLabel?: string;
}

export interface FamilyApplicationTimelineItem {
  id: string;
  title: string;
  description: string;
  occurredAt?: string;
  current?: boolean;
}

export interface FamilyOfferSummary {
  programName: string;
  campusName: string;
  academicYear: string;
  gradeLevel?: string;
  expiresAt: string;
  status: 'issued' | 'accepted' | 'declined' | 'expired' | 'withdrawn';
  actionHref?: string;
}

export interface FamilyContractSummary {
  status: 'not-issued' | 'issued' | 'signed' | 'void';
  issuedAt?: string;
  signedAt?: string;
  actionHref?: string;
}

export interface FamilyAdmissionsWorkspaceProps {
  guardianName: string;
  applicantName: string;
  applicationNumber: string;
  applicationStatus: string;
  checklist: readonly FamilyChecklistItem[];
  timeline: readonly FamilyApplicationTimelineItem[];
  offer?: FamilyOfferSummary;
  contract?: FamilyContractSummary;
  depositStatus?: 'not-required' | 'pending' | 'confirmed' | 'waived' | 'refunded';
  supportHref: string;
}

function statusExplanation(status: string): string {
  switch (status) {
    case 'draft':
      return 'The application has not been submitted yet.';
    case 'submitted':
      return 'The school has received the application.';
    case 'under-review':
      return 'The admissions team is reviewing the application and submitted documents.';
    case 'waitlisted':
      return 'The application is on the waitlist. The school will contact you when a place becomes available.';
    case 'offered':
      return 'An admission offer is available. Review its deadline and requirements.';
    case 'accepted':
      return 'The offer has been accepted. Complete any remaining contract or deposit steps.';
    case 'declined':
      return 'The application was not offered a place for this cycle.';
    case 'withdrawn':
      return 'The application has been withdrawn.';
    case 'converted':
      return 'Admissions is complete and a student enrollment record has been created.';
    default:
      return 'The school is processing the application.';
  }
}

function checklistStatusText(item: FamilyChecklistItem): string {
  const requirement = item.required ? 'Required' : 'Optional';
  return `${requirement}; ${item.status}`;
}

export function FamilyAdmissionsWorkspace(props: FamilyAdmissionsWorkspaceProps): ReactElement {
  const completedChecklist = props.checklist.filter((item) =>
    ['verified', 'waived'].includes(item.status),
  ).length;
  const requiredIncomplete = props.checklist.filter(
    (item) => item.required && !['verified', 'waived'].includes(item.status),
  );

  return (
    <main id="main-content" tabIndex={-1}>
      <header>
        <p>Family admissions portal</p>
        <h1>{props.applicantName}'s application</h1>
        <p>
          Signed in as {props.guardianName}. Application number {props.applicationNumber}.
        </p>
      </header>

      <section aria-labelledby="application-status-heading">
        <h2 id="application-status-heading">Application status</h2>
        <p role="status" aria-live="polite">
          <strong>{props.applicationStatus}</strong>
        </p>
        <p>{statusExplanation(props.applicationStatus)}</p>
      </section>

      <section aria-labelledby="checklist-heading">
        <h2 id="checklist-heading">Documents and checklist</h2>
        <p>
          {completedChecklist} of {props.checklist.length} checklist items are verified or waived.
        </p>
        {requiredIncomplete.length > 0 ? (
          <p role="alert">
            {requiredIncomplete.length} required item{requiredIncomplete.length === 1 ? '' : 's'} still need
            attention.
          </p>
        ) : (
          <p role="status">All required checklist items are complete.</p>
        )}
        <ul>
          {props.checklist.map((item) => (
            <li key={item.id}>
              <h3>{item.label}</h3>
              <p>{checklistStatusText(item)}</p>
              {item.actionHref !== undefined && item.actionLabel !== undefined ? (
                <a href={item.actionHref}>{item.actionLabel}</a>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading">Application timeline</h2>
        <ol>
          {props.timeline.map((item) => (
            <li key={item.id} aria-current={item.current ? 'step' : undefined}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <p>{item.occurredAt ?? 'Pending'}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="offer-heading">
        <h2 id="offer-heading">Offer</h2>
        {props.offer === undefined ? (
          <p role="status">No offer is available yet.</p>
        ) : (
          <article>
            <h3>{props.offer.programName}</h3>
            <dl>
              <div>
                <dt>Campus</dt>
                <dd>{props.offer.campusName}</dd>
              </div>
              <div>
                <dt>Academic year</dt>
                <dd>{props.offer.academicYear}</dd>
              </div>
              {props.offer.gradeLevel === undefined ? null : (
                <div>
                  <dt>Grade level</dt>
                  <dd>{props.offer.gradeLevel}</dd>
                </div>
              )}
              <div>
                <dt>Status</dt>
                <dd>{props.offer.status}</dd>
              </div>
              <div>
                <dt>Deadline</dt>
                <dd>{props.offer.expiresAt}</dd>
              </div>
            </dl>
            {props.offer.actionHref === undefined ? null : (
              <a href={props.offer.actionHref}>
                {props.offer.status === 'issued' ? 'Review and respond to offer' : 'View offer'}
              </a>
            )}
          </article>
        )}
      </section>

      <section aria-labelledby="contract-heading">
        <h2 id="contract-heading">Enrollment contract and deposit</h2>
        <dl>
          <div>
            <dt>Contract</dt>
            <dd>{props.contract?.status ?? 'not-issued'}</dd>
          </div>
          <div>
            <dt>Deposit</dt>
            <dd>{props.depositStatus ?? 'not-required'}</dd>
          </div>
        </dl>
        {props.contract?.actionHref === undefined ? null : (
          <a href={props.contract.actionHref}>
            {props.contract.status === 'issued' ? 'Review and sign contract' : 'View contract'}
          </a>
        )}
      </section>

      <aside aria-labelledby="support-heading">
        <h2 id="support-heading">Need help?</h2>
        <p>Contact the admissions office about checklist items, offer deadlines or family access.</p>
        <a href={props.supportHref}>Contact admissions support</a>
      </aside>
    </main>
  );
}
