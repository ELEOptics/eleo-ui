// Acceptance tests for plan #30 (agent_docs/plans/30-layouts.md), outcomes O1 and O2.
// oracle: fixture the website's layouts recorded by its scripts/layout.py (eleo-website@39d19e4), plus the sample; inverting each SVG's transform recovers every surface profile and ray within 0.01 mm
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ELEO from '../../packages/plots/src/renderers.js';
import sample from '../../packages/plots/src/sample.js';
import * as layout2dModule from '../../packages/plots/src/layout2d.js';
import * as plots from '../../packages/plots/src/index.js';
const { layoutBounds } = layout2dModule;

const TOL = 0.01; // mm
const FIXTURES = ['analysis', 'merit-before', 'merit-after', 'focus', 'tolerance'];
const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/layouts/${name}.json`, import.meta.url)));

// The SVG is our own renderer's output: flat elements with double-quoted attributes. Read just enough of it.
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const nums = (s) => s.trim().split(/[\s,]+/).map(Number);
const pairs = (s) => { const n = nums(s), out = []; for (let i = 0; i < n.length; i += 2) out.push([n[i], n[i + 1]]); return out; };

// The geometry group: `<g transform="matrix(a b c d e f)">` up to its matching `</g>`.
function geometry(svg) {
  const open = /<g\b[^>]*\btransform="matrix\(([^)]*)\)"[^>]*>/.exec(svg);
  assert.ok(open, 'the SVG has a <g transform="matrix(…)"> holding the geometry');
  let depth = 1, i = open.index + open[0].length;
  const tags = /<(\/?)g\b[^>]*>/g;
  tags.lastIndex = i;
  for (let m; (m = tags.exec(svg));) {
    if (!m[1]) { assert.ok(!/\btransform=/.test(m[0]), 'no nested transform inside the geometry group'); depth++; }
    else if (--depth === 0) return { M: nums(open[1]), body: svg.slice(i, m.index) };
  }
  assert.fail('the geometry group is closed');
}

// Invert the group's transform: viewBox px → mm. It must be a uniform scale with y flipped (matrix(s 0 0 -s tx ty)).
function inverse(M) {
  const [a, b, c, d, e, f] = M;
  assert.equal(M.length, 6, 'matrix has 6 terms');
  assert.ok(b === 0 && c === 0 && a > 0 && Math.abs(a + d) <= 1e-9 * a, `matrix(s 0 0 -s tx ty), got matrix(${M.join(' ')})`);
  return ([x, y]) => [(x - e) / a, (y - f) / d];
}

const near = (p, q) => Math.abs(p[0] - q[0]) <= TOL && Math.abs(p[1] - q[1]) <= TOL;
const samePath = (got, want) => got.length === want.length && got.every((p, i) => near(p, want[i]));
const at = (x, z) => Math.abs(x - z) <= TOL;

function roundTrip(L, svg) {
  const { M, body } = geometry(svg);
  const toMm = inverse(M);
  const view = nums(/<svg\b[^>]*\bviewBox="([^"]*)"/.exec(svg)[1]);
  // The part of the mm plane the viewBox shows.
  const [z0, y1] = toMm([view[0], view[1]]), [z1, y0] = toMm([view[0] + view[2], view[1] + view[3]]);
  const visible = (p) => p[0] >= z0 - TOL && p[0] <= z1 + TOL && p[1] >= y0 - TOL && p[1] <= y1 + TOL;

  const elements = (tag) => [...body.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((m) => attrs(m[0]));
  const polygons = elements('polygon').map((a) => pairs(a.points));
  const polylines = elements('polyline').map((a) => pairs(a.points));
  const lines = elements('line').map((a) => [[+a.x1, +a.y1], [+a.x2, +a.y2]]);
  const S = L.surfaces;

  // Glass: one polygon per lens, this profile then the next one reversed.
  const glass = S.flatMap((s, i) => (s.glass && S[i + 1] ? [[...s.profile, ...S[i + 1].profile.slice().reverse()]] : []));
  for (const [k, want] of glass.entries()) {
    assert.ok(polygons.some((got) => samePath(got, want)), `glass polygon ${k} recovers its two profiles`);
    assert.ok(want.every(visible), `glass polygon ${k} lies inside the viewBox`);
  }
  for (const got of polygons) assert.ok(glass.some((want) => samePath(got, want)), 'every polygon is a recorded lens');

  // A standalone stop (no glass on either side): two ticks, from ±sd out to ±(sd + 2.5).
  S.forEach((s, i) => {
    if (!(s.stop && !s.glass && !(S[i - 1] && S[i - 1].glass))) return;
    for (const k of [1, -1]) {
      const ends = [[s.z, k * s.sd], [s.z, k * (s.sd + 2.5)]];
      assert.ok(lines.some(([p, q]) => (near(p, ends[0]) && near(q, ends[1])) || (near(p, ends[1]) && near(q, ends[0]))),
        `stop tick at z=${s.z} from ${k * s.sd} to ${k * (s.sd + 2.5)}`);
      assert.ok(ends.every(visible), `stop tick at z=${s.z} lies inside the viewBox`);
    }
  });

  // The image: a vertical line at its z.
  const img = S.find((s) => s.image);
  assert.ok(img, 'the layout has an image surface');
  assert.ok(lines.some(([p, q]) => at(p[0], img.z) && at(q[0], img.z) && p[1] !== q[1]), `image line at z=${img.z}`);

  // Rays: every recorded ray is a polyline, and every polyline is a recorded ray.
  const rays = L.rays.flat();
  L.rays.forEach((fan, k) => fan.forEach((want, i) => {
    assert.ok(polylines.some((got) => samePath(got, want)), `field ${k} ray ${i} recovered`);
    assert.ok(want.every(visible), `field ${k} ray ${i} lies inside the viewBox`);
  }));
  for (const got of polylines) assert.ok(rays.some((want) => samePath(got, want)), 'every polyline is a recorded ray');
}

test('recorded layouts round-trip', async (t) => {
  const cases = [
    ...FIXTURES.map((name) => { const L = fixture(name); return { name, data: L, layout: L }; }),
    { name: 'sample', data: sample, layout: sample.layout },
  ];
  for (const { name, data, layout } of cases) {
    await t.test(name, () => {
      assert.ok(layout && Array.isArray(layout.surfaces), `${name}: a recorded layout ({surfaces, rays})`);
      let svg;
      assert.doesNotThrow(() => { svg = ELEO.layout2D({ data, rays: 'fan' }); }, `${name}: layout2D draws it`);
      roundTrip(layout, svg);
    });
  }
});

// Plan #30, #32: layout2D on the recorded format. Counts and positions read from the same mm group.
function drawn(svg) {
  const { M, body } = geometry(svg);
  const tags = (tag, src) => [...src.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((m) => attrs(m[0]));
  const outside = svg.replace(body, '');
  return { M, body, polygons: tags('polygon', body), lines: tags('line', body), polylines: tags('polyline', body), dots: tags('circle', outside) };
}
const vertical = (a) => a.x1 === a.x2 && a.y1 !== a.y2;
const image = (L) => L.surfaces.find((s) => s.image).z;
// CR #48: dash arrays stay in px. Under non-scaling-stroke the browser applies them in screen space
// (SVG 2 vector-effect), so the literals are the old renderer's: axis `4 6`, chief `6 4`.
function dashesArePx({ lines, polylines }) {
  const axis = lines.filter((a) => a.stroke === 'var(--plot-axis)');
  assert.equal(axis.length, 1, 'one axis line');
  assert.equal(axis[0]['stroke-dasharray'], '4 6', 'axis dashes 4 6 px');
  const chief = polylines.filter((a) => a['stroke-dasharray'] !== undefined);
  assert.ok(chief.length > 0, 'a dashed chief ray');
  assert.ok(chief.every((a) => a['stroke-dasharray'] === '6 4'), 'chief dashes 6 4 px');
}

test('triplet draws 3 polygons, no stop ticks', () => {
  const L = fixture('tolerance');
  const d = drawn(ELEO.layout2D({ data: L }));
  assert.equal(d.polygons.length, 3);
  assert.equal(d.lines.filter((a) => vertical(a) && !at(+a.x1, image(L))).length, 0, 'no stop ticks');
  dashesArePx(d);
});

test('singlet draws 1 polygon and 2 ticks', () => {
  const L = fixture('merit-before');
  const d = drawn(ELEO.layout2D({ data: L }));
  assert.equal(d.polygons.length, 1);
  const ticks = d.lines.filter((a) => vertical(a) && !at(+a.x1, image(L)));
  assert.equal(ticks.length, 2, 'two stop ticks');
  assert.ok(ticks.every((a) => at(+a.x1, 0)), 'ticks at the stop z');
  dashesArePx(d);
});

test('chief index picks the dot', () => {
  const ray = (y) => [[-12, y], [0, y], [50, y / 2], [100, -y / 4]];
  const fan = [-2, -1, 0, 1, 2].map(ray);
  const prof = (z) => Array.from({ length: 41 }, (_, i) => [z, -6 + (12 * i) / 40]);
  const L = {
    surfaces: [
      { z: 0, sd: 6, stop: true, image: false, glass: 'crown', profile: prof(0) },
      { z: 4, sd: 6, stop: false, image: false, glass: null, profile: prof(4) },
      { z: 100, sd: 3, stop: false, image: true, glass: null, profile: prof(100) },
    ],
    rays: [fan],
  };
  const dotAt = (data) => {
    const d = drawn(ELEO.layout2D({ data }));
    assert.equal(d.dots.length, 1, 'one chief dot, outside the mm group');
    const [s, , , ns, tx, ty] = d.M;
    return [(+d.dots[0].cx - tx) / s, (+d.dots[0].cy - ty) / ns];
  };
  assert.ok(near(dotAt(L), [100, 0]), 'without chief, the middle ray');
  assert.ok(near(dotAt({ ...L, chief: [1] }), [100, 0.25]), 'chief: [1] picks ray 1');
});

// Plan #30, #33: the sample's `layout` and `layoutWl` are recorded layouts.
// oracle: fixture the sample's own profiles, zimg and ray ends (packages/plots/src/sample.json)
test('sample surfaces equal its profiles', () => {
  for (const key of ['layout', 'layoutWl']) {
    const L = sample[key];
    assert.ok(L && Array.isArray(L.surfaces), `${key} is a recorded layout ({surfaces, rays})`);
    const S = L.surfaces;
    assert.equal(S.length, sample.profiles.length + 1, `${key}: one surface per profile, then the image`);
    sample.profiles.forEach((p, i) => {
      assert.equal(S[i].z, p.z, `${key} surface ${i} z`);
      assert.equal(S[i].sd, p.sd, `${key} surface ${i} sd`);
      assert.deepEqual(S[i].profile, p.zs.map((z, j) => [z, p.ys[j]]), `${key} surface ${i} profile is its zs, ys`);
      assert.equal(S[i].image, false, `${key} surface ${i} is not the image`);
    });
    assert.deepEqual(S.map((s) => s.glass), ['crown', 'flint', null, null], `${key}: crown then flint`);
    assert.deepEqual(S.map((s) => s.stop), [true, false, false, false], `${key}: the stop is surface 0`);
    const img = S[S.length - 1];
    assert.equal(img.image, true, `${key}: the last surface is the image`);
    assert.equal(img.z, sample.zimg, `${key}: the image is at zimg`);
    const sd = Math.max(...L.rays.flat().map((r) => Math.abs(r[r.length - 1][1])));
    assert.equal(img.sd, sd, `${key}: image sd is the largest |y| of the rays there`);
    assert.equal(img.profile.length, 41, `${key}: image profile has 41 points`);
    assert.ok(img.profile.every((q) => q[0] === sample.zimg), `${key}: image profile lies at zimg`);
    assert.ok(!('chief' in L), `${key}: no chief`);
    assert.ok(L.rays.every((fan) => fan.length === 7), `${key}: 7-ray fans`);
  }
});

// Plan #30, #51: layoutBounds ports the site's bounds().
// oracle: reference the site's function, copied verbatim from eleo-website@39d19e4 public/layout.js:20-35
function bounds(layouts) {
    var zmin = Infinity, zmax = -Infinity, ylo = 0, yhi = 0;
    layouts.forEach(function (L) {
      L.rays.forEach(function (fan) { fan.forEach(function (r) {
        zmin = Math.min(zmin, r[0][0]); zmax = Math.max(zmax, r[r.length - 1][0]);
        r.forEach(function (p) { ylo = Math.min(ylo, p[1]); yhi = Math.max(yhi, p[1]); });
      }); });
      L.surfaces.forEach(function (s) {
        if (s.image) return;
        var e = s.stop && !s.glass ? s.sd + 2.5 : Math.abs(s.profile[0][1]);  // a lens reaches its edge
        ylo = Math.min(ylo, -e); yhi = Math.max(yhi, e);
      });
    });
    var pad = (yhi - ylo) * 0.04;
    return { zmin: zmin, zmax: zmax, ylo: ylo - pad, yhi: yhi + pad };
  }

test('layoutBounds ports the site', async (t) => {
  for (const name of FIXTURES) {
    await t.test(name, () => {
      const L = fixture(name);
      assert.deepEqual(layout2dModule.layoutBounds([L]), bounds([L]), `${name}: the site's box`);
    });
  }
});

// Plan #30, #52: review finding 5. A layout of the old shape is named; an all-dead fan is skipped.
// oracle: spec the recorded format allows a fan with every ray dropped (eleo-website scripts/layout.py drops dead rays)
test('old shape is named', () => {
  const old = { layout: [[[0, 1], [10, 0]]], profiles: [], zimg: 10 };
  assert.throws(() => ELEO.layout2D({ data: old }),
    { message: 'layout2D: data is not a recorded layout ({surfaces, rays}); see the plots README migration note' });
});

test('empty fan is skipped', () => {
  const L = fixture('merit-before');
  const E = { ...L, rays: L.rays.map((fan, k) => (k === 1 ? [] : fan)) };
  assert.deepEqual(layout2dModule.layoutBounds([E]), bounds([E]), "an empty fan leaves the site's box as the site computes it");
  for (const rays of ['fan', 'marginal-chief', 'chief']) {
    let svg;
    assert.doesNotThrow(() => { svg = ELEO.layout2D({ data: E, rays }); }, `${rays}: layout2D draws it`);
    const d = drawn(svg);
    const want = rays === 'fan' ? 14 : rays === 'chief' ? 2 : 6;
    assert.equal(d.polylines.length, want, `${rays}: the other fans' polylines`);
    assert.equal(d.dots.length, 2, `${rays}: a chief dot per drawn fan`);
  }
  roundTrip(E, ELEO.layout2D({ data: E, rays: 'fan' }));
});

// Plan #30, #54: review round 2 finding 1. A stop on a lens is labelled above its glass, not above its sd.
// Plan #30, #57: review round 3 finding 1. For every fixture, the sample, and the sample in the gallery's pinned box.
// oracle: property a label sits outside the glass it names
test("STO label above the stop's edge", () => {
  const pinned = { zmin: -8, zmax: sample.zimg + 4, ylo: -13.5, yhi: 13.5 }; // gallery/index.html SAMPLE_BOX
  const cases = [
    ...FIXTURES.map((name) => ({ name, L: fixture(name), o: {} })),
    { name: 'sample', L: sample.layout, o: {} },
    { name: 'sample, pinned box', L: sample.layout, o: { box: pinned } },
  ];
  for (const { name, L, o } of cases) {
    const svg = ELEO.layout2D({ data: L, ...o });
    const [s, , , , , ty] = geometry(svg).M;
    const sto = [...svg.matchAll(/<text\b[^>]*>STO<\/text>/g)].map((m) => attrs(m[0]));
    const stops = L.surfaces.filter((x) => x.stop);
    assert.equal(sto.length, stops.length, `${name}: one STO label per stop`);
    stops.forEach((stop, j) => {
      const i = L.surfaces.indexOf(stop);
      const onLens = stop.glass || L.surfaces[i - 1]?.glass;
      const edge = ty - (onLens ? Math.abs(stop.profile[0][1]) : stop.sd + 2.5) * s;
      assert.ok(+sto[j].y < edge, `${name}: STO y ${sto[j].y} px is above the stop's edge ${edge.toFixed(2)} px`);
    });
  }
});

// Plan #30, #55: review round 2 findings 2-3. A bad chief and a layout with no rays are named.
// oracle: spec the plan's `chief` is "one ray index per fan"
test('out-of-range chief is named', () => {
  const L = fixture('tolerance');
  for (const chief of [[9, 9, 9], [-1, 0, 0], [1.5, 0, 0]]) {
    assert.throws(() => ELEO.layout2D({ data: { ...L, chief } }),
      { message: 'layout2D: chief[0] is not a ray of fan 0' }, `chief ${JSON.stringify(chief)}`);
  }
});

test('no rays is named', () => {
  const L = fixture('tolerance');
  for (const rays of [[[], [], []], []]) {
    assert.throws(() => ELEO.layout2D({ data: { ...L, rays } }), { message: 'layout2D: no rays' });
  }
});

// Plan #30, #58: review round 3 finding 3. A fan that is not an array is named, not a bare TypeError.
// oracle: spec the plan's `rays: [field][ray][[z, y]…]`
test('a fan that is not an array is named', () => {
  const L = fixture('tolerance');
  for (const bad of [null, undefined, 3, {}]) {
    assert.throws(() => ELEO.layout2D({ data: { ...L, rays: [bad, L.rays[0]] } }),
      { message: /^layout2D: / }, `fan ${String(bad)}`);
  }
});

// Plan #30, #65: review M2 findings 2 and 4. A bad box, layoutBounds input or labels is named, like #52/#55/#58.
// oracle: spec index.d.ts LayoutBox {zmin, zmax, ylo, yhi} (a drawable box: finite, zmax > zmin, yhi > ylo),
// RecordedLayout {surfaces, rays} and Layout2DProps.labels: string[]
test('a bad box is named', () => {
  const L = fixture('tolerance'), good = layout2dModule.layoutBounds([L]);
  const bad = [
    { ...good, zmax: good.zmin }, { ...good, zmax: good.zmin - 1 }, { ...good, yhi: good.ylo },
    { ...good, zmin: NaN }, { ...good, yhi: Infinity }, { zmin: 0, zmax: 10 }, 5, 0, '',
  ];
  for (const box of bad) {
    assert.throws(() => ELEO.layout2D({ data: L, box }),
      { message: 'layout2D: box needs finite zmin < zmax and ylo < yhi' }, `box ${JSON.stringify(box)}`);
  }
});

test('layoutBounds names a bad input', () => {
  assert.throws(() => layout2dModule.layoutBounds([]), { message: 'layoutBounds: no layouts' });
  const L = fixture('tolerance');
  for (const bad of [null, {}, { surfaces: L.surfaces }, { rays: L.rays }, { surfaces: {}, rays: L.rays }]) {
    assert.throws(() => layout2dModule.layoutBounds([L, bad]),
      { message: 'layoutBounds: layouts[1] is not a recorded layout' }, `layout ${JSON.stringify(bad)?.slice(0, 40)}`);
  }
  // #67: a fan that isn't an array, a ray with no points and a layout with no rays are named, not a TypeError or an Infinity box.
  for (const bad of [null, 3, {}]) {
    assert.throws(() => layout2dModule.layoutBounds([L, { ...L, rays: [L.rays[0], bad] }]),
      { message: 'layoutBounds: layouts[1].rays[1] is not an array' }, `fan ${JSON.stringify(bad)}`);
  }
  assert.throws(() => layout2dModule.layoutBounds([{ ...L, rays: [L.rays[0], [L.rays[1][0], []]] }]),
    { message: 'layoutBounds: layouts[0].rays[1][1]: ray has no points' });
  for (const rays of [[], [[], []]]) {
    assert.throws(() => layout2dModule.layoutBounds([L, { ...L, rays }]),
      { message: 'layoutBounds: layouts[1] has no rays' }, `rays ${JSON.stringify(rays)}`);
  }
  // layout2D names an empty ray too, with or without a box.
  for (const box of [undefined, layout2dModule.layoutBounds([L])]) {
    assert.throws(() => ELEO.layout2D({ data: { ...L, rays: [L.rays[0], [[], ...L.rays[1].slice(1)]] }, box }),
      { message: 'layout2D: fan 1 ray 0 has no points' }, `box ${JSON.stringify(box)}`);
  }
});

test('labels must be an array', () => {
  const L = fixture('tolerance');
  for (const labels of ['0°', 3, { 0: 'a' }]) {
    assert.throws(() => ELEO.layout2D({ data: L, labels }),
      { message: 'layout2D: labels must be an array of strings' }, `labels ${JSON.stringify(labels)}`);
  }
});

// oracle: spec the plan's Public API list (layout2D, layoutBounds).
test('layout2d.js exports layout2D and layoutBounds only', () => {
  assert.deepEqual(Object.keys(layout2dModule).sort(), ['layout2D', 'layoutBounds']);
});

// Plan #30, #35: `box` is public. layoutBounds is on the ES entry and on ELEO (so eleo-plots.js has it), and a box
// alone sets the scale and the z origin. #61: a label at the box's left edge anchors at its start, not half clipped.
// oracle: spec the plan's transform matrix(s 0 0 -s tx ty), with s = width / (zmax - zmin), tx = -zmin·s and
// ty = 15 + yhi·s (#63: the label room above the geometry is a constant 15 px)
test('box pins the transform', () => {
  assert.equal(plots.layoutBounds, layoutBounds, 'the ES entry exports layoutBounds');
  assert.equal(plots.default.layoutBounds, layoutBounds, 'ELEO.layoutBounds, so eleo-plots.js has it');
  const before = fixture('merit-before'), after = fixture('merit-after');
  const box = plots.layoutBounds([before, after]);
  for (const W of [1000, 480]) {
    const s = W / (box.zmax - box.zmin);
    for (const L of [before, after]) {
      const [a, , , d, tx, ty] = geometry(plots.layout2D({ data: L, box, width: W })).M;
      assert.ok(Math.abs(a - s) <= 1e-6 && Math.abs(d + s) <= 1e-6, `width ${W}: scale ${a} is width / box z span ${s}`);
      assert.ok(Math.abs(tx + box.zmin * s) <= 1e-3, `width ${W}: z = box.zmin sits at x = 0`);
      assert.ok(Math.abs(ty - (15 + box.yhi * s)) <= 1e-3, `width ${W}: y = box.yhi sits 15 px down, the label room`);
    }
  }
  const edge = { zmin: 0, zmax: sample.zimg + 4, ylo: -13.5, yhi: 13.5 }; // the sample's stop is at z = 0
  const sto = attrs(/<text\b[^>]*>STO<\/text>/.exec(plots.layout2D({ data: sample.layout, box: edge }))[0]);
  assert.equal(sto['text-anchor'], 'start', 'STO at the left edge anchors at its start');
});

// Plan #30, #36: `labels[k]` is drawn once, near the image end of fan k's chief, inside the viewBox. Escaped as text.
// oracle: spec the plan's `labels` (text at the image end of each fan's chief); property a label stays in the viewBox
test('labels at the image', () => {
  const texts = (svg) => [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map((m) => ({ ...attrs(m[1]), text: m[2] }));
  const tol = fixture('tolerance');
  const cases = [
    { name: 'merit-before', L: fixture('merit-before'), labels: ['0°', '12°', '24°'] },
    { name: 'tolerance, chief', L: { ...tol, chief: tol.rays.map((fan) => fan.length - 1) }, labels: ['a', 'b', 'c'] },
    { name: 'empty fan', L: { ...tol, rays: tol.rays.map((fan, k) => (k === 1 ? [] : fan)) }, labels: ['a', 'b', 'c'] },
  ];
  for (const { name, L, labels } of cases) {
    for (const W of [1000, 480]) {
      const svg = ELEO.layout2D({ data: L, labels, width: W });
      const view = nums(/<svg\b[^>]*\bviewBox="([^"]*)"/.exec(svg)[1]);
      const [s, , , ns, tx, ty] = geometry(svg).M;
      const T = texts(svg);
      labels.forEach((label, k) => {
        const got = T.filter((t) => t.text === label), fan = L.rays[k];
        if (!fan.length) { assert.equal(got.length, 0, `${name}: no label for empty fan ${k}`); return; }
        assert.equal(got.length, 1, `${name} w${W}: label ${label} drawn once`);
        const ray = fan[L.chief?.[k] ?? Math.floor(fan.length / 2)], end = ray[ray.length - 1];
        const px = [end[0] * s + tx, end[1] * ns + ty], x = +got[0].x, y = +got[0].y;
        assert.ok(Math.hypot(x - px[0], y - px[1]) <= 16, `${name} w${W}: label ${label} (${x}, ${y}) within 16 px of the chief end (${px[0].toFixed(2)}, ${px[1].toFixed(2)})`);
        assert.ok(x >= 0 && x <= view[2] && y > 0 && y <= view[3], `${name} w${W}: label ${label} anchor inside the viewBox`);
        if (x > view[2] - 16) assert.equal(got[0]['text-anchor'], 'end', `${name} w${W}: label ${label} at the right edge anchors at its end`);
      });
    }
  }
  // #64: with labels and marks on, IMA sits below the image line's lower end and clears every label and the scale bar.
  // oracle: property labels don't overlap (IMA's anchor ≥ 12 px from every label's, to the SVG's 2 dp, inside the viewBox; IMA's and the scale text's x ranges apart at 8 px a character)
  for (const [name, L] of [...FIXTURES.map((f) => [f, fixture(f)]), ['sample', sample.layout]]) {
    for (const W of [1000, 480]) {
      const labels = L.rays.map((_, k) => `F${k}`);
      const svg = ELEO.layout2D({ data: L, labels, width: W });
      const view = nums(/<svg\b[^>]*\bviewBox="([^"]*)"/.exec(svg)[1]);
      const T = texts(svg), ima = T.filter((t) => t.text === 'IMA');
      assert.equal(ima.length, 1, `${name} w${W}: IMA drawn once`);
      const [ix, iy] = [+ima[0].x, +ima[0].y];
      assert.ok(iy >= 10 && iy <= view[3], `${name} w${W}: IMA (${ix}, ${iy}) inside the viewBox`);
      const [, , , ns, , ty] = geometry(svg).M, img = L.surfaces.find((x) => x.image);
      const low = Math.max(-img.sd, layoutBounds([L]).ylo) * ns + ty;
      assert.ok(iy >= low + 14 - 0.005, `${name} w${W}: IMA (${iy}) at least 14 px below the image line's lower end (${low.toFixed(2)})`);
      const span = (t) => { const x = +t.x, w = 8 * t.text.length, a = t['text-anchor'] || 'start'; return a === 'end' ? [x - w, x] : a === 'middle' ? [x - w / 2, x + w / 2] : [x, x + w]; };
      const bar = span(T.find((t) => /true scale/.test(t.text))), im = span(ima[0]);
      assert.ok(im[0] > bar[1] || im[1] < bar[0], `${name} w${W}: IMA x ${im.map((v) => v.toFixed(1))} clear of the scale text x ${bar.map((v) => v.toFixed(1))}`);
      T.filter((t) => labels.includes(t.text)).forEach((t) => {
        const d = Math.hypot(+t.x - ix, +t.y - iy);
        assert.ok(d >= 12 - 0.005, `${name} w${W}: IMA is ${d.toFixed(1)} px from label ${t.text}, want ≥ 12`);
      });
    }
  }
  const esc = ELEO.layout2D({ data: fixture('merit-before'), labels: ['a<b&c'] });
  assert.ok(esc.includes('>a&lt;b&amp;c</text>'), 'a label is escaped as text');
  assert.ok(!texts(ELEO.layout2D({ data: fixture('merit-before') })).some((t) => /°/.test(t.text)), 'no labels by default');
  // #67: a null or undefined entry skips that fan's label; more labels than fans is named.
  // oracle: spec index.d.ts Layout2DProps.labels (one label per fan of rays)
  const mb = fixture('merit-before');
  const skip = texts(ELEO.layout2D({ data: mb, labels: [null, 'b', undefined] })).map((t) => t.text);
  assert.ok(!skip.includes('null') && !skip.includes('undefined'), 'a null label draws no text');
  assert.equal(skip.filter((t) => t === 'b').length, 1, 'the other labels still draw');
  assert.throws(() => ELEO.layout2D({ data: mb, labels: [...mb.rays.map((_, k) => `F${k}`), 'extra'] }),
    { message: `layout2D: labels has ${mb.rays.length + 1} entries for ${mb.rays.length} fans` });
});

// Plan #30, #36: `marks: false` drops the STO and IMA text; the drawing is otherwise unchanged.
// oracle: spec the plan's `marks: false` (drops STO and IMA)
test('marks off', () => {
  for (const name of FIXTURES) {
    const L = fixture(name);
    const on = ELEO.layout2D({ data: L }), off = ELEO.layout2D({ data: L, marks: false });
    assert.match(on, />STO<\/text>/, `${name}: STO by default`);
    assert.match(on, />IMA<\/text>/, `${name}: IMA by default`);
    assert.equal(ELEO.layout2D({ data: L, marks: true }), on, `${name}: marks: true is the default`);
    assert.doesNotMatch(off, />(STO|IMA)<\/text>/, `${name}: no STO or IMA with marks: false`);
    assert.equal(off, on.replace(/<text\b[^>]*>(STO|IMA)<\/text>/g, ''), `${name}: only the STO and IMA text differ`);
  }
});

// Plan #30, outcome O2: layouts drawn with one box share a scale, and fields are labelled at the image.
// Plan #30, #63: review M2 finding 3. The label room above the geometry is the box's alone, so a pinned box
// gives one transform whatever the layouts' stops reach.
// oracle: property one box → one transform (O2)
test('shared box, pinned: stop reach does not move the transform', () => {
  const box = { zmin: -12, zmax: 130, ylo: -20, yhi: 7.5 };
  const before = fixture('merit-before');
  const small = structuredClone(before);
  small.surfaces.find((x) => x.stop).sd = 3;
  const [Mb, Ms] = [before, small].map((L) => geometry(ELEO.layout2D({ data: L, box })).M);
  assert.deepEqual(Ms, Mb, 'one box → one transform');
});

// oracle: property one box → one transform; metamorphic: a layout alone vs in a shared box differs only by the box
test('shared box', () => {
  const before = fixture('merit-before'), after = fixture('merit-after');
  const box = layoutBounds([before, after]);
  const labels = ['0°', '12°', '24°'];
  const drawings = [before, after].map((L) => ({ L, svg: ELEO.layout2D({ data: L, box, labels, marks: false }) }));
  const [Mb, Ma] = drawings.map(({ svg }) => geometry(svg).M);
  assert.deepEqual(Ma, Mb, 'one box → one transform');

  for (const { L, svg } of drawings) {
    // Metamorphic: the box is the only input that changes. The default box is the layout's own; passing it is a no-op,
    // and the shared box moves no glass or ray in mm.
    assert.equal(ELEO.layout2D({ data: L, box: layoutBounds([L]), labels, marks: false }), ELEO.layout2D({ data: L, labels, marks: false }),
      'the default box is layoutBounds([L])');
    const alone = drawn(ELEO.layout2D({ data: L, labels, marks: false })), shared = drawn(svg);
    assert.deepEqual(shared.polygons, alone.polygons, 'glass is the same in mm');
    assert.deepEqual(shared.polylines, alone.polylines, 'rays are the same in mm');

    // Each labels[k] sits at the image end of fan k's chief (the middle ray: merit records no chief), in viewBox px.
    const [s, , , ns, tx, ty] = geometry(svg).M;
    const texts = [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map((m) => ({ ...attrs(m[1]), text: m[2] }));
    labels.forEach((label, k) => {
      const got = texts.filter((t) => t.text === label);
      assert.equal(got.length, 1, `label ${label} drawn once`);
      const fan = L.rays[k], ray = fan[L.chief?.[k] ?? Math.floor(fan.length / 2)], end = ray[ray.length - 1];
      const px = [end[0] * s + tx, end[1] * ns + ty];
      const d = Math.hypot(+got[0].x - px[0], +got[0].y - px[1]);
      assert.ok(d <= 16, `label ${label} at (${got[0].x}, ${got[0].y}) px is within 16 px of fan ${k}'s chief end (${px[0].toFixed(2)}, ${px[1].toFixed(2)})`);
    });
  }
});
