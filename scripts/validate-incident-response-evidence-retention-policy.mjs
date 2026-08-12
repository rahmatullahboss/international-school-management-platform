import { readFileSync } from 'node:fs';

const DEFAULT_POLICY_PATH = new URL(
  '../config/production/incident-response-evidence-retention-policy.json',
  import.meta.url,
);

function fail(message) {
  throw new Error(`incident response evidence retention policy invalid: ${message}`);
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

const severityTargets = {
  sev1: {
    acknowledgeWithinMinutes: 10,
    incidentLeadWithinMinutes: 15,
    containmentPlanWithinMinutes: 30,
    postIncidentReviewWithinHours: 72,
  },
  sev2: {
    acknowledgeWithinMinutes: 30,
    incidentLeadWithinMinutes: 60,
    containmentPlanWithinMinutes: 120,
    postIncidentReviewWithinHours: 120,
  },
  sev3: {
    acknowledgeWithinMinutes: 240,
    incidentLeadWithinMinutes: 480,
    containmentPlanWithinMinutes: 1440,
    postIncidentReviewWithinHours: 168,
  },
  sev4: {
    acknowledgeWithinMinutes: 1440,
    incidentLeadWithinMinutes: 2880,
    containmentPlanWithinMinutes: 4320,
    postIncidentReviewWithinHours: 336,
  },
};

const categoryDefaults = {
  'identity-session-compromise': 'sev1',
  'privileged-access-misuse': 'sev1',
  'cross-tenant-boundary': 'sev1',
  'data-exposure': 'sev1',
  'finance-integrity-compromise': 'sev1',
  'projection-recovery-misuse': 'sev1',
  'secret-exposure': 'sev1',
  'infrastructure-availability-recovery': 'sev2',
};

const retentionMinimums = {
  incidentTimeline: 365,
  securityDecision: 730,
  recoveryEvidence: 365,
  credentialRotationRevocation: 365,
  auditBoundaryEvidence: 730,
  communicationsMetadata: 365,
};

const allowedOwnerRoles = ['engineering', 'operations', 'security', 'owner', 'data-protection'];

const lifecycleStates = ['detected', 'triaged', 'contained', 'recovered', 'review-complete'];

const externalBindingKeys = [
  'incidentSystem',
  'primaryIncidentOwner',
  'secondaryIncidentOwner',
  'securityOwner',
  'communicationsOwner',
  'evidenceStore',
  'primaryAlertDestination',
  'secondaryAlertDestination',
];

export function validateIncidentResponseEvidenceRetentionPolicy(policy) {
  assertExactKeys(
    policy,
    [
      'schemaVersion',
      'policyId',
      'productionAuthorized',
      'severity',
      'classification',
      'response',
      'evidence',
      'closure',
      'externalBindings',
    ],
    'policy',
  );

  assertEqual(policy.schemaVersion, 1, 'schemaVersion');
  assertEqual(policy.policyId, 'incident-response-evidence-retention-v1', 'policyId');
  assertEqual(policy.productionAuthorized, false, 'productionAuthorized');

  assertExactKeys(policy.severity, Object.keys(severityTargets), 'severity');
  for (const [severity, expected] of Object.entries(severityTargets)) {
    assertExactKeys(policy.severity[severity], Object.keys(expected), `severity.${severity}`);
    for (const [key, value] of Object.entries(expected)) {
      assertEqual(policy.severity[severity][key], value, `severity.${severity}.${key}`);
    }
  }

  assertExactKeys(
    policy.classification,
    ['categoryDefaultSeverity', 'unknownFailsClosed', 'unknownMinimumSeverity'],
    'classification',
  );
  assertExactKeys(
    policy.classification.categoryDefaultSeverity,
    Object.keys(categoryDefaults),
    'classification.categoryDefaultSeverity',
  );
  for (const [category, severity] of Object.entries(categoryDefaults)) {
    assertEqual(
      policy.classification.categoryDefaultSeverity[category],
      severity,
      `classification.categoryDefaultSeverity.${category}`,
    );
  }
  assertEqual(policy.classification.unknownFailsClosed, true, 'classification.unknownFailsClosed');
  assertEqual(
    policy.classification.unknownMinimumSeverity,
    'sev2',
    'classification.unknownMinimumSeverity',
  );

  assertExactKeys(
    policy.response,
    [
      'automaticProductionMutation',
      'incidentRecordBeforeRecoveryRequired',
      'destructiveActionSecondaryApprovalRequired',
      'primaryAndSecondaryMustDiffer',
      'dedicatedRecoveryCredentialRequiredWhenDomainPolicyRequires',
      'customerCommunicationExternalApprovalRequired',
      'projectionRecoveryRunbook',
    ],
    'response',
  );
  assertEqual(
    policy.response.automaticProductionMutation,
    false,
    'response.automaticProductionMutation',
  );
  assertEqual(
    policy.response.incidentRecordBeforeRecoveryRequired,
    true,
    'response.incidentRecordBeforeRecoveryRequired',
  );
  assertEqual(
    policy.response.destructiveActionSecondaryApprovalRequired,
    true,
    'response.destructiveActionSecondaryApprovalRequired',
  );
  assertEqual(
    policy.response.primaryAndSecondaryMustDiffer,
    true,
    'response.primaryAndSecondaryMustDiffer',
  );
  assertEqual(
    policy.response.dedicatedRecoveryCredentialRequiredWhenDomainPolicyRequires,
    true,
    'response.dedicatedRecoveryCredentialRequiredWhenDomainPolicyRequires',
  );
  assertEqual(
    policy.response.customerCommunicationExternalApprovalRequired,
    true,
    'response.customerCommunicationExternalApprovalRequired',
  );
  assertEqual(
    policy.response.projectionRecoveryRunbook,
    'docs/execution/57-projection-recovery-operator-runbook-v1.md',
    'response.projectionRecoveryRunbook',
  );

  assertExactKeys(
    policy.evidence,
    [
      'referenceScheme',
      'sha256Required',
      'utcTimestampRequired',
      'allowedOwnerRoles',
      'redactionRequired',
      'rawPayloadsProhibited',
      'tokensCredentialsPasswordsProhibited',
      'directPersonIdentifiersProhibited',
      'appendOnlyIncidentTimelineRequired',
      'preservationHoldOverridesDisposal',
      'minimumRetentionDays',
    ],
    'evidence',
  );
  assertEqual(policy.evidence.referenceScheme, 'evidence://', 'evidence.referenceScheme');
  assertEqual(policy.evidence.sha256Required, true, 'evidence.sha256Required');
  assertEqual(policy.evidence.utcTimestampRequired, true, 'evidence.utcTimestampRequired');
  assertExactArray(
    policy.evidence.allowedOwnerRoles,
    allowedOwnerRoles,
    'evidence.allowedOwnerRoles',
  );
  assertEqual(policy.evidence.redactionRequired, true, 'evidence.redactionRequired');
  assertEqual(policy.evidence.rawPayloadsProhibited, true, 'evidence.rawPayloadsProhibited');
  assertEqual(
    policy.evidence.tokensCredentialsPasswordsProhibited,
    true,
    'evidence.tokensCredentialsPasswordsProhibited',
  );
  assertEqual(
    policy.evidence.directPersonIdentifiersProhibited,
    true,
    'evidence.directPersonIdentifiersProhibited',
  );
  assertEqual(
    policy.evidence.appendOnlyIncidentTimelineRequired,
    true,
    'evidence.appendOnlyIncidentTimelineRequired',
  );
  assertEqual(
    policy.evidence.preservationHoldOverridesDisposal,
    true,
    'evidence.preservationHoldOverridesDisposal',
  );
  assertExactKeys(
    policy.evidence.minimumRetentionDays,
    Object.keys(retentionMinimums),
    'evidence.minimumRetentionDays',
  );
  for (const [key, value] of Object.entries(retentionMinimums)) {
    assertEqual(
      policy.evidence.minimumRetentionDays[key],
      value,
      `evidence.minimumRetentionDays.${key}`,
    );
  }

  assertExactKeys(
    policy.closure,
    [
      'requiredLifecycleStates',
      'outcomeVerificationRequired',
      'rootCauseOrContributingFactorsRequired',
      'correctiveActionOwnerRoleRequired',
      'unresolvedBusinessImpactBlocksClosure',
      'evidenceIntegrityFailureReopensIncident',
    ],
    'closure',
  );
  assertExactArray(
    policy.closure.requiredLifecycleStates,
    lifecycleStates,
    'closure.requiredLifecycleStates',
  );
  assertEqual(
    policy.closure.outcomeVerificationRequired,
    true,
    'closure.outcomeVerificationRequired',
  );
  assertEqual(
    policy.closure.rootCauseOrContributingFactorsRequired,
    true,
    'closure.rootCauseOrContributingFactorsRequired',
  );
  assertEqual(
    policy.closure.correctiveActionOwnerRoleRequired,
    true,
    'closure.correctiveActionOwnerRoleRequired',
  );
  assertEqual(
    policy.closure.unresolvedBusinessImpactBlocksClosure,
    true,
    'closure.unresolvedBusinessImpactBlocksClosure',
  );
  assertEqual(
    policy.closure.evidenceIntegrityFailureReopensIncident,
    true,
    'closure.evidenceIntegrityFailureReopensIncident',
  );

  assertExactKeys(policy.externalBindings, externalBindingKeys, 'externalBindings');
  for (const key of externalBindingKeys) {
    assertEqual(policy.externalBindings[key], 'required-external', `externalBindings.${key}`);
  }

  return true;
}

function loadPolicy(path = DEFAULT_POLICY_PATH) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  validateIncidentResponseEvidenceRetentionPolicy(parsed);
  return parsed;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectRejected(base, label, mutate) {
  const candidate = clone(base);
  mutate(candidate);
  try {
    validateIncidentResponseEvidenceRetentionPolicy(candidate);
  } catch {
    return;
  }
  throw new Error(`incident response policy adversarial case was accepted: ${label}`);
}

function runSelfTests(base) {
  const cases = [
    [
      'unknown top-level key',
      (candidate) => {
        candidate.unreviewed = true;
      },
    ],
    [
      'production authorization enabled',
      (candidate) => {
        candidate.productionAuthorized = true;
      },
    ],
    [
      'sev1 acknowledgement weakened',
      (candidate) => {
        candidate.severity.sev1.acknowledgeWithinMinutes = 11;
      },
    ],
    [
      'cross-tenant severity downgraded',
      (candidate) => {
        candidate.classification.categoryDefaultSeverity['cross-tenant-boundary'] = 'sev2';
      },
    ],
    [
      'unknown class fail-closed disabled',
      (candidate) => {
        candidate.classification.unknownFailsClosed = false;
      },
    ],
    [
      'automatic production mutation enabled',
      (candidate) => {
        candidate.response.automaticProductionMutation = true;
      },
    ],
    [
      'secondary approval removed',
      (candidate) => {
        candidate.response.destructiveActionSecondaryApprovalRequired = false;
      },
    ],
    [
      'same primary and secondary allowed',
      (candidate) => {
        candidate.response.primaryAndSecondaryMustDiffer = false;
      },
    ],
    [
      'projection runbook changed',
      (candidate) => {
        candidate.response.projectionRecoveryRunbook = 'docs/unsafe.md';
      },
    ],
    [
      'raw URL evidence scheme',
      (candidate) => {
        candidate.evidence.referenceScheme = 'https://';
      },
    ],
    [
      'redaction disabled',
      (candidate) => {
        candidate.evidence.redactionRequired = false;
      },
    ],
    [
      'raw payload allowed',
      (candidate) => {
        candidate.evidence.rawPayloadsProhibited = false;
      },
    ],
    [
      'credentials allowed',
      (candidate) => {
        candidate.evidence.tokensCredentialsPasswordsProhibited = false;
      },
    ],
    [
      'preservation hold bypass',
      (candidate) => {
        candidate.evidence.preservationHoldOverridesDisposal = false;
      },
    ],
    [
      'recovery retention shortened',
      (candidate) => {
        candidate.evidence.minimumRetentionDays.recoveryEvidence = 364;
      },
    ],
    [
      'unknown owner role',
      (candidate) => {
        candidate.evidence.allowedOwnerRoles[0] = 'administrator';
      },
    ],
    [
      'lifecycle closure removed',
      (candidate) => {
        candidate.closure.requiredLifecycleStates.pop();
      },
    ],
    [
      'business impact allowed at closure',
      (candidate) => {
        candidate.closure.unresolvedBusinessImpactBlocksClosure = false;
      },
    ],
    [
      'real incident system binding',
      (candidate) => {
        candidate.externalBindings.incidentSystem = 'https://incident.example.test';
      },
    ],
    [
      'real owner binding',
      (candidate) => {
        candidate.externalBindings.securityOwner = 'security@example.test';
      },
    ],
  ];

  for (const [label, mutate] of cases) {
    expectRejected(base, label, mutate);
  }
}

const policy = loadPolicy();
if (process.argv.includes('--self-test')) runSelfTests(policy);
process.stdout.write('Incident response and evidence retention policy validation passed.\n');
