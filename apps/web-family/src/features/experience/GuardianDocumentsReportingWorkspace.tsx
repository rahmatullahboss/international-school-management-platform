import type { ComponentProps, ReactElement } from 'react';

import { DocumentsReportingWorkspace } from '@school/documents-experience/reporting';
import '@school/documents-experience/reporting.css';

type GuardianDocumentsReportingWorkspaceProps = Omit<
  ComponentProps<typeof DocumentsReportingWorkspace>,
  'persona'
>;

export function GuardianDocumentsReportingWorkspace(
  props: GuardianDocumentsReportingWorkspaceProps,
): ReactElement {
  return <DocumentsReportingWorkspace {...props} persona="guardian" />;
}
