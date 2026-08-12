import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TEMPLATE_PATH = fileURLToPath(
  new URL('../config/production/activation-evidence.template.json', import.meta.url),
);

const REQUIRED_GATES = [
  'realExternalOidc',
  'productionRuntimeCredential',
  'deployedSevenPersonaE2e',
  'projectionCredentialsAndSchedule',
  'alertDestinationsAndOwners',
  'monitorAlertRehearsal',
  'controlledRecoveryRehearsal',
  'credentialRotationRevocation',
  'securityPrivacyReview',
  'backupRestoreRollback',
  'ownerUat',
  'incidentOperationsAcceptance',
];

const REQUIRED_AUTHORIZATIONS = ['ownerAuthorization', 'securityAuthorization'];
const RECORD_KEYS = ['status', 'evidenceRef', 'evidenceSha256', 'verifiedAt', 'verifiedByRole'];
const ALLOWED_ROLES = new Set(['engineering', 'operations', 'security', 'owner', 'data-protection']);
const RELEASE_COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const EVIDENCE_REF_PATTERN = /^evidence:\/\/[A-Za-z0-9][A-Za-z0-9._/-]{2,255}$/;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SECRET_LIKE_PATTERNS = [
  /https?:\/\//i,
  /postgres(?:ql)?:\/\//i,
  /bearer\s+/i,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{6,}/i,
  /(?:password|passwd|client[_-]?secret|api[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]/i,
];

function fail(message) {
  throw new Error(`production activation evidence invalid: ${message}`);
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

function assertExactNamedRecords(value, expectedNames, path) {
  assertExactKeys(value, expectedNames, path);
  for (const name of expectedNames) {
    validateEvidenceRecord(value[name], `${path}.${name}`);
  }
}

function validateUtcTimestamp(value, path) {
  if (typeof value !== 'string' || !UTC_TIMESTAMP_PATTERN.test(value)) {
    fail(`${path} must be an RFC 3339 UTC timestamp`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    fail(`${path} must be a valid timestamp`);
  }
}

function validateEvidenceRecord(record, path) {
  assertExactKeys(record, RECORD_KEYS, path);
  if (record.status !== 'pending-external' && record.status !== 'verified') {
    fail(`${path}.status must be pending-external or verified`);
  }

  if (record.status === 'pending-external') {
    for (const key of RECORD_KEYS.slice(1)) {
      if (record[key] !== null) {
        fail(`${path}.${key} must be null while status is pending-external`);
      }
    }
    return;
  }

  if (typeof record.evidenceRef !== 'string' || !EVIDENCE_REF_PATTERN.test(record.evidenceRef)) {
    fail(`${path}.evidenceRef must use the opaque evidence:// reference scheme`);
  }
  if (record.evidenceRef.includes('?') || record.evidenceRef.includes('#')) {
    fail(`${path}.evidenceRef must not contain a query string or fragment`);
  }
  if (typeof record.evidenceSha256 !== 'string' || !SHA256_PATTERN.test(record.evidenceSha256)) {
    fail(`${path}.evidenceSha256 must be a lowercase SHA-256 digest`);
  }
  validateUtcTimestamp(record.verifiedAt, `${path}.verifiedAt`);
  if (!ALLOWED_ROLES.has(record.verifiedByRole)) {
    fail(`${path}.verifiedByRole is not an allowed verifier role`);
  }
}

function scanForSecretLikeStrings(value, path = 'manifest') {
  if (typeof value === 'string') {
    for (const pattern of SECRET_LIKE_PATTERNS) {
      if (pattern.test(value)) {
        fail(`${path} contains secret-like or raw URL material`);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForSecretLikeStrings(entry, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      scanForSecretLikeStrings(entry, `${path}.${key}`);
    }
  }
}

function allRecordsVerified(records, names) {
  return names.every((name) => records[name].status === 'verified');
}

export function validateProductionActivationEvidence(manifest, options = {}) {
  const { expectedCommit = null, requireTemplate = false } = options;

  assertExactKeys(
    manifest,
    [
      'schemaVersion',
      'contractId',
      'environment',
      'productionAuthorized',
      'releaseCommit',
      'gates',
      'authorizations',
    ],
    'manifest',
  );

  if (manifest.schemaVersion !== 1) fail('schemaVersion must be 1');
  if (manifest.contractId !== 'production-activation-evidence-v1') {
    fail('contractId must be production-activation-evidence-v1');
  }
  if (manifest.environment !== 'production') fail('environment must be production');
  if (typeof manifest.productionAuthorized !== 'boolean') {
    fail('productionAuthorized must be a boolean');
  }
  if (manifest.releaseCommit !== null && !RELEASE_COMMIT_PATTERN.test(manifest.releaseCommit)) {
    fail('releaseCommit must be null or an exact lowercase 40-hex Git commit');
  }

  assertExactNamedRecords(manifest.gates, REQUIRED_GATES, 'gates');
  assertExactNamedRecords(manifest.authorizations, REQUIRED_AUTHORIZATIONS, 'authorizations');

  const ownerAuthorization = manifest.authorizations.ownerAuthorization;
  const securityAuthorization = manifest.authorizations.securityAuthorization;
  if (ownerAuthorization.status === 'verified' && ownerAuthorization.verifiedByRole !== 'owner') {
    fail('ownerAuthorization must be verified by the owner role');
  }
  if (securityAuthorization.status === 'verified' && securityAuthorization.verifiedByRole !== 'security') {
    fail('securityAuthorization must be verified by the security role');
  }

  scanForSecretLikeStrings(manifest);

  if (expectedCommit !== null) {
    if (!RELEASE_COMMIT_PATTERN.test(expectedCommit)) {
      fail('expectedCommit must be an exact lowercase 40-hex Git commit');
    }
    if (manifest.releaseCommit !== expectedCommit) {
      fail('releaseCommit does not match the expected release commit');
    }
  }

  if (manifest.productionAuthorized) {
    if (manifest.releaseCommit === null) {
      fail('productionAuthorized requires an exact releaseCommit');
    }
    if (!allRecordsVerified(manifest.gates, REQUIRED_GATES)) {
      fail('productionAuthorized requires every production gate to be verified');
    }
    if (!allRecordsVerified(manifest.authorizations, REQUIRED_AUTHORIZATIONS)) {
      fail('productionAuthorized requires owner and security authorization');
    }
    if (ownerAuthorization.evidenceRef === securityAuthorization.evidenceRef) {
      fail('owner and security authorization must use different evidence references');
    }
    if (ownerAuthorization.evidenceSha256 === securityAuthorization.evidenceSha256) {
      fail('owner and security authorization must use different evidence digests');
    }
  }

  if (requireTemplate) {
    if (manifest.productionAuthorized !== false) {
      fail('committed template must keep productionAuthorized false');
    }
    if (manifest.releaseCommit !== null) {
      fail('committed template must keep releaseCommit null');
    }
    for (const name of REQUIRED_GATES) {
      if (manifest.gates[name].status !== 'pending-external') {
        fail(`committed template gate ${name} must remain pending-external`);
      }
    }
    for (const name of REQUIRED_AUTHORIZATIONS) {
      if (manifest.authorizations[name].status !== 'pending-external') {
        fail(`committed template authorization ${name} must remain pending-external`);
      }
    }
  }

  return true;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digestFor(label) {
  return createHash('sha256').update(label).digest('hex');
}

function buildAuthorizedCandidate(template) {
  const candidate = clone(template);
  candidate.productionAuthorized = true;
  candidate.releaseCommit = 'a'.repeat(40);
  for (const name of REQUIRED_GATES) {
    candidate.gates[name] = {
      status: 'verified',
      evidenceRef: `evidence://release/gates/${name}`,
      evidenceSha256: digestFor(`gate:${name}`),
      verifiedAt: '2026-08-12T10:00:00Z',
      verifiedByRole: name === 'securityPrivacyReview' ? 'security' : 'engineering',
    };
  }
  candidate.authorizations.ownerAuthorization = {
    status: 'verified',
    evidenceRef: 'evidence://release/authorizations/owner',
    evidenceSha256: digestFor('authorization:owner'),
    verifiedAt: '2026-08-12T10:05:00Z',
    verifiedByRole: 'owner',
  };
  candidate.authorizations.securityAuthorization = {
    status: 'verified',
    evidenceRef: 'evidence://release/authorizations/security',
    evidenceSha256: digestFor('authorization:security'),
    verifiedAt: '2026-08-12T10:06:00Z',
    verifiedByRole: 'security',
  };
  return candidate;
}

function expectRejected(base, label, mutate, options = {}) {
  const candidate = clone(base);
  mutate(candidate);
  try {
    validateProductionActivationEvidence(candidate, options);
  } catch {
    return;
  }
  throw new Error(`production activation evidence adversarial case was accepted: ${label}`);
}

function runSelfTests(template) {
  validateProductionActivationEvidence(template, { requireTemplate: true });

  const authorized = buildAuthorizedCandidate(template);
  validateProductionActivationEvidence(authorized, { expectedCommit: 'a'.repeat(40) });

  expectRejected(authorized, 'pending gate with production authorization', (candidate) => {
    candidate.gates.realExternalOidc = clone(template.gates.realExternalOidc);
  });
  expectRejected(authorized, 'authorized manifest without release commit', (candidate) => {
    candidate.releaseCommit = null;
  });
  expectRejected(
    authorized,
    'release commit mismatch',
    () => {},
    { expectedCommit: 'b'.repeat(40) },
  );
  expectRejected(authorized, 'raw HTTP evidence URL', (candidate) => {
    candidate.gates.realExternalOidc.evidenceRef = 'https://example.invalid/evidence';
  });
  expectRejected(authorized, 'evidence reference query string', (candidate) => {
    candidate.gates.realExternalOidc.evidenceRef = 'evidence://release/gate?id=secret';
  });
  expectRejected(authorized, 'malformed SHA-256 digest', (candidate) => {
    candidate.gates.realExternalOidc.evidenceSha256 = 'abc123';
  });
  expectRejected(authorized, 'non-UTC timestamp', (candidate) => {
    candidate.gates.realExternalOidc.verifiedAt = '2026-08-12T16:00:00+06:00';
  });
  expectRejected(authorized, 'unknown verifier role', (candidate) => {
    candidate.gates.realExternalOidc.verifiedByRole = 'database-owner';
  });
  expectRejected(authorized, 'owner authorization by wrong role', (candidate) => {
    candidate.authorizations.ownerAuthorization.verifiedByRole = 'security';
  });
  expectRejected(authorized, 'security authorization by wrong role', (candidate) => {
    candidate.authorizations.securityAuthorization.verifiedByRole = 'owner';
  });
  expectRejected(authorized, 'owner and security authorization evidence reused', (candidate) => {
    candidate.authorizations.securityAuthorization.evidenceRef =
      candidate.authorizations.ownerAuthorization.evidenceRef;
  });
  expectRejected(authorized, 'owner and security authorization digest reused', (candidate) => {
    candidate.authorizations.securityAuthorization.evidenceSha256 =
      candidate.authorizations.ownerAuthorization.evidenceSha256;
  });
  expectRejected(authorized, 'unknown production gate', (candidate) => {
    candidate.gates.unreviewedGate = clone(candidate.gates.realExternalOidc);
  });
  expectRejected(authorized, 'unknown evidence-record field', (candidate) => {
    candidate.gates.realExternalOidc.notes = 'unreviewed expansion';
  });
  expectRejected(authorized, 'secret-like material embedded in evidence reference', (candidate) => {
    candidate.gates.realExternalOidc.evidenceRef = 'evidence://release/sk-proj-abcdef123456';
  });
  expectRejected(template, 'committed template authorization drift', (candidate) => {
    candidate.productionAuthorized = true;
  }, { requireTemplate: true });
}

function parseArguments(argv) {
  let file = TEMPLATE_PATH;
  let expectedCommit = null;
  let requireTemplate = false;
  let selfTest = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--file') {
      file = argv[index + 1];
      if (!file) fail('--file requires a path');
      index += 1;
    } else if (argument === '--expected-commit') {
      expectedCommit = argv[index + 1];
      if (!expectedCommit) fail('--expected-commit requires a Git SHA');
      index += 1;
    } else if (argument === '--template') {
      requireTemplate = true;
    } else if (argument === '--self-test') {
      selfTest = true;
    } else {
      fail(`unknown CLI argument: ${argument}`);
    }
  }

  return { file, expectedCommit, requireTemplate, selfTest };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArguments(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(options.file, 'utf8'));
  validateProductionActivationEvidence(manifest, {
    expectedCommit: options.expectedCommit,
    requireTemplate: options.requireTemplate,
  });
  if (options.selfTest) {
    const template = JSON.parse(readFileSync(TEMPLATE_PATH, 'utf8'));
    runSelfTests(template);
  }
  console.log('Production activation evidence validation passed.');
}
