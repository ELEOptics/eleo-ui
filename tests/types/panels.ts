// A typed panel curve call and a typed spot call compile under --strict; a color key does not (#242, plan 232; #243 types them).
// oracle: spec roadmap Constraints (typed API alongside the old one) and plan #232 Decisions (CurvePanel, SpotPanel, SpotSeries)
import type { CurvePanel, CurvePlotProps, SpotDiagramProps, SpotPanel, SpotSeries } from '../../packages/plots/src/index';
import { curve, spot } from '../../packages/plots/src/index';

const fan: CurvePanel = { title: '1.0° · Py', series: [{ points: [[-1, 2], [0, 0], [0.5, null], [1, -3]], index: 0 }] };
const panelled: CurvePlotProps = {
  panels: [fan, { series: [{ points: [[-1, 1], [1, -1]], index: 1 }] }],
  columns: 3,
  x: { label: 'Pupil', range: [-1, 1] },
  y: { label: 'Ray error', unit: 'µm' },
  width: 460,
};
const html: string = curve(panelled);

const dots: SpotSeries = { points: [[0.1, -0.2], [0.3, 0.4]], index: 0 };
const panel: SpotPanel = { title: '0.0°', series: [dots], airy: 2.4 };
const spots: SpotDiagramProps = {
  panels: [panel],
  origin: 'chief ray',
  reference: 'centroid',
  showStats: true,
  showAiry: true,
  scale: 'common',
  half: 5,
  unit: 'µm',
  label: 'Spot diagrams',
  width: 300,
};
const svg: string = spot(spots);

// @ts-expect-error callers never give a color (ADR-0001)
curve({ panels: [{ series: [{ points: [[0, 1]], color: 'red' }] }] });
// @ts-expect-error nor a plot-level color
curve({ panels: [fan], color: 'red' });
// @ts-expect-error nor a spot series color
spot({ panels: [{ series: [{ points: [[0, 0]], color: 'red' }] }] });
const sampled: string = spot({ colorBy: 'field', showStats: false, reference: 'chief' });
// @ts-expect-error the sample call ignores a label (spotPanels hard-codes it)
spot({ colorBy: 'field', label: 'x' });
export { html, svg, sampled };
