import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  CommunicationsWorkspace,
  NotificationDispatcher,
  resolveLocalizedCopy,
  selectScopedCommunications,
  type CommunicationsWorkspaceProps,
  type NotificationAdapter,
  type NotificationTemplate,
} from '../../packages/modules/documents-experience/src/communications';

const base: CommunicationsWorkspaceProps = {
  tenantId: 'tenant-1',
  persona: 'guardian',
  principalId: 'guardian-1',
  schoolName: 'International Community School',
  locale: 'bn-BD',
  capabilities: [
    'announcements.household.read',
    'messages.household.read',
    'messages.household.reply',
    'forms.household.read',
    'delivery.household.read',
    'preferences.household.read',
  ],
  announcements: [
    {
      id: 'announcement-weather',
      tenantId: 'tenant-1',
      visibleToIds: ['guardian-1'],
      requiredCapability: 'announcements.household.read',
      priority: 'urgent',
      publishedAt: '2026-07-29T07:00:00+06:00',
      copies: [
        {
          locale: 'en',
          title: 'Campus closes early',
          body: 'Collection starts at 1:00 PM because of severe weather.',
        },
        {
          locale: 'bn-BD',
          title: 'ক্যাম্পাস আজ আগে বন্ধ হবে',
          body: 'খারাপ আবহাওয়ার কারণে দুপুর ১টা থেকে শিক্ষার্থীদের নিয়ে যেতে হবে।',
        },
      ],
      defaultLocale: 'en',
      acknowledgementRequired: true,
      acknowledgedBy: [],
      acknowledgementHref: '/family/announcements/weather/acknowledge',
    },
    {
      id: 'announcement-other-tenant',
      tenantId: 'tenant-2',
      visibleToIds: ['guardian-1'],
      priority: 'urgent',
      publishedAt: '2026-07-29T08:00:00+06:00',
      copies: [
        { locale: 'en', title: 'Other tenant notice', body: 'Must never render.' },
      ],
      defaultLocale: 'en',
      acknowledgementRequired: false,
    },
    {
      id: 'announcement-other-family',
      tenantId: 'tenant-1',
      visibleToIds: ['guardian-2'],
      priority: 'important',
      publishedAt: '2026-07-29T08:30:00+06:00',
      copies: [
        { locale: 'en', title: 'Other household notice', body: 'Must never render.' },
      ],
      defaultLocale: 'en',
      acknowledgementRequired: false,
    },
  ],
  threads: [
    {
      id: 'thread-science',
      tenantId: 'tenant-1',
      visibleToIds: ['guardian-1'],
      requiredCapability: 'messages.household.read',
      subject: 'Science fieldwork',
      participantLabels: ['Ms Karim', 'Nadia household'],
      latestPreview: 'Please review the fieldwork equipment list.',
      lastMessageAt: '2026-07-29T09:15:00+06:00',
      unreadCount: 2,
      href: '/family/messages/science-fieldwork',
      replyCapability: 'messages.household.reply',
    },
    {
      id: 'thread-restricted',
      tenantId: 'tenant-1',
      visibleToIds: ['guardian-1'],
      requiredCapability: 'care.case.read',
      subject: 'Restricted safeguarding case',
      participantLabels: ['Restricted team'],
      latestPreview: 'Sensitive information must not render.',
      lastMessageAt: '2026-07-29T09:45:00+06:00',
      unreadCount: 4,
      href: '/family/messages/restricted',
    },
  ],
  actions: [
    {
      id: 'consent-trip',
      tenantId: 'tenant-1',
      visibleToIds: ['guardian-1'],
      requiredCapability: 'forms.household.read',
      kind: 'consent',
      title: 'Science fieldwork consent',
      description: 'Review transport, emergency and collection details.',
      state: 'not-started',
      subjectLabel: 'Nadia Rahman',
      dueAt: '2026-08-01T23:59:00+06:00',
      href: '/family/forms/fieldwork-consent',
    },
    {
      id: 'survey-complete',
      tenantId: 'tenant-1',
      visibleToIds: ['guardian-1'],
      requiredCapability: 'forms.household.read',
      kind: 'survey',
      title: 'Transport survey',
      description: 'Your response was submitted.',
      state: 'complete',
      href: '/family/forms/transport-survey',
    },
  ],
  deliveries: [
    {
      id: 'delivery-sms',
      tenantId: 'tenant-1',
      visibleToIds: ['guardian-1'],
      requiredCapability: 'delivery.household.read',
      campaignTitle: 'Campus closes early',
      recipientId: 'guardian-1',
      channel: 'sms',
      state: 'delivered',
      destinationLabel: '•••• 0191',
      updatedAt: '2026-07-29T07:02:00+06:00',
    },
    {
      id: 'delivery-email',
      tenantId: 'tenant-1',
      visibleToIds: ['guardian-1'],
      requiredCapability: 'delivery.household.read',
      campaignTitle: 'Science fieldwork consent',
      recipientId: 'guardian-1',
      channel: 'email',
      state: 'failed',
      destinationLabel: 'r••••@example.test',
      updatedAt: '2026-07-29T07:03:00+06:00',
      failureReason: 'Mailbox rejected the message. Verify the saved address.',
    },
  ],
  preferences: [
    {
      id: 'preference-email',
      tenantId: 'tenant-1',
      visibleToIds: ['guardian-1'],
      requiredCapability: 'preferences.household.read',
      recipientId: 'guardian-1',
      channel: 'email',
      enabled: true,
      locked: false,
      href: '/family/preferences/email',
    },
    {
      id: 'preference-sms',
      tenantId: 'tenant-1',
      visibleToIds: ['guardian-1'],
      requiredCapability: 'preferences.household.read',
      recipientId: 'guardian-1',
      channel: 'sms',
      enabled: true,
      locked: true,
      reason: 'Emergency closure notices require one verified contact channel.',
      href: '/family/preferences/sms',
    },
  ],
  adapterHealth: [
    {
      tenantId: 'tenant-1',
      visibleToIds: ['admin-1'],
      requiredCapability: 'communications.adapters.read',
      channel: 'sms',
      providerLabel: 'SMS provider',
      state: 'healthy',
      checkedAt: '2026-07-29T09:00:00+06:00',
      detail: 'Provider accepted the synthetic health check.',
    },
  ],
};

const template: NotificationTemplate = {
  key: 'school.closure',
  defaultLocale: 'en',
  translations: [
    {
      locale: 'en',
      subject: '{{school}} closes early',
      body: 'Collect {{student}} at {{time}}.',
    },
    {
      locale: 'bn-BD',
      subject: '{{school}} আগে বন্ধ হবে',
      body: '{{student}}-কে {{time}}-এ নিয়ে যান।',
    },
  ],
};

const smsAdapter: NotificationAdapter = {
  channel: 'sms',
  deliver(input) {
    return {
      state: 'sent',
      providerReference: `sms:${input.deliveryId}`,
    };
  },
};

describe('EXP-01 communications experience', () => {
  it('filters every communication record by tenant, principal and capability', () => {
    const visible = selectScopedCommunications(
      base.announcements,
      'tenant-1',
      'guardian-1',
      ['announcements.household.read'],
    );
    expect(visible.map((record) => record.id)).toEqual(['announcement-weather']);
  });

  it('resolves exact locale, language fallback and default locale without mutating templates', () => {
    expect(resolveLocalizedCopy(template.translations, 'bn-BD', 'en')?.locale).toBe('bn-BD');
    expect(resolveLocalizedCopy(template.translations, 'bn-IN', 'en')?.locale).toBe('bn-BD');
    expect(resolveLocalizedCopy(template.translations, 'fr-FR', 'en')?.locale).toBe('en');
  });

  it('plans multilingual delivery through adapters and honours optional preferences', () => {
    const dispatcher = new NotificationDispatcher([smsAdapter]);
    const planned = dispatcher.dispatch({
      notificationId: 'notification-1',
      recipientId: 'guardian-1',
      destinationLabels: {
        'in-app': 'Family inbox',
        sms: '•••• 0191',
        email: 'r••••@example.test',
      },
      requestedLocale: 'bn-BD',
      template,
      variables: {
        school: 'ICS',
        student: 'Nadia',
        time: '1:00 PM',
      },
      channels: ['in-app', 'sms', 'email'],
      preferences: [
        { channel: 'sms', enabled: true, locked: false },
        { channel: 'email', enabled: false, locked: false },
      ],
    });

    expect(planned).toHaveLength(3);
    expect(planned[0]).toMatchObject({ channel: 'in-app', state: 'delivered', locale: 'bn-BD' });
    expect(planned[1]).toMatchObject({
      channel: 'sms',
      state: 'sent',
      providerReference: 'sms:notification-1:sms',
    });
    expect(planned[1]?.subject).toContain('ICS');
    expect(planned[1]?.body).toContain('Nadia');
    expect(planned[2]).toMatchObject({ channel: 'email', state: 'suppressed' });
  });

  it('records a recoverable failure when a required channel has no configured adapter', () => {
    const dispatcher = new NotificationDispatcher([]);
    const [delivery] = dispatcher.dispatch({
      notificationId: 'notification-2',
      recipientId: 'guardian-1',
      destinationLabels: { push: 'Guardian device' },
      requestedLocale: 'en',
      template,
      variables: { school: 'ICS', student: 'Nadia', time: '1:00 PM' },
      channels: ['push'],
      preferences: [{ channel: 'push', enabled: false, locked: true }],
    });
    expect(delivery).toMatchObject({
      channel: 'push',
      state: 'failed',
      failureReason: 'No configured adapter is available for this channel.',
    });
  });

  it('renders urgent localized notices, secure threads, required responses and masked delivery evidence', () => {
    const markup = renderToStaticMarkup(<CommunicationsWorkspace {...base} />);
    expect(markup).toContain('ক্যাম্পাস আজ আগে বন্ধ হবে');
    expect(markup).toContain('Review and acknowledge');
    expect(markup).not.toContain('Other tenant notice');
    expect(markup).not.toContain('Other household notice');
    expect(markup).toContain('Science fieldwork');
    expect(markup).toContain('2 unread');
    expect(markup).not.toContain('Restricted safeguarding case');
    expect(markup).toContain('Science fieldwork consent');
    expect(markup.indexOf('Science fieldwork consent')).toBeLessThan(markup.indexOf('Transport survey'));
    expect(markup).toContain('•••• 0191');
    expect(markup).toContain('Mailbox rejected the message');
    expect(markup).toContain('Emergency closure notices require one verified contact channel.');
    expect(markup).not.toContain('Provider accepted the synthetic health check.');
  });

  it('shows operator adapter health only with explicit principal and capability scope', () => {
    const markup = renderToStaticMarkup(
      <CommunicationsWorkspace
        {...base}
        persona="admin"
        principalId="admin-1"
        capabilities={['communications.adapters.read']}
      />,
    );
    expect(markup).toContain('Channel adapter health');
    expect(markup).toContain('SMS provider');
    expect(markup).not.toContain('Restricted safeguarding case');
    expect(markup).not.toContain('ক্যাম্পাস আজ আগে বন্ধ হবে');
  });

  it('preserves drafts and acknowledgement state in loading and recoverable errors', () => {
    const loading = renderToStaticMarkup(<CommunicationsWorkspace {...base} state="loading" />);
    const error = renderToStaticMarkup(
      <CommunicationsWorkspace
        {...base}
        state="error"
        errorMessage="Your saved reply and consent draft are unchanged."
        retryHref="/family/messages?retry=1"
      />,
    );
    expect(loading).toContain('Preparing school communication');
    expect(error).toContain('role="alert"');
    expect(error).toContain('Your saved reply and consent draft are unchanged.');
    expect(error).toContain('href="/family/messages?retry=1"');
  });
});
