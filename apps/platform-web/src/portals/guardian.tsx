import type { ReactElement } from 'react';

import {
  GuardianExperienceShell,
  GuardianHouseholdWorkspace,
} from '@school/web-family/experience';

import {
  guardianCapabilities,
  guardianOverview,
  modulePages,
  pilotTimestamp,
  schoolName,
} from '../pilot-data';
import {
  PilotModuleSurface,
  UnknownRoute,
  resolvePageHeading,
  shellUtilityActions,
  type PilotConnectivity,
} from '../portal-shared';

export interface GuardianPortalProps {
  readonly path: string;
  readonly connectivity: PilotConnectivity;
}

export default function GuardianPortal(props: GuardianPortalProps): ReactElement {
  const page = modulePages[props.path];
  const heading = resolvePageHeading(
    'guardian',
    props.path,
    page,
    'Family portal',
    'Household school services',
  );

  return (
    <GuardianExperienceShell
      schoolName={schoolName}
      userName="Farhana Noor · Guardian"
      locale="en-BD"
      pageTitle={heading.title}
      pageDescription={heading.description}
      activeHref={props.path}
      capabilities={guardianCapabilities}
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
      utilityActions={shellUtilityActions('guardian')}
    >
      {props.path === '/family' ? (
        <GuardianHouseholdWorkspace
          guardianName="Farhana Noor"
          householdLabel="Noor household"
          locale="en-BD"
          activeChildId="student-1"
          capabilities={guardianCapabilities}
          children={guardianOverview.children}
          applications={guardianOverview.applications}
          attendance={guardianOverview.attendance}
          grades={guardianOverview.grades}
          fees={guardianOverview.fees}
          forms={guardianOverview.forms}
          documents={guardianOverview.documents}
          conversations={guardianOverview.conversations}
        />
      ) : page === undefined ? (
        <UnknownRoute homeHref="/family" />
      ) : (
        <PilotModuleSurface page={page} />
      )}
    </GuardianExperienceShell>
  );
}
