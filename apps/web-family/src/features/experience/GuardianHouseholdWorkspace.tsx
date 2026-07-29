import type { ReactElement } from 'react';

import './guardian-household-workspace.css';

interface GuardianScopedItem {
  readonly childId?: string;
  readonly requiredCapability?: string;
}

export type GuardianTaskState = 'ready' | 'due-soon' | 'overdue' | 'submitted' | 'complete';
export type GuardianPublicationState = 'unpublished' | 'published' | 'revised';
export type GuardianBalanceState = 'clear' | 'due' | 'overdue' | 'credit';

export interface GuardianChildSummary extends GuardianScopedItem {
  readonly childId: string;
  readonly displayName: string;
  readonly preferredName?: string;
  readonly yearLabel: string;
  readonly campusLabel: string;
  readonly relationshipLabel: string;
  readonly avatarText?: string;
  readonly profileHref: string;
}

export interface GuardianApplicationItem extends GuardianScopedItem {
  readonly id: string;
  readonly applicantName: string;
  readonly programmeLabel: string;
  readonly statusLabel: string;
  readonly nextAction?: string;
  readonly dueAt?: string;
  readonly href: string;
}

export interface GuardianAttendanceItem extends GuardianScopedItem {
  readonly id: string;
  readonly childId: string;
  readonly periodLabel: string;
  readonly presentCount: number;
  readonly absentCount: number;
  readonly lateCount: number;
  readonly publishedAt: string;
  readonly notice?: string;
  readonly href: string;
}

export interface GuardianGradeItem extends GuardianScopedItem {
  readonly id: string;
  readonly childId: string;
  readonly subjectLabel: string;
  readonly resultLabel: string;
  readonly teacherComment?: string;
  readonly publicationState: GuardianPublicationState;
  readonly publishedAt?: string;
  readonly href: string;
}

export interface GuardianFeeItem extends GuardianScopedItem {
  readonly id: string;
  readonly childId?: string;
  readonly label: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly balanceState: GuardianBalanceState;
  readonly dueAt?: string;
  readonly statementHref: string;
  readonly paymentHref?: string;
}

export interface GuardianFormItem extends GuardianScopedItem {
  readonly id: string;
  readonly childId?: string;
  readonly title: string;
  readonly description: string;
  readonly state: GuardianTaskState;
  readonly dueAt?: string;
  readonly requiresAssurance?: 'aal1' | 'aal2';
  readonly href: string;
}

export interface GuardianDocumentItem extends GuardianScopedItem {
  readonly id: string;
  readonly childId?: string;
  readonly title: string;
  readonly category: string;
  readonly publishedAt: string;
  readonly downloadHref: string;
}

export interface GuardianConversationItem extends GuardianScopedItem {
  readonly id: string;
  readonly childId?: string;
  readonly subject: string;
  readonly participantLabel: string;
  readonly lastMessageAt: string;
  readonly unreadCount: number;
  readonly href: string;
}

export interface GuardianHouseholdWorkspaceProps {
  readonly guardianName: string;
  readonly householdLabel: string;
  readonly locale: string;
  readonly activeChildId?: string;
  readonly state?: 'ready' | 'loading' | 'error';
  readonly errorMessage?: string;
  readonly retryHref?: string;
  readonly capabilities: readonly string[];
  readonly children: readonly GuardianChildSummary[];
  readonly applications: readonly GuardianApplicationItem[];
  readonly attendance: readonly GuardianAttendanceItem[];
  readonly grades: readonly GuardianGradeItem[];
  readonly fees: readonly GuardianFeeItem[];
  readonly forms: readonly GuardianFormItem[];
  readonly documents: readonly GuardianDocumentItem[];
  readonly conversations: readonly GuardianConversationItem[];
}

function hasCapability(capabilities: readonly string[], requiredCapability?: string): boolean {
  return requiredCapability === undefined || capabilities.includes(requiredCapability);
}

function isInChildScope(item: GuardianScopedItem, activeChildId?: string): boolean {
  return (
    activeChildId === undefined || item.childId === undefined || item.childId === activeChildId
  );
}

export function selectGuardianItems<T extends GuardianScopedItem>(
  items: readonly T[],
  capabilities: readonly string[],
  activeChildId?: string,
): T[] {
  return items.filter(
    (item) =>
      hasCapability(capabilities, item.requiredCapability) && isInChildScope(item, activeChildId),
  );
}

export function selectGuardianChildren(
  children: readonly GuardianChildSummary[],
  capabilities: readonly string[],
): GuardianChildSummary[] {
  return children.filter((child) => hasCapability(capabilities, child.requiredCapability));
}

export function resolveGuardianActiveChild(
  children: readonly GuardianChildSummary[],
  requestedChildId?: string,
): GuardianChildSummary | undefined {
  if (requestedChildId === undefined) return children[0];
  return children.find((child) => child.childId === requestedChildId);
}

function formatCount(locale: string, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

function formatMoney(locale: string, amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amountMinor / 100);
}

function EmptyState(props: { readonly title: string; readonly detail: string }): ReactElement {
  return (
    <div className="guardian-workspace__empty" role="status">
      <strong>{props.title}</strong>
      <span>{props.detail}</span>
    </div>
  );
}

function WorkspaceState(props: {
  readonly title: string;
  readonly detail: string;
  readonly role?: 'status' | 'alert';
  readonly retryHref?: string | undefined;
}): ReactElement {
  return (
    <section className="guardian-workspace__state" role={props.role ?? 'status'}>
      <h2>{props.title}</h2>
      <p>{props.detail}</p>
      {props.retryHref === undefined ? null : <a href={props.retryHref}>Try again</a>}
    </section>
  );
}

function childName(
  children: readonly GuardianChildSummary[],
  childId?: string,
): string | undefined {
  if (childId === undefined) return undefined;
  return children.find((child) => child.childId === childId)?.displayName;
}

function statusLabel(state: GuardianTaskState | GuardianBalanceState): string {
  return state.replace('-', ' ');
}

export function GuardianHouseholdWorkspace(props: GuardianHouseholdWorkspaceProps): ReactElement {
  if (props.state === 'loading') {
    return (
      <WorkspaceState
        title="Preparing your family workspace"
        detail="Loading linked children, published school information and household tasks."
      />
    );
  }

  if (props.state === 'error') {
    return (
      <WorkspaceState
        role="alert"
        title="Your family workspace could not be loaded"
        detail={
          props.errorMessage ??
          'No form, consent or payment was submitted. Your saved household work is unchanged.'
        }
        retryHref={props.retryHref}
      />
    );
  }

  const linkedChildren = selectGuardianChildren(props.children, props.capabilities);
  const activeChild = resolveGuardianActiveChild(linkedChildren, props.activeChildId);
  const activeChildId =
    props.activeChildId === undefined ? activeChild?.childId : props.activeChildId;
  const requestedChildIsLinked =
    props.activeChildId === undefined ||
    linkedChildren.some((child) => child.childId === props.activeChildId);

  if (!requestedChildIsLinked) {
    return (
      <WorkspaceState
        role="alert"
        title="This child profile is not available"
        detail="No linked child record is available in your current household scope."
      />
    );
  }

  const applications = selectGuardianItems(props.applications, props.capabilities, activeChildId);
  const attendance = selectGuardianItems(props.attendance, props.capabilities, activeChildId);
  const grades = selectGuardianItems(props.grades, props.capabilities, activeChildId).filter(
    (grade) => grade.publicationState !== 'unpublished',
  );
  const fees = selectGuardianItems(props.fees, props.capabilities, activeChildId);
  const forms = selectGuardianItems(props.forms, props.capabilities, activeChildId);
  const documents = selectGuardianItems(props.documents, props.capabilities, activeChildId);
  const conversations = selectGuardianItems(props.conversations, props.capabilities, activeChildId);

  const dueForms = forms.filter(
    (form) => form.state === 'ready' || form.state === 'due-soon' || form.state === 'overdue',
  ).length;
  const amountDue = fees
    .filter((fee) => fee.balanceState === 'due' || fee.balanceState === 'overdue')
    .reduce((total, fee) => total + fee.amountMinor, 0);
  const feeCurrency = fees.find(
    (fee) => fee.balanceState === 'due' || fee.balanceState === 'overdue',
  )?.currency;
  const unreadMessages = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );

  return (
    <div className="guardian-workspace" data-active-child={activeChildId ?? 'household'}>
      <header className="guardian-workspace__masthead">
        <div>
          <p className="guardian-workspace__kicker">Family workspace</p>
          <h2>{props.guardianName}</h2>
          <span>{props.householdLabel}</span>
        </div>
        <dl aria-label="Household action summary">
          <div>
            <dt>Forms needing action</dt>
            <dd>{formatCount(props.locale, dueForms)}</dd>
          </div>
          <div>
            <dt>Amount due</dt>
            <dd>
              {feeCurrency === undefined ? '—' : formatMoney(props.locale, amountDue, feeCurrency)}
            </dd>
          </div>
          <div>
            <dt>Unread messages</dt>
            <dd>{formatCount(props.locale, unreadMessages)}</dd>
          </div>
        </dl>
      </header>

      <section className="guardian-workspace__children" aria-labelledby="guardian-children-heading">
        <header>
          <h3 id="guardian-children-heading">Linked children</h3>
          <p>Switching child changes every child-specific section in one consistent scope.</p>
        </header>
        {linkedChildren.length === 0 ? (
          <EmptyState
            title="No linked child profile"
            detail="No child relationship is available in your current household scope."
          />
        ) : (
          <nav aria-label="Choose a linked child">
            <ul>
              {linkedChildren.map((child) => (
                <li key={child.childId}>
                  <a
                    href={`/family?child=${encodeURIComponent(child.childId)}`}
                    aria-current={child.childId === activeChildId ? 'page' : undefined}
                  >
                    <span aria-hidden="true">
                      {child.avatarText ?? child.displayName.slice(0, 1)}
                    </span>
                    <strong>{child.preferredName ?? child.displayName}</strong>
                    <small>
                      {child.yearLabel} · {child.campusLabel}
                    </small>
                    <small>{child.relationshipLabel}</small>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </section>

      <section
        className="guardian-workspace__section"
        aria-labelledby="guardian-applications-heading"
      >
        <header>
          <h3 id="guardian-applications-heading">Applications and admissions</h3>
          <p>Current application state and the next required household action.</p>
        </header>
        {applications.length === 0 ? (
          <EmptyState
            title="No visible applications"
            detail="No household application is available in your current scope."
          />
        ) : (
          <ol className="guardian-workspace__tasks">
            {applications.map((application) => (
              <li key={application.id}>
                <div>
                  <strong>{application.applicantName}</strong>
                  <span>{application.programmeLabel}</span>
                  <small>{application.statusLabel}</small>
                  {application.nextAction === undefined ? null : (
                    <small>Next: {application.nextAction}</small>
                  )}
                </div>
                {application.dueAt === undefined ? null : (
                  <time dateTime={application.dueAt}>Due {application.dueAt}</time>
                )}
                <a href={application.href}>Open application</a>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="guardian-workspace__split">
        <section
          className="guardian-workspace__section"
          aria-labelledby="guardian-attendance-heading"
        >
          <header>
            <h3 id="guardian-attendance-heading">Published attendance</h3>
            <p>School-published attendance only; draft teacher registers are never shown.</p>
          </header>
          {attendance.length === 0 ? (
            <EmptyState
              title="No published attendance"
              detail="No published attendance summary is available for this child."
            />
          ) : (
            <ol className="guardian-workspace__records">
              {attendance.map((record) => (
                <li key={record.id}>
                  <div>
                    <strong>{record.periodLabel}</strong>
                    <span>{childName(linkedChildren, record.childId)}</span>
                    <small>
                      Published <time dateTime={record.publishedAt}>{record.publishedAt}</time>
                    </small>
                  </div>
                  <dl>
                    <div>
                      <dt>Present</dt>
                      <dd>{formatCount(props.locale, record.presentCount)}</dd>
                    </div>
                    <div>
                      <dt>Absent</dt>
                      <dd>{formatCount(props.locale, record.absentCount)}</dd>
                    </div>
                    <div>
                      <dt>Late</dt>
                      <dd>{formatCount(props.locale, record.lateCount)}</dd>
                    </div>
                  </dl>
                  {record.notice === undefined ? null : <p>{record.notice}</p>}
                  <a href={record.href}>View attendance</a>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="guardian-workspace__section" aria-labelledby="guardian-grades-heading">
          <header>
            <h3 id="guardian-grades-heading">Published grades and reports</h3>
            <p>Only formally published or revised results are visible.</p>
          </header>
          {grades.length === 0 ? (
            <EmptyState
              title="No published results"
              detail="No published grade or report is available for this child."
            />
          ) : (
            <ol className="guardian-workspace__records guardian-workspace__records--grades">
              {grades.map((grade) => (
                <li key={grade.id} data-publication={grade.publicationState}>
                  <div>
                    <strong>{grade.subjectLabel}</strong>
                    <span>{grade.resultLabel}</span>
                    <small>{grade.publicationState}</small>
                  </div>
                  {grade.teacherComment === undefined ? null : <p>{grade.teacherComment}</p>}
                  {grade.publishedAt === undefined ? null : (
                    <time dateTime={grade.publishedAt}>{grade.publishedAt}</time>
                  )}
                  <a href={grade.href}>View published result</a>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="guardian-workspace__section" aria-labelledby="guardian-fees-heading">
        <header>
          <h3 id="guardian-fees-heading">Fees, statements and payments</h3>
          <p>Balances retain child/household attribution, currency and statement drill-down.</p>
        </header>
        {fees.length === 0 ? (
          <EmptyState
            title="No visible fee statement"
            detail="No authorised household balance is available in this scope."
          />
        ) : (
          <div
            className="guardian-workspace__table-frame"
            role="region"
            aria-label="Household fee statements"
            tabIndex={0}
          >
            <table>
              <caption>Authorised household and child fee balances</caption>
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Charge</th>
                  <th scope="col">Amount</th>
                  <th scope="col">State</th>
                  <th scope="col">Due</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => (
                  <tr key={fee.id} data-state={fee.balanceState}>
                    <td>{childName(linkedChildren, fee.childId) ?? 'Household'}</td>
                    <td>{fee.label}</td>
                    <td>{formatMoney(props.locale, fee.amountMinor, fee.currency)}</td>
                    <td>
                      <span className="guardian-workspace__status">
                        {statusLabel(fee.balanceState)}
                      </span>
                    </td>
                    <td>
                      {fee.dueAt === undefined ? (
                        '—'
                      ) : (
                        <time dateTime={fee.dueAt}>{fee.dueAt}</time>
                      )}
                    </td>
                    <td>
                      <a href={fee.statementHref}>View statement</a>
                      {fee.paymentHref === undefined || fee.balanceState === 'clear' ? null : (
                        <a className="guardian-workspace__primary" href={fee.paymentHref}>
                          Pay securely
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="guardian-workspace__split">
        <section className="guardian-workspace__section" aria-labelledby="guardian-forms-heading">
          <header>
            <h3 id="guardian-forms-heading">Forms and consent</h3>
            <p>Due dates, submission state and identity verification are visible before action.</p>
          </header>
          {forms.length === 0 ? (
            <EmptyState title="No household forms" detail="No form or consent requires action." />
          ) : (
            <ol className="guardian-workspace__tasks">
              {forms.map((form) => (
                <li key={form.id} data-state={form.state}>
                  <div>
                    <strong>{form.title}</strong>
                    <span>{form.description}</span>
                    <small>{childName(linkedChildren, form.childId) ?? 'Household'}</small>
                    <span className="guardian-workspace__status">{statusLabel(form.state)}</span>
                  </div>
                  <div>
                    {form.dueAt === undefined ? null : (
                      <time dateTime={form.dueAt}>Due {form.dueAt}</time>
                    )}
                    {form.requiresAssurance === 'aal2' ? (
                      <small>Identity verification required</small>
                    ) : null}
                  </div>
                  <a href={form.href}>
                    {form.state === 'complete' ? 'View response' : 'Open form'}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section
          className="guardian-workspace__section"
          aria-labelledby="guardian-documents-heading"
        >
          <header>
            <h3 id="guardian-documents-heading">Authorised documents</h3>
            <p>Downloads remain linked to the current household/child authorization.</p>
          </header>
          {documents.length === 0 ? (
            <EmptyState
              title="No authorised documents"
              detail="No published document is available in this scope."
            />
          ) : (
            <ol className="guardian-workspace__documents">
              {documents.map((document) => (
                <li key={document.id}>
                  <div>
                    <strong>{document.title}</strong>
                    <span>{document.category}</span>
                    <small>{childName(linkedChildren, document.childId) ?? 'Household'}</small>
                    <time dateTime={document.publishedAt}>{document.publishedAt}</time>
                  </div>
                  <a href={document.downloadHref}>Download authorised copy</a>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="guardian-workspace__section" aria-labelledby="guardian-messages-heading">
        <header>
          <h3 id="guardian-messages-heading">Secure school communication</h3>
          <p>Only conversations allowed for the current household relationship are visible.</p>
        </header>
        {conversations.length === 0 ? (
          <EmptyState
            title="No authorised conversations"
            detail="No secure message thread is available in this scope."
          />
        ) : (
          <ol className="guardian-workspace__messages">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <div>
                  <strong>{conversation.subject}</strong>
                  <span>{conversation.participantLabel}</span>
                  <small>{childName(linkedChildren, conversation.childId) ?? 'Household'}</small>
                  <time dateTime={conversation.lastMessageAt}>{conversation.lastMessageAt}</time>
                </div>
                {conversation.unreadCount === 0 ? null : (
                  <span className="guardian-workspace__unread">
                    {formatCount(props.locale, conversation.unreadCount)} unread
                  </span>
                )}
                <a href={conversation.href}>Open conversation</a>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
