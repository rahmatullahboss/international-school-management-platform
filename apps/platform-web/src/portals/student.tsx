import type { ReactElement } from 'react';

import { StudentDailyWorkspace, StudentExperienceShell } from '@school/web-student/experience';

import {
  modulePages,
  pilotTimestamp,
  schoolName,
  studentCapabilities,
  studentOverview,
} from '../pilot-data';
import {
  PilotModuleSurface,
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

  return (
    <StudentExperienceShell
      schoolName={schoolName}
      userName="Samira Noor · Year 8"
      locale="en-BD"
      pageTitle={heading.title}
      pageDescription={heading.description}
      activeHref={props.path}
      capabilities={studentCapabilities}
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
      utilityActions={shellUtilityActions('student')}
    >
      {props.path === '/student' ? (
        <StudentDailyWorkspace
          studentId="student-1"
          studentName="Samira Noor"
          schoolName={schoolName}
          yearLabel="Year 8"
          locale="en-BD"
          date={pilotTimestamp}
          ageBand="secondary"
          capabilities={studentCapabilities}
          lessons={studentOverview.lessons}
          attendance={studentOverview.attendance}
          results={studentOverview.results}
          resources={studentOverview.resources}
          requests={studentOverview.requests}
          documents={studentOverview.documents}
          conversations={studentOverview.conversations}
        />
      ) : page === undefined ? (
        <UnknownRoute homeHref="/student" />
      ) : (
        <PilotModuleSurface page={page} />
      )}
    </StudentExperienceShell>
  );
}
