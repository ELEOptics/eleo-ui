// Records every SVG renderer's output on the sample, with the gallery's options, from packages/plots/dist.
// Run it against a build of the plan's base (agent_docs/plans/162-curve-typed.md, O2); tests/unit/split.test.js
// then asserts the current build draws the same strings. Never re-record from code under test.
//   node scripts/record-renderers.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import ELEO from '../packages/plots/dist/index.js';
import SAMPLE from '../packages/plots/dist/sample.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../tests/fixtures/layouts/${name}.json`, import.meta.url), 'utf8'));

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
    'spot': () => ELEO.spot(),
    'throughFocus': () => ELEO.throughFocus(),
    'rayFan': () => ELEO.rayFan(),
    'rayFan-opd': () => ELEO.rayFan({ kind: 'opd' }),
    'curve-mtf': () => ELEO.curve({ kind: 'mtf' }),
    'curve-fieldCurvature': () => ELEO.curve({ kind: 'fieldCurvature' }),
    'curve-distortion': () => ELEO.curve({ kind: 'distortion' }),
    'curve-chromaticFocus': () => ELEO.curve({ kind: 'chromaticFocus' }),
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
