import type { ReactElement } from 'react';

import './teacher-daily-workspace.css';

export type TeacherSessionState = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
export type TeacherAttendanceState =
  | 'not-started'
  | 'draft-local'
  | 'syncing'
  | 'synced'
  | 'conflict'
  | 'finalised';
export type TeacherPublicationState = 'draft' | 'ready' | 'published' | 'locked';

interface CapabilityScoped {
  readonly requiredCapability?: string;
}

export interface TeacherClassSession extends CapabilityScoped {
  readonly id: string;
  readonly subject: string;
  readonly section: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly room?: string;
  readonly state: TeacherSessionState;
  readonly href: string;
}

export interface TeacherAttendanceTask extends CapabilityScoped {
  readonly id: string;
  readonly classLabel: string;
  readonly sessionAt: string;
  readonly rosterCount: number;
  readonly markedCount: number;
  readonly state: TeacherAttendanceState;
  readonly href: string;
  readonly retryHref?: string;
  readonly finaliseHref?: string;
}

export interface TeacherGradebookTask extends CapabilityScoped {
  readonly id: string;
  readonly classLabel: string;
  readonly assessmentLabel: string;
  readonly dueAt?: string;
  readonly studentCount: number;
  readonly enteredCount: number;
  readonly publicationState: TeacherPublicationState;
  readonly href: string;
}

export interface TeacherStudentContext extends CapabilityScoped {
  readonly id: string;
  readonly displayName: string;
  readonly classLabel: string;
  readonly learningSummary: string;
  readonly permittedTags: readonly string[];
  readonly nextAction?: string;
  readonly href: string;
}

export interface TeacherConversation extends CapabilityScoped {
  readonly id: string;
  readonly subject: string;
  readonly participantLabel: string;
  readonly lastMessageAt: string;
  readonly unreadCount: number;
  readonly href: string;
}

export interface TeacherDailyWorkspaceProps {
  readonly teacherName: string;
  readonly schoolName: string;
  readonly locale: string;
  readonly date: string;
  readonly state?: 'ready' | 'loading' | 'error';
  readonly errorMessage?: string;
  readonly retryHref?: string;
  readonly connectivity: 'online' | 'degraded' | 'offline';
  readonly pendingChanges: number;
  readonly capabilities: readonly string[];
  readonly sessions: readonly TeacherClassSession[];
  readonly attendance: readonly TeacherAttendanceTask[];
  readonly gradebook: readonly TeacherGradebookTask[];
  readonly studentContext: readonly TeacherStudentContext[];
  readonly conversations: readonly TeacherConversation[];
}

const sessionStateOrder: Readonly<Record<TeacherSessionState, number>> = {
  'in-progress': 0,
  scheduled: 1,
  completed: 2,
  cancelled: 3,
};

function hasCapability(capabilities: readonly string[], requiredCapability?: string): boolean {
  return requiredCapability === undefined || capabilities.includes(requiredCapability);
}

export function selectTeacherItems<T extends CapabilityScoped>(
  items: readonly T[],
  capabilities: readonly string[],
): T[] {
  return items.filter((item) => hasCapability(capabilities, item.requiredCapability));
}

export function sortTeacherSessions(sessions: readonly TeacherClassSession[]): TeacherClassSession[] {
  return [...sessions].sort((left, right) => {
    const stateDifference = sessionStateOrder[left.state] - sessionStateOrder[right.state];
    if (stateDifference !== 0) return stateDifference;
    return left.startsAt.localeCompare(right.startsAt);
  });
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
  readonly retryHref?: string;
}): ReactElement {
  return (
    <section className="teacher-workspace__state" role={props.role ?? 'status'}>
      <h2>{props.title}</h2>
      <p>{props.detail}</p>
      {props.retryHref === undefined ? null : <a href={props.retryHref}>Try again</a>}
    </section>
  );
}

function EmptyState(props: { readonly title: string; readonly detail: string }): ReactElement {
  return (
    <div className="teacher-workspace__empty" role="status">
      <strong>{props.title}</strong>
      <span>{props.detail}</span>
    </div>
  );
}

function AttendanceAction(props: {
  readonly task: TeacherAttendanceTask;
  readonly connectivity: TeacherDailyWorkspaceProps['connectivity'];
}): ReactElement {
  if (props.task.state === 'conflict') {
    return (
      <a className="teacher-workspace__action teacher-workspace__action--warning" href={props.task.href}>
        Reconcile changes
      </a>
    );
  }

  if (props.task.state === 'finalised') {
    return <a href={props.task.href}>View final register</a>;
  }

  if (props.connectivity === 'offline') {
    return <a href={props.task.href}>Continue on this device</a>;
  }

  if (props.task.state === 'draft-local' && props.task.retryHref !== undefined) {
    return <a href={props.task.retryHref}>Retry sync</a>;
  }

  if (props.task.markedCount === props.task.rosterCount && props.task.finaliseHref !== undefined) {
    return (
      <a className="teacher-workspace__action" href={props.task.finaliseHref}>
        Review and finalise
      </a>
    );
  }

  return <a href={props.task.href}>Open register</a>;
}

export function TeacherDailyWorkspace(props: TeacherDailyWorkspaceProps): ReactElement {
  if (props.state === 'loading') {
    return (
      <WorkspaceState
        title="Preparing today’s teaching workspace"
        detail="Loading assigned classes, registers, gradebook tasks and permitted student context."
      />
    );
  }

  if (props.state === 'error') {
    return (
      <WorkspaceState
        role="alert"
        title="Today’s teaching workspace could not be loaded"
        detail={
          props.errorMessage ??
          'No attendance, grade or message change was submitted. Your saved local work is unchanged.'
        }
        retryHref={props.retryHref}
      />
    );
  }

  const sessions = sortTeacherSessions(selectTeacherItems(props.sessions, props.capabilities));
  const attendance = selectTeacherItems(props.attendance, props.capabilities);
  const gradebook = selectTeacherItems(props.gradebook, props.capabilities);
  const studentContext = selectTeacherItems(props.studentContext, props.capabilities);
  const conversations = selectTeacherItems(props.conversations, props.capabilities);
  const activeSessions = sessions.filter(
    (session) => session.state === 'in-progress' || session.state === 'scheduled',
  ).length;
  const attendanceAttention = attendance.filter(
    (task) => task.state === 'conflict' || task.markedCount < task.rosterCount,
  ).length;
  const gradebookAttention = gradebook.filter(
    (task) => task.publicationState === 'draft' || task.enteredCount < task.studentCount,
  ).length;

  return (
    <div className="teacher-workspace" data-connectivity={props.connectivity}>
      <header className="teacher-workspace__masthead">
        <div>
          <p className="teacher-workspace__kicker">Teacher workspace</p>
          <h2>{props.teacherName}</h2>
          <span>
            {props.schoolName} · <time dateTime={props.date}>{props.date}</time>
          </span>
        </div>
        <dl aria-label="Today’s teaching status">
          <div>
            <dt>Upcoming or active</dt>
            <dd>{formatCount(props.locale, activeSessions)}</dd>
          </div>
          <div>
            <dt>Registers needing attention</dt>
            <dd>{formatCount(props.locale, attendanceAttention)}</dd>
          </div>
          <div>
            <dt>Gradebook tasks</dt>
            <dd>{formatCount(props.locale, gradebookAttention)}</dd>
          </div>
        </dl>
      </header>

      {props.connectivity === 'online' && props.pendingChanges === 0 ? null : (
        <div className="teacher-workspace__network" role="status" aria-live="polite">
          <strong>
            {props.connectivity === 'offline'
              ? 'Working offline'
              : props.connectivity === 'degraded'
                ? 'Connection is unstable'
                : 'Changes are syncing'}
          </strong>
          <span>
            {formatCount(props.locale, props.pendingChanges)} pending change
            {props.pendingChanges === 1 ? '' : 's'}. Approved work remains on this device until a
            duplicate-safe sync succeeds.
          </span>
        </div>
      )}

      <section className="teacher-workspace__section" aria-labelledby="teacher-schedule-heading">
        <header>
          <h3 id="teacher-schedule-heading">Teaching sequence</h3>
          <p>Only assigned sections and authorised class links appear here.</p>
        </header>
        {sessions.length === 0 ? (
          <EmptyState
            title="No assigned sessions"
            detail="No class session is available in your current school and role scope."
          />
        ) : (
          <ol className="teacher-workspace__timeline">
            {sessions.map((session) => (
              <li key={session.id} data-state={session.state}>
                <time dateTime={session.startsAt}>{formatTime(props.locale, session.startsAt)}</time>
                <div>
                  <strong>{session.subject}</strong>
                  <span>
                    {session.section}
                    {session.room === undefined ? '' : ` · ${session.room}`}
                  </span>
                  <small>
                    {session.state} · until {formatTime(props.locale, session.endsAt)}
                  </small>
                </div>
                <a href={session.href}>
                  {session.state === 'in-progress' ? 'Open current class' : 'Open class'}
                </a>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="teacher-workspace__section" aria-labelledby="teacher-attendance-heading">
        <header>
          <h3 id="teacher-attendance-heading">Attendance registers</h3>
          <p>Local drafts, server sync, conflicts and finalisation remain explicit.</p>
        </header>
        {attendance.length === 0 ? (
          <EmptyState
            title="No permitted registers"
            detail="No assigned attendance session currently needs work."
          />
        ) : (
          <div
            className="teacher-workspace__table-frame"
            role="region"
            aria-label="Assigned attendance registers"
            tabIndex={0}
          >
            <table>
              <caption>Assigned attendance sessions and sync state</caption>
              <thead>
                <tr>
                  <th scope="col">Class</th>
                  <th scope="col">Session</th>
                  <th scope="col">Progress</th>
                  <th scope="col">State</th>
                  <th scope="col">Next action</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((task) => (
                  <tr key={task.id} data-state={task.state}>
                    <td><strong>{task.classLabel}</strong></td>
                    <td><time dateTime={task.sessionAt}>{formatTime(props.locale, task.sessionAt)}</time></td>
                    <td>
                      {formatCount(props.locale, task.markedCount)} of{' '}
                      {formatCount(props.locale, task.rosterCount)} marked
                    </td>
                    <td><span className="teacher-workspace__status">{task.state}</span></td>
                    <td><AttendanceAction task={task} connectivity={props.connectivity} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="teacher-workspace__split">
        <section className="teacher-workspace__section" aria-labelledby="teacher-gradebook-heading">
          <header>
            <h3 id="teacher-gradebook-heading">Gradebook work</h3>
            <p>Entry progress and publication state are separate and visible.</p>
          </header>
          {gradebook.length === 0 ? (
            <EmptyState title="No gradebook tasks" detail="No assigned assessment needs attention." />
          ) : (
            <ol className="teacher-workspace__tasks">
              {gradebook.map((task) => (
                <li key={task.id} data-state={task.publicationState}>
                  <div>
                    <strong>{task.assessmentLabel}</strong>
                    <span>{task.classLabel}</span>
                    <small>
                      {formatCount(props.locale, task.enteredCount)} of{' '}
                      {formatCount(props.locale, task.studentCount)} results entered
                      {task.dueAt === undefined ? '' : ` · due ${task.dueAt}`}
                    </small>
                  </div>
                  <span className="teacher-workspace__status">{task.publicationState}</span>
                  <a href={task.href}>
                    {task.publicationState === 'locked' || task.publicationState === 'published'
                      ? 'View results'
                      : 'Open gradebook'}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="teacher-workspace__section" aria-labelledby="teacher-messages-heading">
          <header>
            <h3 id="teacher-messages-heading">Secure communication</h3>
            <p>Only authorised class or household conversations are listed.</p>
          </header>
          {conversations.length === 0 ? (
            <EmptyState
              title="No permitted conversations"
              detail="No authorised message thread is available in this scope."
            />
          ) : (
            <ol className="teacher-workspace__tasks teacher-workspace__tasks--messages">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <div>
                    <strong>{conversation.subject}</strong>
                    <span>{conversation.participantLabel}</span>
                    <time dateTime={conversation.lastMessageAt}>{conversation.lastMessageAt}</time>
                  </div>
                  {conversation.unreadCount === 0 ? null : (
                    <span className="teacher-workspace__unread">
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

      <section className="teacher-workspace__section" aria-labelledby="teacher-students-heading">
        <header>
          <h3 id="teacher-students-heading">Permitted student context</h3>
          <p>
            Learning context is limited to the assigned relationship. Restricted health,
            safeguarding and counselling records are not inferred or disclosed.
          </p>
        </header>
        {studentContext.length === 0 ? (
          <EmptyState
            title="No authorised student context"
            detail="No matching student record is available in your current assigned scope."
          />
        ) : (
          <ul className="teacher-workspace__students">
            {studentContext.map((student) => (
              <li key={student.id}>
                <div>
                  <strong>{student.displayName}</strong>
                  <span>{student.classLabel}</span>
                </div>
                <p>{student.learningSummary}</p>
                {student.permittedTags.length === 0 ? null : (
                  <ul aria-label={`${student.displayName} permitted learning tags`}>
                    {student.permittedTags.map((tag) => <li key={tag}>{tag}</li>)}
                  </ul>
                )}
                {student.nextAction === undefined ? null : <small>Next: {student.nextAction}</small>}
                <a href={student.href}>Open permitted profile</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
