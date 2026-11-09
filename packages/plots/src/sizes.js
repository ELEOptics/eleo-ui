/* The narrowest figure a call can draw at ADR-0003's floor: its plot frame F_LO wide and its text at TEXT_MIN px.
   F_LO + TEXT_MIN * (L + R) + (panels - 1) * panelStep, with the margins the renderer draws with (L and R in text units).
   Its own file because scale.js is imported by map2d.js and curve.js; importing them back from scale.js would be a cycle. */
import { F_LO, TEXT_MIN, PLOT_SIZES, SPOT_LABEL_M } from "./scale.js";
import { data, state } from "./data.js";
import { mapMargins } from "./map2d.js";
import { scales } from "./curve.js";
import { checkLimits } from "./limits.js";
import { fanPanels } from "./fan.js";
import { labelM } from "./spot.js";

/* The right margin (text units) and the column count of a curve call; null where the call has no series to measure. */
function curveShape(o) {
  var panels = o.panels, groups = panels ? panels.map(function (p) { return p.series || []; }) : o.series ? [o.series] : null;
  if (!groups) return null;
  var n = groups.length, cols = panels ? Math.max(1, Math.min(n || 1, Math.floor(+o.columns) || n || 1)) : 1;
  return { Rt: scales({ x: o.x || {}, y: o.y || {}, limits: checkLimits(o.limits, "curve") }, groups, !!panels).Rt, cols: cols };
}

export function minWidth(name, props) {
  var o = props || {}, T = PLOT_SIZES[name];
  if (!T) throw new TypeError('minWidth: unknown renderer "' + name + '"');
  var panels = 1, base = T.minWidth, step = T.panelStep;
  if (name === "map2D" && o.values) {
    base = F_LO + TEXT_MIN * (function (m) { return m.L + m.R; })(mapMargins(o));
  } else if (name === "curve" || name === "rayFan") {
    var c = null;
    if (name === "rayFan") { if (o.data || state.sample) { var f = fanPanels(data(o), o); c = curveShape({ panels: f.panels, columns: f.columns, x: f.x, y: f.y }); } }
    else c = curveShape(o);
    if (c) { base = F_LO + TEXT_MIN * (4.6 + c.Rt); step = name === "rayFan" || o.panels ? base : 0; panels = c.cols; }
  } else if (name === "spot") {
    panels = o.panels ? o.panels.length : o.data || state.sample ? data(o).spots.length : 1;
    if (o.half > 0 && isFinite(o.half)) { var extra = TEXT_MIN * (labelM(+o.half) - SPOT_LABEL_M); base += extra; step += extra; }
  } else if (name === "throughFocus") {
    panels = o.data || state.sample ? data(o).throughFocus.defocus.length : 1;
    if (o.half > 0 && isFinite(o.half)) base += TEXT_MIN * (labelM(+o.half) - SPOT_LABEL_M);
  }
  return base + (Math.max(1, panels) - 1) * step;
}
