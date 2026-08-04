import { useMemo, useState, type ReactElement } from 'react';

import { teacherOverview } from '../pilot-data';
import '../operator-route-workspace.css';

type TeacherOverview = typeof teacherOverview;
type Row = readonly string[];

interface TeacherRouteDefinition {
  readonly title: string;
  readonly description: string;
  readonly columns: readonly string[];
  readonly rows: readonly Row[];
  readonly noun: string;
  readonly boundary: string;
}

const operationalTeacherRoutes = new Set([
  '/teacher/classes',
  '/teacher/attendance',
  '/teacher/gradebook',
  '/teacher/students',
  '/teacher/messages',
]);

export function hasTeacherRouteWorkspace(path: string): boolean {
  return operationalTeacherRoutes.has(path);
}

function compactDateTime(value: string): string {
  return value.replace('T', ' · ').replace('+06:00', '');
}

function definitionFor(path: string, overview: TeacherOverview): TeacherRouteDefinition | undefined {
  if (path === '/teacher/classes') {
    return {
      title: 'Assigned class schedule',
      description: 'Work from the teacher-scoped timetable instead of a module summary page.',
      columns: ['Class', 'Section', 'Starts', 'Ends', 'Room', 'State'],
      noun: 'class',
      boundary: 'Class membership and lesson changes remain disabled in this staging slice.',
      rows: overview.sessions.map((session) => [
        session.subject,
        session.section,
        compactDateTime(session.startsAt),
        compactDateTime(session.endsAt),
        session.room,
        session.state,
      ]),
    };
  }

  if (path === '/teacher/attendance') {
    return {
      title: 'Attendance register status',
      description: 'Inspect each assigned register, roster coverage and sync state in one place.',
      columns: ['Class', 'Session', 'Roster', 'Marked', 'State'],
      noun: 'register',
      boundary:
        'This route uses the assigned attendance read model. Marking and finalisation stay disabled until the audited attendance command is connected here.',
      rows: overview.attendance.map((register) => [
        register.classLabel,
        compactDateTime(register.sessionAt),
        String(register.rosterCount),
        String(register.markedCount),
        register.state,
      ]),
    };
  }

  if (path === '/teacher/gradebook') {
    return {
      title: 'Assessment entry queue',
      description: 'See assessment completion and publication state from the assigned gradebook scope.',
      columns: ['Class', 'Assessment', 'Due', 'Students', 'Entered', 'Publication'],
      noun: 'assessment',
      boundary:
        'Grade entry and publication remain disabled until the governed gradebook write contract is wired to this route.',
      rows: overview.gradebook.map((gradebook) => [
        gradebook.classLabel,
        gradebook.assessmentLabel,
        compactDateTime(gradebook.dueAt),
        String(gradebook.studentCount),
        String(gradebook.enteredCount),
        gradebook.publicationState,
      ]),
    };
  }

  if (path === '/teacher/students') {
    return {
      title: 'Assigned student context',
      description: 'Review only the learning context needed for students assigned to this teacher.',
      columns: ['Student', 'Class', 'Learning summary', 'Permitted context', 'Next action'],
      noun: 'student',
      boundary:
        'Only teacher-assigned student context is shown; unrelated profile, finance and restricted-care data remain outside this workspace.',
      rows: overview.studentContext.map((student) => [
        student.displayName,
        student.classLabel,
        student.learningSummary,
        student.permittedTags.join(', '),
        student.nextAction,
      ]),
    };
  }

  if (path === '/teacher/messages') {
    return {
      title: 'Conversation register',
      description: 'Find teacher-scoped family and student conversations without leaving the task route.',
      columns: ['Subject', 'Participant', 'Last message', 'Unread'],
      noun: 'conversation',
      boundary:
        'Conversation content and reply mutation remain disabled until the secure messaging command is connected to this route.',
      rows: overview.conversations.map((conversation) => [
        conversation.subject,
        conversation.participantLabel,
        compactDateTime(conversation.lastMessageAt),
        String(conversation.unreadCount),
      ]),
    };
  }

  return undefined;
}

export function TeacherRouteWorkspace(props: {
  readonly path: string;
  readonly overview: TeacherOverview;
}): ReactElement | null {
  const definition = definitionFor(props.path, props.overview);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    if (definition === undefined) return [];
    const normalized = query.trim().toLocaleLowerCase();
    return definition.rows.filter(
      (row) => normalized === '' || row.join(' ').toLocaleLowerCase().includes(normalized),
    );
  }, [definition, query]);

  if (definition === undefined) return null;

  return (
    <section className="operator-register" aria-labelledby="teacher-route-register-title">
      <header className="operator-register__header">
        <div>
          <p>Scoped operational read model</p>
          <h2 id="teacher-route-register-title">{definition.title}</h2>
          <span>{definition.description}</span>
        </div>
        <div className="operator-register__filters">
          <label>
            Search
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={`Search ${definition.noun}s`}
            />
          </label>
        </div>
      </header>

      <div
        className="operator-register__table"
        tabIndex={0}
        role="region"
        aria-label={`${definition.title} table`}
      >
        <table>
          <thead>
            <tr>
              {definition.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={definition.columns.length} className="operator-register__empty">
                  No records match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={`${props.path}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="operator-register__boundary">{definition.boundary}</p>
    </section>
  );
}
