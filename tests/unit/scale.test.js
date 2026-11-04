// Acceptance tests for plan #512 (agent_docs/plans/512-plot-scale.md), outcome O1 (issue #513; #521 unskips).
// oracle: closed-form ADR-0003 (the user's rules, plan rounds 1b and 3, 2026-11-04)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ELEO from '../../packages/plots/src/renderers.js';
import sample from '../../packages/plots/src/sample.js';

// Skipped until #521; the guard is the one line #521 removes.
const SKIP = 'plan #512 O1: awaiting #517, #518; #521 unskips';

const TOL = 0.01; // px
const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/layouts/${name}.json`, import.meta.url), 'utf8'));

// ADR-0003, framed renderers: F is the plot frame's width in px. 9 px below F = 162, F / 18 inside the band (9 to 13 px),
// 13 * (F / 234)^(1/3) above 234; strokes and dots grow by sqrt(F / 234) above the band, else 1 px.
const frameText = (F) => (F < 162 ? 9 : F <= 234 ? F / 18 : 13 * Math.cbrt(F / 234));
const frameWeight = (F) => (F > 234 ? Math.sqrt(F / 234) : 1);
const frameBranch = (F) => (F < 162 ? 'below' : F <= 234 ? 'inside' : 'above');
// ADR-0003, layout2D: W is the drawing width. W / 70 inside 630 to 910, hidden below 630 (W / 70 < 9, unrounded),
// 13 * sqrt(W / 910) text and strokes above 910.
const layoutText = (W) => (W / 70 < 9 ? null : W <= 910 ? W / 70 : 13 * Math.sqrt(W / 910));
const layoutWeight = (W) => (W > 910 ? Math.sqrt(W / 910) : 1);
const layoutBranch = (W) => (W < 630 ? 'below' : W <= 910 ? 'inside' : 'above');

const sizes = (svg) => [...svg.matchAll(/<text\b[^>]*>/g)].map((m) => {
  const px = /font-size:\s*([\d.]+)px/.exec(m[0]);
  return px ? +px[1] : NaN; // an attribute or class size is not px in the drawing
});
const frames = (svg) => [...svg.matchAll(/<rect\b[^>]*stroke="var\(--plot-grid\)"[^>]*>/g)].map((m) => +/\bwidth="([\d.]+)"/.exec(m[0])[1]);
const seriesWidths = (svg) => [...svg.matchAll(/<path\b[^>]*\bstroke-width="([\d.]+)"/g)].map((m) => +m[1]);
const rayWidths = (svg) => [...svg.matchAll(/<polyline\b[^>]*\bstroke="var\(--series-[^>]*stroke-width:\s*([\d.]+)px/g)].map((m) => +m[1]);

const near = (a, b, msg) => assert.ok(Math.abs(a - b) <= TOL, `${msg}: ${a} against ${b}`);

// Text sizes of a framed drawing equal the formula for its frame; every drawn series stroke equals the weight.
function checkFramed(name, svg, branches) {
  const F = frames(svg);
  assert.ok(F.length > 0, `${name}: a frame is drawn`);
  F.forEach((f) => near(f, F[0], `${name}: every panel has one frame width`));
  const t = sizes(svg), w = seriesWidths(svg);
  assert.ok(t.length > 0, `${name}: text is drawn`);
  t.forEach((s, i) => near(s, frameText(F[0]), `${name} (F ${F[0]}) text ${i} font size`));
  assert.ok(w.length > 0, `${name}: series are drawn`);
  w.forEach((s, i) => near(s, frameWeight(F[0]), `${name} (F ${F[0]}) series ${i} stroke width`));
  branches.add(frameBranch(F[0]));
}

const curveInput = { series: [{ points: [[0, 0], [1, 2], [2, 1]], index: 0, role: 'tangential' }, { points: [[0, 1], [1, 1.5], [2, 2]], index: 0, role: 'sagittal' }], x: { label: 'Frequency', unit: 'cycles/mm', range: [0, 2] }, y: { label: 'Modulus', range: [0, 2] } };

test('text and weight per renderer (U18)', { skip: SKIP }, () => {
  // curve: widths chosen to land F below, inside and above the band (checked at the end).
  const curveBranches = new Set();
  for (const width of [200, 300, 1200]) checkFramed(`curve ${width}`, ELEO.curve({ ...curveInput, width }), curveBranches);
  assert.deepEqual([...curveBranches].sort(), ['above', 'below', 'inside'], 'curve widths cover the floor, the band and the knee');

  // rayFan: three columns; F is one panel's frame.
  const fanBranches = new Set();
  for (const width of [450, 900, 3600]) checkFramed(`rayFan ${width}`, ELEO.rayFan({ ...sample, width }), fanBranches);
  assert.deepEqual([...fanBranches].sort(), ['above', 'below', 'inside'], 'rayFan widths cover the floor, the band and the knee');

  // layout2D: W is its width; labels and the scale bar are hidden where W / 70 is under 9.
  const L = fixture('analysis'), layoutBranches = new Set();
  for (const width of [600, 629, 630, 800, 910, 1000, 1600]) {
    const svg = ELEO.layout2D({ data: L, labels: ['a', 'b', 'c'], width });
    const t = sizes(svg), want = layoutText(width), w = rayWidths(svg);
    if (want === null) assert.equal(t.length, 0, `layout2D ${width}: labels and scale bar hidden`);
    else {
      assert.ok(t.length > 0, `layout2D ${width}: text is drawn`);
      t.forEach((s, i) => near(s, want, `layout2D ${width} text ${i} font size`));
    }
    assert.ok(w.length > 0, `layout2D ${width}: rays are drawn`);
    w.forEach((s, i) => near(s, layoutWeight(width), `layout2D ${width} ray ${i} stroke width`));
    layoutBranches.add(layoutBranch(width));
  }
  assert.deepEqual([...layoutBranches].sort(), ['above', 'below', 'inside'], 'layout2D widths cover hidden, band and knee');
});
