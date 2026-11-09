// Acceptance tests for plan #512 (agent_docs/plans/512-plot-scale.md), outcome O1 (issue #513; #521 unskips).
// oracle: closed-form ADR-0003 (the user's rules, plan rounds 1b and 3, 2026-11-04)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ELEO from '../../packages/plots/src/renderers.js';
import sample from '../../packages/plots/src/sample.js';
import * as scale from '../../packages/plots/src/scale.js';
import { frameText as fText, frameWeight as fWeight, frameOf, layoutText as lText, layoutWeight as lWeight } from '../../packages/plots/src/scale.js';

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
const seriesWidths = (svg) => [...svg.matchAll(/<(?:path|polyline)\b[^>]*\bstroke-width="([\d.]+)"/g)].map((m) => +m[1]);
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

test('text and weight per renderer (U18)', () => {
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

// ADR-0003 formulas at the band's edges: scale.js against hand-computed values (not the test's own copies above).
test("formulas at the band's edges", () => {
  // frameText: floor 9, band F / 18, knee 13 * (F / 234)^(1/3); continuous at 162 and 234.
  near(fText(161.99), 9, 'text below the floor edge');
  near(fText(162), 9, 'text at 162');
  near(fText(234), 13, 'text at 234');
  near(fText(234.01), 13 * Math.cbrt(234.01 / 234), 'text just above 234');
  near(fText(468), 13 * Math.cbrt(2), 'text at 468');
  near(fText(198), 11, 'text inside the band');
  // frameWeight: 1 at and below 234, sqrt(F / 234) above.
  assert.equal(fWeight(161.99), 1);
  assert.equal(fWeight(234), 1);
  near(fWeight(234.01), Math.sqrt(234.01 / 234), 'weight just above 234');
  near(fWeight(936), 2, 'weight at 936');
  // layoutText: null where W / 70 < 9, W / 70 to 910, 13 * sqrt(W / 910) above.
  assert.equal(lText(629.99), null);
  near(lText(630), 9, 'layout text at 630');
  near(lText(910), 13, 'layout text at 910');
  near(lText(910.01), 13 * Math.sqrt(910.01 / 910), 'layout text just above 910');
  near(lText(3640), 26, 'layout text at 3640');
  // layoutWeight: 1 up to 910, sqrt(W / 910) above.
  assert.equal(lWeight(629.99), 1);
  assert.equal(lWeight(910), 1);
  near(lWeight(3640), 2, 'layout weight at 3640');
  // frameOf: one branch each, solving F + m * t(F) = W; round trip through the formulas, both sides of each edge.
  const m = 4.6;
  const edgeW = [162 + 9 * m, 234 + 13 * m]; // floor/band and band/knee, from the ADR
  near(frameOf(edgeW[0], m), 162, 'floor/band edge');
  near(frameOf(edgeW[1], m), 234, 'band/knee edge');
  near(frameOf(100, m), 100 - 9 * m, 'floor branch');
  near(frameOf(250, m), 18 * 250 / (18 + m), 'band branch'); // 250 is between 203.4 and 293.8
  for (const mm of [0, 2.6, 4.6, 7.2]) {
    for (const W of [60, 161.99, 162 + 9 * mm - 0.01, 162 + 9 * mm, 234 + 13 * mm, 234 + 13 * mm + 0.01, 402, 1000, 5000]) {
      const F = frameOf(W, mm);
      if (F <= 1) { assert.equal(F, 1, `frameOf(${W}, ${mm}) clamps to 1`); continue; }
      near(F + mm * fText(F), W, `frameOf(${W}, ${mm}) round trip`);
    }
  }
  // A frame never goes under 1.
  assert.equal(frameOf(10, 4.6), 1);
});

// Plan #512, outcome O1 for bars, spot and throughFocus (issue #522; #528 unskips). oracle: closed-form ADR-0003.
// bars: F is the plot frame's rect width. spot and throughFocus: the frame is a panel, F = its rect width + 1 (the rect is inset 0.5 px each side for its stroke).
// Text only: bars draws no stroked series, and spot's and throughFocus's dots are not stroke-width attributes.
const panelFrames = (svg) => frames(svg).map((w) => w + 1);
function checkText(name, svg, F, branches) {
  const t = sizes(svg);
  assert.ok(t.length > 0, `${name}: text is drawn`);
  t.forEach((s, i) => near(s, frameText(F), `${name} (F ${F}) text ${i} font size`));
  branches.add(frameBranch(F));
}
test('text and weight per renderer (U18): bars, spot, throughFocus', () => {
  const bars = new Set();
  for (const width of [200, 300, 1200]) {
    const svg = ELEO.bars({ categories: ['a', 'b'], series: [{ values: [2, 5] }], width });
    const F = frames(svg);
    assert.ok(F.length > 0, `bars ${width}: a frame is drawn`);
    checkText(`bars ${width}`, svg, F[0], bars);
  }
  assert.deepEqual([...bars].sort(), ['above', 'below', 'inside'], 'bars widths cover the floor, the band and the knee');

  // spot: three panels at the sample's default; F is one panel's side.
  const spot = new Set();
  for (const width of [400, 600, 1500]) {
    const svg = ELEO.spot({ ...sample, width }), F = panelFrames(svg);
    assert.ok(F.length > 0, `spot ${width}: panels are drawn`);
    F.forEach((f) => near(f, F[0], `spot ${width}: one panel side`));
    checkText(`spot ${width}`, svg, F[0], spot);
  }
  assert.deepEqual([...spot].sort(), ['above', 'below', 'inside'], 'spot widths cover the floor, the band and the knee');

  // throughFocus: fields by rows, focus shifts by columns; F is one panel's side.
  const tf = new Set();
  for (const width of [500, 1100, 3000]) {
    const svg = ELEO.throughFocus({ ...sample, width }), F = panelFrames(svg);
    assert.ok(F.length > 0, `throughFocus ${width}: panels are drawn`);
    F.forEach((f) => near(f, F[0], `throughFocus ${width}: one panel side`));
    checkText(`throughFocus ${width}`, svg, F[0], tf);
  }
  assert.deepEqual([...tf].sort(), ['above', 'below', 'inside'], 'throughFocus widths cover the floor, the band and the knee');
});

// Plan #512, outcome O2 (issue #526): PLOT_SIZES is computed from scale.js and the renderers' margins. oracle: closed-form ADR-0003,
// the renderer itself as the measure: drawn at its table minimum, each renderer's plot frame is F_LO wide and its text is the 9 px floor.
// A figure of n panels needs minWidth + (n - 1) * panelStep; spot and throughFocus frames are panels (rect width + 1).
test("table matches each renderer's floor width", () => {
  const T = scale.PLOT_SIZES;
  assert.ok(T, 'PLOT_SIZES is exported');
  assert.deepEqual(Object.keys(T).sort(), ['bars', 'curve', 'layout2D', 'map2D', 'rayFan', 'spot', 'throughFocus']);
  const at = (k, n = 1) => T[k].minWidth + (n - 1) * T[k].panelStep;
  const only = (a, k) => { a.forEach((f) => near(f, a[0], `${k}: one frame width`)); return a[0]; };
  const floorText = (svg, k) => sizes(svg).forEach((s) => near(s, 9, `${k} text at the floor`));
  const svgs = {
    curve: ELEO.curve({ ...curveInput, width: at('curve') }),
    bars: ELEO.bars({ categories: ['a', 'b'], series: [{ values: [2, 5] }], width: at('bars') }),
    rayFan: ELEO.rayFan({ ...sample, width: at('rayFan', 3) }),
  };
  for (const k of Object.keys(svgs)) { near(only(frames(svgs[k]), k), 162, `${k} frame at its minWidth`); floorText(svgs[k], k); }
  assert.equal(frames(svgs.rayFan).length, 6, 'rayFan draws three columns of two rows');
  const spot = ELEO.spot({ ...sample, width: at('spot', 3) }), tf = ELEO.throughFocus({ ...sample, width: at('throughFocus', 5) });
  near(only(panelFrames(spot), 'spot'), 162, 'spot panel at its minWidth'); floorText(spot, 'spot');
  assert.equal(panelFrames(spot).length, 3);
  near(only(panelFrames(tf), 'throughFocus'), 162, 'throughFocus panel at its minWidth'); floorText(tf, 'throughFocus');
  assert.equal(panelFrames(tf).length, 12, 'three rows of the four columns framed in --plot-grid (the focus column is --ink-subtle)');
  // layout2D: labels show at its minimum and not a pixel under.
  const L = fixture('analysis'), lay = (width) => sizes(ELEO.layout2D({ data: L, labels: ['a', 'b', 'c'], width }));
  assert.ok(lay(at('layout2D')).length > 0 && lay(at('layout2D') - 1).length === 0, 'layout2D labels start at minWidth');
  lay(at('layout2D')).forEach((s) => near(s, 9, 'layout2D text at the floor'));
  // ADR-0003's figures (spot's now carry the y labels' 2.4 text units per panel): throughFocus about 894 plus the y labels' 2.4 text units, 919 (the renderer's own floor is within 1 %).
  near(at('spot', 3), 3 * (162 + 9 * 2.4) + 2 * 22, 'spot, three panels: a frame, 2.4 text units for the y labels, 22 between');
  assert.ok(Math.abs(at('throughFocus', 5) / (894 + 2.4 * 9) - 1) <= 0.01, `throughFocus, five columns: ${at('throughFocus', 5)} against about 916`);
  // The defaults: each renderer's own default width, and the aspect it draws at.
  assert.deepEqual([T.curve.width, T.bars.width, T.map2D.width, T.layout2D.width, T.rayFan.width, T.spot.width], [460, 460, 460, 1000, 228, 150]);
  near(T.curve.aspect, 260 / 460, 'curve aspect'); near(T.map2D.aspect, 360 / 460, 'map2D aspect');
  const d = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(ELEO.curve(curveInput));
  near(+d[1] * T.curve.aspect, +d[2], 'a default curve draws at the table aspect');
  assert.equal(T.layout2D.aspect, null);
});

// Plan #603 (agent_docs/plans/603-recorded-fans.md), outcome O2 (issue #604; #608 and #609 unskip).
// oracle: closed-form ADR-0003 (F_LO = 162, TEXT_MIN = 9) and map2d.js's margins in text units: colorbar 3 + 0.6 x the widest label, x ticks max(1.2, 0.3 x the widest label)
// What #608 must provide: mapMargins(props) -> { L, R } from map2d.js (the margins typedMap draws with, text units).
const gridProps = (extra) => ({ values: [[0, 1, 2], [3, 4, 5], [6, 7, 8]], extent: [-1, 1, -1, 1], x: { label: 'x' }, y: { label: 'y' }, ...extra });
test('mapMargins gives map2D\'s margins', async () => {
  const { mapMargins } = await import('../../packages/plots/src/map2d.js');
  assert.equal(typeof mapMargins, 'function', 'map2d.js exports mapMargins');
  // No colorbar: 4.6 left, and at least 1.2 right.
  const plain = mapMargins(gridProps());
  near(plain.L, 4.6, 'L'); near(plain.R, 1.2, 'R with no colorbar');
  // A linear colorbar over 0..8 labels 0, 2, 4, 6, 8: one character wide, so 3 + 0.6 on top of the margin.
  near(mapMargins(gridProps({ value: { label: 'v' }, range: [0, 8] })).R, 1.2 + 3 + 0.6, 'R with a linear colorbar');
  // A log colorbar over 1e-3..1 labels 0.001 ... 1: the widest is five characters.
  near(mapMargins(gridProps({ value: { label: 'v' }, scale: 'log', range: [1e-3, 1] })).R, 1.2 + 3 + 0.6 * 5, 'R with a log colorbar');
  // A five-character right-most x tick ("0.050"; curve's margin counts the largest tick, not a negative one) widens R past 1.2 by 0.3 per character.
  const wide = mapMargins({ ...gridProps(), extent: [-0.05, 0.05, -0.05, 0.05], x: { label: 'x', ticks: [0, 0.025, 0.05] } });
  near(wide.R, Math.max(1.2, 0.3 * 5), 'R from the widest x tick label');
});
// What #609 must provide: minWidth(name, props) on ELEO (packages/plots/src/sizes.js): F_LO + TEXT_MIN x (L + R) + (panels - 1) x panelStep.
test('minWidth gives the floor frame (#587)', async () => {
  // sizes.js directly: ELEO.minWidth is #610's export.
  const { minWidth } = await import('../../packages/plots/src/sizes.js');
  assert.equal(typeof minWidth, 'function', 'sizes.js exports minWidth');
  const { mapMargins } = await import('../../packages/plots/src/map2d.js');
  const colorbar = gridProps({ value: { label: 'v' }, range: [0, 8] }), log = gridProps({ value: { label: 'v' }, scale: 'log', range: [1e-3, 1] });
  // map2D draws on a canvas (the gallery's floor test draws it); here frameOf, ADR-0003's own function, gives the frame at a width and margins.
  for (const [what, props] of [['map2D with a linear colorbar', colorbar], ['map2D with a log colorbar', log]]) {
    const w = minWidth('map2D', props), { L, R } = mapMargins(props);
    assert.ok(Number.isFinite(w) && w > scale.F_LO, `${what}: a finite minimum above the frame floor`);
    assert.ok(frameOf(w, L + R) >= scale.F_LO - TOL, `${what}: at minWidth the frame is at least F_LO`);
    assert.ok(frameOf(w - 1, L + R) < scale.F_LO, `${what}: 1 px less is under F_LO`);
  }
  // A wider colorbar label costs TEXT_MIN px per text unit (0.6 a character): five characters against one.
  near(minWidth('map2D', log) - minWidth('map2D', colorbar), scale.TEXT_MIN * 0.6 * 4, 'five characters against one');
  // Without a sample a rayFan counts one panel; the table's width otherwise.
  // (Importing sample.js loaded the sample as the default data, and rayFan({}) would draw its three fields; unload it for the no-sample case.)
  const T = scale.PLOT_SIZES.rayFan;
  near(minWidth('rayFan', {}), T.minWidth + 2 * T.panelStep, 'rayFan with the sample loaded counts its three fields');
  ELEO.useSample(null);
  try { near(minWidth('rayFan', {}), T.minWidth, 'rayFan with no sample is one panel'); } finally { ELEO.useSample(sample); }
});

// Plan #603, issue #610: minWidth is public, on the module and on the classic build's window.ELEO, the one function of sizes.js.
// oracle: tests/unit/layout2d.test.js's layoutBounds case (a public export is on ELEO so eleo-plots.js carries it)
test('ELEO.minWidth is exported on the module and on the classic build (#610)', async () => {
  const { minWidth } = await import('../../packages/plots/src/sizes.js');
  const plots = await import('../../packages/plots/src/index.js');
  assert.equal(typeof plots.default.minWidth, 'function', 'ELEO.minWidth');
  assert.equal(plots.default.minWidth, minWidth, 'ELEO.minWidth is sizes.js minWidth');
  assert.equal(plots.minWidth, minWidth, 'named export');
  const win = {};
  vm.runInNewContext(readFileSync(new URL('../../packages/plots/dist/eleo-plots.js', import.meta.url), 'utf8'), { window: win });
  assert.equal(typeof win.ELEO.minWidth, 'function', 'window.ELEO.minWidth');
  assert.equal(win.ELEO.minWidth('bars'), minWidth('bars'), 'same floor on the classic build');
});
