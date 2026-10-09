/* ELEO plot renderers. Plain functions, no framework. SVG renderers return markup that reads colors from
   tokens.css variables, so one drawing works in both themes. Canvas renderers read the variables at draw time:
   call them again after a theme or palette change. Sample data: a traced AC254-100-A style achromat (see ELEO.sample.note). */
import { layout2D as recordedLayout2D } from "./layout2d.js";
import { state, data, useSample } from "./data.js";
import { curve } from "./curve.js";
import { legend } from "./legend.js";
import { spot, throughFocus } from "./spot.js";
import { layout3D } from "./layout3d.js";
import { map2D } from "./map2d.js";
import { icon, ICONS } from "./icons.js";
import { rayFan } from "./fan.js";
import { VIRIDIS, GRAY, fmt, css, gradient } from "./color.js";

const ELEO = (function () {
  "use strict";

  /* ---------------- Layout2D ---------------- */
  function layout2D(o) { o = o || {}; return recordedLayout2D(Object.assign({}, o, { data: data(o) })); }


  var api = { useSample: useSample, icon: icon, icons: ICONS, get sample() { return state.sample; }, fmt: fmt, css: css, gradient: gradient, layout2D: layout2D, layout3D: layout3D, spot: spot, throughFocus: throughFocus, rayFan: rayFan, map2D: map2D, curve: curve, legend: legend, maps: { viridis: VIRIDIS, gray: GRAY } };
  return api;
})();

export default ELEO;
