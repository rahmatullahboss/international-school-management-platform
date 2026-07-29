import type { ComponentProps, ReactElement } from 'react';

import { CommunicationsWorkspace } from '@school/documents-experience/communications';
import '@school/documents-experience/communications.css';

type TeacherCommunicationsWorkspaceProps = Omit<
  ComponentProps<typeof CommunicationsWorkspace>,
  'persona'
>;

export function TeacherCommunicationsWorkspace(
  props: TeacherCommunicationsWorkspaceProps,
): ReactElement {
  return <CommunicationsWorkspace {...props} persona="teacher" />;
}
