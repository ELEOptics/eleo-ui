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

// Plan #677 M2 (#740): spot's series label and keyAt.
import type { SpotSeries, SpotPanelsProps } from '../../packages/plots/src/index';
import { spot, throughFocus } from '../../packages/plots/src/index';

const ss: SpotSeries = { points: [[0, 1]], index: 0, label: '486.1 nm' };
const spotAt: SpotPanelsProps['keyAt'] = at;
const spotProps: SpotPanelsProps = { panels: [{ series: [ss] }], keyAt: spotAt };
const spotSvg: string = spot(spotProps);
spot({ panels: [{ series: [ss] }], grid: false });
throughFocus({ defocus: [0], rows: [], grid: false });
// @ts-expect-error throughFocus's grid is a boolean
throughFocus({ defocus: [0], rows: [], grid: 'off' });
// @ts-expect-error spot's keyAt is one of five places
spot({ panels: [{ series: [ss] }], keyAt: 'middle' });
export { spotSvg };

// Plan #677 M3 (#759): grid: false on curve and bars.
import { bars } from '../../packages/plots/src/index';
const gridCurve: string = curve({ series: [s], grid: false });
const gridPanels: string = curve({ panels: [{ series: [s] }], grid: false });
const gridBars: string = bars({ categories: ['a'], series: [{ values: [1] }], grid: false });
// @ts-expect-error grid is a boolean
curve({ series: [s], grid: 'off' });
export { gridCurve, gridPanels, gridBars };
