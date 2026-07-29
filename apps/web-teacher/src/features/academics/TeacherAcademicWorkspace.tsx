/*
THESIS: A teacher workspace follows the day from next class to reconciled attendance to evidence-ready grades.
OWN-WORLD: Classroom register, ruled rows, high-contrast ink and a single teal action language.
STORY: The teacher sees what is next, what is saved offline, who is missing and which assessments need evidence.
FIRST VIEWPORT: Sync integrity, today's teaching sequence and the current attendance session.
FORM: Established Operate extension; compact register and gradebook tables with standard forms, no modal-first tasks.
*/
import type { ReactElement, ReactNode } from 'react';

import './teacher-academics.css';

export interface TeacherScheduleMeeting {
  scheduledMeetingId: string;
  localDate: string;
  startsAt: string;
  endsAt: string;
  section: string;
  course: string;
  room: string;
  status: 'next' | 'scheduled' | 'completed' | 'cancelled';
  substitution?: string;
  href: string;
}

export interface TeacherAttendanceStudent {
  studentProfileId: string;
  displayName: string;
  rollNumber?: string;
  currentCode?: string;
  currentLabel?: string;
  amendmentRequired?: boolean;
  note?: string;
}

export interface TeacherAttendanceSession {
  sessionId: string;
  section: string;
  course: string;
  localDate: string;
  startsAt: string;
  endsAt: string;
  state: 'not-started' | 'open' | 'incomplete' | 'finalized';
  missingStudents: number;
  students: readonly TeacherAttendanceStudent[];
  codeOptions: readonly { id: string; code: string; label: string; requiresReason: boolean }[];
  captureAction: string;
  finalizeAction: string;
}

export interface TeacherAssessmentRow {
  assessmentId: string;
  title: string;
  category: string;
  dueAt: string;
  maximumPoints: number;
  resultCount: number;
  rosterCount: number;
  state: 'draft' | 'published' | 'closed';
  moderation: 'not-required' | 'pending' | 'moderated';
  href: string;
}

export interface TeacherGradebookStudentRow {
  assessmentResultId?: string;
  studentProfileId: string;
  displayName: string;
  rawScore?: number;
  resultState: 'scored' | 'missing' | 'exempt' | 'late' | 'not-entered';
  maximumPoints: number;
  comment?: string;
  version?: number;
  saveAction: string;
}

export interface TeacherReportCardCommentRow {
  reportCardId: string;
  student: string;
  reportingPeriod: string;
  courseGrade: string;
  currentComment?: string;
  state: 'draft' | 'approved' | 'published';
  saveAction: string;
}

export interface TeacherAcademicWorkspaceProps {
  teacherName: string;
  locale: string;
  direction?: 'ltr' | 'rtl';
  state?: 'ready' | 'loading' | 'error';
  errorMessage?: string;
  timezone: string;
  sync: {
    state: 'online' | 'offline' | 'syncing' | 'error';
    pendingChanges: number;
    lastSuccessfulSync?: string;
    retryAction: string;
  };
  schedule: readonly TeacherScheduleMeeting[];
  attendance?: TeacherAttendanceSession;
  assessments: readonly TeacherAssessmentRow[];
  selectedAssessment?: {
    assessmentId: string;
    title: string;
    students: readonly TeacherGradebookStudentRow[];
  };
  reportCardComments: readonly TeacherReportCardCommentRow[];
  canCaptureAttendance?: boolean;
  canFinalizeAttendance?: boolean;
  canWriteGradebook?: boolean;
  canCommentOnReportCards?: boolean;
}

function Panel(props: {
  id: string;
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="teacher-acad__panel" id={props.id} aria-labelledby={`${props.id}-heading`}>
      <header>
        <div>
          <h2 id={`${props.id}-heading`}>{props.title}</h2>
          <p>{props.description}</p>
        </div>
        {props.aside === undefined ? null : <div>{props.aside}</div>}
      </header>
      {props.children}
    </section>
  );
}

function Status(props: { value: string }): ReactElement {
  return (
    <span className="teacher-acad__status" data-tone={props.value}>
      {props.value.replaceAll('-', ' ')}
    </span>
  );
}

function Empty(props: { title: string; detail: string }): ReactElement {
  return (
    <div className="teacher-acad__empty" role="status">
      <strong>{props.title}</strong>
      <span>{props.detail}</span>
    </div>
  );
}

function TableFrame(props: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="teacher-acad__table" role="region" aria-label={props.label} tabIndex={0}>
      {props.children}
    </div>
  );
}

function formatCount(
  locale: string,
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  const category = new Intl.PluralRules(locale).select(count);
  return `${new Intl.NumberFormat(locale).format(count)} ${category === 'one' ? singular : plural}`;
}

export function TeacherAcademicWorkspace(props: TeacherAcademicWorkspaceProps): ReactElement {
  const direction = props.direction ?? (props.locale.startsWith('ar') ? 'rtl' : 'ltr');
  const nextMeeting = props.schedule.find((meeting) => meeting.status === 'next');
  const attendance = props.attendance;

  if (props.state === 'loading') {
    return (
      <main
        className="teacher-acad teacher-acad--state"
        dir={direction}
        lang={props.locale}
        aria-busy="true"
      >
        <h1>Teacher academic workspace</h1>
        <p>Loading schedule, attendance and gradebook data.</p>
        <div className="teacher-acad__skeleton" aria-hidden="true" />
      </main>
    );
  }

  if (props.state === 'error') {
    return (
      <main className="teacher-acad teacher-acad--state" dir={direction} lang={props.locale}>
        <section
          className="teacher-acad__error"
          role="alert"
          aria-labelledby="teacher-academic-error-heading"
        >
          <h1 id="teacher-academic-error-heading">Teacher academic data could not be loaded</h1>
          <p>{props.errorMessage ?? 'Refresh the page or contact your platform administrator.'}</p>
          <a href="/academics">Retry loading the teacher workspace</a>
        </section>
      </main>
    );
  }

  return (
    <main
      className="teacher-acad"
      dir={direction}
      lang={props.locale}
      id="main-content"
      tabIndex={-1}
    >
      <a className="teacher-acad__skip" href="#attendance">
        Skip to attendance register
      </a>
      <header className="teacher-acad__masthead">
        <div>
          <p>Teacher academic workspace</p>
          <h1>{props.teacherName}</h1>
          <span>{props.timezone}</span>
        </div>
        <div
          className="teacher-acad__sync"
          data-state={props.sync.state}
          role="status"
          aria-live="polite"
        >
          <strong>
            {props.sync.state === 'online'
              ? 'All changes synchronized'
              : props.sync.state === 'offline'
                ? 'Working offline'
                : props.sync.state === 'syncing'
                  ? 'Synchronizing changes'
                  : 'Synchronization needs attention'}
          </strong>
          <span>
            {formatCount(props.locale, props.sync.pendingChanges, 'pending change')}
            {props.sync.lastSuccessfulSync === undefined
              ? ''
              : ` · Last sync ${props.sync.lastSuccessfulSync}`}
          </span>
          {props.sync.state === 'error' ? (
            <form action={props.sync.retryAction} method="post">
              <button type="submit">Retry synchronization</button>
            </form>
          ) : null}
        </div>
      </header>

      <nav className="teacher-acad__nav" aria-label="Teacher academic tasks">
        <a href="#schedule">Schedule</a>
        <a href="#attendance">Attendance</a>
        <a href="#gradebook">Gradebook</a>
        <a href="#report-comments">Report comments</a>
      </nav>

      <section className="teacher-acad__next" aria-labelledby="next-class-heading">
        <div>
          <h2 id="next-class-heading">Next teaching block</h2>
          {nextMeeting === undefined ? (
            <p>No further scheduled class is available today.</p>
          ) : (
            <p>
              <strong>{nextMeeting.course}</strong> with {nextMeeting.section},{' '}
              {nextMeeting.startsAt}–{nextMeeting.endsAt} in {nextMeeting.room}.
            </p>
          )}
        </div>
        {nextMeeting === undefined ? null : <a href={nextMeeting.href}>Open class</a>}
      </section>

      <Panel
        id="schedule"
        title="Teaching schedule"
        description="Published meeting instances include resolved substitutions without hiding the base timetable."
      >
        {props.schedule.length === 0 ? (
          <Empty
            title="No scheduled meetings"
            detail="Published timetable meetings will appear here."
          />
        ) : (
          <ol className="teacher-acad__schedule">
            {props.schedule.map((meeting) => (
              <li key={meeting.scheduledMeetingId} data-status={meeting.status}>
                <time dateTime={`${meeting.localDate}T${meeting.startsAt}`}>
                  {meeting.localDate} · {meeting.startsAt}–{meeting.endsAt}
                </time>
                <div>
                  <strong>{meeting.course}</strong>
                  <span>
                    {meeting.section} · {meeting.room}
                  </span>
                  {meeting.substitution === undefined ? null : (
                    <span className="teacher-acad__substitution">{meeting.substitution}</span>
                  )}
                </div>
                <Status value={meeting.status} />
                <a href={meeting.href}>Open meeting</a>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel
        id="attendance"
        title="Attendance register"
        description="Capture one current result per student. Finalized corrections follow the approved amendment workflow."
        aside={
          attendance === undefined ? undefined : (
            <div className="teacher-acad__panel-state">
              <Status value={attendance.state} />
              <span>
                {formatCount(props.locale, attendance.missingStudents, 'missing student')}
              </span>
            </div>
          )
        }
      >
        {attendance === undefined ? (
          <Empty
            title="No attendance session selected"
            detail="Open a scheduled class to begin roster capture."
          />
        ) : (
          <>
            <p className="teacher-acad__context">
              {attendance.course} · {attendance.section} · {attendance.localDate} ·{' '}
              {attendance.startsAt}–{attendance.endsAt}
            </p>
            <TableFrame label="Current attendance roster">
              <table>
                <caption>Attendance results for {attendance.section}</caption>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">Current result</th>
                    <th scope="col">New result</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.students.map((student) => (
                    <tr key={student.studentProfileId}>
                      <td>
                        <strong>{student.displayName}</strong>
                        <span>{student.rollNumber ?? 'No roll number'}</span>
                      </td>
                      <td>
                        {student.currentLabel ?? 'Not entered'}
                        {student.amendmentRequired ? (
                          <span>Finalized result; amendment approval required.</span>
                        ) : null}
                      </td>
                      <td colSpan={3}>
                        {props.canCaptureAttendance && !student.amendmentRequired ? (
                          <form
                            className="teacher-acad__row-form"
                            action={attendance.captureAction}
                            method="post"
                          >
                            <input type="hidden" name="sessionId" value={attendance.sessionId} />
                            <input
                              type="hidden"
                              name="studentProfileId"
                              value={student.studentProfileId}
                            />
                            <label>
                              <span className="teacher-acad__visually-hidden">
                                Attendance result for {student.displayName}
                              </span>
                              <select
                                name="attendanceCodeId"
                                defaultValue={student.currentCode ?? ''}
                                required
                              >
                                <option value="" disabled>
                                  Select result
                                </option>
                                {attendance.codeOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.code} — {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span className="teacher-acad__visually-hidden">
                                Attendance reason for {student.displayName}
                              </span>
                              <input
                                type="text"
                                name="reason"
                                defaultValue={student.note}
                                placeholder="Reason when required"
                                maxLength={240}
                              />
                            </label>
                            <button type="submit">Save result</button>
                          </form>
                        ) : (
                          <a
                            href={`/academics/attendance/${attendance.sessionId}/students/${student.studentProfileId}`}
                          >
                            {student.amendmentRequired ? 'Request amendment' : 'View result'}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
            {props.canFinalizeAttendance ? (
              <form
                className="teacher-acad__finalize"
                action={attendance.finalizeAction}
                method="post"
              >
                <input type="hidden" name="sessionId" value={attendance.sessionId} />
                <p>
                  Finalization locks ordinary capture. Resolve all missing students before
                  continuing.
                </p>
                <button type="submit" disabled={attendance.missingStudents > 0}>
                  Finalize attendance
                </button>
              </form>
            ) : null}
          </>
        )}
      </Panel>

      <Panel
        id="gradebook"
        title="Assessments and gradebook"
        description="Raw score states remain separate from calculated grades; moderation and lock status are visible."
      >
        {props.assessments.length === 0 ? (
          <Empty
            title="No assessments"
            detail="Create and publish an assessment to begin grading."
          />
        ) : (
          <TableFrame label="Teacher assessment list">
            <table>
              <caption>Assessments for assigned sections</caption>
              <thead>
                <tr>
                  <th scope="col">Assessment</th>
                  <th scope="col">Due</th>
                  <th scope="col">Results</th>
                  <th scope="col">State</th>
                  <th scope="col">Moderation</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {props.assessments.map((assessment) => (
                  <tr key={assessment.assessmentId}>
                    <td>
                      <strong>{assessment.title}</strong>
                      <span>
                        {assessment.category} · {assessment.maximumPoints} points
                      </span>
                    </td>
                    <td>{assessment.dueAt}</td>
                    <td>
                      {assessment.resultCount}/{assessment.rosterCount}
                    </td>
                    <td>
                      <Status value={assessment.state} />
                    </td>
                    <td>
                      <Status value={assessment.moderation} />
                    </td>
                    <td>
                      <a href={assessment.href}>Open assessment</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}

        {props.selectedAssessment === undefined ? null : (
          <div className="teacher-acad__grade-entry" aria-labelledby="grade-entry-heading">
            <h3 id="grade-entry-heading">Enter results: {props.selectedAssessment.title}</h3>
            <TableFrame label={`Grade entry for ${props.selectedAssessment.title}`}>
              <table>
                <caption>Student grade entry</caption>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">State</th>
                    <th scope="col">Raw score</th>
                    <th scope="col">Comment</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {props.selectedAssessment.students.map((student) => (
                    <tr key={student.studentProfileId}>
                      <td>{student.displayName}</td>
                      <td colSpan={4}>
                        {props.canWriteGradebook ? (
                          <form
                            className="teacher-acad__row-form"
                            action={student.saveAction}
                            method="post"
                          >
                            <input
                              type="hidden"
                              name="assessmentId"
                              value={props.selectedAssessment?.assessmentId}
                            />
                            <input
                              type="hidden"
                              name="studentProfileId"
                              value={student.studentProfileId}
                            />
                            {student.version === undefined ? null : (
                              <input type="hidden" name="version" value={student.version} />
                            )}
                            <select
                              name="state"
                              defaultValue={
                                student.resultState === 'not-entered' ? '' : student.resultState
                              }
                              aria-label={`Result state for ${student.displayName}`}
                              required
                            >
                              <option value="" disabled>
                                Select result state
                              </option>
                              <option value="scored">Scored</option>
                              <option value="late">Late</option>
                              <option value="missing">Missing</option>
                              <option value="exempt">Exempt</option>
                            </select>
                            <label>
                              <span className="teacher-acad__visually-hidden">
                                Raw score for {student.displayName}, maximum {student.maximumPoints}
                              </span>
                              <input
                                type="number"
                                name="rawScore"
                                min={0}
                                max={student.maximumPoints}
                                step="0.01"
                                defaultValue={student.rawScore}
                                placeholder={`Score / ${student.maximumPoints}`}
                              />
                            </label>
                            <label>
                              <span className="teacher-acad__visually-hidden">
                                Comment for {student.displayName}
                              </span>
                              <input
                                type="text"
                                name="comment"
                                defaultValue={student.comment}
                                maxLength={500}
                              />
                            </label>
                            <button type="submit">Save grade</button>
                          </form>
                        ) : (
                          <span>
                            {student.resultState} · {student.rawScore ?? 'No score'} /{' '}
                            {student.maximumPoints}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
          </div>
        )}
      </Panel>

      <Panel
        id="report-comments"
        title="Report-card comments"
        description="Comments remain editable only while the report-card snapshot is in draft."
      >
        {props.reportCardComments.length === 0 ? (
          <Empty
            title="No report-card comments due"
            detail="Draft report-card course rows will appear when a reporting period closes."
          />
        ) : (
          <TableFrame label="Report-card comment queue">
            <table>
              <caption>Teacher report-card comments</caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Period</th>
                  <th scope="col">Grade</th>
                  <th scope="col">Comment</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {props.reportCardComments.map((item) => (
                  <tr key={item.reportCardId}>
                    <td>{item.student}</td>
                    <td>{item.reportingPeriod}</td>
                    <td>{item.courseGrade}</td>
                    <td>
                      {props.canCommentOnReportCards && item.state === 'draft' ? (
                        <form
                          className="teacher-acad__comment-form"
                          action={item.saveAction}
                          method="post"
                        >
                          <input type="hidden" name="reportCardId" value={item.reportCardId} />
                          <label>
                            <span className="teacher-acad__visually-hidden">
                              Report-card comment for {item.student}
                            </span>
                            <textarea
                              name="comment"
                              defaultValue={item.currentComment}
                              maxLength={800}
                              rows={3}
                            />
                          </label>
                          <button type="submit">Save comment</button>
                        </form>
                      ) : (
                        (item.currentComment ?? 'No comment')
                      )}
                    </td>
                    <td>
                      <Status value={item.state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}
      </Panel>
    </main>
  );
}
