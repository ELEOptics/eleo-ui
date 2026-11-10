// Plan #804 M1 (#809): interact, InteractOptions, HoverEvent and readout compile; a bad option or axis spec does not.
// oracle: spec packages/plots/src/interact.js (interact, readout)
import type { HoverEvent, InteractOptions, ReadoutAxis } from '../../packages/plots/src/index';
import ELEO, { interact, readout } from '../../packages/plots/src/index';

declare const host: HTMLElement;
const seen: (HoverEvent | null)[] = [];
const opts: InteractOptions = { onhover: (e) => { seen.push(e); } };
const stop: () => void = interact(host, opts);
interact(host);
interact(host, {});
const ev: HoverEvent = { x: 1, y: 2, series: { index: 0, label: 'T', role: 'tangential' }, panel: 1 };
const bare: HoverEvent = { x: 1, y: 2, series: { index: 0 } };
const ax: ReadoutAxis = { unit: 'mm', digits: 2 };
const a: string = readout(ev, { x: ax, y: { unit: 'um' } });
const b: string = readout(bare);
const c: string = readout(null, { x: {} });
const d: string = ELEO.readout(ev);
const e: () => void = ELEO.interact(host, opts);
// @ts-expect-error onhover takes a hover event or null, not a string
interact(host, { onhover: (e: string) => {} });
// @ts-expect-error digits is a number
readout(ev, { x: { digits: '2' } });
// @ts-expect-error a hover event needs its series
const noSeries: HoverEvent = { x: 1, y: 2 };
// @ts-expect-error the pointer target is an element
interact('#plot', opts);
