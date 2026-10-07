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
