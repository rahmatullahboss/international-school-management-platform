#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const apply = args.includes('--apply');
const secretsFile = option('--secrets-file');
const oidcConfigFile = option('--oidc-config');

if (secretsFile === undefined || oidcConfigFile === undefined) {
  throw new Error(
    'Usage: node scripts/deploy-staging-runtime.mjs --secrets-file <external-0600-file> --oidc-config <reviewed-json> [--apply]',
  );
}

const workspaceRoot = resolve('.');
const resolvedSecretsFile = resolve(secretsFile);
const resolvedOidcConfigFile = resolve(oidcConfigFile);
if (resolvedSecretsFile.startsWith(`${workspaceRoot}/`)) {
  throw new Error('The staging secret file must live outside the repository workspace.');
}

const secretStat = await stat(resolvedSecretsFile);
if (!secretStat.isFile()) throw new Error('The staging secret path is not a regular file.');
if ((secretStat.mode & 0o077) !== 0) {
  throw new Error('The staging secret file must not be readable or writable by group/other users.');
}
if (secretStat.size === 0) throw new Error('The staging secret file is empty.');

const config = JSON.parse(await readFile(resolvedOidcConfigFile, 'utf8'));
const browser = config?.browser;
const mobile = config?.mobile;

function exactHttpsUrl(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || value === '') {
    throw new Error(`${label} must be a non-empty reviewed string.`);
  }
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.hash !== '') {
    throw new Error(`${label} must be an exact HTTPS URL without credentials or a fragment.`);
  }
  return url;
}

function exactHttpsOrigin(value, label) {
  const url = exactHttpsUrl(value, label);
  if (url.pathname !== '/' || url.search !== '' || value !== url.origin) {
    throw new Error(`${label} must be an exact HTTPS origin.`);
  }
  return url.origin;
}

for (const [label, value] of [
  ['browser.clientId', browser?.clientId],
  ['mobile.audience', mobile?.audience],
]) {
  if (typeof value !== 'string' || value.trim() !== value || value === '' || /\s/u.test(value)) {
    throw new Error(`${label} must be a non-empty reviewed value without whitespace.`);
  }
}

const browserIssuer = exactHttpsUrl(browser?.issuer, 'browser.issuer');
if (browser.issuer.endsWith('/'))
  throw new Error('browser.issuer must not include a trailing slash.');
const authorizationEndpoint = exactHttpsUrl(
  browser?.authorizationEndpoint,
  'browser.authorizationEndpoint',
);
const tokenEndpoint = exactHttpsUrl(browser?.tokenEndpoint, 'browser.tokenEndpoint');
const browserJwks = exactHttpsUrl(browser?.jwksUri, 'browser.jwksUri');
const browserRedirect = exactHttpsUrl(browser?.redirectUri, 'browser.redirectUri');
const expectedBrowserRedirect =
  'https://international-school-platform-api-staging.rahmatullahzisan.workers.dev/auth/v1/callback';
if (browserRedirect.toString() !== expectedBrowserRedirect) {
  throw new Error('browser.redirectUri must match the exact school staging API callback.');
}

if (!Array.isArray(browser?.endpointOrigins) || browser.endpointOrigins.length === 0) {
  throw new Error('browser.endpointOrigins must contain reviewed HTTPS origins.');
}
const endpointOrigins = browser.endpointOrigins.map((origin, index) =>
  exactHttpsOrigin(origin, `browser.endpointOrigins[${index}]`),
);
for (const endpoint of [browserIssuer, authorizationEndpoint, tokenEndpoint, browserJwks]) {
  if (!endpointOrigins.includes(endpoint.origin)) {
    throw new Error(`browser.endpointOrigins does not pin ${endpoint.origin}.`);
  }
}

exactHttpsUrl(mobile?.issuer, 'mobile.issuer');
if (mobile.issuer.endsWith('/'))
  throw new Error('mobile.issuer must not include a trailing slash.');
const mobileJwks = exactHttpsUrl(mobile?.jwksUri, 'mobile.jwksUri');
const mobileJwksOrigin = exactHttpsOrigin(mobile?.jwksOrigin, 'mobile.jwksOrigin');
if (mobileJwks.origin !== mobileJwksOrigin) {
  throw new Error('mobile.jwksOrigin must exactly match the mobile JWKS origin.');
}

const wranglerArgs = [
  'wrangler',
  'deploy',
  '--config',
  'apps/platform-api/wrangler.jsonc',
  '--env',
  'staging',
  '--secrets-file',
  resolvedSecretsFile,
  '--var',
  `OIDC_ISSUER:${browser.issuer}`,
  '--var',
  `OIDC_CLIENT_ID:${browser.clientId}`,
  '--var',
  `OIDC_AUTHORIZATION_ENDPOINT:${browser.authorizationEndpoint}`,
  '--var',
  `OIDC_TOKEN_ENDPOINT:${browser.tokenEndpoint}`,
  '--var',
  `OIDC_JWKS_URI:${browser.jwksUri}`,
  '--var',
  `OIDC_REDIRECT_URI:${browser.redirectUri}`,
  '--var',
  `OIDC_ENDPOINT_ORIGINS:${endpointOrigins.join(',')}`,
  '--var',
  `MOBILE_OIDC_ISSUER:${mobile.issuer}`,
  '--var',
  `MOBILE_OIDC_AUDIENCE:${mobile.audience}`,
  '--var',
  `MOBILE_OIDC_JWKS_URI:${mobile.jwksUri}`,
  '--var',
  `MOBILE_OIDC_JWKS_ORIGIN:${mobileJwksOrigin}`,
];
if (!apply) wranglerArgs.push('--dry-run');

function run(command, commandArgs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: workspaceRoot,
      env: process.env,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with ${code ?? signal ?? 'unknown status'}.`));
    });
  });
}

console.log(
  apply
    ? 'Applying reviewed staging runtime configuration.'
    : 'Validating reviewed staging runtime configuration with Wrangler dry-run.',
);
await run('npx', wranglerArgs);

if (apply) {
  await run('node', ['scripts/verify-staging-runtime-readiness.mjs', '--expect', 'qa-ready']);
}
