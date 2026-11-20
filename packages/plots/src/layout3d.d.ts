/* @eleoptics/plots/layout3d: layout3D, a canvas renderer that draws a recorded layout with three.js (an optional peer dependency, >=0.170 <1;
   the classic script eleo-layout3d.js bundles it). It reads tokens.css variables at draw time: call it again after a theme or palette change. */
import type { RecordedLayout } from './index.js';

export interface Layout3DProps {
  /** The recorded layout: its surfaces' profiles make the mesh, its rays are drawn in the air. Geometry is cached per `data` object: pass changed data as a new object. */
  data: RecordedLayout;
  /** Which rays to draw: the marginal and chief rays of each field (default), every ray, the chief only, or none. */
  rays?: "marginal-chief" | "fan" | "chief" | false;
  /** The camera: isometric (default, yaw -45, pitch 35.264), a side view with the optical axis to the right (`front`, as layout2D draws it), or from above (`top`). `yaw` and `pitch` override it. */
  view?: "iso" | "front" | "top";
  /** View angles in degrees, overriding `view`. A missing one takes the iso value: yaw -45, pitch 35.264. */
  yaw?: number;
  pitch?: number;
  /** Scale in px/mm. Default: the scale that frames the faces and rays. */
  scale?: number;
  width?: number;
  height?: number;
}
/** Draws a recorded layout into a 2D canvas. Throws `layout3D: WebGL is not available` when the browser gives no WebGL context. */
export declare function layout3D(canvas: HTMLCanvasElement, props: Layout3DProps): void;
