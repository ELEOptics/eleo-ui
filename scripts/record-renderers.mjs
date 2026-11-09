// Records every SVG renderer's output on the sample, with the gallery's options, from packages/plots/dist.
// Run it against a build of the plan's base (agent_docs/plans/162-curve-typed.md, O2); tests/unit/split.test.js
// then asserts the current build draws the same strings. Never re-record from code under test,
// except that the layout2D entries were re-recorded at plan #337 #382 by the user's choice (CR #381),
// and again at plan #512 #519 by the user's choice at approval (draws to ADR-0003's rule, after #518),
// the seidel and seidel-terms entries were recorded at plan #677 #679 from main's build (before #680),
// and the seidel entry alone re-recorded at plan #677 #556 by the user's choice (CR #703: its limit label offsets scale with the text),
// and the throughFocus entry at plan #512 #570 (after #525, same choice); #528 re-runs it if a later M2 change moves it,
// and the throughFocus entry again at plan #677 #783 and #785 by the user's choice (CR #780: one panel function; CR #781: tick labels on the outer edges).
//   node scripts/record-renderers.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import ELEO from '../packages/plots/dist/index.js';
import SAMPLE from '../packages/plots/dist/sample.js';
import '../tests/fixtures/phos-core/adapters.js'; // a classic script: assigns globalThis.ELEOAdapters

const fixture = (name) => JSON.parse(readFileSync(new URL(`../tests/fixtures/layouts/${name}.json`, import.meta.url), 'utf8'));

// The recording with `status` deleted (a copy; the fixture is untouched): plan #642 O3 defines these entries as the legacy drawing (CR #653).
const phosLayout = (name) => {
  const layout = JSON.parse(readFileSync(new URL(`../tests/fixtures/phos-core/${name}-layout.json`, import.meta.url), 'utf8'));
  delete layout.status;
  return layout;
};

const seidelRecording = () => JSON.parse(readFileSync(new URL('../tests/fixtures/phos-core/achromat-seidel.json', import.meta.url), 'utf8'));

// The calls the gallery makes (gallery/index.html, SVG and legend tiles), keyed by tile.
export function draws() {
  const box = { zmin: -8, zmax: SAMPLE.zimg + 4, ylo: -13.5, yhi: 13.5 };
  const before = fixture('merit-before'), after = fixture('merit-after'), glasses = fixture('analysis-glasses');
  const meritBox = ELEO.layoutBounds([before, after]);
  const merit = (data) => ELEO.layout2D({ data, width: 1000, box: meritBox, labels: ['0°', '12°', '24°'], marks: false });
  const out = {
    'layout2D': () => ELEO.layout2D({ width: 1000, box }),
    'layout2D-fan': () => ELEO.layout2D({ width: 1000, box, colorBy: 'wavelength', rays: 'fan' }),
    'merit-before': () => merit(before),
    'merit-after': () => merit(after),
    'layout2D-glasses': () => ELEO.layout2D({ data: glasses, width: 1000, marks: false }),
    // The recorded Wandersleb and Cassegrain through the adapter, as the gallery draws them (plan #642 O3: the base before `status`).
    ...Object.fromEntries(['wandersleb', 'cassegrain'].flatMap((name) => [1000, 600].map((width) => [
      `layout2D-${name}-${width}`,
      () => ELEO.layout2D({ ...globalThis.ELEOAdapters.layout(phosLayout(name)), width }),
    ]))),
    'throughFocus': () => ELEO.throughFocus(),
    // The recorded achromat Seidel sums through the adapter, as the gallery's seidel tiles draw them (plan #677 #679: before the key extraction).
    'seidel': () => ELEO.bars({ ...globalThis.ELEOAdapters.seidel(seidelRecording()), limits: [{ y: 0.05, label: '0.05 mm' }], width: 1000 }),
    'seidel-terms': () => ELEO.bars({ ...globalThis.ELEOAdapters.seidel(seidelRecording(), { by: 'term' }), width: 1000 }),
    'legend-field': () => ELEO.legend('field'),
    'legend-wavelength': () => ELEO.legend('wavelength'),
    'legend-ts': () => ELEO.legend('ts'),
    'glassLegend': () => ELEO.glassLegend(glasses),
  };
  for (const i of ELEO.icons.optical) out[`icon-${i.name}-glass`] = () => ELEO.icon(i.name, { style: 'glass', size: 32, label: i.title });
  for (const i of ELEO.icons.interface) out[`icon-${i.name}`] = () => ELEO.icon(i.name, { size: 24, label: i.title });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const recorded = Object.fromEntries(Object.entries(draws()).map(([k, f]) => [k, f()]));
  const path = new URL('../tests/fixtures/renderers-baseline.json', import.meta.url);
  writeFileSync(path, JSON.stringify(recorded, null, 1) + '\n');
  console.log(`wrote tests/fixtures/renderers-baseline.json (${Object.keys(recorded).length} renderers)`);
}
