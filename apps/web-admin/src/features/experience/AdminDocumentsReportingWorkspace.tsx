import type { ComponentProps, ReactElement } from 'react';

import { DocumentsReportingWorkspace } from '@school/documents-experience/reporting';
import '@school/documents-experience/reporting.css';

type AdminDocumentsReportingWorkspaceProps = Omit<
  ComponentProps<typeof DocumentsReportingWorkspace>,
  'persona'
>;

export function AdminDocumentsReportingWorkspace(
  props: AdminDocumentsReportingWorkspaceProps,
): ReactElement {
  return <DocumentsReportingWorkspace {...props} persona="admin" />;
}
