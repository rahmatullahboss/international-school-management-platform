import type { ReactElement } from 'react';

import './student-daily-workspace.css';

interface StudentScopedItem {
  readonly studentId: string;
  readonly requiredCapability?: string;
}

export type StudentLessonState = 'upcoming' | 'current' | 'completed' | 'cancelled';
export type StudentPublicationState = 'unpublished' | 'published' | 'revised';
export type StudentRequestState = 'draft' | 'submitted' | 'in-review' | 'complete' | 'declined';

export interface StudentLesson extends StudentScopedItem {
  readonly id: string;
  readonly subject: string;
  readonly teacherLabel: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly room?: string;
  readonly state: StudentLessonState;
  readonly href: string;
}

export interface StudentAttendanceSummary extends StudentScopedItem {
  readonly id: string;
  readonly periodLabel: string;
  readonly presentCount: number;
  readonly absentCount: number;
  readonly lateCount: number;
  readonly publicationState: StudentPublicationState;
  readonly publishedAt?: string;
  readonly explanationStatus?: string;
  readonly href: string;
}

export interface StudentResult extends StudentScopedItem {
  readonly id: string;
  readonly subjectLabel: string;
  readonly assessmentLabel: string;
  readonly resultLabel: string;
  readonly feedback?: string;
  readonly publicationState: StudentPublicationState;
  readonly publishedAt?: string;
  readonly href: string;
}

export interface StudentResource extends StudentScopedItem {
  readonly id: string;
  readonly subjectLabel: string;
  readonly title: string;
  readonly description: string;
  readonly resourceType: 'document' | 'link' | 'video' | 'activity';
  readonly availableUntil?: string;
  readonly href: string;
}

export interface StudentRequest extends StudentScopedItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly state: StudentRequestState;
  readonly submittedAt?: string;
  readonly nextAction?: string;
  readonly href: string;
}

export interface StudentDocument extends StudentScopedItem {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly publicationState: StudentPublicationState;
  readonly publishedAt?: string;
  readonly downloadHref: string;
}

export interface StudentConversation extends StudentScopedItem {
  readonly id: string;
  readonly subject: string;
  readonly participantLabel: string;
  readonly lastMessageAt: string;
  readonly unreadCount: number;
  readonly href: string;
}

export interface StudentDailyWorkspaceProps {
  readonly studentId: string;
  readonly studentName: string;
  readonly schoolName: string;
  readonly yearLabel: string;
  readonly locale: string;
  readonly date: string;
  readonly ageBand: 'primary' | 'secondary' | 'senior';
  readonly state?: 'ready' | 'loading' | 'error';
  readonly errorMessage?: string;
  readonly retryHref?: string;
  readonly capabilities: readonly string[];
  readonly lessons: readonly StudentLesson[];
  readonly attendance: readonly StudentAttendanceSummary[];
  readonly results: readonly StudentResult[];
  readonly resources: readonly StudentResource[];
  readonly requests: readonly StudentRequest[];
  readonly documents: readonly StudentDocument[];
  readonly conversations: readonly StudentConversation[];
}

const lessonOrder: Readonly<Record<StudentLessonState, number>> = {
  current: 0,
  upcoming: 1,
  completed: 2,
  cancelled: 3,
};

function hasCapability(capabilities: readonly string[], requiredCapability?: string): boolean {
  return requiredCapability === undefined || capabilities.includes(requiredCapability);
}

export function selectStudentItems<T extends StudentScopedItem>(
  items: readonly T[],
  studentId: string,
  capabilities: readonly string[],
): T[] {
  return items.filter(
    (item) => item.studentId === studentId && hasCapability(capabilities, item.requiredCapability),
  );
}

export function sortStudentLessons(lessons: readonly StudentLesson[]): StudentLesson[] {
  return [...lessons].sort((left, right) => {
    const stateDifference = lessonOrder[left.state] - lessonOrder[right.state];
    if (stateDifference !== 0) return stateDifference;
    return left.startsAt.localeCompare(right.startsAt);
  });
}

function publishedOnly<T extends { readonly publicationState: StudentPublicationState }>(
  items: readonly T[],
): T[] {
  return items.filter((item) => item.publicationState !== 'unpublished');
}

function formatCount(locale: string, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

function formatTime(locale: string, value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(parsed);
}

function WorkspaceState(props: {
  readonly title: string;
  readonly detail: string;
  readonly role?: 'status' | 'alert';
  readonly retryHref?: string | undefined;
}): ReactElement {
  return (
    <section className="student-workspace__state" role={props.role ?? 'status'}>
      <h2>{props.title}</h2>
      <p>{props.detail}</p>
      {props.retryHref === undefined ? null : <a href={props.retryHref}>Try again</a>}
    </section>
  );
}

function EmptyState(props: { readonly title: string; readonly detail: string }): ReactElement {
  return (
    <div className="student-workspace__empty" role="status">
      <strong>{props.title}</strong>
      <span>{props.detail}</span>
    </div>
  );
}

export function StudentResourcesWorkspace(props: {
  readonly resources: readonly StudentResource[];
}): ReactElement {
  return (
    <section className="student-workspace__section" aria-labelledby="student-resources-heading">
      <header>
        <h3 id="student-resources-heading">Class resources</h3>
        <p>Materials are limited to your current classes and authorised records.</p>
      </header>
      {props.resources.length === 0 ? (
        <EmptyState
          title="No class resources"
          detail="No authorised resource is available in this scope."
        />
      ) : (
        <ul className="student-workspace__resources">
          {props.resources.map((resource) => (
            <li key={resource.id} data-type={resource.resourceType}>
              <details>
                <summary>
                  <strong>{resource.title}</strong>{' '}
                  <span>
                    {resource.subjectLabel} · {resource.resourceType}
                  </span>
                </summary>
                <p>{resource.description}</p>
                {resource.availableUntil === undefined ? null : (
                  <small>
                    Available until{' '}
                    <time dateTime={resource.availableUntil}>{resource.availableUntil}</time>
                  </small>
                )}
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StudentRequestsWorkspace(props: {
  readonly requests: readonly StudentRequest[];
}): ReactElement {
  return (
    <section className="student-workspace__section" aria-labelledby="student-requests-heading">
      <header>
        <h3 id="student-requests-heading">My requests</h3>
        <p>Track only the requests available for your age and role.</p>
      </header>
      {props.requests.length === 0 ? (
        <EmptyState
          title="No student requests"
          detail="No request is available in your current scope."
        />
      ) : (
        <ol className="student-workspace__tasks">
          {props.requests.map((request) => (
            <li key={request.id} data-state={request.state}>
              <details>
                <summary>
                  <strong>{request.title}</strong> <span>{request.state.replace('-', ' ')}</span>
                </summary>
                <p>{request.description}</p>
                {request.submittedAt === undefined ? null : (
                  <time dateTime={request.submittedAt}>{request.submittedAt}</time>
                )}
                {request.nextAction === undefined ? null : (
                  <small>Next: {request.nextAction}</small>
                )}
                <a href={request.href}>
                  {request.state === 'draft' ? 'Continue request' : 'View request'}
                </a>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function pageIntroduction(ageBand: StudentDailyWorkspaceProps['ageBand']): string {
  if (ageBand === 'primary') return 'See what is next, what is ready and where to ask for help.';
  if (ageBand === 'senior')
    return 'Review today’s schedule, published progress and your current actions.';
  return 'Follow today’s lessons, published progress and the next task you can complete.';
}

export function StudentDailyWorkspace(props: StudentDailyWorkspaceProps): ReactElement {
  if (props.state === 'loading') {
    return (
      <WorkspaceState
        title="Preparing your school day"
        detail="Loading your timetable, published progress, resources and secure messages."
      />
    );
  }

  if (props.state === 'error') {
    return (
      <WorkspaceState
        role="alert"
        title="Your school day could not be loaded"
        detail={
          props.errorMessage ??
          'No request or message was submitted. Your saved school work is unchanged.'
        }
        retryHref={props.retryHref}
      />
    );
  }

  const lessons = sortStudentLessons(
    selectStudentItems(props.lessons, props.studentId, props.capabilities),
  );
  const attendance = publishedOnly(
    selectStudentItems(props.attendance, props.studentId, props.capabilities),
  );
  const results = publishedOnly(
    selectStudentItems(props.results, props.studentId, props.capabilities),
  );
  const resources = selectStudentItems(props.resources, props.studentId, props.capabilities);
  const requests = selectStudentItems(props.requests, props.studentId, props.capabilities);
  const documents = publishedOnly(
    selectStudentItems(props.documents, props.studentId, props.capabilities),
  );
  const conversations = selectStudentItems(
    props.conversations,
    props.studentId,
    props.capabilities,
  );

  const currentLesson = lessons.find((lesson) => lesson.state === 'current');
  const actionableRequests = requests.filter(
    (request) => request.state === 'draft' || request.state === 'declined',
  ).length;
  const unreadMessages = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );

  return (
    <div className="student-workspace" data-age-band={props.ageBand}>
      <header className="student-workspace__masthead">
        <div>
          <p className="student-workspace__kicker">My school day</p>
          <h2>{props.studentName}</h2>
          <span>
            {props.schoolName} · {props.yearLabel} · <time dateTime={props.date}>{props.date}</time>
          </span>
          <p>{pageIntroduction(props.ageBand)}</p>
        </div>
        <dl aria-label="Today’s student summary">
          <div>
            <dt>Current lesson</dt>
            <dd>{currentLesson?.subject ?? 'No lesson now'}</dd>
          </div>
          <div>
            <dt>Requests needing action</dt>
            <dd>{formatCount(props.locale, actionableRequests)}</dd>
          </div>
          <div>
            <dt>Unread messages</dt>
            <dd>{formatCount(props.locale, unreadMessages)}</dd>
          </div>
        </dl>
      </header>

      <section className="student-workspace__section" aria-labelledby="student-lessons-heading">
        <header>
          <h3 id="student-lessons-heading">Today’s lessons</h3>
          <p>Only your published timetable and authorised class links appear here.</p>
        </header>
        {lessons.length === 0 ? (
          <EmptyState
            title="No published lessons"
            detail="No lesson is available in your current timetable scope."
          />
        ) : (
          <ol className="student-workspace__timeline">
            {lessons.map((lesson) => (
              <li key={lesson.id} data-state={lesson.state}>
                <time dateTime={lesson.startsAt}>{formatTime(props.locale, lesson.startsAt)}</time>
                <div>
                  <strong>{lesson.subject}</strong>
                  <span>{lesson.teacherLabel}</span>
                  <small>
                    {lesson.room === undefined ? '' : `${lesson.room} · `}
                    {lesson.state} · until {formatTime(props.locale, lesson.endsAt)}
                  </small>
                </div>
                <a href={lesson.href}>
                  {lesson.state === 'current' ? 'Open current lesson' : 'Open lesson'}
                </a>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="student-workspace__split">
        <section
          className="student-workspace__section"
          aria-labelledby="student-attendance-heading"
        >
          <header>
            <h3 id="student-attendance-heading">My published attendance</h3>
            <p>Only school-published attendance summaries are shown.</p>
          </header>
          {attendance.length === 0 ? (
            <EmptyState
              title="No published attendance"
              detail="No published attendance summary is available yet."
            />
          ) : (
            <ol className="student-workspace__records">
              {attendance.map((record) => (
                <li key={record.id} data-publication={record.publicationState}>
                  <div>
                    <strong>{record.periodLabel}</strong>
                    <small>
                      {record.publicationState}
                      {record.publishedAt === undefined ? '' : ` · ${record.publishedAt}`}
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
                  {record.explanationStatus === undefined ? null : (
                    <p>{record.explanationStatus}</p>
                  )}
                  <a href={record.href}>View attendance details</a>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="student-workspace__section" aria-labelledby="student-results-heading">
          <header>
            <h3 id="student-results-heading">My published results</h3>
            <p>Draft marks and internal teacher notes are never shown.</p>
          </header>
          {results.length === 0 ? (
            <EmptyState
              title="No published results"
              detail="No published result is available in your current scope."
            />
          ) : (
            <ol className="student-workspace__results">
              {results.map((result) => (
                <li key={result.id} data-publication={result.publicationState}>
                  <div>
                    <strong>{result.subjectLabel}</strong>
                    <span>{result.assessmentLabel}</span>
                    <small>{result.publicationState}</small>
                  </div>
                  <strong className="student-workspace__result-value">{result.resultLabel}</strong>
                  {result.feedback === undefined ? null : <p>{result.feedback}</p>}
                  {result.publishedAt === undefined ? null : (
                    <time dateTime={result.publishedAt}>{result.publishedAt}</time>
                  )}
                  <a href={result.href}>View published result</a>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <StudentResourcesWorkspace resources={resources} />

      <div className="student-workspace__split">
        <StudentRequestsWorkspace requests={requests} />

        <section className="student-workspace__section" aria-labelledby="student-documents-heading">
          <header>
            <h3 id="student-documents-heading">My authorised documents</h3>
            <p>Only published documents authorised for your own student profile are available.</p>
          </header>
          {documents.length === 0 ? (
            <EmptyState
              title="No authorised documents"
              detail="No published document is available in your current scope."
            />
          ) : (
            <ol className="student-workspace__tasks">
              {documents.map((document) => (
                <li key={document.id} data-publication={document.publicationState}>
                  <div>
                    <strong>{document.title}</strong>
                    <span>{document.category}</span>
                    <small>{document.publicationState}</small>
                    {document.publishedAt === undefined ? null : (
                      <time dateTime={document.publishedAt}>{document.publishedAt}</time>
                    )}
                  </div>
                  <a href={document.downloadHref}>Download authorised copy</a>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="student-workspace__section" aria-labelledby="student-messages-heading">
        <header>
          <h3 id="student-messages-heading">Secure school messages</h3>
          <p>Only conversations authorised for your own student role are shown.</p>
        </header>
        {conversations.length === 0 ? (
          <EmptyState
            title="No authorised messages"
            detail="No secure message thread is available in your current scope."
          />
        ) : (
          <ol className="student-workspace__messages">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <div>
                  <strong>{conversation.subject}</strong>
                  <span>{conversation.participantLabel}</span>
                  <time dateTime={conversation.lastMessageAt}>{conversation.lastMessageAt}</time>
                </div>
                {conversation.unreadCount === 0 ? null : (
                  <span className="student-workspace__unread">
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
