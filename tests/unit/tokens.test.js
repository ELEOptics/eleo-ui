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
