import type { ReactElement } from 'react';

import { StudentDailyWorkspace, StudentExperienceShell } from '@school/web-student/experience';

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
  const focus =
    props.path === '/student/documents'
      ? 'documents'
      : props.path === '/student/messages'
        ? 'messages'
        : undefined;
  const usesDailyWorkspace =
    props.path === '/student' ||
    props.path === '/student/resources' ||
    props.path === '/student/requests' ||
    focus !== undefined;

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
      {usesDailyWorkspace ? (
        <StudentDailyWorkspace
          studentId="student-1"
          studentName="Samira Noor"
          schoolName={schoolName}
          yearLabel="Year 8"
          locale="en-BD"
          date={resource.updatedAt}
          ageBand="secondary"
          focus={focus}
          capabilities={resource.capabilities}
          lessons={overview.lessons}
          attendance={overview.attendance}
          results={overview.results}
          resources={overview.resources}
          requests={overview.requests}
          documents={overview.documents}
          conversations={overview.conversations}
        />
      ) : page === undefined ? (
        <UnknownRoute homeHref="/student" />
      ) : (
        <OperationalModuleSurface path={props.path} page={page} role="student" />
      )}
    </StudentExperienceShell>
  );
}
