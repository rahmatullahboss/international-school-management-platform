import type { ReactElement } from 'react';

import { AdminExperienceShell, AdminOperationsHome } from '@school/web-admin/experience';

import {
  adminCapabilities,
  adminOverview,
  campusName,
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

export interface AdminPortalProps {
  readonly path: string;
  readonly connectivity: PilotConnectivity;
}

export default function AdminPortal(props: AdminPortalProps): ReactElement {
  const page = modulePages[props.path];
  const heading = resolvePageHeading(
    'admin',
    props.path,
    page,
    'Administration',
    'Integrated administration workspace',
  );

  return (
    <AdminExperienceShell
      schoolName={schoolName}
      userName="Amina Chowdhury · Principal"
      locale="en-BD"
      pageTitle={heading.title}
      pageDescription={heading.description}
      activeHref={props.path}
      capabilities={adminCapabilities}
      session={{
        assurance: 'aal2',
        deviceLabel: 'Pilot browser',
        expiresAt: '2026-07-30T08:00:00+06:00',
      }}
      connectivity={{
        state: props.connectivity,
        pendingChanges: 0,
        lastSyncedAt: pilotTimestamp,
        retryHref: props.path,
      }}
      utilityActions={shellUtilityActions('admin')}
    >
      {props.path === '/admin' ? (
        <AdminOperationsHome
          schoolName={schoolName}
          campusName={campusName}
          locale="en-BD"
          asOf={pilotTimestamp}
          assurance="aal2"
          capabilities={adminCapabilities}
          metrics={adminOverview.metrics}
          exceptions={adminOverview.exceptions}
          approvals={adminOverview.approvals}
          searchQuery="Samira"
          searchResults={adminOverview.searchResults}
          selectedExceptionIds={['attendance-1']}
          bulkActions={adminOverview.bulkActions}
        />
      ) : page === undefined ? (
        <UnknownRoute homeHref="/admin" />
      ) : (
        <PilotModuleSurface page={page} />
      )}
    </AdminExperienceShell>
  );
}
