#!/usr/bin/env node
// CLI for the carousel renderer.
//
//   node src/cli.mjs --slides <slides.json> --tokens <tokens.json> --out <dir> \
//        [--templates <dir>] [--fonts <dir>] [--scale 2] [--format png] [--debug-html <dir>]
//
// Prints one `OK <path> <w>x<h>` line per slide. Exit 1 on schema/asset error.

import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SlidesSchema, TokensSchema, normalizeSlides } from './schema.mjs';
import { composeAll, createEnv } from './compose.mjs';
import { renderSlides } from './render.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function fail(msg) {
  console.error(`ERR ${msg}`);
  process.exit(1);
}

function readJson(label, p) {
  let raw;
  try {
    raw = readFileSync(p, 'utf8');
  } catch (e) {
    fail(`cannot read ${label}: ${p} (${e.code || e.message})`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`invalid JSON in ${label} (${p}): ${e.message}`);
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      slides: { type: 'string' },
      tokens: { type: 'string' },
      out: { type: 'string' },
      templates: { type: 'string' },
      fonts: { type: 'string' },
      scale: { type: 'string', default: '2' },
      format: { type: 'string', default: 'png' },
      'debug-html': { type: 'string' },
    },
  });

  if (!values.slides || !values.tokens || !values.out) {
    fail('required: --slides <file> --tokens <file> --out <dir>');
  }

  const slidesPath = resolve(values.slides);
  const tokensPath = resolve(values.tokens);
  const outDir = resolve(values.out);
  const templatesDir = values.templates ? resolve(values.templates) : join(ROOT, 'templates');
  const fontsDir = values.fonts ? resolve(values.fonts) : join(ROOT, 'fonts');
  const scale = Math.max(1, parseInt(values.scale, 10) || 2);
  const format = values.format || 'png';
  const debugHtmlDir = values['debug-html'] ? resolve(values['debug-html']) : null;

  // Load + validate
  const tokensParsed = TokensSchema.safeParse(readJson('tokens', tokensPath));
  if (!tokensParsed.success) fail(`tokens schema: ${tokensParsed.error.issues[0]?.path?.join('.')} — ${tokensParsed.error.issues[0]?.message}`);
  const tokens = tokensParsed.data;

  const slidesParsed = SlidesSchema.safeParse(readJson('slides', slidesPath));
  if (!slidesParsed.success) {
    const iss = slidesParsed.error.issues[0];
    fail(`slides schema: ${iss?.path?.join('.')} — ${iss?.message}`);
  }
  const slides = normalizeSlides(slidesParsed.data);

  const env = createEnv(templatesDir);
  let composed;
  try {
    composed = composeAll({
      tokens,
      slides,
      env,
      fontsDir,
      tokensDir: dirname(tokensPath),
      slidesDir: dirname(slidesPath),
    });
  } catch (e) {
    fail(`compose failed: ${e.message}`);
  }

  let results;
  try {
    results = await renderSlides(composed, {
      outDir,
      scale,
      format,
      debugHtmlDir,
      canvas: { width: tokens.canvas?.width, height: tokens.canvas?.height },
    });
  } catch (e) {
    fail(`render failed: ${e.message}`);
  }

  for (const r of results) console.log(`OK ${r.outPath} ${r.w}x${r.h}`);
  console.log(`DONE ${results.length} slides → ${outDir}`);
}

main().catch((e) => fail(e.stack || e.message));
