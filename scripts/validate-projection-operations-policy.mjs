import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEFAULT_POLICY_PATH = new URL(
  '../config/production/projection-operations-policy.json',
  import.meta.url,
);

function fail(message) {
  throw new Error(`projection operations policy invalid: ${message}`);
}

function assertPlainObject(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${path} must be an object`);
  }
}

function assertExactKeys(value, expectedKeys, path) {
  assertPlainObject(value, path);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${path} keys must be exactly ${expected.join(', ')}`);
  }
}

function assertEqual(actual, expected, path) {
  if (actual !== expected) {
    fail(`${path} must be ${JSON.stringify(expected)}`);
  }
}

function assertExactArray(actual, expected, path) {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    fail(`${path} must contain exactly ${expected.join(', ')}`);
  }
  for (const [index, expectedValue] of expected.entries()) {
    if (actual[index] !== expectedValue) {
      fail(`${path}[${index}] must be ${JSON.stringify(expectedValue)}`);
    }
  }
}

export function validateProjectionOperationsPolicy(policy) {
  assertExactKeys(
    policy,
    [
      'schemaVersion',
      'policyId',
      'productionAuthorized',
      'monitor',
      'response',
      'recovery',
      'evidence',
      'externalBindings',
    ],
    'policy',
  );

  assertEqual(policy.schemaVersion, 1, 'schemaVersion');
  assertEqual(policy.policyId, 'projection-operations-production-v1', 'policyId');
  assertEqual(policy.productionAuthorized, false, 'productionAuthorized');

  assertExactKeys(
    policy.monitor,
    [
      'pollIntervalSeconds',
      'warningAgeSeconds',
      'staleSourceSeconds',
      'warningConsecutiveSnapshots',
      'criticalConsecutiveSnapshots',
      'alertDedupWindowSeconds',
      'tenantScopedRequired',
      'payloadRedactionRequired',
      'exactEventAllowlistRequired',
      'functionOnlyAccessRequired',
    ],
    'monitor',
  );
  assertEqual(policy.monitor.pollIntervalSeconds, 60, 'monitor.pollIntervalSeconds');
  assertEqual(policy.monitor.warningAgeSeconds, 300, 'monitor.warningAgeSeconds');
  assertEqual(policy.monitor.staleSourceSeconds, 900, 'monitor.staleSourceSeconds');
  if (policy.monitor.warningAgeSeconds < 60 || policy.monitor.warningAgeSeconds > 86_400) {
    fail('monitor.warningAgeSeconds is outside the PILOT-12 database contract');
  }
  if (policy.monitor.staleSourceSeconds < 300 || policy.monitor.staleSourceSeconds > 604_800) {
    fail('monitor.staleSourceSeconds is outside the PILOT-12 database contract');
  }
  assertEqual(
    policy.monitor.warningConsecutiveSnapshots,
    2,
    'monitor.warningConsecutiveSnapshots',
  );
  assertEqual(
    policy.monitor.criticalConsecutiveSnapshots,
    1,
    'monitor.criticalConsecutiveSnapshots',
  );
  assertEqual(
    policy.monitor.alertDedupWindowSeconds,
    900,
    'monitor.alertDedupWindowSeconds',
  );
  assertEqual(policy.monitor.tenantScopedRequired, true, 'monitor.tenantScopedRequired');
  assertEqual(
    policy.monitor.payloadRedactionRequired,
    true,
    'monitor.payloadRedactionRequired',
  );
  assertEqual(
    policy.monitor.exactEventAllowlistRequired,
    true,
    'monitor.exactEventAllowlistRequired',
  );
  assertEqual(
    policy.monitor.functionOnlyAccessRequired,
    true,
    'monitor.functionOnlyAccessRequired',
  );

  assertExactKeys(policy.response, ['warning', 'critical'], 'response');
  assertExactKeys(
    policy.response.warning,
    ['acknowledgeWithinMinutes', 'investigateWithinMinutes'],
    'response.warning',
  );
  assertEqual(
    policy.response.warning.acknowledgeWithinMinutes,
    30,
    'response.warning.acknowledgeWithinMinutes',
  );
  assertEqual(
    policy.response.warning.investigateWithinMinutes,
    60,
    'response.warning.investigateWithinMinutes',
  );
  assertExactKeys(
    policy.response.critical,
    ['acknowledgeWithinMinutes', 'investigateWithinMinutes'],
    'response.critical',
  );
  assertEqual(
    policy.response.critical.acknowledgeWithinMinutes,
    10,
    'response.critical.acknowledgeWithinMinutes',
  );
  assertEqual(
    policy.response.critical.investigateWithinMinutes,
    15,
    'response.critical.investigateWithinMinutes',
  );

  assertExactKeys(
    policy.recovery,
    [
      'automatic',
      'oneDeadLetterAtATime',
      'secondaryHumanApprovalRequired',
      'dedicatedCredentialRequired',
      'aal2PermissionRequired',
      'repeatReplayProhibited',
      'eligibleErrorCodes',
      'prohibitedErrorCodes',
    ],
    'recovery',
  );
  assertEqual(policy.recovery.automatic, false, 'recovery.automatic');
  assertEqual(policy.recovery.oneDeadLetterAtATime, true, 'recovery.oneDeadLetterAtATime');
  assertEqual(
    policy.recovery.secondaryHumanApprovalRequired,
    true,
    'recovery.secondaryHumanApprovalRequired',
  );
  assertEqual(
    policy.recovery.dedicatedCredentialRequired,
    true,
    'recovery.dedicatedCredentialRequired',
  );
  assertEqual(policy.recovery.aal2PermissionRequired, true, 'recovery.aal2PermissionRequired');
  assertEqual(policy.recovery.repeatReplayProhibited, true, 'recovery.repeatReplayProhibited');
  assertExactArray(
    policy.recovery.eligibleErrorCodes,
    ['source-unavailable', 'processor-error'],
    'recovery.eligibleErrorCodes',
  );
  assertExactArray(
    policy.recovery.prohibitedErrorCodes,
    ['invalid-event', 'projection-state-conflict'],
    'recovery.prohibitedErrorCodes',
  );

  assertExactKeys(
    policy.evidence,
    [
      'retentionDays',
      'beforeAfterRedactedSnapshotsRequired',
      'incidentRecordRequired',
      'recoveryReceiptRequired',
      'payloadsProhibited',
      'tokensAndCredentialsProhibited',
      'personIdentifiersProhibited',
    ],
    'evidence',
  );
  assertEqual(policy.evidence.retentionDays, 365, 'evidence.retentionDays');
  assertEqual(
    policy.evidence.beforeAfterRedactedSnapshotsRequired,
    true,
    'evidence.beforeAfterRedactedSnapshotsRequired',
  );
  assertEqual(policy.evidence.incidentRecordRequired, true, 'evidence.incidentRecordRequired');
  assertEqual(policy.evidence.recoveryReceiptRequired, true, 'evidence.recoveryReceiptRequired');
  assertEqual(policy.evidence.payloadsProhibited, true, 'evidence.payloadsProhibited');
  assertEqual(
    policy.evidence.tokensAndCredentialsProhibited,
    true,
    'evidence.tokensAndCredentialsProhibited',
  );
  assertEqual(
    policy.evidence.personIdentifiersProhibited,
    true,
    'evidence.personIdentifiersProhibited',
  );

  const externalBindingKeys = [
    'monitorCredential',
    'recoveryCredential',
    'pollerSchedule',
    'primaryAlertDestination',
    'secondaryAlertDestination',
    'primaryOperationsOwner',
    'secondaryOperationsOwner',
  ];
  assertExactKeys(policy.externalBindings, externalBindingKeys, 'externalBindings');
  for (const key of externalBindingKeys) {
    assertEqual(policy.externalBindings[key], 'required-external', `externalBindings.${key}`);
  }

  return true;
}

function loadPolicy(path = DEFAULT_POLICY_PATH) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  validateProjectionOperationsPolicy(parsed);
  return parsed;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectRejected(base, label, mutate) {
  const candidate = clone(base);
  mutate(candidate);
  try {
    validateProjectionOperationsPolicy(candidate);
  } catch {
    return;
  }
  throw new Error(`projection operations policy adversarial case was accepted: ${label}`);
}

function runSelfTests(base) {
  const cases = [
    ['unknown top-level key', (candidate) => { candidate.unreviewed = true; }],
    ['production authorization', (candidate) => { candidate.productionAuthorized = true; }],
    ['monitor threshold widening', (candidate) => { candidate.monitor.warningAgeSeconds = 86_401; }],
    ['payload redaction disabled', (candidate) => { candidate.monitor.payloadRedactionRequired = false; }],
    ['automatic recovery', (candidate) => { candidate.recovery.automatic = true; }],
    [
      'secondary approval removed',
      (candidate) => { candidate.recovery.secondaryHumanApprovalRequired = false; },
    ],
    [
      'recovery error allowlist widened',
      (candidate) => { candidate.recovery.eligibleErrorCodes.push('invalid-event'); },
    ],
    [
      'permanent error prohibition removed',
      (candidate) => { candidate.recovery.prohibitedErrorCodes = ['invalid-event']; },
    ],
    [
      'real alert destination embedded',
      (candidate) => { candidate.externalBindings.primaryAlertDestination = 'https://example.invalid/hook'; },
    ],
    [
      'external owner binding omitted',
      (candidate) => { delete candidate.externalBindings.secondaryOperationsOwner; },
    ],
  ];

  for (const [label, mutate] of cases) {
    expectRejected(base, label, mutate);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const policy = loadPolicy();
  if (process.argv.includes('--self-test')) {
    runSelfTests(policy);
  }
  console.log('Projection operations production policy validation passed.');
}
