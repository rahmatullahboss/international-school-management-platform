import type { ReactElement } from 'react';

import {
  selectStudentItems,
  StudentDailyWorkspace,
  StudentExperienceShell,
} from '@school/web-student/experience';

import {
  modulePages,
  pilotTimestamp,
  schoolName,
  studentCapabilities,
  studentOverview,
} from '../pilot-data';
import { OperationalModuleSurface } from '../operational-module-surface';
import { usePilotResource } from '../pilot-resource';
import {
  PilotDataStatus,
  UnknownRoute,
  resolvePageHeading,
  shellUtilityActions,
  type PilotConnectivity,
} from '../portal-shared';

interface DrilldownItem {
  readonly studentId: string;
  readonly requiredCapability?: string;
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly nextAction?: string;
}

function StudentDrilldown(props: { readonly items: readonly DrilldownItem[] }): ReactElement {
  return (
    <div className="student-workspace">
      {props.items.map((item) => (
        <details key={item.id}>
          <summary>{item.title}</summary>
          <p>{item.description}</p>
          {item.nextAction === undefined ? null : <small>Next: {item.nextAction}</small>}
        </details>
      ))}
    </div>
  );
}

export interface StudentPortalProps {
  readonly path: string;
  readonly connectivity: PilotConnectivity;
}

export default function StudentPortal(props: StudentPortalProps): ReactElement {
  const page = modulePages[props.path];
  const heading = resolvePageHeading(
    'student',
    props.path,
    page,
    'Student portal',
    'Published student services',
  );
  const resource = usePilotResource(
    'student',
    studentOverview,
    studentCapabilities,
    pilotTimestamp,
    props.connectivity,
  );
  const overview = resource.data;
  const studentId = 'student-1';
  const drilldownItems =
    props.path === '/student/resources'
      ? overview.resources
      : props.path === '/student/requests'
        ? overview.requests
        : undefined;

  return (
    <StudentExperienceShell
      schoolName={schoolName}
      userName="Samira Noor · Year 8"
      locale="en-BD"
      pageTitle={heading.title}
      pageDescription={heading.description}
      activeHref={props.path}
      capabilities={resource.capabilities}
      session={{
        assurance: 'aal1',
        deviceLabel: 'Pilot browser',
        expiresAt: '2026-07-30T08:00:00+06:00',
      }}
      connectivity={{
        state: props.connectivity,
        pendingChanges: 0,
        lastSyncedAt: resource.updatedAt,
        retryHref: props.path,
      }}
      utilityActions={shellUtilityActions('student')}
    >
      <PilotDataStatus
        state={resource.state}
        apiConfigured={resource.apiConfigured}
        updatedAt={resource.updatedAt}
        message={resource.message}
        onRefresh={resource.refresh}
      />
      {props.path === '/student' ? (
        <StudentDailyWorkspace
          studentId={studentId}
          studentName="Samira Noor"
          schoolName={schoolName}
          yearLabel="Year 8"
          locale="en-BD"
          date={resource.updatedAt}
          ageBand="secondary"
          capabilities={resource.capabilities}
          lessons={overview.lessons}
          attendance={overview.attendance}
          results={overview.results}
          resources={overview.resources}
          requests={overview.requests}
          documents={overview.documents}
          conversations={overview.conversations}
        />
      ) : drilldownItems === undefined ? (
        page === undefined ? (
          <UnknownRoute homeHref="/student" />
        ) : (
          <OperationalModuleSurface path={props.path} page={page} role="student" />
        )
      ) : (
        <StudentDrilldown
          items={selectStudentItems(drilldownItems, studentId, resource.capabilities)}
        />
      )}
    </StudentExperienceShell>
  );
}
