// Layout3DProps: data is a RecordedLayout, rays is a ray set name or false, the view options are numbers.
// oracle: spec plan #1193 item #1197 (Layout3DProps)
import type { RecordedLayout } from '../../packages/plots/src/index.js';
import type { Layout3DProps } from '../../packages/plots/src/layout3d.js';
declare const layout: RecordedLayout;
const ok: Layout3DProps = { data: layout, rays: 'fan', yaw: -38, pitch: 16, scale: 4, width: 560, height: 320 };
const views: Layout3DProps[] = [{ data: layout, view: 'iso' }, { data: layout, view: 'front' }, { data: layout, view: 'top' }];
void views;
// @ts-expect-error view is a named preset, not a number
const badView: Layout3DProps = { data: layout, view: 3 };
void badView;
const off: Layout3DProps = { data: layout, rays: false };
void ok; void off;
// @ts-expect-error data is required
const noData: Layout3DProps = {};
// @ts-expect-error rays is a set name or false, not true
const bad: Layout3DProps = { data: layout, rays: true };
// @ts-expect-error data is a RecordedLayout, not a number
const badData: Layout3DProps = { data: 3 };
void noData; void bad; void badData;
// oracle: spec plan #1193 item #1227 (layout3D needs props: the runtime throws without data)
import { layout3D } from '../../packages/plots/src/layout3d.js';
import * as main from '../../packages/plots/src/index.js';
declare const canvas: HTMLCanvasElement;
layout3D(canvas, { data: layout });
// @ts-expect-error props are required, layout3D(canvas) always throws
layout3D(canvas);
// @ts-expect-error layout3D left the main entry (it needs three, an optional peer: import it from the layout3d entry)
main.layout3D;
// @ts-expect-error nor is it on the default object
main.default.layout3D;
