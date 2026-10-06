// @eleoptics/plots: ELEO's optical plot renderers. SVG renderers return markup whose colors are
// tokens.css variables, so one drawing follows the theme; canvas renderers read the variables
// when they draw, so call them again after a theme or palette change. Needs @eleoptics/tokens' tokens.css.
import ELEO from './renderers.js';
import * as physics from './physics.js';
import * as layout from './layout2d.js';

Object.assign(ELEO, physics, { layoutBounds: layout.layoutBounds });

export default ELEO;
export const {
  layout2D, layout3D, spot, throughFocus, rayFan, map2D, curve, legend, icon, icons, gradient, fmt, css, maps, useSample, layoutBounds,
} = ELEO;
export * from './physics.js';
