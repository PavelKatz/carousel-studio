// Render composed HTML strings to PNGs via headless Chromium (Playwright).
// Generalizes the proven export-series-a.mjs pattern: native-size .stage,
// deviceScaleFactor for crispness, document.fonts.ready before screenshot.

import { chromium } from 'playwright';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function px(v, fallback) {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function renderSlides(composed, { outDir, scale = 2, format = 'png', debugHtmlDir = null, canvas = {} }) {
  await mkdir(outDir, { recursive: true });
  const htmlDir = debugHtmlDir || (await mkdtemp(join(tmpdir(), 'carousel-')));
  if (debugHtmlDir) await mkdir(debugHtmlDir, { recursive: true });

  const cw = px(canvas.width, 1080);
  const ch = px(canvas.height, 1350);

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const results = [];
  try {
    const context = await browser.newContext({
      viewport: { width: cw, height: ch },
      deviceScaleFactor: scale,
    });
    const page = await context.newPage();

    for (const slide of composed) {
      const htmlPath = join(htmlDir, `${slide.name}.html`);
      await writeFile(htmlPath, slide.html, 'utf8');
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle', timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);

      const outPath = join(outDir, `${slide.name}.${format}`);
      const stage = page.locator('.stage');
      await stage.screenshot({ path: outPath, type: format === 'jpg' ? 'jpeg' : format });
      results.push({ outPath, w: cw * scale, h: ch * scale });
    }
  } finally {
    await browser.close();
    if (!debugHtmlDir) await rm(htmlDir, { recursive: true, force: true });
  }
  return results;
}
