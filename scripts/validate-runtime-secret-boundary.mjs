import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = 'apps/platform-api/src';
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

export function auditRuntimeSource(file, source) {
  const violations = [];

  addRegexViolations(
    violations,
    file,
    source,
    'direct-console-output',
    /\bconsole\s*\.\s*(?:log|error|warn|info|debug)\s*\(/gu,
  );

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

  const cases = [
    {
      reason: 'direct-console-output',
      source: 'console.error({ request, environment });',
    },
    {
      reason: 'raw-request-or-environment-serialization',
      source: 'const payload = JSON.stringify(context.env);',
    },
    {
      reason: 'caught-exception-detail-output',
      source: 'try { work(); } catch (failure) { return new Response(failure.message); }',
    },
  ];

  for (const testCase of cases) {
    const violations = auditRuntimeSource('unsafe.ts', testCase.source);
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
