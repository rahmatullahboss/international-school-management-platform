import type { ReactElement } from 'react';

import { GuardianExperienceShell, GuardianHouseholdWorkspace } from '@school/web-family/experience';

import {
  guardianCapabilities,
  guardianOverview,
  modulePages,
  pilotTimestamp,
  schoolName,
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
  const resource = usePilotResource(
    'guardian',
    guardianOverview,
    guardianCapabilities,
    pilotTimestamp,
    props.connectivity,
  );
  const overview = resource.data;

  return (
    <GuardianExperienceShell
      schoolName={schoolName}
      userName="Farhana Noor · Guardian"
      locale="en-BD"
      pageTitle={heading.title}
      pageDescription={heading.description}
      activeHref={props.path}
      capabilities={resource.capabilities}
      session={{
        assurance: 'aal1',
        deviceLabel: 'Web browser',
        expiresAt: '2026-07-30T08:00:00+06:00',
      }}
      connectivity={{
        state: props.connectivity,
        pendingChanges: 0,
        lastSyncedAt: resource.updatedAt,
        retryHref: props.path,
      }}
      utilityActions={shellUtilityActions('guardian')}
    >
      <PilotDataStatus
        state={resource.state}
        apiConfigured={resource.apiConfigured}
        updatedAt={resource.updatedAt}
        message={resource.message}
        onRefresh={resource.refresh}
      />
      {props.path === '/family' ? (
        <GuardianHouseholdWorkspace
          guardianName="Farhana Noor"
          householdLabel="Noor household"
          locale="en-BD"
          activeChildId="student-1"
          capabilities={resource.capabilities}
          children={overview.children}
          applications={overview.applications}
          attendance={overview.attendance}
          grades={overview.grades}
          fees={overview.fees}
          forms={overview.forms}
          documents={overview.documents}
          conversations={overview.conversations}
        />
      ) : page === undefined ? (
        <UnknownRoute homeHref="/family" />
      ) : (
        <OperationalModuleSurface path={props.path} page={page} role="guardian" />
      )}
    </GuardianExperienceShell>
  );
}
