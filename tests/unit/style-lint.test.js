// Plan #162 (agent_docs/plans/162-curve-typed.md), O4, issue #181.
// oracle: property roadmap U5. No color literal or font name in packages/plots/src outside the exemptions.
// Comments are stripped first. Each exemption names a file and the identifier that holds the literal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../packages/plots/src/', import.meta.url));

// [file, line pattern, why]: a matching line in that file is exempt.
const EXEMPT = [
  ['color.js', /^export var VIRIDIS = /, 'viridis map'],
  ['color.js', /^export var GRAY = /, 'gray map'],
  ['physics.js', /^const VIRIDIS = /, 'viridis map in colormap()'],
  ['physics.js', /stops = \['#000000', '#ffffff'\]/, 'gray map in colormap()'],
  ['layout3d.js', /col: "rgb\(" \+ tone\[/, "layout3D's tone composition"],
  ['layout3d.js', /c\.font = '10px "Fira Code", monospace'/, "layout3D's label font"],
];

// Block comments, then line comments not inside a string or after a colon (urls).
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

const LITERALS = [
  /#[0-9a-fA-F]{3,8}\b/,
  /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[-+.\d]/,
  /\b(?:monospace|sans-serif|serif|system-ui|ui-monospace|cursive|fantasy)\b/,
  /\bfont-family\s*:\s*(?!var\(|inherit|initial|unset)[A-Za-z'"]/,
  /\bfont(?:-family)?\s*[:=]\s*['"`]?[^;\n]*['"`][A-Z][\w -]*['"`]/,
  /\.font\s*=\s*[^;\n]*['"][A-Z][\w -]*['"]/,
];

// Lines of one source file holding a color or font literal that no exemption covers.
const scanSource = (file, text) => {
  const found = [];
  strip(text).split('\n').forEach((line, i) => {
    if (!LITERALS.some((re) => re.test(line))) return;
    if (EXEMPT.some(([f, re]) => f === file && re.test(line))) return;
    found.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
  });
  return found;
};

test('no color or font literal outside the exemptions (U5)', () => {
  const found = readdirSync(src)
    .filter((f) => f.endsWith('.js'))
    .flatMap((file) => scanSource(file, readFileSync(join(src, file), 'utf8')));
  assert.deepEqual(found, [], 'color or font literals outside the exemptions');
});

test('the scanner flags planted literals', () => {
  const planted = [
    'const a = { fill: "#ff8800" };',
    'const b = "rgb(12,34,56)";',
    'const c = "oklch(0.5 0.1 200)";',
    'css = "font-family: Inter";',
    "ctx.font = '12px \"Fira Code\"';",
    "css = 'font: 12px monospace';",
  ];
  for (const line of planted) {
    assert.equal(scanSource('plant.js', line).length, 1, `flagged: ${line}`);
  }
  const allowed = [
    'const a = "var(--ink)";',
    'const b = "oklch(from var(--ink) l c h)";',
    '// color #ff8800 is a hex in a comment',
    '/* rgb(1,2,3) and font-family: Inter */',
    'const url = "https://example.com/#anchor";'.replace('#anchor', 'x'),
  ];
  for (const line of allowed) {
    assert.deepEqual(scanSource('allow.js', line), [], `not flagged: ${line}`);
  }
});
