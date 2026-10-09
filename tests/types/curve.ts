// A typed curve call compiles under --strict; a color option and an unknown role do not (#178, plan 162).
// oracle: spec ADR-0001 (roles, no color option) and plan #162 Decisions (CurveSeries, CurveAxis, CurvePlotProps)
import type { CurvePlotProps, CurveSeries } from '../../packages/plots/src/index';
import { curve } from '../../packages/plots/src/index';

const mtf: CurveSeries = { points: [[0, 1], [100, 0.62]], index: 0, role: 'tangential' };
const typed: CurvePlotProps = {
  series: [mtf, { points: [[0, 1], [100, 0.5]], role: 'reference' }],
  x: { label: 'Spatial frequency', unit: 'cycles/mm', range: [0, 400], ticks: [0, 100, 200, 300, 400] },
  y: { label: 'Modulus', range: [0, 1] },
  width: 460,
};
const html: string = curve(typed);
curve({ kind: 'mtf', width: 300 });
curve({ series: [{ points: [[0, 0]] }] });

// @ts-expect-error roles are tangential, sagittal or reference
const badRole: CurveSeries = { points: [[0, 1]], role: 'meridional' };
// @ts-expect-error callers never give a color (ADR-0001)
curve({ series: [{ points: [[0, 1]], color: 'red' }] });
// @ts-expect-error nor a plot-level color
curve({ series: [mtf], color: 'red' });
export { html, badRole };
