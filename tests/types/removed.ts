// Plan #1258 (row K, the sample-free minor): one @ts-expect-error block per removed call, appended by the item that removes it
// (#1205 throughFocus, #1206 curve kind, #1207 rayFan, #1208 spot sample, #1209 map2D canvas, #1210 LayoutSystem, #1212 useSample).
// Each block is red as an "unused @ts-expect-error directive" until its .d.ts change lands.
// oracle: spec plan #1258's removal table (Milestones)
import { curve, map2D, spot, throughFocus } from '../../packages/plots/src/index';
// #1205 throughFocus: the sample call (no defocus, no rows) is not a call any more.
// @ts-expect-error throughFocus needs defocus and rows
throughFocus({});
// @ts-expect-error throughFocus takes no `data`: the sample is gone
throughFocus({ defocus: [0], rows: [], data: {} });
// #1206 curve kind: a `kind` call is not a call any more.
// @ts-expect-error curve takes series or panels, not an analysis kind
curve({ kind: 'mtf' });
// #1207 rayFan: not exported, and RayFanProps with it.
// @ts-expect-error rayFan was removed
import { rayFan } from '../../packages/plots/src/index';
// @ts-expect-error RayFanProps was removed
import type { RayFanProps } from '../../packages/plots/src/index';
// #1208 spot sample: a spot call without panels is not a call any more, and SpotSampleProps is not exported.
// @ts-expect-error spot needs panels
spot({});
// @ts-expect-error spot takes no colorBy: the sample is gone
spot({ panels: [], colorBy: 'field' });
// @ts-expect-error SpotSampleProps was removed
import type { SpotSampleProps } from '../../packages/plots/src/index';
// #1209 map2D canvas: a canvas is not a call any more, and Map2DProps is not exported.
// @ts-expect-error map2D takes a typed grid, not a canvas
map2D(document.createElement('canvas'), { kind: 'psf' });
// @ts-expect-error map2D takes a typed grid, not a canvas
map2D(document.createElement('canvas'));
// @ts-expect-error Map2DProps was removed
import type { Map2DProps } from '../../packages/plots/src/index';
export type Gone = [typeof rayFan, RayFanProps, SpotSampleProps, Map2DProps];
export {};
