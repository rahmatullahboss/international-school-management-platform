#!/usr/bin/env node

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};

const apiUrl = option(
  '--api-url',
  'https://international-school-platform-api-staging.rahmatullahzisan.workers.dev',
).replace(/\/+$/u, '');
const expected = option('--expect', 'auto');

if (!['auto', 'fail-closed', 'qa-ready'].includes(expected)) {
  throw new Error(`Unsupported --expect value: ${expected}`);
}

async function readJson(path) {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { 'cache-control': 'no-cache' },
    redirect: 'error',
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${path} did not return JSON (HTTP ${response.status}).`);
  }
  if (response.status !== 200) {
    throw new Error(`${path} returned HTTP ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function requireReadinessShape(label, payload) {
  if (payload?.schemaVersion !== 1 || !Array.isArray(payload.missingConfiguration)) {
    throw new Error(`${label} readiness response has an unexpected shape.`);
  }
}

const [health, auth, projection, mobile] = await Promise.all([
  readJson('/health'),
  readJson('/auth/v1/readiness'),
  readJson('/auth/v1/runtime-projection-worker/readiness'),
  readJson('/v1/mobile/readiness'),
]);

if (health?.status !== 'ok' || health?.environment !== 'staging') {
  throw new Error(`Staging health is not green: ${JSON.stringify(health)}`);
}
requireReadinessShape('browser auth', auth);
requireReadinessShape('projection worker', projection);
requireReadinessShape('mobile auth', mobile);

const authReady = auth.state === 'provider-test-ready' && auth.missingConfiguration.length === 0;
const projectionReady =
  projection.state === 'ready' && projection.missingConfiguration.length === 0;
const mobileReady = mobile.state === 'ready' && mobile.missingConfiguration.length === 0;
const qaReady = authReady && projectionReady && mobileReady;

const authFailClosed =
  ['disabled', 'incomplete'].includes(auth.state) && auth.loginEnabled === false && !authReady;
const projectionFailClosed =
  ['disabled', 'incomplete'].includes(projection.state) && !projectionReady;
const mobileFailClosed =
  ['disabled', 'incomplete'].includes(mobile.state) &&
  mobile.tokenValidationEnabled === false &&
  !mobileReady;
const failClosed = authFailClosed && projectionFailClosed && mobileFailClosed;

let classification = 'partial';
if (qaReady) classification = 'qa-ready';
else if (failClosed) classification = 'fail-closed';

const summary = {
  apiUrl,
  classification,
  health: health.status,
  browserAuth: {
    state: auth.state,
    missingConfiguration: auth.missingConfiguration,
  },
  projectionWorker: {
    state: projection.state,
    missingConfiguration: projection.missingConfiguration,
  },
  mobileAuth: {
    state: mobile.state,
    missingConfiguration: mobile.missingConfiguration,
  },
};
console.log(JSON.stringify(summary, null, 2));

if (expected !== 'auto' && classification !== expected) {
  throw new Error(`Expected staging classification ${expected}, observed ${classification}.`);
}

if (classification === 'partial') {
  process.exitCode = 2;
}
