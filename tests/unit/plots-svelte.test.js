// Plan #512 (agent_docs/plans/512-plot-scale.md), outcome O3 (issue #529, Files from CR #592; #530 writes the wrappers and unskips, CR #593).
// oracle: reference the renderers (a width the caller gives reaches the renderer; none given reaches it as undefined, so it draws its default).
// The six framed wrappers are compiled for the server against a stub `@eleoptics/plots` whose renderers print the width they got, in a temp
// dir as map2d-svelte.test.js does. The server has no layout, so `bind:contentRect` measures nothing there: the wrapper must pass the
// caller's width, or none, never 0 or NaN. Map2D's typed SVG is drawn in an effect, which does not run in SSR, so it is checked for its frame only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

test('wrappers pass width through on the server', async () => {
  const { compile } = await import('svelte/compiler');
  const { render } = await import('svelte/server');
  const dir = mkdtempSync(join(tmpdir(), 'plots-svelte-'));
  try {
    const stub = (name) => `export const ${name} = (p) => '<svg data-width="' + p.width + '"></svg>';`;
    writeFileSync(join(dir, 'plots.js'), ['curve', 'rayFan', 'bars', 'spot', 'layout2D'].map(stub).join('\n') + '\nexport const map2D = () => ({ lo: 0, hi: 1 });\nexport const interact = () => () => {};\nexport const readout = () => \'\';');
    writeFileSync(join(dir, 'theme.js'), 'export const themeTick = () => 0;');
    writeFileSync(join(dir, 'interact.js'), readFileSync(new URL('../../packages/plots-svelte/src/lib/interact.svelte.js', import.meta.url), 'utf8').replaceAll("'@eleoptics/plots'", '"./plots.js"'));
    const load = async (name) => {
      const src = readFileSync(new URL(`../../packages/plots-svelte/src/lib/${name}.svelte`, import.meta.url), 'utf8');
      const js = compile(src, { generate: 'server', filename: `${name}.svelte` }).js.code
        .replaceAll("'svelte/internal/server'", JSON.stringify(import.meta.resolve('svelte/internal/server')))
        .replaceAll("'@eleoptics/plots'", '"./plots.js"').replaceAll("'./theme.svelte.js'", '"./theme.js"').replaceAll("'./interact.svelte.js'", '"./interact.js"');
      writeFileSync(join(dir, `${name}.js`), js);
      return (await import(pathToFileURL(join(dir, `${name}.js`)).href)).default;
    };
    const props = {
      CurvePlot: { series: [{ points: [[0, 1], [1, 0]], index: 0 }] },
      RayFan: {},
      BarPlot: { categories: ['1'], series: [{ values: [1], index: 0 }] },
      SpotDiagram: {},
      Layout2D: {},
    };
    for (const [name, p] of Object.entries(props)) {
      const Wrapper = await load(name);
      assert.match(render(Wrapper, { props: { ...p, width: 300 } }).body, /data-width="300"/, `${name} drops the width it is given`);
      assert.match(render(Wrapper, { props: p }).body, /data-width="undefined"/, `${name} passes a width on the server when none is given`);
    }
    const Map2D = await load('Map2D');
    assert.match(render(Map2D, { props: { values: [[0, 1], [1, 0]], extent: [-1, 1, -1, 1], width: 300 } }).body, /<div class="eleo-svg"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Plan #804, outcome O4 (issue #843). oracle: closed-form (binds minus stops is the number of live listeners: one while marks, tooltip or a callback is on, none when marks and tooltip are off and no callback is given; CR #857).
// The hover action is imported against a stub `interact` that counts binds and stops.
test('hover binds unless marks and tooltip are off', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'plots-svelte-hover-'));
  try {
    const count = { binds: 0, stops: 0 };
    globalThis.__hoverCount = count;
    writeFileSync(join(dir, 'plots.js'), 'export const interact = () => { globalThis.__hoverCount.binds++; return () => { globalThis.__hoverCount.stops++; }; };');
    writeFileSync(join(dir, 'interact.js'), readFileSync(new URL('../../packages/plots-svelte/src/lib/interact.svelte.js', import.meta.url), 'utf8').replaceAll("'@eleoptics/plots'", '"./plots.js"'));
    const { hover } = await import(pathToFileURL(join(dir, 'interact.js')).href);
    const live = () => count.binds - count.stops;
    const el = {};

    const off = { marks: false, tooltip: false };
    const none = hover(el, off);
    assert.equal(live(), 0, 'marks and tooltip off with no callback still binds');
    none.update({ ...off, onhover() {} });
    assert.equal(live(), 1, 'a callback added later does not bind');
    none.update(off);
    assert.equal(live(), 0, 'a callback removed later does not stop');
    none.update({ ...off, onselect() {} });
    assert.equal(live(), 1, 'onselect added later does not bind');
    none.update({ ...off, onselect() {}, onhover() {} });
    assert.equal(live(), 1, 'a changed callback leaks or drops the listener');
    none.update({ tooltip: false });
    assert.equal(live(), 1, 'marks on by default does not bind');
    none.update({ marks: false });
    assert.equal(live(), 1, 'tooltip on by default does not bind');
    none.destroy();
    assert.equal(live(), 0, 'destroy leaves a listener');

    const bare = hover(el, {});
    assert.equal(live(), 1, 'the default marks and tooltip do not bind without a callback');
    bare.destroy();
    assert.equal(live(), 0);

    const undef = hover(el, undefined);
    assert.equal(live(), 1, 'undefined options do not bind the defaults');
    undef.destroy();
    assert.equal(live(), 0);
  } finally {
    delete globalThis.__hoverCount;
    rmSync(dir, { recursive: true, force: true });
  }
});
