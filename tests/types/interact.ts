// Plan #804 M1 (#809): interact, InteractOptions, HoverEvent and readout compile; a bad option or axis spec does not.
// oracle: spec packages/plots/src/interact.js (interact, readout)
import type { HoverEvent, InteractOptions, ReadoutAxis, SelectEvent } from '../../packages/plots/src/index';
import ELEO, { interact, readout } from '../../packages/plots/src/index';

declare const host: HTMLElement;
const seen: (HoverEvent | null)[] = [];
const opts: InteractOptions = { onhover: (e) => { seen.push(e); } };
const full: InteractOptions = { axes: { x: { unit: 'mm' }, y: { digits: 3 } }, marks: false, tooltip: false };
const partial: InteractOptions = { axes: { y: {} } };
const stop: () => void = interact(host, opts);
interact(host);
interact(host, {});
const ev: HoverEvent = { x: 1, y: 2, series: { index: 0, label: 'T', role: 'tangential' }, panel: 1 };
// series.index is the series' position in its `series` array (or panel), not its palette slot (#842).
const position: number | undefined = ev.series?.index;
const bare: HoverEvent = { x: 1, y: 2, series: { index: 0 } };
// A reading between two points carries interpolated and the pair of point indices; a snapped point carries neither (#876).
const between: HoverEvent = { x: 1.5, y: 2, series: { index: 0 }, interpolated: true, segment: [3, 4] };
// At a segment's end the clamped projection can equal a data point and still be an interpolated reading.
const clampedEnd: HoverEvent = { x: 5, y: 5, series: { index: 0 }, interpolated: true, segment: [0, 1] };
const flag: true | undefined = ev.interpolated;
const pair: [number, number] | undefined = between.segment;
// @ts-expect-error interpolated is only ever true
const notInterp: HoverEvent = { x: 1, y: 2, series: { index: 0 }, interpolated: false };
// @ts-expect-error segment is a pair
const triple: HoverEvent = { x: 1, y: 2, series: { index: 0 }, segment: [1, 2, 3] };
const ax: ReadoutAxis = { unit: 'mm', digits: 2 };
const a: string = readout(ev, { x: ax, y: { unit: 'um' } });
const b: string = readout(bare);
const c: string = readout(null, { x: {} });
const d: string = ELEO.readout(ev);
const e: () => void = ELEO.interact(host, opts);
// @ts-expect-error onhover takes a hover event or null, not a string
interact(host, { onhover: (e: string) => {} });
// @ts-expect-error marks is a boolean
interact(host, { marks: 'yes' });
// @ts-expect-error tooltip is a boolean
interact(host, { tooltip: 1 });
// @ts-expect-error an axis spec is an object, not a unit string
interact(host, { axes: { x: 'mm' } });
// @ts-expect-error digits is a number
readout(ev, { x: { digits: '2' } });
// @ts-expect-error a hover event needs its position
const noPosition: HoverEvent = { y: 2 };
// The M2 hover keys (#819): a bar, a grid and a polar map sample, and a layout2D ray run (no series).
const barHover: HoverEvent = { x: 2, y: 0.4, series: { index: 0 }, category: 2 };
const gridHover: HoverEvent = { x: 1, y: 2, row: 0, column: 3, value: 0.5 };
const polarHover: HoverEvent = { x: 1, y: 2, ring: 1, spoke: 4 };
const runHover: HoverEvent = { x: 10, y: 1, field: 0, ray: 3, status: 'ok', interpolated: true, segment: [0, 1] };
const cat: number | undefined = barHover.category;
// @ts-expect-error row is a number
const badRow: HoverEvent = { x: 1, y: 2, row: '0' };
// Select events (#819): a click names the mark's series, bar, surface or field.
const sel: SelectEvent = { series: { index: 1, label: 'T', role: 'tangential' }, panel: 0 };
const selBar: SelectEvent = { series: { index: 0 }, category: 2 };
const selSurface: SelectEvent = { surface: 3 };
const selField: SelectEvent = { field: 1 };
const withSelect: InteractOptions = { onselect: (e) => { const s: SelectEvent = e; }, values: [[1, 2]] };
// @ts-expect-error onselect takes a select event, not a string
interact(host, { onselect: (e: string) => {} });
// @ts-expect-error surface is a number
const badSurface: SelectEvent = { surface: 'glass' };
// @ts-expect-error onselect takes a function
interact(host, { onselect: 1 });
// @ts-expect-error the pointer target is an element
interact('#plot', opts);
// The value axis (#901): the readout appends ` = <value>` using axes.value; a masked sample sends value null.
interact(host, { axes: { x: { unit: 'mm' }, y: {}, value: { unit: 'W', digits: 1 } } });
const withValue: string = readout(gridHover, { x: { unit: 'mm' }, y: { unit: 'mm' }, value: { unit: 'W', digits: 1 } });
const maskedHover: HoverEvent = { x: 1, y: 2, row: 0, column: 3, value: null };
const maskedValue: number | null | undefined = maskedHover.value;
// @ts-expect-error value is a number or null
const badValue: HoverEvent = { x: 1, y: 2, value: 'high' };
