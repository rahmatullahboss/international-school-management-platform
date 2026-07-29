import type { ComponentProps, ReactElement } from 'react';

import { CommunicationsWorkspace } from '@school/documents-experience/communications';
import '@school/documents-experience/communications.css';

type AdminCommunicationsWorkspaceProps = Omit<
  ComponentProps<typeof CommunicationsWorkspace>,
  'persona'
>;

export function AdminCommunicationsWorkspace(
  props: AdminCommunicationsWorkspaceProps,
): ReactElement {
  return <CommunicationsWorkspace {...props} persona="admin" />;
}
