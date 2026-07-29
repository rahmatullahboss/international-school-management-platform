import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = path.join(repositoryRoot, 'apps/platform-web/dist');
const assetsDirectory = path.join(distDirectory, 'assets');
const indexPath = path.join(distDirectory, 'index.html');
const budgets = Object.freeze({
  initialJavascriptBytes: 250_000,
  initialCssBytes: 50_000,
  totalJavascriptBytes: 350_000,
  totalCssBytes: 85_000,
});
const requiredPwaFiles = [
  'manifest.webmanifest',
  'offline.html',
  'sw.js',
  'icons/school-platform-192.svg',
  'icons/school-platform-512.svg',
];

async function assetEntries() {
  const entries = await readdir(assetsDirectory, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile());
}

async function totalBytesForExtension(entries, extension) {
  let total = 0;
  for (const entry of entries) {
    if (path.extname(entry.name) !== extension) continue;
    total += (await stat(path.join(assetsDirectory, entry.name))).size;
  }
  return total;
}

function initialAssetNames(indexHtml, extension) {
  const matches = indexHtml.matchAll(/(?:src|href)=["']\/?(assets\/[^"']+)["']/gu);
  return [...matches]
    .map((match) => match[1])
    .filter((assetPath) => path.extname(assetPath) === extension)
    .map((assetPath) => path.basename(assetPath));
}

async function bytesForAssetNames(names) {
  let total = 0;
  for (const name of new Set(names)) {
    total += (await stat(path.join(assetsDirectory, name))).size;
  }
  return total;
}

const [entries, indexHtml] = await Promise.all([
  assetEntries(),
  readFile(indexPath, 'utf8'),
  ...requiredPwaFiles.map((file) => access(path.join(distDirectory, file))),
]);

const [totalJavascriptBytes, totalCssBytes, initialJavascriptBytes, initialCssBytes] =
  await Promise.all([
    totalBytesForExtension(entries, '.js'),
    totalBytesForExtension(entries, '.css'),
    bytesForAssetNames(initialAssetNames(indexHtml, '.js')),
    bytesForAssetNames(initialAssetNames(indexHtml, '.css')),
  ]);

const violations = [];
if (initialJavascriptBytes > budgets.initialJavascriptBytes) {
  violations.push(
    `Platform web initial JavaScript is ${initialJavascriptBytes} bytes; budget is ${budgets.initialJavascriptBytes} bytes.`,
  );
}
if (initialCssBytes > budgets.initialCssBytes) {
  violations.push(
    `Platform web initial CSS is ${initialCssBytes} bytes; budget is ${budgets.initialCssBytes} bytes.`,
  );
}
if (totalJavascriptBytes > budgets.totalJavascriptBytes) {
  violations.push(
    `Platform web total JavaScript is ${totalJavascriptBytes} bytes; budget is ${budgets.totalJavascriptBytes} bytes.`,
  );
}
if (totalCssBytes > budgets.totalCssBytes) {
  violations.push(
    `Platform web total CSS is ${totalCssBytes} bytes; budget is ${budgets.totalCssBytes} bytes.`,
  );
}

console.log(
  JSON.stringify(
    {
      platformWeb: {
        initialJavascriptBytes,
        initialCssBytes,
        totalJavascriptBytes,
        totalCssBytes,
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
