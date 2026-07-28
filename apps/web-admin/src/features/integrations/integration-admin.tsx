import type { IntegrationAdminModel } from './integration-admin-model.js';

export * from './integration-admin-model.js';

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
