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
