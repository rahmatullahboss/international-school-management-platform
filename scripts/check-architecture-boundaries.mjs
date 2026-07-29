import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const workspaceRoots = ['apps', 'packages'];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const importPattern = /(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/gu;

const compositionDependencies = new Map([
  [
    '@school/platform-web',
    new Set([
      '@school/web-admin',
      '@school/web-teacher',
      '@school/web-family',
      '@school/web-student',
    ]),
  ],
]);

function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

async function hasManifest(directory) {
  try {
    await access(path.join(directory, 'package.json'));
    return true;
  } catch {
    return false;
  }
}

async function packageDirectories(parent) {
  const packages = [];

  async function visit(directory) {
    if (await hasManifest(directory)) {
      packages.push(directory);
      return;
    }

    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || ['dist', 'node_modules', 'coverage'].includes(entry.name)) {
        continue;
      }
      await visit(path.join(directory, entry.name));
    }
  }

  await visit(path.join(root, parent));
  return packages;
}

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['dist', 'node_modules', 'coverage'].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(absolute)));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

const failures = [];
for (const workspaceRoot of workspaceRoots) {
  for (const directory of await packageDirectories(workspaceRoot)) {
    const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
    const declared = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]);
    const allowedCompositionDependencies = compositionDependencies.get(manifest.name) ?? new Set();

    for (const file of await sourceFiles(directory)) {
      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];
        if (!specifier) continue;
        const importedPackage = packageName(specifier);
        if (
          specifier.startsWith('@school/') &&
          importedPackage !== manifest.name &&
          !declared.has(importedPackage) &&
          !allowedCompositionDependencies.has(importedPackage)
        ) {
          failures.push(
            `${path.relative(root, file)} imports undeclared workspace dependency ${specifier}`,
          );
        }
        if (specifier.startsWith('.')) {
          const resolved = path.resolve(path.dirname(file), specifier);
          const relative = path.relative(directory, resolved);
          if (relative.startsWith('..') || path.isAbsolute(relative)) {
            failures.push(
              `${path.relative(root, file)} crosses its package boundary via ${specifier}`,
            );
          }
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('architecture boundary validation: PASS');
}
