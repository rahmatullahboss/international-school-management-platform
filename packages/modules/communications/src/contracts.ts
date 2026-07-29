export type CommunicationChannel = 'in-app' | 'email' | 'sms' | 'push';
export type CommunicationCategory =
  | 'general'
  | 'academic'
  | 'attendance'
  | 'finance'
  | 'operations'
  | 'form'
  | 'emergency';
export type CommunicationAudienceKind =
  | 'tenant'
  | 'campus'
  | 'role'
  | 'class'
  | 'household'
  | 'person'
  | 'explicit';
export type DeliveryState =
  | 'queued'
  | 'accepted'
  | 'delivered'
  | 'failed'
  | 'suppressed'
  | 'cancelled';
export type AnnouncementState = 'draft' | 'scheduled' | 'published' | 'cancelled';
export type ThreadState = 'open' | 'closed';
export type FormKind = 'form' | 'survey' | 'acknowledgement';
export type FormState = 'draft' | 'published' | 'closed';
export type QuestionKind = 'short-text' | 'long-text' | 'single-choice' | 'multi-choice' | 'boolean';

export interface CommunicationPrincipal {
  readonly tenantId: string;
  readonly actorId: string;
  readonly capabilities: readonly string[];
  readonly locale: string;
}

export interface CommunicationScope {
  readonly tenantId: string;
  readonly campusId?: string;
  readonly legalEntityId?: string;
}

export interface RecipientAddress {
  readonly recipientRef: string;
  readonly personRef?: string;
  readonly householdRef?: string;
  readonly locale: string;
  readonly timezone?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly pushToken?: string;
  readonly inAppInboxRef?: string;
}

export interface AudienceSelector {
  readonly kind: CommunicationAudienceKind;
  readonly reference: string;
}

export interface ResolvedAudience {
  readonly selector: AudienceSelector;
  readonly recipients: readonly RecipientAddress[];
  readonly resolvedAt: string;
  readonly sourceVersion: string;
}

export interface TemplateVariantInput {
  readonly locale: string;
  readonly subject?: string;
  readonly body: string;
}

export interface MessageTemplateInput {
  readonly id: string;
  readonly code: string;
  readonly category: CommunicationCategory;
  readonly defaultLocale: string;
  readonly requiredVariables: readonly string[];
  readonly variants: readonly TemplateVariantInput[];
}

export interface MessageTemplate extends Omit<MessageTemplateInput, 'variants'> {
  readonly variants: ReadonlyMap<string, TemplateVariantInput>;
  readonly version: number;
  readonly active: boolean;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RenderedTemplate {
  readonly templateId: string;
  readonly templateVersion: number;
  readonly requestedLocale: string;
  readonly resolvedLocale: string;
  readonly subject?: string;
  readonly body: string;
}

export interface RecipientPreferenceInput {
  readonly recipientRef: string;
  readonly category: CommunicationCategory;
  readonly channel: CommunicationChannel;
  readonly enabled: boolean;
}

export interface RecipientPreference extends RecipientPreferenceInput {
  readonly updatedBy: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface AnnouncementInput {
  readonly id: string;
  readonly title: string;
  readonly templateId: string;
  readonly audience: readonly AudienceSelector[];
  readonly variables: Readonly<Record<string, string>>;
  readonly channels: readonly CommunicationChannel[];
  readonly mandatory: boolean;
  readonly scheduledFor?: string;
  readonly expiresAt?: string;
}

export interface Announcement extends AnnouncementInput {
  readonly state: AnnouncementState;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly publishedBy?: string;
  readonly publishedAt?: string;
  readonly version: number;
}

export interface ThreadParticipant {
  readonly participantRef: string;
  readonly roleLabel: string;
  readonly canPost: boolean;
  readonly joinedAt: string;
  readonly leftAt?: string;
}

export interface SecureThreadInput {
  readonly id: string;
  readonly subject: string;
  readonly purpose: string;
  readonly participantRefs: readonly string[];
}

export interface SecureThread extends Omit<SecureThreadInput, 'participantRefs'> {
  readonly state: ThreadState;
  readonly participants: readonly ThreadParticipant[];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly version: number;
}

export interface SecureMessageInput {
  readonly id: string;
  readonly threadId: string;
  readonly body: string;
  readonly attachmentRefs?: readonly string[];
  readonly idempotencyKey: string;
}

export interface SecureMessage extends SecureMessageInput {
  readonly senderRef: string;
  readonly sentAt: string;
  readonly version: number;
}

export interface DeliveryDispatchInput {
  readonly id: string;
  readonly sourceType: 'announcement' | 'thread-message' | 'form-request' | 'system';
  readonly sourceId: string;
  readonly recipient: RecipientAddress;
  readonly category: CommunicationCategory;
  readonly channel: CommunicationChannel;
  readonly rendered: RenderedTemplate;
  readonly mandatory: boolean;
  readonly idempotencyKey: string;
}

export interface DeliveryDispatch extends DeliveryDispatchInput {
  readonly state: DeliveryState;
  readonly providerReference?: string;
  readonly attemptCount: number;
  readonly lastAttemptAt?: string;
  readonly deliveredAt?: string;
  readonly failureCode?: string;
  readonly suppressionReason?: string;
  readonly createdAt: string;
  readonly version: number;
}

export interface DeliveryAttempt {
  readonly id: string;
  readonly dispatchId: string;
  readonly attemptNumber: number;
  readonly state: DeliveryState;
  readonly providerReference?: string;
  readonly failureCode?: string;
  readonly occurredAt: string;
}

export interface FormQuestion {
  readonly id: string;
  readonly kind: QuestionKind;
  readonly label: string;
  readonly required: boolean;
  readonly options?: readonly string[];
}

export interface CommunicationFormInput {
  readonly id: string;
  readonly code: string;
  readonly kind: FormKind;
  readonly title: string;
  readonly description: string;
  readonly defaultLocale: string;
  readonly questions: readonly FormQuestion[];
  readonly acknowledgementText?: string;
}

export interface CommunicationForm extends CommunicationFormInput {
  readonly state: FormState;
  readonly version: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly publishedBy?: string;
  readonly publishedAt?: string;
  readonly closedAt?: string;
}

export type FormAnswer = string | boolean | readonly string[];

export interface FormResponseInput {
  readonly id: string;
  readonly formId: string;
  readonly respondentRef: string;
  readonly answers: Readonly<Record<string, FormAnswer>>;
  readonly acknowledgementAccepted?: boolean;
  readonly idempotencyKey: string;
}

export interface FormResponse extends FormResponseInput {
  readonly formVersion: number;
  readonly submittedAt: string;
  readonly version: number;
}

export interface AcknowledgementReceipt {
  readonly id: string;
  readonly formId: string;
  readonly responseId: string;
  readonly respondentRef: string;
  readonly textSnapshot: string;
  readonly acceptedAt: string;
}

export interface ProviderMessage {
  readonly tenantId: string;
  readonly dispatchId: string;
  readonly recipientRef: string;
  readonly destination: string;
  readonly subject?: string;
  readonly body: string;
  readonly idempotencyKey: string;
}

export interface ProviderResult {
  readonly state: 'accepted' | 'delivered' | 'failed';
  readonly providerReference?: string;
  readonly failureCode?: string;
}

export interface CommunicationChannelAdapter {
  readonly channel: CommunicationChannel;
  send(message: ProviderMessage): ProviderResult;
}

export interface CommunicationAuditEntry {
  readonly id: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly action: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly occurredAt: string;
  readonly detail?: Readonly<Record<string, string | number | boolean>>;
}

export interface CommunicationEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly schemaVersion: 1;
  readonly tenantId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
