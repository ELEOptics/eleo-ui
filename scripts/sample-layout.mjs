// One-off conversion (plan #30, #33): the sample's `layout` and `layoutWl` become recorded layouts,
// {surfaces: [{z, sd, stop, image, glass, profile: [[z, y] × 41]}], rays: [field][ray][[z, y]…]}, in mm.
// Surfaces come from `profiles` (crown then flint), the stop is surface 0, and the image sits at `zimg`
// with sd = the largest |y| of the rays there. No `chief`: the 7-ray fans' middle ray (3) is the chief.
// Run once: node scripts/sample-layout.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../packages/plots/src/sample.json', import.meta.url);
const D = JSON.parse(readFileSync(file, 'utf8'));
if (D.layout.surfaces) { console.log('sample.json: layout is already recorded'); process.exit(0); }

const GLASS = ['crown', 'flint', null];
function recorded(rays) {
  const surfaces = D.profiles.map((p, i) => ({
    z: p.z, sd: p.sd, stop: i === 0, image: false, glass: GLASS[i],
    profile: p.zs.map((z, j) => [z, p.ys[j]]),
  }));
  const sd = Math.max(...rays.flat().map((r) => Math.abs(r[r.length - 1][1])));
  const n = 41;
  surfaces.push({
    z: D.zimg, sd, stop: false, image: true, glass: null,
    profile: Array.from({ length: n }, (_, j) => [D.zimg, +(-sd + (2 * sd * j) / (n - 1)).toFixed(4)]),
  });
  return { surfaces, rays };
}

D.layout = recorded(D.layout);
D.layoutWl = { field: D.layoutWl.field, ...recorded(D.layoutWl.rays) };
writeFileSync(file, JSON.stringify(D));
