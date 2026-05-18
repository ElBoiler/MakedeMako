// Copies UMD browser bundles from node_modules into vendor/ for the extension.
// Re-run after `npm install` to refresh.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const copies = [
  ['node_modules/pizzip/dist/pizzip.min.js',                 'vendor/pizzip.js'],
  ['node_modules/docxtemplater/build/docxtemplater.js',      'vendor/docxtemplater.js'],
  ['node_modules/pdf-lib/dist/pdf-lib.min.js',               'vendor/pdf-lib.min.js'],
  ['node_modules/exceljs/dist/exceljs.min.js',               'vendor/exceljs.min.js'],
];

await mkdir(resolve(root, 'vendor'), { recursive: true });
for (const [from, to] of copies) {
  await copyFile(resolve(root, from), resolve(root, to));
  console.log(`copied ${from} → ${to}`);
}
