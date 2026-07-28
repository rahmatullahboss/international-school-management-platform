export type CountryPackAdminStatus = 'active' | 'available';
export type ConnectorAdminStatus = 'active' | 'disabled' | 'draft';
export type ConnectorAdminHealth = 'healthy' | 'degraded' | 'down' | 'unknown' | 'disabled';
export type ConnectorAdminAction = 'test-connection' | 'replay-dead-letters' | 'rotate-credential';

export interface CountryPackAdminItem {
  packKey: string;
  version: number;
  displayName: string;
  status: CountryPackAdminStatus;
  defaultLocale: string;
  defaultTimeZone: string;
  upgradeChanges: number;
}

export interface ConnectorAdminItem {
  connectionId: string;
  displayName: string;
  status: ConnectorAdminStatus;
  health: ConnectorAdminHealth;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  sandboxPassed: boolean;
  scopes: readonly string[];
  dataCategories: readonly string[];
  subprocessorName: string;
  subprocessorCountryCode: string;
  privacyUrl: string;
  alertCount: number;
  deadLetterCount: number;
  lastCheckedAt: string | null;
  credentialReference: string;
}

export interface IntegrationAdminInput {
  locale: string;
  countryPacks: readonly Readonly<CountryPackAdminItem>[];
  connectors: readonly Readonly<ConnectorAdminItem>[];
}

export interface ConnectorAdminView extends ConnectorAdminItem {
  needsAttention: boolean;
  availableActions: readonly ConnectorAdminAction[];
  healthLabel: string;
}

export interface IntegrationAdminModel {
  locale: string;
  direction: 'ltr' | 'rtl';
  countryPacks: readonly Readonly<CountryPackAdminItem>[];
  activeCountryPack: Readonly<CountryPackAdminItem> | null;
  connectors: readonly Readonly<ConnectorAdminView>[];
}

const rtlLanguages = new Set(['ar', 'fa', 'he', 'ur']);

function localeDirection(locale: string): 'ltr' | 'rtl' {
  return rtlLanguages.has(locale.split('-')[0]?.toLowerCase() ?? '') ? 'rtl' : 'ltr';
}

function healthLabel(health: ConnectorAdminHealth): string {
  if (health === 'healthy') return 'Healthy';
  if (health === 'degraded') return 'Degraded — attention required';
  if (health === 'down') return 'Down — action required';
  if (health === 'disabled') return 'Disabled';
  return 'Unknown — not checked';
}

function actionsFor(connector: Readonly<ConnectorAdminItem>): readonly ConnectorAdminAction[] {
  if (connector.status !== 'active' || connector.approvalStatus !== 'approved') return [];
  const actions: ConnectorAdminAction[] = ['test-connection'];
  if (connector.deadLetterCount > 0) actions.push('replay-dead-letters');
  actions.push('rotate-credential');
  return Object.freeze(actions);
}

export function buildIntegrationAdminModel(
  input: IntegrationAdminInput,
): Readonly<IntegrationAdminModel> {
  const countryPacks = input.countryPacks.map((pack) => Object.freeze({ ...pack }));
  const connectors = input.connectors.map((connector) =>
    Object.freeze({
      ...connector,
      scopes: Object.freeze([...connector.scopes]),
      dataCategories: Object.freeze([...connector.dataCategories]),
      needsAttention:
        connector.health === 'degraded' ||
        connector.health === 'down' ||
        connector.alertCount > 0 ||
        !connector.sandboxPassed,
      availableActions: actionsFor(connector),
      healthLabel: healthLabel(connector.health),
    }),
  );
  return Object.freeze({
    locale: input.locale,
    direction: localeDirection(input.locale),
    countryPacks: Object.freeze(countryPacks),
    activeCountryPack: countryPacks.find((pack) => pack.status === 'active') ?? null,
    connectors: Object.freeze(connectors),
  });
}

export interface IntegrationAdminPanelProps {
  model: Readonly<IntegrationAdminModel>;
  onActivatePack: (packKey: string, version: number) => void;
  onTestConnection: (connectionId: string) => void;
  onReplayDeadLetters: (connectionId: string) => void;
  onRotateCredential: (connectionId: string) => void;
}

export function IntegrationAdminPanel({
  model,
  onActivatePack,
  onTestConnection,
  onReplayDeadLetters,
  onRotateCredential,
}: IntegrationAdminPanelProps) {
  return (
    <main dir={model.direction} lang={model.locale}>
      <header>
        <h1>Internationalisation and integrations</h1>
        <p>
          Activate exact country-pack versions and operate approved connectors with sandbox, privacy
          and delivery evidence.
        </p>
      </header>

      <section aria-label="Country pack administration">
        <h2>Country packs</h2>
        <ul>
          {model.countryPacks.map((pack) => (
            <li key={`${pack.packKey}@${pack.version}`}>
              <h3>{pack.displayName}</h3>
              <p>
                Version {pack.version}; locale {pack.defaultLocale}; time zone{' '}
                {pack.defaultTimeZone}
              </p>
              <p>Status: {pack.status === 'active' ? 'Active exact version' : 'Available'}</p>
              {pack.status === 'available' ? (
                <button
                  type="button"
                  aria-label={`Activate ${pack.displayName} version ${pack.version}`}
                  onClick={() => onActivatePack(pack.packKey, pack.version)}
                >
                  Activate {pack.displayName} version {pack.version}
                  {pack.upgradeChanges > 0 ? ` — review ${pack.upgradeChanges} changes` : ''}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Connector administration">
        <h2>Connectors</h2>
        <table>
          <caption>Approved tenant connectors, operational health and privacy metadata</caption>
          <thead>
            <tr>
              <th scope="col">Connector</th>
              <th scope="col">Status</th>
              <th scope="col">Health</th>
              <th scope="col">Approved access</th>
              <th scope="col">Subprocessor</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {model.connectors.map((connector) => (
              <tr key={connector.connectionId}>
                <th scope="row">{connector.displayName}</th>
                <td>
                  {connector.status}; approval {connector.approvalStatus}; sandbox{' '}
                  {connector.sandboxPassed ? 'passed' : 'not passed'}
                </td>
                <td>
                  {connector.healthLabel}; {connector.alertCount} alerts; checked{' '}
                  {connector.lastCheckedAt ?? 'never'}
                </td>
                <td>
                  Scopes: {connector.scopes.join(', ')}. Data: {connector.dataCategories.join(', ')}
                  . Credential: {connector.credentialReference}.
                </td>
                <td>
                  {connector.subprocessorName} ({connector.subprocessorCountryCode}) —{' '}
                  <a href={connector.privacyUrl}>{connector.privacyUrl}</a>
                </td>
                <td>
                  {connector.availableActions.includes('test-connection') ? (
                    <button type="button" onClick={() => onTestConnection(connector.connectionId)}>
                      Test connection
                    </button>
                  ) : null}
                  {connector.availableActions.includes('replay-dead-letters') ? (
                    <button
                      type="button"
                      onClick={() => onReplayDeadLetters(connector.connectionId)}
                    >
                      Replay {connector.deadLetterCount} dead-letter{' '}
                      {connector.deadLetterCount === 1 ? 'delivery' : 'deliveries'}
                    </button>
                  ) : null}
                  {connector.availableActions.includes('rotate-credential') ? (
                    <button
                      type="button"
                      onClick={() => onRotateCredential(connector.connectionId)}
                    >
                      Rotate credential
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
