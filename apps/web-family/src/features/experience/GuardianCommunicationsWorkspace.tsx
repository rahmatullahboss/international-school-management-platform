import type { ComponentProps, ReactElement } from 'react';

import { CommunicationsWorkspace } from '@school/documents-experience/communications';
import '@school/documents-experience/communications.css';

type GuardianCommunicationsWorkspaceProps = Omit<
  ComponentProps<typeof CommunicationsWorkspace>,
  'persona'
>;

export function GuardianCommunicationsWorkspace(
  props: GuardianCommunicationsWorkspaceProps,
): ReactElement {
  return <CommunicationsWorkspace {...props} persona="guardian" />;
}
