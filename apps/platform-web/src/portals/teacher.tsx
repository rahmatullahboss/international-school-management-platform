import type { ReactElement } from 'react';

import { TeacherDailyWorkspace, TeacherExperienceShell } from '@school/web-teacher/experience';

import {
  modulePages,
  pilotTimestamp,
  schoolName,
  teacherCapabilities,
  teacherOverview,
} from '../pilot-data';
import {
  PilotModuleSurface,
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

  return (
    <TeacherExperienceShell
      schoolName={schoolName}
      userName="Nusrat Rahman · Mathematics"
      locale="en-BD"
      pageTitle={heading.title}
      pageDescription={heading.description}
      activeHref={props.path}
      capabilities={teacherCapabilities}
      session={{
        assurance: 'aal1',
        deviceLabel: 'Pilot browser',
        expiresAt: '2026-07-30T08:00:00+06:00',
      }}
      connectivity={{
        state: props.connectivity,
        pendingChanges: 0,
        lastSyncedAt: pilotTimestamp,
        retryHref: props.path,
      }}
      utilityActions={shellUtilityActions('teacher')}
    >
      {props.path === '/teacher' ? (
        <TeacherDailyWorkspace
          teacherName="Nusrat Rahman"
          schoolName={schoolName}
          locale="en-BD"
          date={pilotTimestamp}
          connectivity={props.connectivity}
          pendingChanges={0}
          capabilities={teacherCapabilities}
          sessions={teacherOverview.sessions}
          attendance={teacherOverview.attendance}
          gradebook={teacherOverview.gradebook}
          studentContext={teacherOverview.studentContext}
          conversations={teacherOverview.conversations}
        />
      ) : page === undefined ? (
        <UnknownRoute homeHref="/teacher" />
      ) : (
        <PilotModuleSurface page={page} />
      )}
    </TeacherExperienceShell>
  );
}
