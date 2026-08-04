import type { ReactElement } from 'react';

import { TeacherDailyWorkspace, TeacherExperienceShell } from '@school/web-teacher/experience';

import {
  modulePages,
  pilotTimestamp,
  schoolName,
  teacherCapabilities,
  teacherOverview,
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

export interface TeacherPortalProps {
  readonly path: string;
  readonly connectivity: PilotConnectivity;
}

export default function TeacherPortal(props: TeacherPortalProps): ReactElement {
  const page = modulePages[props.path];
  const heading = resolvePageHeading(
    'teacher',
    props.path,
    page,
    'Teacher workspace',
    'Assigned teaching work',
  );
  const resource = usePilotResource(
    'teacher',
    teacherOverview,
    teacherCapabilities,
    pilotTimestamp,
    props.connectivity,
  );
  const overview = resource.data;

  return (
    <TeacherExperienceShell
      schoolName={schoolName}
      userName="Nusrat Rahman · Mathematics"
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
      utilityActions={shellUtilityActions('teacher')}
    >
      <PilotDataStatus
        state={resource.state}
        apiConfigured={resource.apiConfigured}
        updatedAt={resource.updatedAt}
        message={resource.message}
        onRefresh={resource.refresh}
      />
      {props.path === '/teacher' ? (
        <TeacherDailyWorkspace
          teacherName="Nusrat Rahman"
          schoolName={schoolName}
          locale="en-BD"
          date={resource.updatedAt}
          connectivity={props.connectivity}
          pendingChanges={0}
          capabilities={resource.capabilities}
          sessions={overview.sessions}
          attendance={overview.attendance}
          gradebook={overview.gradebook}
          studentContext={overview.studentContext}
          conversations={overview.conversations}
        />
      ) : page === undefined ? (
        <UnknownRoute homeHref="/teacher" />
      ) : (
        <OperationalModuleSurface path={props.path} page={page} role="teacher" />
      )}
    </TeacherExperienceShell>
  );
}
