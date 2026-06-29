// Compose each slide spec + tokens into a self-contained HTML string.
// All subresources (fonts, logo, motifs, background images) are resolved to
// absolute file:// URLs so the HTML renders identically regardless of where the
// temp file is written.

import nunjucks from 'nunjucks';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildTokenCss, colorRef, leaf } from './tokens.mjs';

export function createEnv(templatesDir) {
  return nunjucks.configure(templatesDir, { autoescape: true, noCache: true, trimBlocks: true, lstripBlocks: true });
}

const isUrl = (s) => /^(https?:|file:|data:)/i.test(s);

function fileUrl(p, baseDir) {
  if (!p) return null;
  if (isUrl(p)) return p;
  const abs = isAbsolute(p) ? p : resolve(baseDir, p);
  return pathToFileURL(abs).href;
}

// Read fonts/fonts.css and rewrite relative url(file.woff2) -> absolute file://.
export function buildFontFaceCss(fontsDir) {
  let css;
  try {
    css = readFileSync(join(fontsDir, 'fonts.css'), 'utf8');
  } catch {
    return '/* no fonts.css — run `npm run fonts` to bundle webfonts */';
  }
  return css.replace(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/g, (_m, f) => {
    if (isUrl(f)) return `url(${f})`;
    return `url(${pathToFileURL(join(fontsDir, f)).href})`;
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Escape text, then wrap any highlight substrings in an accent plaque.
function renderText(text, highlights) {
  if (text === undefined || text === null) return text;
  let out = escapeHtml(text);
  for (const h of highlights || []) {
    if (!h) continue;
    const safe = escapeHtml(h);
    out = out.split(safe).join(`<span class="plaque">${safe}</span>`);
  }
  // allow soft line breaks authored as "\n"
  return out.replace(/\n/g, '<br>');
}

// Walk slot values, turning strings into highlighted HTML and arrays of strings
// into arrays of highlighted HTML. Non-string scalars (booleans/numbers) pass through.
function renderSlots(slots, highlights) {
  const out = {};
  for (const [k, v] of Object.entries(slots || {})) {
    if (Array.isArray(v)) out[k] = v.map((x) => (typeof x === 'string' ? renderText(x, highlights) : x));
    else if (typeof v === 'string') out[k] = renderText(v, highlights);
    else out[k] = v;
  }
  return out;
}

function resolveBackground(slide, slidesDir) {
  const bg = slide.background || { mode: 'solid' };
  if (bg.mode === 'image' && bg.image) {
    if (!isUrl(bg.image)) {
      const abs = isAbsolute(bg.image) ? bg.image : resolve(slidesDir, bg.image);
      if (!existsSync(abs)) throw new Error(`background image not found: ${abs}`);
    }
    return { slideBg: colorRef(bg.color || 'bg'), bgImage: fileUrl(bg.image, slidesDir), bgOverlay: bg.overlay ? resolveColor(bg.overlay) : null };
  }
  if (bg.mode === 'gradient' && bg.gradient) {
    const angle = bg.gradient.angle || '160deg';
    const stops = bg.gradient.stops.map(resolveColor).join(', ');
    return { slideBg: `linear-gradient(${angle}, ${stops})`, bgImage: null, bgOverlay: null };
  }
  return { slideBg: colorRef(bg.color || 'bg'), bgImage: null, bgOverlay: null };
}

function resolveColor(c) {
  if (typeof c === 'string' && (c.startsWith('#') || c.startsWith('rgb') || c.startsWith('hsl'))) return c;
  return colorRef(c);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function composeAll({ tokens, slides, env, fontsDir, tokensDir, slidesDir }) {
  const fontFaceCss = buildFontFaceCss(fontsDir);
  const tokenVars = buildTokenCss(tokens);
  const total = slides.length;

  // Logo config from tokens (shown only on templates listed in layout.logo.showOn).
  const logoCfg = (tokens.layout && tokens.layout.logo) || null;

  return slides.map((slide, i) => {
    const idx = i + 1;
    const name = slide.name || `${pad2(idx)}-${slide.template}`;
    const { slideBg, bgImage, bgOverlay } = resolveBackground(slide, slidesDir);

    let logo = null;
    if (logoCfg && logoCfg.asset && (logoCfg.showOn || []).includes(slide.template)) {
      const assetRel = leaf(logoCfg.asset);
      const abs = isUrl(assetRel) ? null : (isAbsolute(assetRel) ? assetRel : resolve(tokensDir, assetRel));
      if (abs && !existsSync(abs)) {
        console.error(`WARN logo asset not found, skipping on ${slide.template}: ${abs}`);
      } else {
        logo = { src: fileUrl(assetRel, tokensDir), placement: logoCfg.placement || 'bottom-left', width: leaf(logoCfg.width) || '180px' };
      }
    }

    const showPage = slide.showPageNum !== false && slide.template !== 'cover';
    const pageNum = showPage ? `${pad2(idx)} / ${pad2(total)}` : null;

    const ctx = {
      lang: tokens.meta?.lang || 'ru',
      fontFaceCss,
      tokenVars,
      stageStyle: `--slide-bg:${slideBg};`,
      bgImage,
      bgOverlay,
      watermark: slide.slots?.watermark ? escapeHtml(slide.slots.watermark) : null,
      slots: renderSlots(slide.slots, slide.highlights),
      logo,
      pageNum,
    };

    const html = env.render(`${slide.template}.njk`, ctx);
    return { name, html, format: 'png' };
  });
}
