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
import { OperationalModuleSurface } from '../operational-module-surface';
import { usePilotResource } from '../pilot-resource';
import {
  PilotDataStatus,
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
  const resource = usePilotResource(
    'admin',
    adminOverview,
    adminCapabilities,
    pilotTimestamp,
    props.connectivity,
  );
  const overview = resource.data;

  return (
    <AdminExperienceShell
      schoolName={schoolName}
      userName="Amina Chowdhury · Principal"
      locale="en-BD"
      pageTitle={heading.title}
      pageDescription={heading.description}
      activeHref={props.path}
      capabilities={resource.capabilities}
      session={{
        assurance: 'aal2',
        deviceLabel: 'Pilot browser',
        expiresAt: '2026-07-30T08:00:00+06:00',
      }}
      connectivity={{
        state: props.connectivity,
        pendingChanges: 0,
        lastSyncedAt: resource.updatedAt,
        retryHref: props.path,
      }}
      utilityActions={shellUtilityActions('admin')}
    >
      <PilotDataStatus
        state={resource.state}
        apiConfigured={resource.apiConfigured}
        updatedAt={resource.updatedAt}
        message={resource.message}
        onRefresh={resource.refresh}
      />
      {props.path === '/admin' ? (
        <AdminOperationsHome
          schoolName={schoolName}
          campusName={campusName}
          locale="en-BD"
          asOf={resource.updatedAt}
          assurance="aal2"
          capabilities={resource.capabilities}
          metrics={overview.metrics}
          exceptions={overview.exceptions}
          approvals={overview.approvals}
          searchQuery="Samira"
          searchResults={overview.searchResults}
          selectedExceptionIds={['attendance-1']}
          bulkActions={overview.bulkActions}
        />
      ) : page === undefined ? (
        <UnknownRoute homeHref="/admin" />
      ) : (
        <OperationalModuleSurface path={props.path} page={page} role="admin" />
      )}
    </AdminExperienceShell>
  );
}
