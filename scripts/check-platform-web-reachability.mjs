import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const webRoot = path.join(root, 'apps/platform-web');
const sourceRoot = path.join(webRoot, 'src');
const sourceExtensions = ['.ts', '.tsx'];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(absolute)));
      continue;
    }
    if (!sourceExtensions.includes(path.extname(entry.name))) continue;
    if (/\.(?:test|spec)\.tsx?$/u.test(entry.name) || entry.name.endsWith('.d.ts')) continue;
    files.push(absolute);
  }
  return files;
}

function localSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gu,
    /\bexport\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]/gu,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
    /\bnew\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/gu,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier?.startsWith('.')) specifiers.add(specifier);
    }
  }
  return [...specifiers];
}

async function resolveSourceImport(fromFile, specifier) {
  const cleanSpecifier = specifier.split(/[?#]/u, 1)[0];
  if (cleanSpecifier === undefined || cleanSpecifier === '') return undefined;
  const base = path.resolve(path.dirname(fromFile), cleanSpecifier);
  const extension = path.extname(base);

  if (extension !== '') {
    if (sourceExtensions.includes(extension) && (await exists(base))) return base;
    if (extension === '.js' || extension === '.jsx') {
      const withoutExtension = base.slice(0, -extension.length);
      for (const candidateExtension of sourceExtensions) {
        const candidate = `${withoutExtension}${candidateExtension}`;
        if (await exists(candidate)) return candidate;
      }
    }
    return undefined;
  }

  for (const candidateExtension of sourceExtensions) {
    const candidate = `${base}${candidateExtension}`;
    if (await exists(candidate)) return candidate;
  }
  for (const candidateExtension of sourceExtensions) {
    const candidate = path.join(base, `index${candidateExtension}`);
    if (await exists(candidate)) return candidate;
  }
  return undefined;
}

function webPath(relativePath) {
  return path.join(webRoot, relativePath.replace(/^\.\//u, ''));
}

const indexHtml = await readFile(path.join(webRoot, 'index.html'), 'utf8');
const htmlEntryMatch = indexHtml.match(
  /<script\b[^>]*\btype=['"]module['"][^>]*\bsrc=['"]([^'"]+)['"]/u,
);
if (htmlEntryMatch?.[1] === undefined) {
  console.error('platform web reachability: no module entry found in apps/platform-web/index.html');
  process.exit(1);
}
const htmlEntry = path.join(webRoot, htmlEntryMatch[1].replace(/^\//u, ''));

const wrangler = await readFile(path.join(webRoot, 'wrangler.jsonc'), 'utf8');
const workerEntryMatch = wrangler.match(/"main"\s*:\s*"([^"]+)"/u);
if (workerEntryMatch?.[1] === undefined) {
  console.error(
    'platform web reachability: no worker entry found in apps/platform-web/wrangler.jsonc',
  );
  process.exit(1);
}
const workerEntry = webPath(workerEntryMatch[1]);

const roots = [htmlEntry, workerEntry];
for (const entry of roots) {
  if (!(await exists(entry))) {
    console.error(
      `platform web reachability: configured entry does not exist: ${path.relative(root, entry)}`,
    );
    process.exit(1);
  }
}

const reachable = new Set();
const unresolved = [];
const queue = [...roots];
while (queue.length > 0) {
  const file = queue.shift();
  if (file === undefined || reachable.has(file)) continue;
  reachable.add(file);
  const source = await readFile(file, 'utf8');
  for (const specifier of localSpecifiers(source)) {
    const resolved = await resolveSourceImport(file, specifier);
    if (resolved === undefined) {
      const extension = path.extname(specifier.split(/[?#]/u, 1)[0] ?? '');
      if (extension === '' || sourceExtensions.includes(extension) || extension === '.js') {
        unresolved.push(`${path.relative(root, file)} -> ${specifier}`);
      }
      continue;
    }
    const relativeToSource = path.relative(sourceRoot, resolved);
    if (relativeToSource.startsWith('..') || path.isAbsolute(relativeToSource)) continue;
    if (!reachable.has(resolved)) queue.push(resolved);
  }
}

const runtimeSources = await sourceFiles(sourceRoot);
const orphaned = runtimeSources.filter((file) => !reachable.has(file));
const failures = [];
if (unresolved.length > 0) {
  failures.push('Unresolved local source imports:', ...unresolved.map((item) => `  - ${item}`));
}
if (orphaned.length > 0) {
  failures.push(
    'Runtime source files unreachable from the Vite or Cloudflare worker entry:',
    ...orphaned.map((file) => `  - ${path.relative(root, file)}`),
  );
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `platform web reachability validation: PASS (${runtimeSources.length} runtime source files reachable from ${roots
      .map((entry) => path.relative(root, entry))
      .join(', ')})`,
  );
}
