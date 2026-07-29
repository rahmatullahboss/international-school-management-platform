import type {
  AcknowledgementReceipt,
  Announcement,
  AnnouncementInput,
  CommunicationAuditEntry,
  CommunicationChannel,
  CommunicationChannelAdapter,
  CommunicationEvent,
  CommunicationForm,
  CommunicationFormInput,
  CommunicationPrincipal,
  CommunicationScope,
  DeliveryAttempt,
  DeliveryDispatch,
  DeliveryDispatchInput,
  FormAnswer,
  FormQuestion,
  FormResponse,
  FormResponseInput,
  MessageTemplate,
  MessageTemplateInput,
  RecipientAddress,
  RecipientPreference,
  RecipientPreferenceInput,
  RenderedTemplate,
  ResolvedAudience,
  SecureMessage,
  SecureMessageInput,
  SecureThread,
  SecureThreadInput,
  TemplateVariantInput,
} from './contracts.js';

interface Clock {
  now(): Date;
}

const systemClock: Clock = { now: () => new Date() };
const identifierPattern = /^[a-zA-Z0-9][a-zA-Z0-9:_./-]{0,199}$/;
const variablePattern = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function nowIso(clock: Clock): string {
  return clock.now().toISOString();
}

function assertIdentifier(value: string, field: string): string {
  if (!identifierPattern.test(value)) throw new Error(`COMM_INVALID_IDENTIFIER:${field}`);
  return value;
}

function assertNonEmpty(value: string, field: string, maxLength = 10_000): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new Error(`COMM_INVALID_TEXT:${field}`);
  }
  return normalized;
}

function assertTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`COMM_INVALID_TIMESTAMP:${field}`);
  return parsed.toISOString();
}

function requireCapability(principal: CommunicationPrincipal, capability: string): void {
  if (principal.tenantId.length === 0 || !principal.capabilities.includes(capability)) {
    throw new Error('COMM_NOT_FOUND');
  }
}

function freezeRecord<T extends object>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}

function cloneRecord<T extends object>(value: T): T {
  return { ...value };
}

function distinct<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function preferenceKey(
  recipientRef: string,
  category: RecipientPreferenceInput['category'],
  channel: CommunicationChannel,
): string {
  return `${recipientRef}:${category}:${channel}`;
}

function templateVariantMap(
  variants: readonly TemplateVariantInput[],
): ReadonlyMap<string, TemplateVariantInput> {
  if (variants.length === 0) throw new Error('COMM_TEMPLATE_VARIANT_REQUIRED');
  const mapped = new Map<string, TemplateVariantInput>();
  for (const variant of variants) {
    const locale = assertNonEmpty(variant.locale, 'template.locale', 40);
    if (mapped.has(locale)) throw new Error('COMM_DUPLICATE_TEMPLATE_LOCALE');
    mapped.set(
      locale,
      freezeRecord({
        locale,
        body: assertNonEmpty(variant.body, 'template.body', 50_000),
        ...(variant.subject === undefined
          ? {}
          : { subject: assertNonEmpty(variant.subject, 'template.subject', 500) }),
      }),
    );
  }
  return mapped;
}

function localeCandidates(requestedLocale: string, defaultLocale: string): string[] {
  const requestedLanguage = requestedLocale.split('-')[0];
  const defaultLanguage = defaultLocale.split('-')[0];
  return distinct([
    requestedLocale,
    requestedLanguage ?? requestedLocale,
    defaultLocale,
    defaultLanguage ?? defaultLocale,
  ]);
}

function renderText(
  text: string,
  variables: Readonly<Record<string, string>>,
  requiredVariables: readonly string[],
): string {
  for (const variable of requiredVariables) {
    if (variables[variable] === undefined) throw new Error(`COMM_TEMPLATE_VARIABLE_MISSING:${variable}`);
  }
  const rendered = text.replace(variablePattern, (_match, variable: string) => {
    const value = variables[variable];
    if (value === undefined) throw new Error(`COMM_TEMPLATE_VARIABLE_MISSING:${variable}`);
    return value;
  });
  variablePattern.lastIndex = 0;
  if (variablePattern.test(rendered)) throw new Error('COMM_TEMPLATE_VARIABLE_UNRESOLVED');
  variablePattern.lastIndex = 0;
  return rendered;
}

function destinationFor(channel: CommunicationChannel, recipient: RecipientAddress): string | undefined {
  if (channel === 'email') return recipient.email;
  if (channel === 'sms') return recipient.phone;
  if (channel === 'push') return recipient.pushToken;
  return recipient.inAppInboxRef;
}

function answerIsEmpty(answer: FormAnswer | undefined): boolean {
  return (
    answer === undefined ||
    answer === '' ||
    (Array.isArray(answer) && answer.length === 0)
  );
}

function validateQuestion(question: FormQuestion): FormQuestion {
  assertIdentifier(question.id, 'question.id');
  assertNonEmpty(question.label, 'question.label', 500);
  if (
    (question.kind === 'single-choice' || question.kind === 'multi-choice') &&
    (question.options === undefined || question.options.length < 2)
  ) {
    throw new Error('COMM_FORM_OPTIONS_REQUIRED');
  }
  if (question.options !== undefined && distinct(question.options).length !== question.options.length) {
    throw new Error('COMM_FORM_DUPLICATE_OPTION');
  }
  return freezeRecord({
    ...question,
    ...(question.options === undefined ? {} : { options: Object.freeze([...question.options]) }),
  });
}

function validateAnswer(question: FormQuestion, answer: FormAnswer | undefined): void {
  if (question.required && answerIsEmpty(answer)) {
    throw new Error(`COMM_FORM_REQUIRED:${question.id}`);
  }
  if (answer === undefined) return;

  if (question.kind === 'boolean' && typeof answer !== 'boolean') {
    throw new Error(`COMM_FORM_ANSWER_TYPE:${question.id}`);
  }
  if (
    (question.kind === 'short-text' || question.kind === 'long-text' || question.kind === 'single-choice') &&
    typeof answer !== 'string'
  ) {
    throw new Error(`COMM_FORM_ANSWER_TYPE:${question.id}`);
  }
  if (question.kind === 'multi-choice' && !Array.isArray(answer)) {
    throw new Error(`COMM_FORM_ANSWER_TYPE:${question.id}`);
  }
  if (question.kind === 'single-choice' && typeof answer === 'string' && !question.options?.includes(answer)) {
    throw new Error(`COMM_FORM_ANSWER_OPTION:${question.id}`);
  }
  if (
    question.kind === 'multi-choice' &&
    Array.isArray(answer) &&
    answer.some((value) => !question.options?.includes(value))
  ) {
    throw new Error(`COMM_FORM_ANSWER_OPTION:${question.id}`);
  }
}

export class CommunicationsService {
  readonly #scope: CommunicationScope;
  readonly #adapters: ReadonlyMap<CommunicationChannel, CommunicationChannelAdapter>;
  readonly #clock: Clock;
  readonly #templates = new Map<string, MessageTemplate>();
  readonly #templateCodes = new Map<string, string>();
  readonly #preferences = new Map<string, RecipientPreference>();
  readonly #announcements = new Map<string, Announcement>();
  readonly #threads = new Map<string, SecureThread>();
  readonly #messages = new Map<string, SecureMessage>();
  readonly #messageIdempotency = new Map<string, string>();
  readonly #dispatches = new Map<string, DeliveryDispatch>();
  readonly #dispatchIdempotency = new Map<string, string>();
  readonly #attempts: DeliveryAttempt[] = [];
  readonly #forms = new Map<string, CommunicationForm>();
  readonly #formCodes = new Map<string, string>();
  readonly #responses = new Map<string, FormResponse>();
  readonly #responseIdempotency = new Map<string, string>();
  readonly #acknowledgements = new Map<string, AcknowledgementReceipt>();
  readonly #audiences = new Map<string, ResolvedAudience>();
  readonly #audit: CommunicationAuditEntry[] = [];
  readonly #events: CommunicationEvent[] = [];

  constructor(options: {
    readonly scope: CommunicationScope;
    readonly adapters: ReadonlyMap<CommunicationChannel, CommunicationChannelAdapter>;
    readonly clock?: Clock;
  }) {
    this.#scope = freezeRecord({
      tenantId: assertIdentifier(options.scope.tenantId, 'scope.tenantId'),
      ...(options.scope.campusId === undefined
        ? {}
        : { campusId: assertIdentifier(options.scope.campusId, 'scope.campusId') }),
      ...(options.scope.legalEntityId === undefined
        ? {}
        : { legalEntityId: assertIdentifier(options.scope.legalEntityId, 'scope.legalEntityId') }),
    });
    this.#adapters = options.adapters;
    this.#clock = options.clock ?? systemClock;
  }

  get auditEntries(): readonly CommunicationAuditEntry[] {
    return Object.freeze([...this.#audit]);
  }

  get events(): readonly CommunicationEvent[] {
    return Object.freeze([...this.#events]);
  }

  get deliveryAttempts(): readonly DeliveryAttempt[] {
    return Object.freeze([...this.#attempts]);
  }

  listDispatches(): readonly DeliveryDispatch[] {
    return Object.freeze([...this.#dispatches.values()]);
  }

  createTemplate(
    principal: CommunicationPrincipal,
    input: MessageTemplateInput,
    correlationId: string,
  ): MessageTemplate {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.template.manage');
    assertIdentifier(input.id, 'template.id');
    const code = assertIdentifier(input.code, 'template.code');
    if (this.#templates.has(input.id) || this.#templateCodes.has(code)) {
      throw new Error('COMM_TEMPLATE_EXISTS');
    }
    const defaultLocale = assertNonEmpty(input.defaultLocale, 'template.defaultLocale', 40);
    const variants = templateVariantMap(input.variants);
    if (!variants.has(defaultLocale)) throw new Error('COMM_TEMPLATE_DEFAULT_LOCALE_MISSING');
    const requiredVariables = distinct(input.requiredVariables.map((value) => assertIdentifier(value, 'template.variable')));
    const timestamp = nowIso(this.#clock);
    const template: MessageTemplate = Object.freeze({
      id: input.id,
      code,
      category: input.category,
      defaultLocale,
      requiredVariables: Object.freeze(requiredVariables),
      variants,
      version: 1,
      active: true,
      createdBy: principal.actorId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    this.#templates.set(template.id, template);
    this.#templateCodes.set(code, template.id);
    this.#record(principal, 'communications.template.created', 'message-template', template.id, correlationId, template.version, {
      code,
      locales: variants.size,
    });
    return template;
  }

  reviseTemplate(
    principal: CommunicationPrincipal,
    templateId: string,
    variantsInput: readonly TemplateVariantInput[],
    correlationId: string,
  ): MessageTemplate {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.template.manage');
    const existing = this.#requireTemplate(templateId);
    const variants = templateVariantMap(variantsInput);
    if (!variants.has(existing.defaultLocale)) throw new Error('COMM_TEMPLATE_DEFAULT_LOCALE_MISSING');
    const revised: MessageTemplate = Object.freeze({
      ...existing,
      variants,
      version: existing.version + 1,
      updatedAt: nowIso(this.#clock),
    });
    this.#templates.set(templateId, revised);
    this.#record(principal, 'communications.template.revised', 'message-template', templateId, correlationId, revised.version, {
      locales: variants.size,
    });
    return revised;
  }

  renderTemplate(
    principal: CommunicationPrincipal,
    templateId: string,
    requestedLocale: string,
    variables: Readonly<Record<string, string>>,
  ): RenderedTemplate {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.template.render');
    const template = this.#requireTemplate(templateId);
    if (!template.active) throw new Error('COMM_TEMPLATE_INACTIVE');
    const variant = localeCandidates(requestedLocale, template.defaultLocale)
      .map((candidate) => template.variants.get(candidate))
      .find((candidate): candidate is TemplateVariantInput => candidate !== undefined);
    if (variant === undefined) throw new Error('COMM_TEMPLATE_LOCALE_UNAVAILABLE');
    return freezeRecord({
      templateId,
      templateVersion: template.version,
      requestedLocale,
      resolvedLocale: variant.locale,
      ...(variant.subject === undefined
        ? {}
        : { subject: renderText(variant.subject, variables, template.requiredVariables) }),
      body: renderText(variant.body, variables, template.requiredVariables),
    });
  }

  setPreference(
    principal: CommunicationPrincipal,
    input: RecipientPreferenceInput,
    correlationId: string,
  ): RecipientPreference {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.preference.manage');
    const recipientRef = assertIdentifier(input.recipientRef, 'preference.recipientRef');
    const key = preferenceKey(recipientRef, input.category, input.channel);
    const existing = this.#preferences.get(key);
    const preference: RecipientPreference = Object.freeze({
      recipientRef,
      category: input.category,
      channel: input.channel,
      enabled: input.enabled,
      updatedBy: principal.actorId,
      updatedAt: nowIso(this.#clock),
      version: (existing?.version ?? 0) + 1,
    });
    this.#preferences.set(key, preference);
    this.#record(principal, 'communications.preference.updated', 'recipient-preference', key, correlationId, preference.version, {
      enabled: preference.enabled,
    });
    return preference;
  }

  resolveAudience(
    principal: CommunicationPrincipal,
    audienceId: string,
    audience: ResolvedAudience,
    correlationId: string,
  ): ResolvedAudience {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.audience.resolve');
    assertIdentifier(audienceId, 'audience.id');
    const recipients = new Map<string, RecipientAddress>();
    for (const recipient of audience.recipients) {
      assertIdentifier(recipient.recipientRef, 'audience.recipientRef');
      if (recipients.has(recipient.recipientRef)) throw new Error('COMM_DUPLICATE_RECIPIENT');
      recipients.set(recipient.recipientRef, freezeRecord(recipient));
    }
    const resolved: ResolvedAudience = Object.freeze({
      selector: freezeRecord(audience.selector),
      recipients: Object.freeze([...recipients.values()]),
      resolvedAt: assertTimestamp(audience.resolvedAt, 'audience.resolvedAt'),
      sourceVersion: assertNonEmpty(audience.sourceVersion, 'audience.sourceVersion', 200),
    });
    this.#audiences.set(audienceId, resolved);
    this.#record(principal, 'communications.audience.resolved', 'resolved-audience', audienceId, correlationId, 1, {
      recipients: resolved.recipients.length,
      kind: resolved.selector.kind,
    });
    return resolved;
  }

  createAnnouncement(
    principal: CommunicationPrincipal,
    input: AnnouncementInput,
    correlationId: string,
  ): Announcement {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.announcement.manage');
    assertIdentifier(input.id, 'announcement.id');
    if (this.#announcements.has(input.id)) throw new Error('COMM_ANNOUNCEMENT_EXISTS');
    this.#requireTemplate(input.templateId);
    if (input.audience.length === 0) throw new Error('COMM_ANNOUNCEMENT_AUDIENCE_REQUIRED');
    if (input.channels.length === 0) throw new Error('COMM_ANNOUNCEMENT_CHANNEL_REQUIRED');
    const scheduledFor = input.scheduledFor === undefined
      ? undefined
      : assertTimestamp(input.scheduledFor, 'announcement.scheduledFor');
    const expiresAt = input.expiresAt === undefined
      ? undefined
      : assertTimestamp(input.expiresAt, 'announcement.expiresAt');
    if (scheduledFor !== undefined && expiresAt !== undefined && expiresAt <= scheduledFor) {
      throw new Error('COMM_ANNOUNCEMENT_INVALID_WINDOW');
    }
    const announcement: Announcement = Object.freeze({
      ...input,
      title: assertNonEmpty(input.title, 'announcement.title', 500),
      audience: Object.freeze(input.audience.map((selector) => freezeRecord(selector))),
      variables: Object.freeze(cloneRecord(input.variables)),
      channels: Object.freeze(distinct(input.channels)),
      ...(scheduledFor === undefined ? {} : { scheduledFor }),
      ...(expiresAt === undefined ? {} : { expiresAt }),
      state: scheduledFor === undefined ? 'draft' : 'scheduled',
      createdBy: principal.actorId,
      createdAt: nowIso(this.#clock),
      version: 1,
    });
    this.#announcements.set(announcement.id, announcement);
    this.#record(principal, 'communications.announcement.created', 'announcement', announcement.id, correlationId, 1, {
      mandatory: announcement.mandatory,
      channels: announcement.channels.length,
    });
    return announcement;
  }

  publishAnnouncement(
    principal: CommunicationPrincipal,
    announcementId: string,
    resolvedAudienceIds: readonly string[],
    correlationId: string,
  ): Announcement {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.announcement.publish');
    const existing = this.#requireAnnouncement(announcementId);
    if (existing.state === 'published' || existing.state === 'cancelled') {
      throw new Error('COMM_ANNOUNCEMENT_NOT_PUBLISHABLE');
    }
    const audiences = resolvedAudienceIds.map((audienceId) => {
      const audience = this.#audiences.get(audienceId);
      if (audience === undefined) throw new Error('COMM_AUDIENCE_NOT_FOUND');
      return audience;
    });
    if (audiences.length === 0) throw new Error('COMM_AUDIENCE_NOT_FOUND');
    const timestamp = nowIso(this.#clock);
    const published: Announcement = Object.freeze({
      ...existing,
      state: 'published',
      publishedBy: principal.actorId,
      publishedAt: timestamp,
      version: existing.version + 1,
    });
    this.#announcements.set(announcementId, published);

    const recipients = new Map<string, RecipientAddress>();
    for (const audience of audiences) {
      for (const recipient of audience.recipients) recipients.set(recipient.recipientRef, recipient);
    }
    for (const recipient of recipients.values()) {
      for (const channel of published.channels) {
        const rendered = this.renderTemplate(
          { ...principal, capabilities: distinct([...principal.capabilities, 'communications.template.render']) },
          published.templateId,
          recipient.locale,
          published.variables,
        );
        this.dispatch(
          principal,
          {
            id: `${published.id}:${recipient.recipientRef}:${channel}`,
            sourceType: 'announcement',
            sourceId: published.id,
            recipient,
            category: this.#requireTemplate(published.templateId).category,
            channel,
            rendered,
            mandatory: published.mandatory,
            idempotencyKey: `announcement:${published.id}:${recipient.recipientRef}:${channel}`,
          },
          correlationId,
        );
      }
    }
    this.#record(principal, 'communications.announcement.published', 'announcement', announcementId, correlationId, published.version, {
      recipients: recipients.size,
      dispatches: recipients.size * published.channels.length,
    });
    return published;
  }

  dispatch(
    principal: CommunicationPrincipal,
    input: DeliveryDispatchInput,
    correlationId: string,
  ): DeliveryDispatch {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.dispatch.send');
    const existingId = this.#dispatchIdempotency.get(input.idempotencyKey);
    if (existingId !== undefined) return this.#requireDispatch(existingId);
    assertIdentifier(input.id, 'dispatch.id');
    if (this.#dispatches.has(input.id)) throw new Error('COMM_DISPATCH_EXISTS');
    const destination = destinationFor(input.channel, input.recipient);
    const preference = this.#preferences.get(
      preferenceKey(input.recipient.recipientRef, input.category, input.channel),
    );
    const timestamp = nowIso(this.#clock);
    let dispatch: DeliveryDispatch;
    if (destination === undefined) {
      dispatch = Object.freeze({
        ...input,
        state: 'suppressed',
        suppressionReason: 'destination-unavailable',
        attemptCount: 0,
        createdAt: timestamp,
        version: 1,
      });
    } else if (!input.mandatory && preference?.enabled === false) {
      dispatch = Object.freeze({
        ...input,
        state: 'suppressed',
        suppressionReason: 'recipient-preference',
        attemptCount: 0,
        createdAt: timestamp,
        version: 1,
      });
    } else {
      const adapter = this.#adapters.get(input.channel);
      if (adapter === undefined) throw new Error('COMM_ADAPTER_NOT_CONFIGURED');
      const result = adapter.send({
        tenantId: this.#scope.tenantId,
        dispatchId: input.id,
        recipientRef: input.recipient.recipientRef,
        destination,
        ...(input.rendered.subject === undefined ? {} : { subject: input.rendered.subject }),
        body: input.rendered.body,
        idempotencyKey: input.idempotencyKey,
      });
      dispatch = Object.freeze({
        ...input,
        state: result.state,
        ...(result.providerReference === undefined
          ? {}
          : { providerReference: result.providerReference }),
        ...(result.failureCode === undefined ? {} : { failureCode: result.failureCode }),
        attemptCount: 1,
        lastAttemptAt: timestamp,
        ...(result.state === 'delivered' ? { deliveredAt: timestamp } : {}),
        createdAt: timestamp,
        version: 1,
      });
      this.#attempts.push(
        Object.freeze({
          id: `${input.id}:1`,
          dispatchId: input.id,
          attemptNumber: 1,
          state: result.state,
          ...(result.providerReference === undefined
            ? {}
            : { providerReference: result.providerReference }),
          ...(result.failureCode === undefined ? {} : { failureCode: result.failureCode }),
          occurredAt: timestamp,
        }),
      );
    }
    this.#dispatches.set(dispatch.id, dispatch);
    this.#dispatchIdempotency.set(input.idempotencyKey, dispatch.id);
    this.#record(principal, 'communications.dispatch.created', 'delivery-dispatch', dispatch.id, correlationId, 1, {
      channel: dispatch.channel,
      state: dispatch.state,
      mandatory: dispatch.mandatory,
    });
    return dispatch;
  }

  markDelivered(
    principal: CommunicationPrincipal,
    dispatchId: string,
    providerReference: string,
    correlationId: string,
  ): DeliveryDispatch {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.delivery.update');
    const existing = this.#requireDispatch(dispatchId);
    if (existing.state === 'suppressed' || existing.state === 'cancelled') {
      throw new Error('COMM_DELIVERY_NOT_UPDATABLE');
    }
    if (existing.providerReference !== undefined && existing.providerReference !== providerReference) {
      throw new Error('COMM_DELIVERY_REFERENCE_MISMATCH');
    }
    if (existing.state === 'delivered') return existing;
    const delivered: DeliveryDispatch = Object.freeze({
      ...existing,
      state: 'delivered',
      providerReference,
      deliveredAt: nowIso(this.#clock),
      version: existing.version + 1,
    });
    this.#dispatches.set(dispatchId, delivered);
    this.#record(principal, 'communications.delivery.delivered', 'delivery-dispatch', dispatchId, correlationId, delivered.version, {
      channel: delivered.channel,
    });
    return delivered;
  }

  retryDispatch(
    principal: CommunicationPrincipal,
    dispatchId: string,
    correlationId: string,
  ): DeliveryDispatch {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.dispatch.retry');
    const existing = this.#requireDispatch(dispatchId);
    if (existing.state !== 'failed') throw new Error('COMM_DELIVERY_NOT_RETRYABLE');
    const destination = destinationFor(existing.channel, existing.recipient);
    if (destination === undefined) throw new Error('COMM_DESTINATION_UNAVAILABLE');
    const adapter = this.#adapters.get(existing.channel);
    if (adapter === undefined) throw new Error('COMM_ADAPTER_NOT_CONFIGURED');
    const attemptNumber = existing.attemptCount + 1;
    const timestamp = nowIso(this.#clock);
    const result = adapter.send({
      tenantId: this.#scope.tenantId,
      dispatchId: existing.id,
      recipientRef: existing.recipient.recipientRef,
      destination,
      ...(existing.rendered.subject === undefined ? {} : { subject: existing.rendered.subject }),
      body: existing.rendered.body,
      idempotencyKey: `${existing.idempotencyKey}:attempt:${attemptNumber}`,
    });
    const retried: DeliveryDispatch = Object.freeze({
      ...existing,
      state: result.state,
      ...(result.providerReference === undefined
        ? {}
        : { providerReference: result.providerReference }),
      ...(result.failureCode === undefined
        ? { failureCode: undefined }
        : { failureCode: result.failureCode }),
      attemptCount: attemptNumber,
      lastAttemptAt: timestamp,
      ...(result.state === 'delivered' ? { deliveredAt: timestamp } : {}),
      version: existing.version + 1,
    });
    this.#dispatches.set(dispatchId, retried);
    this.#attempts.push(
      Object.freeze({
        id: `${dispatchId}:${attemptNumber}`,
        dispatchId,
        attemptNumber,
        state: result.state,
        ...(result.providerReference === undefined
          ? {}
          : { providerReference: result.providerReference }),
        ...(result.failureCode === undefined ? {} : { failureCode: result.failureCode }),
        occurredAt: timestamp,
      }),
    );
    this.#record(principal, 'communications.dispatch.retried', 'delivery-dispatch', dispatchId, correlationId, retried.version, {
      attemptNumber,
      state: retried.state,
    });
    return retried;
  }

  createThread(
    principal: CommunicationPrincipal,
    input: SecureThreadInput,
    correlationId: string,
  ): SecureThread {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.thread.manage');
    assertIdentifier(input.id, 'thread.id');
    if (this.#threads.has(input.id)) throw new Error('COMM_THREAD_EXISTS');
    const participantRefs = distinct(input.participantRefs.map((value) => assertIdentifier(value, 'thread.participant')));
    if (!participantRefs.includes(principal.actorId)) participantRefs.push(principal.actorId);
    if (participantRefs.length < 2) throw new Error('COMM_THREAD_PARTICIPANT_REQUIRED');
    const timestamp = nowIso(this.#clock);
    const thread: SecureThread = Object.freeze({
      id: input.id,
      subject: assertNonEmpty(input.subject, 'thread.subject', 500),
      purpose: assertNonEmpty(input.purpose, 'thread.purpose', 1_000),
      state: 'open',
      participants: Object.freeze(
        participantRefs.map((participantRef) =>
          Object.freeze({
            participantRef,
            roleLabel: participantRef === principal.actorId ? 'creator' : 'participant',
            canPost: true,
            joinedAt: timestamp,
          }),
        ),
      ),
      createdBy: principal.actorId,
      createdAt: timestamp,
      version: 1,
    });
    this.#threads.set(thread.id, thread);
    this.#record(principal, 'communications.thread.created', 'secure-thread', thread.id, correlationId, 1, {
      participants: thread.participants.length,
    });
    return thread;
  }

  postMessage(
    principal: CommunicationPrincipal,
    input: SecureMessageInput,
    correlationId: string,
  ): SecureMessage {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.thread.post');
    const existingMessageId = this.#messageIdempotency.get(input.idempotencyKey);
    if (existingMessageId !== undefined) return this.#requireMessage(existingMessageId);
    assertIdentifier(input.id, 'message.id');
    if (this.#messages.has(input.id)) throw new Error('COMM_MESSAGE_EXISTS');
    const thread = this.#requireThread(input.threadId);
    if (thread.state !== 'open') throw new Error('COMM_THREAD_CLOSED');
    const participant = thread.participants.find(
      (candidate) => candidate.participantRef === principal.actorId && candidate.leftAt === undefined,
    );
    if (participant === undefined || !participant.canPost) throw new Error('COMM_NOT_FOUND');
    const message: SecureMessage = Object.freeze({
      id: input.id,
      threadId: thread.id,
      body: assertNonEmpty(input.body, 'message.body', 50_000),
      ...(input.attachmentRefs === undefined
        ? {}
        : {
            attachmentRefs: Object.freeze(
              distinct(input.attachmentRefs.map((value) => assertIdentifier(value, 'message.attachment'))),
            ),
          }),
      idempotencyKey: assertIdentifier(input.idempotencyKey, 'message.idempotencyKey'),
      senderRef: principal.actorId,
      sentAt: nowIso(this.#clock),
      version: 1,
    });
    this.#messages.set(message.id, message);
    this.#messageIdempotency.set(message.idempotencyKey, message.id);
    this.#record(principal, 'communications.thread.message-posted', 'secure-message', message.id, correlationId, 1, {
      threadId: thread.id,
      attachments: message.attachmentRefs?.length ?? 0,
    });
    return message;
  }

  listThreadMessages(
    principal: CommunicationPrincipal,
    threadId: string,
  ): readonly SecureMessage[] {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.thread.read');
    const thread = this.#requireThread(threadId);
    if (!thread.participants.some((participant) => participant.participantRef === principal.actorId && participant.leftAt === undefined)) {
      throw new Error('COMM_NOT_FOUND');
    }
    this.#auditEntry(principal, 'communications.thread.read', 'secure-thread', threadId, {
      messageCount: [...this.#messages.values()].filter((message) => message.threadId === threadId).length,
    });
    return Object.freeze(
      [...this.#messages.values()]
        .filter((message) => message.threadId === threadId)
        .sort((left, right) => left.sentAt.localeCompare(right.sentAt)),
    );
  }

  createForm(
    principal: CommunicationPrincipal,
    input: CommunicationFormInput,
    correlationId: string,
  ): CommunicationForm {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.form.manage');
    assertIdentifier(input.id, 'form.id');
    const code = assertIdentifier(input.code, 'form.code');
    if (this.#forms.has(input.id) || this.#formCodes.has(code)) throw new Error('COMM_FORM_EXISTS');
    if (input.questions.length === 0) throw new Error('COMM_FORM_QUESTION_REQUIRED');
    const questions = input.questions.map(validateQuestion);
    if (distinct(questions.map((question) => question.id)).length !== questions.length) {
      throw new Error('COMM_FORM_DUPLICATE_QUESTION');
    }
    if (input.kind === 'acknowledgement' && input.acknowledgementText === undefined) {
      throw new Error('COMM_ACKNOWLEDGEMENT_TEXT_REQUIRED');
    }
    const form: CommunicationForm = Object.freeze({
      id: input.id,
      code,
      kind: input.kind,
      title: assertNonEmpty(input.title, 'form.title', 500),
      description: assertNonEmpty(input.description, 'form.description', 5_000),
      defaultLocale: assertNonEmpty(input.defaultLocale, 'form.defaultLocale', 40),
      questions: Object.freeze(questions),
      ...(input.acknowledgementText === undefined
        ? {}
        : {
            acknowledgementText: assertNonEmpty(
              input.acknowledgementText,
              'form.acknowledgementText',
              5_000,
            ),
          }),
      state: 'draft',
      version: 1,
      createdBy: principal.actorId,
      createdAt: nowIso(this.#clock),
    });
    this.#forms.set(form.id, form);
    this.#formCodes.set(form.code, form.id);
    this.#record(principal, 'communications.form.created', 'communication-form', form.id, correlationId, 1, {
      kind: form.kind,
      questions: form.questions.length,
    });
    return form;
  }

  publishForm(
    principal: CommunicationPrincipal,
    formId: string,
    correlationId: string,
  ): CommunicationForm {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.form.publish');
    const existing = this.#requireForm(formId);
    if (existing.state !== 'draft') throw new Error('COMM_FORM_NOT_PUBLISHABLE');
    const published: CommunicationForm = Object.freeze({
      ...existing,
      state: 'published',
      version: existing.version + 1,
      publishedBy: principal.actorId,
      publishedAt: nowIso(this.#clock),
    });
    this.#forms.set(formId, published);
    this.#record(principal, 'communications.form.published', 'communication-form', formId, correlationId, published.version, {
      kind: published.kind,
    });
    return published;
  }

  submitFormResponse(
    principal: CommunicationPrincipal,
    input: FormResponseInput,
    correlationId: string,
  ): FormResponse {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.form.respond');
    const existingResponseId = this.#responseIdempotency.get(input.idempotencyKey);
    if (existingResponseId !== undefined) return this.#requireResponse(existingResponseId);
    assertIdentifier(input.id, 'response.id');
    if (this.#responses.has(input.id)) throw new Error('COMM_FORM_RESPONSE_EXISTS');
    if (input.respondentRef !== principal.actorId) throw new Error('COMM_NOT_FOUND');
    const form = this.#requireForm(input.formId);
    if (form.state !== 'published') throw new Error('COMM_FORM_NOT_OPEN');
    const knownQuestionIds = new Set(form.questions.map((question) => question.id));
    for (const questionId of Object.keys(input.answers)) {
      if (!knownQuestionIds.has(questionId)) throw new Error(`COMM_FORM_UNKNOWN_QUESTION:${questionId}`);
    }
    for (const question of form.questions) validateAnswer(question, input.answers[question.id]);
    if (form.kind === 'acknowledgement' && input.acknowledgementAccepted !== true) {
      throw new Error('COMM_ACKNOWLEDGEMENT_REQUIRED');
    }
    const timestamp = nowIso(this.#clock);
    const response: FormResponse = Object.freeze({
      id: input.id,
      formId: form.id,
      respondentRef: principal.actorId,
      answers: Object.freeze(cloneRecord(input.answers)),
      ...(input.acknowledgementAccepted === undefined
        ? {}
        : { acknowledgementAccepted: input.acknowledgementAccepted }),
      idempotencyKey: assertIdentifier(input.idempotencyKey, 'response.idempotencyKey'),
      formVersion: form.version,
      submittedAt: timestamp,
      version: 1,
    });
    this.#responses.set(response.id, response);
    this.#responseIdempotency.set(response.idempotencyKey, response.id);
    if (form.kind === 'acknowledgement' && form.acknowledgementText !== undefined) {
      const receipt: AcknowledgementReceipt = Object.freeze({
        id: `${form.id}:${response.id}`,
        formId: form.id,
        responseId: response.id,
        respondentRef: response.respondentRef,
        textSnapshot: form.acknowledgementText,
        acceptedAt: timestamp,
      });
      this.#acknowledgements.set(receipt.id, receipt);
    }
    this.#record(principal, 'communications.form.responded', 'form-response', response.id, correlationId, 1, {
      formId: form.id,
      formVersion: form.version,
      acknowledgement: response.acknowledgementAccepted === true,
    });
    return response;
  }

  acknowledgementFor(
    principal: CommunicationPrincipal,
    responseId: string,
  ): AcknowledgementReceipt | undefined {
    this.#assertTenant(principal);
    requireCapability(principal, 'communications.form.receipt.read');
    const response = this.#requireResponse(responseId);
    if (
      response.respondentRef !== principal.actorId &&
      !principal.capabilities.includes('communications.form.response.admin-read')
    ) {
      throw new Error('COMM_NOT_FOUND');
    }
    return [...this.#acknowledgements.values()].find((receipt) => receipt.responseId === responseId);
  }

  private #assertTenant(principal: CommunicationPrincipal): void {
    if (principal.tenantId !== this.#scope.tenantId) throw new Error('COMM_NOT_FOUND');
    assertIdentifier(principal.actorId, 'principal.actorId');
  }

  private #requireTemplate(templateId: string): MessageTemplate {
    const template = this.#templates.get(templateId);
    if (template === undefined) throw new Error('COMM_TEMPLATE_NOT_FOUND');
    return template;
  }

  private #requireAnnouncement(announcementId: string): Announcement {
    const announcement = this.#announcements.get(announcementId);
    if (announcement === undefined) throw new Error('COMM_ANNOUNCEMENT_NOT_FOUND');
    return announcement;
  }

  private #requireThread(threadId: string): SecureThread {
    const thread = this.#threads.get(threadId);
    if (thread === undefined) throw new Error('COMM_NOT_FOUND');
    return thread;
  }

  private #requireMessage(messageId: string): SecureMessage {
    const message = this.#messages.get(messageId);
    if (message === undefined) throw new Error('COMM_NOT_FOUND');
    return message;
  }

  private #requireDispatch(dispatchId: string): DeliveryDispatch {
    const dispatch = this.#dispatches.get(dispatchId);
    if (dispatch === undefined) throw new Error('COMM_DISPATCH_NOT_FOUND');
    return dispatch;
  }

  private #requireForm(formId: string): CommunicationForm {
    const form = this.#forms.get(formId);
    if (form === undefined) throw new Error('COMM_FORM_NOT_FOUND');
    return form;
  }

  private #requireResponse(responseId: string): FormResponse {
    const response = this.#responses.get(responseId);
    if (response === undefined) throw new Error('COMM_FORM_RESPONSE_NOT_FOUND');
    return response;
  }

  private #auditEntry(
    principal: CommunicationPrincipal,
    action: string,
    subjectType: string,
    subjectId: string,
    detail?: Readonly<Record<string, string | number | boolean>>,
  ): void {
    this.#audit.push(
      Object.freeze({
        id: crypto.randomUUID(),
        tenantId: this.#scope.tenantId,
        actorId: principal.actorId,
        action,
        subjectType,
        subjectId,
        occurredAt: nowIso(this.#clock),
        ...(detail === undefined ? {} : { detail: Object.freeze(cloneRecord(detail)) }),
      }),
    );
  }

  private #record(
    principal: CommunicationPrincipal,
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    correlationId: string,
    aggregateVersion: number,
    payload: Readonly<Record<string, unknown>>,
  ): void {
    this.#auditEntry(principal, eventType, aggregateType, aggregateId);
    this.#events.push(
      Object.freeze({
        eventId: crypto.randomUUID(),
        eventType,
        schemaVersion: 1,
        tenantId: this.#scope.tenantId,
        aggregateType,
        aggregateId,
        aggregateVersion,
        correlationId: assertIdentifier(correlationId, 'correlationId'),
        occurredAt: nowIso(this.#clock),
        payload: Object.freeze(cloneRecord(payload)),
      }),
    );
  }
}
