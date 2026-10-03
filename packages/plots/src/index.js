// @eleoptics/plots: ELEO's optical plot renderers. SVG renderers return markup whose colors are
// tokens.css variables, so one drawing follows the theme; canvas renderers read the variables
// when they draw, so call them again after a theme change. Needs @eleoptics/tokens' tokens.css.
import ELEO from './renderers.js';
import * as physics from './physics.js';

Object.assign(ELEO, physics);

export default ELEO;
export const {
  layout2D, layout3D, spot, throughFocus, rayFan, map2D, curve, legend, icon, icons, gradient, fmt, css, maps, useSample,
} = ELEO;
export * from './physics.js';
