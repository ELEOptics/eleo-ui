// Plan #677 M1 (#681): curve's series label, key and keyAt compile; a color on a key entry does not.
// oracle: spec packages/plots/src/index.d.ts (PlotKeyEntry, PlotKeyAt)
import type { CurveSeries, CurvePlotProps, PlotKeyEntry, PlotKeyAt } from '../../packages/plots/src/index';
import { curve } from '../../packages/plots/src/index';

const s: CurveSeries = { points: [[0, 1]], index: 0, role: 'tangential', label: '0.0° T' };
const entry: PlotKeyEntry = { label: 'T', role: 'sagittal', index: 1 };
const at: PlotKeyAt = 'top-right';
const props: CurvePlotProps = { series: [s], key: [entry], keyAt: at };
const html: string = curve(props);
curve({ panels: [{ series: [s] }], key: [entry], keyAt: 'below' });
// @ts-expect-error keyAt is one of five places
curve({ series: [s], keyAt: 'middle' });
// @ts-expect-error callers never give a color (ADR-0001)
const colored: PlotKeyEntry = { label: 'T', color: 'red' };
export { html, colored };
