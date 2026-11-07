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

// Plan #677 M2 (#740): spot's series label and keyAt, rayFan's key and keyAt.
import type { SpotSeries, SpotPanelsProps, RayFanProps } from '../../packages/plots/src/index';
import { spot, rayFan } from '../../packages/plots/src/index';

const ss: SpotSeries = { points: [[0, 1]], index: 0, label: '486.1 nm' };
const spotAt: SpotPanelsProps['keyAt'] = at;
const spotProps: SpotPanelsProps = { panels: [{ series: [ss] }], keyAt: spotAt };
const spotSvg: string = spot(spotProps);
const fanProps: RayFanProps = { key: true, keyAt: at };
const fanSvg: string = rayFan(fanProps);
spot({ panels: [{ series: [ss] }], grid: false });
// @ts-expect-error spot's keyAt is one of five places
spot({ panels: [{ series: [ss] }], keyAt: 'middle' });
// @ts-expect-error rayFan's keyAt is one of five places
rayFan({ key: true, keyAt: 'middle' });
export { spotSvg, fanSvg };

// Plan #677 M3 (#759): grid: false on curve, rayFan and bars.
import { bars } from '../../packages/plots/src/index';
const gridCurve: string = curve({ series: [s], grid: false });
const gridPanels: string = curve({ panels: [{ series: [s] }], grid: false });
const gridFan: string = rayFan({ grid: false });
const gridBars: string = bars({ categories: ['a'], series: [{ values: [1] }], grid: false });
const gridKind: string = curve({ kind: 'mtf', grid: false });
// @ts-expect-error grid is a boolean
curve({ series: [s], grid: 'off' });
// @ts-expect-error grid is a boolean on the kind call too
curve({ kind: 'mtf', grid: 'off' });
export { gridCurve, gridPanels, gridFan, gridBars, gridKind };
