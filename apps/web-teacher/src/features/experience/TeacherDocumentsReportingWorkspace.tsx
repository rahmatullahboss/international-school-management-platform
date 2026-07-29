import type { ComponentProps, ReactElement } from 'react';

import { DocumentsReportingWorkspace } from '@school/documents-experience/reporting';
import '@school/documents-experience/reporting.css';

type TeacherDocumentsReportingWorkspaceProps = Omit<
  ComponentProps<typeof DocumentsReportingWorkspace>,
  'persona'
>;

export function TeacherDocumentsReportingWorkspace(
  props: TeacherDocumentsReportingWorkspaceProps,
): ReactElement {
  return <DocumentsReportingWorkspace {...props} persona="teacher" />;
}
