/*
THESIS: School communication should behave like a governed delivery ledger, not an untraceable social feed.
OWN-WORLD: The Operational Ledger extends into concise notices, scoped conversations and explicit delivery evidence.
STORY: Each person sees only communication addressed to them, completes required responses and understands what was delivered through which channel.
FIRST VIEWPORT: Urgent announcements, unread secure threads and required acknowledgements lead; adapter health and delivery evidence follow for authorised operators.
FORM: Capability- and recipient-filtered read models with multilingual resolution, preference-aware dispatch planning and no direct domain-table access.
*/
import type { ReactElement } from 'react';

export type CommunicationPersona = 'admin' | 'teacher' | 'guardian' | 'student';
export type CommunicationPriority = 'routine' | 'important' | 'urgent';
export type CommunicationActionKind = 'form' | 'survey' | 'acknowledgement' | 'consent';
export type CommunicationActionState =
  | 'not-started'
  | 'in-progress'
  | 'submitted'
  | 'complete'
  | 'expired';
export type DeliveryChannel = 'in-app' | 'email' | 'sms' | 'push';
export type DeliveryState = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'suppressed';
export type AdapterHealthState = 'healthy' | 'degraded' | 'unavailable';

interface CommunicationScope {
  readonly tenantId: string;
  readonly visibleToIds: readonly string[];
  readonly requiredCapability?: string;
}

export interface LocalizedCommunicationCopy {
  readonly locale: string;
  readonly title: string;
  readonly body: string;
}

export interface CommunicationAnnouncement extends CommunicationScope {
  readonly id: string;
  readonly priority: CommunicationPriority;
  readonly publishedAt: string;
  readonly expiresAt?: string;
  readonly copies: readonly LocalizedCommunicationCopy[];
  readonly defaultLocale: string;
  readonly acknowledgementRequired: boolean;
  readonly acknowledgedBy?: readonly string[];
  readonly acknowledgementHref?: string;
}

export interface CommunicationThread extends CommunicationScope {
  readonly id: string;
  readonly subject: string;
  readonly participantLabels: readonly string[];
  readonly latestPreview: string;
  readonly lastMessageAt: string;
  readonly unreadCount: number;
  readonly href: string;
  readonly replyCapability?: string;
  readonly locked?: boolean;
}

export interface CommunicationAction extends CommunicationScope {
  readonly id: string;
  readonly kind: CommunicationActionKind;
  readonly title: string;
  readonly description: string;
  readonly state: CommunicationActionState;
  readonly subjectLabel?: string;
  readonly dueAt?: string;
  readonly href: string;
}

export interface CommunicationDelivery extends CommunicationScope {
  readonly id: string;
  readonly campaignTitle: string;
  readonly recipientId: string;
  readonly channel: DeliveryChannel;
  readonly state: DeliveryState;
  readonly destinationLabel: string;
  readonly updatedAt: string;
  readonly failureReason?: string;
}

export interface CommunicationPreference extends CommunicationScope {
  readonly id: string;
  readonly recipientId: string;
  readonly channel: DeliveryChannel;
  readonly enabled: boolean;
  readonly locked: boolean;
  readonly reason?: string;
  readonly href: string;
}

export interface NotificationAdapterHealth extends CommunicationScope {
  readonly channel: Exclude<DeliveryChannel, 'in-app'>;
  readonly providerLabel: string;
  readonly state: AdapterHealthState;
  readonly checkedAt: string;
  readonly detail: string;
}

export interface NotificationTemplateTranslation {
  readonly locale: string;
  readonly subject: string;
  readonly body: string;
}

export interface NotificationTemplate {
  readonly key: string;
  readonly defaultLocale: string;
  readonly translations: readonly NotificationTemplateTranslation[];
}

export interface NotificationAdapterInput {
  readonly deliveryId: string;
  readonly recipientId: string;
  readonly destinationLabel: string;
  readonly locale: string;
  readonly subject: string;
  readonly body: string;
}

export interface NotificationAdapterResult {
  readonly state: Extract<DeliveryState, 'sent' | 'delivered' | 'failed'>;
  readonly providerReference?: string;
  readonly failureReason?: string;
}

export interface NotificationAdapter {
  readonly channel: Exclude<DeliveryChannel, 'in-app'>;
  deliver(input: NotificationAdapterInput): NotificationAdapterResult;
}

export interface NotificationDispatchRequest {
  readonly notificationId: string;
  readonly recipientId: string;
  readonly destinationLabels: Readonly<Partial<Record<DeliveryChannel, string>>>;
  readonly requestedLocale: string;
  readonly template: NotificationTemplate;
  readonly variables: Readonly<Record<string, string>>;
  readonly channels: readonly DeliveryChannel[];
  readonly preferences: readonly Pick<CommunicationPreference, 'channel' | 'enabled' | 'locked'>[];
}

export interface PlannedNotificationDelivery {
  readonly deliveryId: string;
  readonly channel: DeliveryChannel;
  readonly locale: string;
  readonly subject: string;
  readonly body: string;
  readonly state: DeliveryState;
  readonly destinationLabel: string;
  readonly providerReference?: string;
  readonly failureReason?: string;
}

export interface CommunicationsWorkspaceProps {
  readonly tenantId: string;
  readonly persona: CommunicationPersona;
  readonly principalId: string;
  readonly schoolName: string;
  readonly locale: string;
  readonly capabilities: readonly string[];
  readonly announcements: readonly CommunicationAnnouncement[];
  readonly threads: readonly CommunicationThread[];
  readonly actions: readonly CommunicationAction[];
  readonly deliveries: readonly CommunicationDelivery[];
  readonly preferences: readonly CommunicationPreference[];
  readonly adapterHealth: readonly NotificationAdapterHealth[];
  readonly state?: 'ready' | 'loading' | 'error';
  readonly errorMessage?: string;
  readonly retryHref?: string;
}

const priorityOrder: Readonly<Record<CommunicationPriority, number>> = {
  urgent: 0,
  important: 1,
  routine: 2,
};

const actionOrder: Readonly<Record<CommunicationActionState, number>> = {
  'not-started': 0,
  'in-progress': 1,
  submitted: 2,
  complete: 3,
  expired: 4,
};

const deliveryLabels: Readonly<Record<DeliveryState, string>> = {
  queued: 'Queued',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
  suppressed: 'Suppressed by preference',
};

function hasCapability(capabilities: readonly string[], requiredCapability?: string): boolean {
  return requiredCapability === undefined || capabilities.includes(requiredCapability);
}

function canView(
  record: CommunicationScope,
  tenantId: string,
  principalId: string,
  capabilities: readonly string[],
): boolean {
  return (
    record.tenantId === tenantId &&
    record.visibleToIds.includes(principalId) &&
    hasCapability(capabilities, record.requiredCapability)
  );
}

export function selectScopedCommunications<T extends CommunicationScope>(
  records: readonly T[],
  tenantId: string,
  principalId: string,
  capabilities: readonly string[],
): T[] {
  return records.filter((record) => canView(record, tenantId, principalId, capabilities));
}

export function resolveLocalizedCopy<T extends { readonly locale: string }>(
  copies: readonly T[],
  requestedLocale: string,
  defaultLocale: string,
): T | undefined {
  const normalized = requestedLocale.toLowerCase();
  const exact = copies.find((copy) => copy.locale.toLowerCase() === normalized);
  if (exact !== undefined) return exact;

  const language = normalized.split(/[-_]/u)[0];
  const languageMatch = copies.find(
    (copy) => copy.locale.toLowerCase().split(/[-_]/u)[0] === language,
  );
  if (languageMatch !== undefined) return languageMatch;

  return copies.find((copy) => copy.locale.toLowerCase() === defaultLocale.toLowerCase()) ?? copies[0];
}

function interpolateTemplate(value: string, variables: Readonly<Record<string, string>>): string {
  return value.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/gu, (token, key: string) => {
    return variables[key] ?? token;
  });
}

export class NotificationDispatcher {
  readonly #adapters = new Map<Exclude<DeliveryChannel, 'in-app'>, NotificationAdapter>();

  constructor(adapters: readonly NotificationAdapter[]) {
    for (const adapter of adapters) {
      if (this.#adapters.has(adapter.channel)) {
        throw new Error(`Duplicate notification adapter for ${adapter.channel}`);
      }
      this.#adapters.set(adapter.channel, adapter);
    }
  }

  dispatch(request: NotificationDispatchRequest): PlannedNotificationDelivery[] {
    const translation = resolveLocalizedCopy(
      request.template.translations,
      request.requestedLocale,
      request.template.defaultLocale,
    );
    if (translation === undefined) throw new Error('Notification template has no translations');

    const subject = interpolateTemplate(translation.subject, request.variables);
    const body = interpolateTemplate(translation.body, request.variables);

    return request.channels.map((channel) => {
      const deliveryId = `${request.notificationId}:${channel}`;
      const destinationLabel = request.destinationLabels[channel] ?? 'Destination unavailable';
      const preference = request.preferences.find((candidate) => candidate.channel === channel);

      if (preference?.enabled === false && preference.locked === false) {
        return {
          deliveryId,
          channel,
          locale: translation.locale,
          subject,
          body,
          state: 'suppressed',
          destinationLabel,
        };
      }

      if (channel === 'in-app') {
        return {
          deliveryId,
          channel,
          locale: translation.locale,
          subject,
          body,
          state: 'delivered',
          destinationLabel,
        };
      }

      const adapter = this.#adapters.get(channel);
      if (adapter === undefined) {
        return {
          deliveryId,
          channel,
          locale: translation.locale,
          subject,
          body,
          state: 'failed',
          destinationLabel,
          failureReason: 'No configured adapter is available for this channel.',
        };
      }

      try {
        const result = adapter.deliver({
          deliveryId,
          recipientId: request.recipientId,
          destinationLabel,
          locale: translation.locale,
          subject,
          body,
        });
        return {
          deliveryId,
          channel,
          locale: translation.locale,
          subject,
          body,
          state: result.state,
          destinationLabel,
          ...(result.providerReference === undefined
            ? {}
            : { providerReference: result.providerReference }),
          ...(result.failureReason === undefined ? {} : { failureReason: result.failureReason }),
        };
      } catch (error) {
        return {
          deliveryId,
          channel,
          locale: translation.locale,
          subject,
          body,
          state: 'failed',
          destinationLabel,
          failureReason: error instanceof Error ? error.message : 'Notification adapter failed.',
        };
      }
    });
  }
}

function formatNumber(locale: string, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

function formatTimestamp(locale: string, value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function EmptyState(props: { readonly title: string; readonly detail: string }): ReactElement {
  return (
    <div className="communications-empty" role="status">
      <strong>{props.title}</strong>
      <span>{props.detail}</span>
    </div>
  );
}

function WorkspaceState(props: {
  readonly title: string;
  readonly detail: string;
  readonly role?: 'status' | 'alert';
  readonly retryHref?: string | undefined;
}): ReactElement {
  return (
    <section className="communications-state" role={props.role ?? 'status'}>
      <h2>{props.title}</h2>
      <p>{props.detail}</p>
      {props.retryHref === undefined ? null : <a href={props.retryHref}>Try again</a>}
    </section>
  );
}

export function CommunicationsWorkspace(props: CommunicationsWorkspaceProps): ReactElement {
  if (props.state === 'loading') {
    return (
      <WorkspaceState
        title="Preparing school communication"
        detail="Loading announcements, secure messages, required responses and delivery evidence."
      />
    );
  }

  if (props.state === 'error') {
    return (
      <WorkspaceState
        role="alert"
        title="School communication could not be loaded"
        detail={
          props.errorMessage ??
          'No message, acknowledgement or preference change was submitted. Saved drafts are unchanged.'
        }
        retryHref={props.retryHref}
      />
    );
  }

  const announcements = selectScopedCommunications(
    props.announcements,
    props.tenantId,
    props.principalId,
    props.capabilities,
  ).sort((left, right) => {
    const priorityDifference = priorityOrder[left.priority] - priorityOrder[right.priority];
    if (priorityDifference !== 0) return priorityDifference;
    return right.publishedAt.localeCompare(left.publishedAt);
  });
  const threads = selectScopedCommunications(
    props.threads,
    props.tenantId,
    props.principalId,
    props.capabilities,
  ).sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt));
  const actions = selectScopedCommunications(
    props.actions,
    props.tenantId,
    props.principalId,
    props.capabilities,
  ).sort((left, right) => {
    const stateDifference = actionOrder[left.state] - actionOrder[right.state];
    if (stateDifference !== 0) return stateDifference;
    if (left.dueAt === undefined) return 1;
    if (right.dueAt === undefined) return -1;
    return left.dueAt.localeCompare(right.dueAt);
  });
  const deliveries = selectScopedCommunications(
    props.deliveries,
    props.tenantId,
    props.principalId,
    props.capabilities,
  ).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const preferences = selectScopedCommunications(
    props.preferences,
    props.tenantId,
    props.principalId,
    props.capabilities,
  );
  const adapterHealth = selectScopedCommunications(
    props.adapterHealth,
    props.tenantId,
    props.principalId,
    props.capabilities,
  );

  const unreadCount = threads.reduce((total, thread) => total + thread.unreadCount, 0);
  const requiredActionCount = actions.filter(
    (action) => action.state === 'not-started' || action.state === 'in-progress',
  ).length;
  const failedDeliveryCount = deliveries.filter((delivery) => delivery.state === 'failed').length;

  return (
    <div className="communications-workspace" data-persona={props.persona}>
      <header className="communications-masthead">
        <div>
          <p>School communication ledger</p>
          <h2>{props.schoolName}</h2>
          <span>
            Announcements, secure conversations, required responses and delivery evidence in one authorised scope.
          </span>
        </div>
        <dl aria-label="Communication summary">
          <div>
            <dt>Unread messages</dt>
            <dd>{formatNumber(props.locale, unreadCount)}</dd>
          </div>
          <div>
            <dt>Responses due</dt>
            <dd>{formatNumber(props.locale, requiredActionCount)}</dd>
          </div>
          <div>
            <dt>Delivery failures</dt>
            <dd>{formatNumber(props.locale, failedDeliveryCount)}</dd>
          </div>
        </dl>
      </header>

      <section className="communications-section" aria-labelledby="communications-announcements">
        <header>
          <h3 id="communications-announcements">Announcements</h3>
          <p>Only notices addressed to this account and current tenant are shown.</p>
        </header>
        {announcements.length === 0 ? (
          <EmptyState title="No current announcements" detail="There is no authorised notice in this scope." />
        ) : (
          <ol className="communications-announcements">
            {announcements.map((announcement) => {
              const copy = resolveLocalizedCopy(
                announcement.copies,
                props.locale,
                announcement.defaultLocale,
              );
              const acknowledged = announcement.acknowledgedBy?.includes(props.principalId) ?? false;
              return (
                <li key={announcement.id} data-priority={announcement.priority}>
                  <div>
                    <span>{announcement.priority}</span>
                    <time dateTime={announcement.publishedAt}>
                      {formatTimestamp(props.locale, announcement.publishedAt)}
                    </time>
                  </div>
                  <h4>{copy?.title ?? 'Announcement'}</h4>
                  <p>{copy?.body ?? 'The translated announcement is unavailable.'}</p>
                  {announcement.expiresAt === undefined ? null : (
                    <small>Available until {formatTimestamp(props.locale, announcement.expiresAt)}</small>
                  )}
                  {announcement.acknowledgementRequired ? (
                    acknowledged ? (
                      <strong className="communications-complete">Acknowledged</strong>
                    ) : announcement.acknowledgementHref === undefined ? (
                      <strong className="communications-warning">Acknowledgement required</strong>
                    ) : (
                      <a href={announcement.acknowledgementHref}>Review and acknowledge</a>
                    )
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="communications-columns">
        <section className="communications-section" aria-labelledby="communications-messages">
          <header>
            <h3 id="communications-messages">Secure messages</h3>
            <p>Participants, reply permission and unread state remain explicit.</p>
          </header>
          {threads.length === 0 ? (
            <EmptyState title="No authorised conversations" detail="No secure thread is available in this scope." />
          ) : (
            <ol className="communications-threads">
              {threads.map((thread) => {
                const canReply =
                  thread.locked !== true && hasCapability(props.capabilities, thread.replyCapability);
                return (
                  <li key={thread.id}>
                    <div>
                      <h4>{thread.subject}</h4>
                      <span>{thread.participantLabels.join(' · ')}</span>
                    </div>
                    <p>{thread.locked === true ? 'This conversation is read-only.' : thread.latestPreview}</p>
                    <footer>
                      <time dateTime={thread.lastMessageAt}>
                        {formatTimestamp(props.locale, thread.lastMessageAt)}
                      </time>
                      <span>{formatNumber(props.locale, thread.unreadCount)} unread</span>
                      <a href={thread.href}>{canReply ? 'Open and reply' : 'Open conversation'}</a>
                    </footer>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="communications-section" aria-labelledby="communications-actions">
          <header>
            <h3 id="communications-actions">Forms and responses</h3>
            <p>Forms, surveys, consent and acknowledgements keep their subject and due state.</p>
          </header>
          {actions.length === 0 ? (
            <EmptyState title="No response required" detail="There is no authorised form or acknowledgement due." />
          ) : (
            <ol className="communications-actions">
              {actions.map((action) => (
                <li key={action.id} data-state={action.state}>
                  <div>
                    <span>{action.kind}</span>
                    <strong>{action.state}</strong>
                  </div>
                  <h4>{action.title}</h4>
                  {action.subjectLabel === undefined ? null : <small>{action.subjectLabel}</small>}
                  <p>{action.description}</p>
                  {action.dueAt === undefined ? null : (
                    <time dateTime={action.dueAt}>Due {formatTimestamp(props.locale, action.dueAt)}</time>
                  )}
                  <a href={action.href}>
                    {action.state === 'not-started' || action.state === 'in-progress'
                      ? 'Continue response'
                      : 'View response'}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="communications-section" aria-labelledby="communications-delivery">
        <header>
          <h3 id="communications-delivery">Delivery status</h3>
          <p>Destinations stay masked while channel, state, timestamp and recovery reason remain traceable.</p>
        </header>
        {deliveries.length === 0 ? (
          <EmptyState title="No delivery evidence" detail="No authorised delivery record is available." />
        ) : (
          <div className="communications-table" role="region" aria-label="Notification delivery status" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Notification</th>
                  <th scope="col">Channel</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id} data-state={delivery.state}>
                    <th scope="row">{delivery.campaignTitle}</th>
                    <td>{delivery.channel}</td>
                    <td>{delivery.destinationLabel}</td>
                    <td>
                      <strong>{deliveryLabels[delivery.state]}</strong>
                      {delivery.failureReason === undefined ? null : <small>{delivery.failureReason}</small>}
                    </td>
                    <td>
                      <time dateTime={delivery.updatedAt}>
                        {formatTimestamp(props.locale, delivery.updatedAt)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="communications-columns communications-columns--compact">
        <section className="communications-section" aria-labelledby="communications-preferences">
          <header>
            <h3 id="communications-preferences">Notification preferences</h3>
            <p>Mandatory safety or operational notices identify why a channel cannot be disabled.</p>
          </header>
          {preferences.length === 0 ? (
            <EmptyState title="No editable preferences" detail="No preference record is available in this scope." />
          ) : (
            <ul className="communications-preferences">
              {preferences.map((preference) => (
                <li key={preference.id}>
                  <div>
                    <strong>{preference.channel}</strong>
                    <span>{preference.enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  {preference.reason === undefined ? null : <p>{preference.reason}</p>}
                  <a href={preference.href}>
                    {preference.locked ? 'Review mandatory channel' : 'Manage preference'}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {adapterHealth.length === 0 ? null : (
          <section className="communications-section" aria-labelledby="communications-adapters">
            <header>
              <h3 id="communications-adapters">Channel adapter health</h3>
              <p>Visible only to authorised communication operators.</p>
            </header>
            <ul className="communications-adapters">
              {adapterHealth.map((adapter) => (
                <li key={`${adapter.channel}:${adapter.providerLabel}`} data-state={adapter.state}>
                  <div>
                    <strong>{adapter.providerLabel}</strong>
                    <span>{adapter.channel}</span>
                  </div>
                  <p>{adapter.detail}</p>
                  <footer>
                    <strong>{adapter.state}</strong>
                    <time dateTime={adapter.checkedAt}>
                      Checked {formatTimestamp(props.locale, adapter.checkedAt)}
                    </time>
                  </footer>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
