import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const json = JSON.parse(readFileSync(new URL('../../packages/tokens/src/tokens.json', import.meta.url)));
const css = readFileSync(new URL('../../packages/tokens/dist/tokens.css', import.meta.url), 'utf8');

test('every color token has a light and a dark value', () => {
  for (const t of json.color.tokens) {
    assert.equal(typeof t.value, 'object', t.name);
    assert.match(t.value.light, /^#[0-9a-f]{6}$/i, t.name);
    assert.match(t.value.dark, /^#[0-9a-f]{6}$/i, t.name);
  }
});

test('tokens.css defines every token in both themes', () => {
  const [light, , , dark] = css.split(/\n(?=:root \{|@media|\[data-theme="dark"\])/);
  for (const t of json.color.tokens) {
    assert.ok(light.includes(`--${t.name}: ${t.value.light};`), `light ${t.name}`);
    assert.ok(dark.includes(`--${t.name}: ${t.value.dark};`), `dark ${t.name}`);
  }
});

test('zero of each colormap equals the plot ground', () => {
  const v = (n, th) => json.color.tokens.find((t) => t.name === n).value[th];
  for (const th of ['light', 'dark']) assert.equal(v('map-ember-0', th), v('map-wave-4', th));
});

test('glass band ends in range', async () => {
  const { oklch } = await import('culori');
  const band = { light: [0.66, 0.93], dark: [0.26, 0.52] };
  const tok = (n) => json.color.tokens.find((t) => t.name === n);
  for (const n of ['glass-band-hi', 'glass-band-lo']) assert.ok(tok(n), `${n} is defined`);
  for (const th of ['light', 'dark']) {
    const [lo, hi] = band[th];
    const ends = { hi: oklch(tok('glass-band-hi').value[th]), lo: oklch(tok('glass-band-lo').value[th]) };
    for (const [k, c] of Object.entries(ends)) {
      const id = `glass-band-${k} ${th}`;
      assert.ok(c.l >= lo && c.l <= hi, `${id}: L ${c.l} outside ${lo}–${hi}`);
      assert.ok(c.c <= 0.1, `${id}: chroma ${c.c} > .10`);
      assert.ok(c.h >= 225 && c.h <= 275, `${id}: hue ${c.h} outside 225–275`);
    }
    // each token sits at its end of the band: the lightest and the darkest
    assert.ok(ends.hi.l >= hi - 0.02, `glass-band-hi ${th}: L ${ends.hi.l} not at the light end ${hi}`);
    assert.ok(ends.lo.l <= lo + 0.02, `glass-band-lo ${th}: L ${ends.lo.l} not at the dark end ${lo}`);
  }
});

// oracle: WCAG 2.1 contrast ratio of each map's grid tokens against the map's lowest and highest stops,
// the same ends tests/map2d.spec.js::grid over the image reads from ELEO.colormap(map, el)[0] and [255].
test('map grid contrast', () => {
  const tok = (n) => json.color.tokens.find((t) => t.name === n);
  const val = (n, th) => { assert.ok(tok(n), `${n} is defined`); return tok(n).value[th]; };
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const ends = (map, th) => map === 'viridis' ? ['#440154', '#fde725'] : map === 'gray' ? ['#000000', '#ffffff']
    : [val(`map-${map}-0`, th), val(`map-${map}-8`, th)];
  for (const map of ['ember', 'wave', 'viridis', 'gray']) for (const th of ['light', 'dark']) {
    for (const [name, min] of [[`map-grid-${map}`, 3], [`map-grid-${map}-minor`, 1.5]]) {
      const c = val(name, th);
      for (const [i, end] of ends(map, th).entries()) {
        const r = ratio(c, end);
        assert.ok(r >= min, `${name} ${th} ${c} vs ${map} stop ${i ? 'highest' : 'lowest'} ${end}: ${r.toFixed(2)}:1 < ${min}:1`);
      }
    }
  }
});
