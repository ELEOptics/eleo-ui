// A typed bars call and a limited curve call compile under --strict; a color key and an x limit on bars do not (#296, plan 284).
// oracle: spec ADR-0001 (roles, no color option) and plan #284 Decisions (BarSeries, BarPlotProps, PlotLimit)
import type { BarPlotProps, BarSeries, CurvePlotProps, PlotLimit } from '../../packages/plots/src/index';
import ELEO, { bars, curve } from '../../packages/plots/src/index';

// A Seidel call: surfaces as categories, a term per series, a total group, one y limit; a gap is null.
const sm: BarSeries = { values: [0.012, -0.004, null, 0.001], index: 0, label: 'SI' };
const seidel: BarPlotProps = {
  categories: ['1', '2', '3', '4'],
  series: [sm, { values: [0.002, 0, 0.003, -0.001], index: 1, label: 'SII' }],
  total: 'Σ',
  y: { label: 'Seidel sum', unit: 'mm' },
  limits: [{ y: [-0.005, 0.005], label: 'tolerance' }, { y: 0.01 }],
  width: 460,
  height: 260,
};
const a: string = bars(seidel);

// A merit-share call: one unsigned series, a bar per operand name.
const b: string = ELEO.bars({ categories: ['RMS', 'MTF', 'Distortion'], series: [{ values: [0.5, 0.3, 0.2] }], y: { label: 'Share' } });

// A curve call with limits (a line, a band, an x limit) and the limit role.
const limits: PlotLimit[] = [{ y: 0.5, label: 'spec' }, { x: [100, 200] }];
const typed: CurvePlotProps = {
  series: [{ points: [[0, 1], [100, 0.5]], role: 'tangential' }, { points: [[0, 0.4], [400, 0.4]], role: 'limit' }],
  limits,
};
const c: string = curve(typed);
curve({ panels: [{ series: [{ points: [[0, 1], [null, 2]] }] }], limits: [{ x: 0.5 }] });

// @ts-expect-error callers never give a color (ADR-0001)
bars({ categories: ['1'], series: [{ values: [1], color: 'red' }] });
// @ts-expect-error a category axis has no x value to draw a limit at
bars({ categories: ['1'], series: [{ values: [1] }], limits: [{ x: 0.5 }] });
// A non-literal call (no excess-property check): limits with kind throws at run time, so it must not type-check.
const kindLimits = { kind: 'mtf' as const, limits: [{ y: 0.5 }] };
// @ts-expect-error CurveKindProps has no limits
curve(kindLimits);
export { a, b, c };
