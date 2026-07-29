import type { ComponentProps, ReactElement } from 'react';

import { CommunicationsWorkspace } from '@school/documents-experience/communications';
import '@school/documents-experience/communications.css';

type StudentCommunicationsWorkspaceProps = Omit<
  ComponentProps<typeof CommunicationsWorkspace>,
  'persona'
>;

export function StudentCommunicationsWorkspace(
  props: StudentCommunicationsWorkspaceProps,
): ReactElement {
  return <CommunicationsWorkspace {...props} persona="student" />;
}
