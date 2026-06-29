// Flatten a tokens.json object into a block of CSS custom properties for :root.
// Templates reference ONLY these variables, so swapping --tokens swaps the whole
// look with zero template edits.

function leaf(v) {
  return v && typeof v === 'object' && '$value' in v ? v.$value : v;
}
function dim(v, fallback) {
  const x = leaf(v);
  return x === undefined || x === null ? fallback : x;
}
// "fg" -> var(--c-fg);  "#fff" -> #fff;  undefined -> inherit
function colorRef(name, fallback = 'inherit') {
  const n = leaf(name);
  if (n === undefined || n === null) return fallback;
  if (typeof n === 'string' && (n.startsWith('#') || n.startsWith('rgb') || n.startsWith('hsl'))) return n;
  return `var(--c-${n})`;
}

export function buildTokenCss(tokens) {
  const lines = [];
  const push = (k, v) => {
    if (v !== undefined && v !== null && v !== '') lines.push(`  ${k}: ${v};`);
  };

  const canvas = tokens.canvas || {};
  push('--canvas-w', dim(canvas.width, '1080px'));
  push('--canvas-h', dim(canvas.height, '1350px'));
  const sa = canvas.safeArea || {};
  push('--safe-top', dim(sa.top, '96px'));
  push('--safe-right', dim(sa.right, '84px'));
  push('--safe-bottom', dim(sa.bottom, '120px'));
  push('--safe-left', dim(sa.left, '84px'));

  for (const [name, val] of Object.entries(tokens.color || {})) {
    push(`--c-${name}`, leaf(val));
  }

  const typo = tokens.typography || {};
  for (const [name, val] of Object.entries(typo.fontFamilies || {})) {
    const fam = leaf(val);
    const fallback = (val && typeof val === 'object' && val.fallback) || 'sans-serif';
    push(`--ff-${name}`, `"${fam}", ${fallback}`);
  }

  for (const [role, def0] of Object.entries(typo.roles || {})) {
    const def = def0 || {};
    push(`--t-${role}-family`, `var(--ff-${def.family || 'serif'})`);
    push(`--t-${role}-size`, dim(def.size, '40px'));
    push(`--t-${role}-weight`, def.weight ?? 400);
    push(`--t-${role}-lh`, def.lineHeight ?? '1.2');
    push(`--t-${role}-tracking`, def.tracking ?? 'normal');
    push(`--t-${role}-case`, def.case ?? 'none');
    push(`--t-${role}-style`, def.italic ? 'italic' : 'normal');
    push(`--t-${role}-color`, colorRef(def.color, 'var(--c-fg)'));
  }

  const layout = tokens.layout || {};
  push('--radius', dim(layout.radius, '0px'));
  const plaque = layout.plaque || {};
  push('--plaque-bg', colorRef(plaque.bg, 'var(--c-accent)'));
  push('--plaque-fg', colorRef(plaque.color, 'var(--c-ink)'));
  push('--plaque-px', dim(plaque.padX, '14px'));
  push('--plaque-py', dim(plaque.padY, '4px'));

  return lines.join('\n');
}

export { leaf, dim, colorRef };
