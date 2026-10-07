// Extracts the five lens layouts eleoptics.com records (its scripts/layout.py output) into fixtures here.
// Usage: node tests/fixtures/layouts/extract.mjs <eleo-website checkout at 39d19e4>
// The two source files are classic scripts of one line each, `window.NAME = {JSON};`. They are parsed as
// JSON, never run.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const site = process.argv[2];
if (!site) {
  console.error('usage: node tests/fixtures/layouts/extract.mjs <eleo-website checkout>');
  process.exit(2);
}

function record(file, name) {
  const text = readFileSync(join(site, file), 'utf8');
  const start = text.indexOf(`window.${name} = `);
  if (start < 0) throw new Error(`${file}: no window.${name}`);
  return JSON.parse(text.slice(start + `window.${name} = `.length).trim().replace(/;$/, ''));
}

const runs = record('public/phos-core-runs.js', 'PHOS_CORE_RUNS').runs;
const run = (id) => {
  const r = runs.find((x) => x.id === id);
  if (!r) throw new Error(`phos-core-runs.js: no run "${id}"`);
  return r.output;
};
const tool = record('public/services-tool.js', 'TOLERANCE_TOOL');

const fixtures = {
  'analysis.json': run('analysis').layout,
  'merit-before.json': run('merit').layout_before,
  'merit-after.json': run('merit').layout_after,
  'focus.json': run('focus').layout,
  'tolerance.json': tool.results.layout,
};

const out = new URL('.', import.meta.url);
for (const [file, layout] of Object.entries(fixtures)) {
  if (!layout || !Array.isArray(layout.surfaces) || !Array.isArray(layout.rays)) throw new Error(`${file}: not a recorded layout`);
  writeFileSync(new URL(file, out), JSON.stringify(layout) + '\n');
  console.log(`${file}: ${layout.surfaces.length} surfaces, fans of ${layout.rays.map((f) => f.length).join('/')} rays`);
}
