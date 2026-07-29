import type { ComponentProps, ReactElement } from 'react';

import { DocumentsReportingWorkspace } from '@school/documents-experience/reporting';
import '@school/documents-experience/reporting.css';

type StudentDocumentsReportingWorkspaceProps = Omit<
  ComponentProps<typeof DocumentsReportingWorkspace>,
  'persona'
>;

export function StudentDocumentsReportingWorkspace(
  props: StudentDocumentsReportingWorkspaceProps,
): ReactElement {
  return <DocumentsReportingWorkspace {...props} persona="student" />;
}
