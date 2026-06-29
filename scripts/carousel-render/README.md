# carousel-render

Deterministic **design-token → HTML/CSS → PNG** renderer for Instagram carousel slides.
The image engine behind the `carousel-creator` agent.

- **Model-agnostic.** It only renders HTML/CSS. Generative backgrounds are produced
  upstream (by the agent) and passed in as image file paths — this tool never calls
  an image API.
- **Brand-exact.** Every visual value comes from a `tokens.json` (the decomposed
  brand reference). Templates reference only CSS variables, so swapping `--tokens`
  swaps the entire look with no template edits.
- **Self-contained.** Fonts are bundled locally (`fonts/`), so rendering is
  deterministic and the tool is portable when handed to someone else.

## Setup (once)

```bash
cd tools/carousel-render
npm run setup          # npm install + Playwright Chromium + bundle webfonts
npm run smoke          # render fixtures → .cache/smoke/*.png  (sanity check)
```

`npm run setup` runs three steps; you can run them individually:
`npm install`, `npm run browser` (`playwright install chromium`), `npm run fonts`.

## CLI

```bash
node src/cli.mjs \
  --slides  <slides.json> \
  --tokens  <tokens.json> \
  --out     <output-dir> \
  [--templates <dir>]   # default: ./templates
  [--fonts <dir>]       # default: ./fonts
  [--scale 2]           # device pixel ratio; 2 → 2160×2700 (default 2)
  [--format png]        # png | jpeg
  [--debug-html <dir>]  # also write the composed .html per slide
```

Prints one line per slide and a summary:

```
OK /abs/out/01-cover.png 2160x2700
...
DONE 5 slides → /abs/out
```

Exit code `1` on a JSON/schema error or a missing asset (with an `ERR …` line).

## Inputs

### `tokens.json` — the decomposed brand reference
DTCG-flavored. Groups: `canvas` (+ `safeArea`), `color`, `typography.fontFamilies`,
`typography.roles` (per text role: family/size/weight/lineHeight/tracking/case/italic/color),
`layout` (`plaque`, `logo`), `imagery`, `motifs`. `tokens.mjs` flattens these into
`:root { --c-*, --ff-*, --t-<role>-*, --safe-* … }`. See `fixtures/tokens.example.json`.

Role `color` values may be a token name (`"fg"` → `var(--c-fg)`) or a literal
(`"#fff"`). Font `$value` must match a bundled family name (Playfair Display, Lora,
Inter, IBM Plex Mono) or any system font.

### `slides.json` — the per-slide spec
`{ "slides": [ … ] }` (or a bare array). Each slide:

| field | meaning |
|---|---|
| `template` | `cover` \| `body` \| `quote` \| `list` \| `cta` |
| `slots` | text per template slot (see below) — already-final copy |
| `highlights` | substrings wrapped in the accent plaque across all slots |
| `background` | `{ mode: solid\|gradient\|image, color?, gradient?{angle,stops[]}, image?, overlay? }` |
| `name` | optional output filename (default `NN-<template>`) |
| `showPageNum` | set `false` to hide the page number on a slide |

**Slots per template**

- `cover` — `eyebrow?`, `title`, `subtitle?`, `watermark?`
- `body` — `kicker?`, `title?`, `body[]` (paragraphs)
- `quote` — `quote`, `attribution?`
- `list` — `kicker?`, `title?`, `items[]`, `ordered?` (bool)
- `cta` — `kicker?`, `title`, `question?`, `handle?`

`background.mode: image` consumes a PNG path (resolved relative to `slides.json`)
— that is where an agent-generated background is plugged in. Default is `solid`,
so the pipeline renders with zero generative dependency.

## Fonts

`fonts/` holds bundled WOFF2 + a generated `fonts.css`. All four families are
SIL OFL and cover **Cyrillic + Latin** — required for Russian carousels. (Note:
Cinzel, used on the ave-ai landing, has no Cyrillic; the `ave-roman` brand
reference therefore swaps it for Playfair Display + Lora.) Re-run `npm run fonts`
to refresh or extend the set (edit the family list in `scripts/fetch-fonts.mjs`).

## How it fits

```
tokens.json ─┐
             ├─▶ compose.mjs (nunjucks + token→CSS) ─▶ render.mjs (Playwright) ─▶ PNG
slides.json ─┘
```

`export-series-a.mjs` in the ai-v-dele-tlv landing is the original one-off this
tool generalizes (native-size `.stage`, `deviceScaleFactor`, `document.fonts.ready`).
