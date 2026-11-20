import { render3d } from "./layout3dThree.js";

/**
 * Draws a recorded layout in 3D (an orthographic three.js scene, isometric by default) into a 2D canvas; see `render3d`.
 * @param {HTMLCanvasElement} canvas
 * @param {{ data: *, width?: number, height?: number, view?: "iso" | "front" | "top", yaw?: number, pitch?: number, scale?: number, rays?: "marginal-chief" | "chief" | "fan" | false }} o
 */
export function layout3D(canvas, o) {
  return render3d(canvas, o);
}
