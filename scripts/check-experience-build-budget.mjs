import { access, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = path.join(repositoryRoot, 'apps/platform-web/dist');
const assetsDirectory = path.join(distDirectory, 'assets');
const budgets = Object.freeze({
  javascriptBytes: 250_000,
  cssBytes: 50_000,
});
const requiredPwaFiles = [
  'manifest.webmanifest',
  'offline.html',
  'sw.js',
  'icons/school-platform-192.svg',
  'icons/school-platform-512.svg',
];

async function totalBytesForExtension(extension) {
  const entries = await readdir(assetsDirectory, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name) !== extension) continue;
    total += (await stat(path.join(assetsDirectory, entry.name))).size;
  }
  return total;
}

const [javascriptBytes, cssBytes] = await Promise.all([
  totalBytesForExtension('.js'),
  totalBytesForExtension('.css'),
]);
await Promise.all(requiredPwaFiles.map((file) => access(path.join(distDirectory, file))));

const violations = [];
if (javascriptBytes > budgets.javascriptBytes) {
  violations.push(
    `Platform web JavaScript is ${javascriptBytes} bytes; budget is ${budgets.javascriptBytes} bytes.`,
  );
}
if (cssBytes > budgets.cssBytes) {
  violations.push(`Platform web CSS is ${cssBytes} bytes; budget is ${budgets.cssBytes} bytes.`);
}

console.log(
  JSON.stringify(
    {
      platformWeb: {
        javascriptBytes,
        cssBytes,
        requiredPwaFiles,
      },
      budgets,
      violations,
    },
    null,
    2,
  ),
);

if (violations.length > 0) process.exitCode = 1;
