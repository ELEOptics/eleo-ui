/* ELEO plot renderers. Plain functions, no framework. SVG renderers return markup that reads colors from
   tokens.css variables, so one drawing works in both themes, except the typed map2D(props), which bakes its cells
   at draw time: draw it again after a theme or palette change. */
import { layout2D } from "./layout2d.js";
import { curve } from "./curve.js";
import { bars } from "./bars.js";
import { legend } from "./legend.js";
import { spot, throughFocus } from "./spot.js";
import { map2D } from "./map2d.js";
import { icon, ICONS } from "./icons.js";
import { fit } from "./fit.js";
import { VIRIDIS, GRAY, fmt, css, gradient } from "./color.js";

const ELEO = (function () {
  "use strict";


  var api = { fit: fit, icon: icon, icons: ICONS, fmt: fmt, css: css, gradient: gradient, layout2D: layout2D, spot: spot, throughFocus: throughFocus, map2D: map2D, curve: curve, bars: bars, legend: legend, maps: { viridis: VIRIDIS, gray: GRAY } };
  return api;
})();

export default ELEO;
