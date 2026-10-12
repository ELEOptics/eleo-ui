// Round-trip helpers shared by the plot tests (plan #232, #233): read a drawn SVG back into data coordinates.
// A plain module under tests/unit/helpers/, outside the tests/unit/*.test.js glob, so importing it registers no tests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export const TOL_PX = 0.5;
export const SIZES = [[460, 300], [920, 600]];
export const fixture = (name) => JSON.parse(readFileSync(new URL(`../../fixtures/phos-core/${name}.json`, import.meta.url), 'utf8'));
export const nums = (s) => s.trim().split(/[\s,]+/).filter(Boolean).map(Number);

// Path data or polyline points to subpaths of [x, y]. `M` starts a subpath, `L` extends it; `h` (a dot: `M x y h0`) draws at its `M` point and adds none.
export function subpaths(d) {
  const out = [];
  for (const m of d.matchAll(/([MLh])\s*([^MLh]*)/g)) {
    if (m[1] === 'h') continue;
    const n = nums(m[2]);
    for (let i = 0; i < n.length; i += 2) {
      if (m[1] === 'M' && i === 0) out.push([]);
      out.at(-1).push([n[i], n[i + 1]]);
    }
  }
  return out;
}
const PATH = /<(?:path|polyline)\b[^>]*?\b(?:d="([^"]*)"|points="([^"]*)")/;
const LIMIT = /\bclass="eleo-limit"/;
// Series are the paths that are not limit marks (`class="eleo-limit"`, plan #284): a limit is read by marks().
function readPaths(body) {
  return [...body.matchAll(/<(?:path|polyline)\b[^>]*>/g)].filter((t) => !LIMIT.test(t[0])).map((t) => PATH.exec(t[0])).filter(Boolean).map((m) => (m[1] !== undefined ? subpaths(m[1]) : [subpaths(`M${m[2].trim().replace(/ /g, ' L')}`)[0]]));
}

// The series group: the first `<g transform="matrix(a b c d e f)">` inside a curve's nested <svg>.
// Its paths are in data coordinates (non-scaling stroke), one per series, in series order, each as its points (a break joins the subpaths).
export function seriesGroup(svg) {
  const open = /<g\b[^>]*\btransform="matrix\(([^)]*)\)"[^>]*>/.exec(svg);
  assert.ok(open, 'the SVG has a <g transform="matrix(…)"> holding the series');
  const end = svg.indexOf('</g>', open.index);
  const body = svg.slice(open.index, end);
  return { M: nums(open[1]), body, paths: readPaths(body).map((p) => p.flat()) };
}

// The <rect>s or <line>s of a group (seriesGroup's or a panelGroups entry's `body`, or markup itself), each as its numeric attributes
// plus `limit`: true for a limit mark (`class="eleo-limit"`). Attributes are in the group's data units; non-numeric ones are left out.
export function marks(group, tag) {
  assert.ok(tag === 'rect' || tag === 'line', `marks reads <rect> or <line>, not <${tag}>`);
  const body = typeof group === 'string' ? group : group.body;
  assert.equal(typeof body, 'string', 'marks takes a group with a body, or markup');
  return [...body.matchAll(new RegExp(`<${tag}\\b([^>]*?)/?>`, 'g'))].map((m) => {
    const out = { limit: LIMIT.test(m[1]) };
    for (const a of m[1].matchAll(/\b([\w-]+)="([^"]*)"/g)) if (a[2].trim() !== '' && Number.isFinite(Number(a[2]))) out[a[1]] = Number(a[2]);
    return out;
  });
}

// Every panel of a paneled plot: its nested <svg> box (x, y, width, height), its transform M, and its paths,
// one per series, each an array of subpaths (a null point splits a series into subpaths).
export function panelGroups(svg) {
  const attr = (tag, k) => { const m = new RegExp(`\\b${k}="([\\d.\\-]+)"`).exec(tag); return m ? +m[1] : NaN; };
  return [...svg.matchAll(/(<svg\b[^>]*>)\s*<g\b[^>]*\btransform="matrix\(([^)]*)\)"[^>]*>/g)].map((m) => {
    const end = svg.indexOf('</g>', m.index);
    const body = svg.slice(m.index + m[0].length, end);
    return {
      body,
      box: { x: attr(m[1], 'x'), y: attr(m[1], 'y'), pw: attr(m[1], 'width'), ph: attr(m[1], 'height') },
      M: nums(m[2]),
      paths: readPaths(body),
    };
  });
}

// px = M·data; the inverse recovers data from px.
export const toPx = ([a, b, c, d, e, f], [x, y]) => [a * x + c * y + e, b * x + d * y + f];
export function toData([a, b, c, d, e, f], [px, py]) {
  const det = a * d - b * c;
  assert.ok(Math.abs(det) > 0, 'the transform is invertible');
  return [(d * (px - e) - c * (py - f)) / det, (a * (py - f) - b * (px - e)) / det];
}

// The plot frame, from the SVG itself: the first nested <svg>'s box and the x tick lines with their labels.
export function frame(svg) {
  const box = /<svg\b[^>]*\bx="([\d.]+)"[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"[^>]*>\s*<g\b[^>]*transform="matrix/.exec(svg);
  assert.ok(box, 'the nested <svg> carries x, width and height');
  const ticks = [...svg.matchAll(/<line x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)" y2="[\d.]+" stroke="var\(--plot-grid\)"\/><text class="eleo-tick"[^>]*>([^<]*)<\/text>/g)]
    .filter((m) => m[1] === m[2]).map((m) => ({ x1: +m[1], tick: Number(m[3].replace(/−/g, '-')) }));
  return { L: +box[1], pw: +box[2], ph: +box[3], ticks };
}

// The transform is held to the caller's ranges, not to itself: x.range maps to [0, pw], y.range to [ph, 0], and each drawn x tick sits at its value.
export function assertPinned(M, svg, x, y, msg) {
  const { L, pw, ph, ticks } = frame(svg);
  const [x0, y0] = toPx(M, [x.range[0], y.range[0]]), [x1, y1] = toPx(M, [x.range[1], y.range[1]]);
  assert.ok(Math.hypot(x0 - 0, y0 - ph) <= TOL_PX, `${msg}: range start maps to [0, ${ph}], got [${x0}, ${y0}]`);
  assert.ok(Math.hypot(x1 - pw, y1 - 0) <= TOL_PX, `${msg}: range end maps to [${pw}, 0], got [${x1}, ${y1}]`);
  assert.ok(ticks.length >= 2, `${msg}: x tick lines found`);
  for (const t of ticks) assert.ok(Math.abs(t.x1 - L - toPx(M, [t.tick, y.range[0]])[0]) <= TOL_PX, `${msg}: tick ${t.tick} at its value`);
}
