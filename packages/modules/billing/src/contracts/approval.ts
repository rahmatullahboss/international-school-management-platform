export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'escalated';
export type ApprovalAction = 'approve' | 'reject' | 'cancel' | 'escalate';

export interface ApprovalTransition {
  readonly from: ApprovalState;
  readonly to: ApprovalState;
  readonly action: ApprovalAction;
}

export interface ApprovalRequest {
  readonly requestId: string;
  readonly documentType: string;
  readonly documentId: string;
  readonly requestedBy: string;
  readonly requestedAt: Date;
  readonly state: ApprovalState;
  readonly requiredApprovers: number;
  readonly approvers: readonly string[];
  readonly approvedBy: readonly string[];
  readonly rejectedBy: string | null;
  readonly rejectionReason: string | null;
  readonly escalatedAt: Date | null;
  readonly escalatedTo: string | null;
  readonly expiresAt: Date | null;
}

export interface ApprovalAssignment {
  readonly assignmentId: string;
  readonly approvalRequestId: string;
  readonly assigneeId: string;
  readonly assignedAt: Date;
  readonly decidedAt: Date | null;
  readonly decision: ApprovalAction | null;
  readonly comment: string | null;
}

const TRANSITIONS: Readonly<Record<ApprovalState, readonly ApprovalTransition[]>> = Object.freeze({
  pending: [
    { from: 'pending', to: 'approved', action: 'approve' },
    { from: 'pending', to: 'rejected', action: 'reject' },
    { from: 'pending', to: 'cancelled', action: 'cancel' },
    { from: 'pending', to: 'escalated', action: 'escalate' },
  ],
  escalated: [
    { from: 'escalated', to: 'approved', action: 'approve' },
    { from: 'escalated', to: 'rejected', action: 'reject' },
  ],
  approved: [],
  rejected: [],
  cancelled: [],
});

export function canTransition(state: ApprovalState, action: ApprovalAction): boolean {
  return TRANSITIONS[state].some((transition) => transition.action === action);
}

export function transitionApproval(
  request: ApprovalRequest,
  action: ApprovalAction,
  principalId: string,
  comment?: string,
): ApprovalRequest {
  const transition = TRANSITIONS[request.state].find((candidate) => candidate.action === action);
  if (!transition) throw new Error(`Cannot ${action} from state ${request.state}`);
  if (!request.approvers.includes(principalId) && action !== 'cancel')
    throw new Error('Principal is not an assigned approver');
  if (principalId === request.requestedBy && action === 'approve')
    throw new Error('Requester cannot approve own request');
  const approvedBy =
    action === 'approve' ? [...new Set([...request.approvedBy, principalId])] : request.approvedBy;
  const effectiveState =
    action === 'approve' && approvedBy.length < request.requiredApprovers
      ? request.state
      : transition.to;
  return Object.freeze({
    ...request,
    state: effectiveState,
    approvedBy,
    rejectedBy: action === 'reject' ? principalId : request.rejectedBy,
    rejectionReason: action === 'reject' ? (comment ?? 'Rejected') : request.rejectionReason,
    escalatedAt: action === 'escalate' ? new Date() : request.escalatedAt,
  });
}
