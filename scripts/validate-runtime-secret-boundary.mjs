import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = 'apps/platform-api/src';
const REVIEWED_OPERATIONAL_LOG_SINK = 'apps/platform-api/src/runtime-operational-log.ts';
const MAX_REPORTED_VIOLATIONS = 40;

function runtimeSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...runtimeSourceFiles(path));
      continue;
    }
    if (!entry.isFile() || extname(entry.name) !== '.ts') continue;
    if (
      entry.name.endsWith('.test.ts') ||
      entry.name.endsWith('.spec.ts') ||
      entry.name.endsWith('.d.ts')
    ) {
      continue;
    }
    files.push(path);
  }
  return files.sort();
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function addRegexViolations(violations, file, source, reason, expression) {
  for (const match of source.matchAll(expression)) {
    violations.push({
      file,
      line: lineNumber(source, match.index ?? 0),
      reason,
    });
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function auditReviewedOperationalLogSink(file, source) {
  const violations = [];
  const consoleCalls = [
    ...source.matchAll(/\bconsole\s*\.\s*(?:log|error|warn|info|debug)\s*\(/gu),
  ];
  const exactSinkCall = 'console.log(JSON.stringify(observation));';

  if (consoleCalls.length !== 1 || !source.includes(exactSinkCall)) {
    violations.push({ file, line: 1, reason: 'reviewed-log-sink-shape-drift' });
  }

  const forbiddenSinkPatterns = [
    /\bresolution\s*\.\s*(?:message|stack|cause)\b/gu,
    /\bJSON\s*\.\s*stringify\s*\(\s*resolution\b/gu,
    /\.\.\.\s*resolution\b/gu,
    /\b(?:DATABASE_URL|authorization|cookie|password|secret|token|request|environment)\b/giu,
  ];
  for (const expression of forbiddenSinkPatterns) {
    addRegexViolations(violations, file, source, 'reviewed-log-sink-sensitive-field', expression);
  }

  return violations;
}

export function auditRuntimeSource(file, source) {
  const violations = [];

  if (file === REVIEWED_OPERATIONAL_LOG_SINK) {
    violations.push(...auditReviewedOperationalLogSink(file, source));
  } else {
    addRegexViolations(
      violations,
      file,
      source,
      'direct-console-output',
      /\bconsole\s*\.\s*(?:log|error|warn|info|debug)\s*\(/gu,
    );
  }

  addRegexViolations(
    violations,
    file,
    source,
    'raw-request-or-environment-serialization',
    /\bJSON\s*\.\s*stringify\s*\(\s*(?:context\s*\.\s*env|environment\b|request\b|context\s*\.\s*req\b)/gu,
  );

  const catchPattern = /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{/gu;
  for (const match of source.matchAll(catchPattern)) {
    const exceptionName = match[1];
    if (exceptionName === undefined) continue;
    const start = match.index ?? 0;
    const inspectionWindow = source.slice(start, Math.min(source.length, start + 1200));
    const escapedName = escapeRegExp(exceptionName);
    const detailPattern = new RegExp(
      `\\b${escapedName}\\s*(?:\\.\\s*(?:message|stack|cause)\\b|\\)|,)`,
      'u',
    );
    const stringPattern = new RegExp(`\\bString\\s*\\(\\s*${escapedName}\\s*\\)`, 'u');
    if (detailPattern.test(inspectionWindow) || stringPattern.test(inspectionWindow)) {
      violations.push({
        file,
        line: lineNumber(source, start),
        reason: 'caught-exception-detail-output',
      });
    }
  }

  return violations;
}

function runSelfTests() {
  const clean = auditRuntimeSource(
    'clean.ts',
    'try { await work(); } catch { return stableInternalErrorResponse(); }\nJSON.stringify({ ok: true });',
  );
  if (clean.length !== 0) {
    throw new Error('runtime secret-boundary clean self-test failed');
  }

  const cleanSink = auditRuntimeSource(
    REVIEWED_OPERATIONAL_LOG_SINK,
    "const observation = resolution.ok ? { event: 'runtime_projection_batch', ok: true, claimed: resolution.result.claimed } : { event: 'runtime_projection_batch', ok: false, code: resolution.code };\nconsole.log(JSON.stringify(observation));",
  );
  if (cleanSink.length !== 0) {
    throw new Error('runtime secret-boundary reviewed sink self-test failed');
  }

  const cases = [
    {
      reason: 'direct-console-output',
      file: 'unsafe.ts',
      source: 'console.error({ request, environment });',
    },
    {
      reason: 'raw-request-or-environment-serialization',
      file: 'unsafe.ts',
      source: 'const payload = JSON.stringify(context.env);',
    },
    {
      reason: 'caught-exception-detail-output',
      file: 'unsafe.ts',
      source: 'try { work(); } catch (failure) { return new Response(failure.message); }',
    },
    {
      reason: 'reviewed-log-sink-sensitive-field',
      file: REVIEWED_OPERATIONAL_LOG_SINK,
      source:
        "const observation = { event: 'runtime_projection_batch', message: resolution.message };\nconsole.log(JSON.stringify(observation));",
    },
  ];

  for (const testCase of cases) {
    const violations = auditRuntimeSource(testCase.file, testCase.source);
    if (!violations.some((violation) => violation.reason === testCase.reason)) {
      throw new Error(`runtime secret-boundary self-test missed ${testCase.reason}`);
    }
  }
}

runSelfTests();

const violations = [];
for (const path of runtimeSourceFiles(ROOT)) {
  const source = readFileSync(path, 'utf8');
  violations.push(...auditRuntimeSource(relative('.', path), source));
}

if (violations.length > 0) {
  const rendered = violations
    .slice(0, MAX_REPORTED_VIOLATIONS)
    .map((violation) => `${violation.reason}|${violation.file}:${violation.line}`)
    .join('\n');
  process.stderr.write(`Runtime secret-boundary violations:\n${rendered}\n`);
  if (violations.length > MAX_REPORTED_VIOLATIONS) {
    process.stderr.write(
      `... ${violations.length - MAX_REPORTED_VIOLATIONS} additional violations omitted.\n`,
    );
  }
  process.exit(1);
}

process.stdout.write('Runtime secret-boundary source validation passed.\n');
