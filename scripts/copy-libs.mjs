/**
 * copy-libs.mjs
 * Copies browser-bundle files for pptxgenjs, xlsx, and docx from node_modules
 * into client/public/libs/ so they are served as local static assets.
 *
 * Run: node scripts/copy-libs.mjs
 * Also called automatically via the "copy-libs" npm script before builds.
 */

import { copyFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DEST = resolve(ROOT, 'client/public/libs');

mkdirSync(DEST, { recursive: true });

const LIBS = [
  {
    src:  'node_modules/pptxgenjs/dist/pptxgen.bundle.js',
    dest: 'pptxgen.bundle.js',
  },
  {
    src:  'node_modules/xlsx/dist/xlsx.full.min.js',
    dest: 'xlsx.full.min.js',
  },
  {
    src:  'node_modules/docx/dist/index.iife.js',
    dest: 'docx.iife.js',
  },
];

for (const { src, dest } of LIBS) {
  const from = resolve(ROOT, src);
  const to   = resolve(DEST, dest);
  copyFileSync(from, to);
  console.log(`  copied  ${src.split('/').pop()}  →  client/public/libs/${dest}`);
}

console.log('Done.');
