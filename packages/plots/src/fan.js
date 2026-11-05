import { data } from "./data.js";
import { fmt } from "./color.js";
import { curve } from "./curve.js";

/* The sample's ray or OPD fans as curve panels: row T (Py) then row S (Px), a column per picked field, one series per wavelength on pupil -1..1. */
export function fanPanels(sample, o) {
  o = o || {};
  var kind = o.kind === "opd" ? "opd" : "tra", src = kind === "opd" ? sample.opdFans : sample.fans, pick = o.fields || src.map(function (_, i) { return i; });
  var all = [];
  pick.forEach(function (fi) { ["T", "S"].forEach(function (k) { src[fi][k].forEach(function (a) { a.forEach(function (v) { if (v !== null) all.push(Math.abs(v)); }); }); }); });
  var mx = Math.max.apply(null, all), steps = kind === "opd" ? [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10] : [5, 10, 20, 25, 50, 100, 200];
  var nice = o.fullScale || steps.find(function (v) { return v >= mx; }) || Math.ceil(mx);
  var panels = [];
  [["T", "Py"], ["S", "Px"]].forEach(function (row) {
    pick.forEach(function (fi) {
      panels.push({
        title: fmt(sample.fields[fi], 1) + "° · " + row[1],
        series: src[fi][row[0]].map(function (vals, wi) { return { points: vals.map(function (v, i) { return [-1 + 2 * i / (vals.length - 1), v]; }), index: wi }; })
      });
    });
  });
  return {
    panels: panels, columns: pick.length, x: { label: "Pupil", range: [-1, 1] },
    y: kind === "opd" ? { label: "Optical path difference", unit: "waves", range: [-nice, nice] } : { label: "Transverse ray aberration", unit: "µm", range: [-nice, nice] }
  };
}

/* `width` is the figure's width in px; each column gets width / columns, and curve's rule (ADR-0003) sets the frame inside it. Without it the figure is columns × (panelWidth + 58) wide (panelWidth default 170: the frame of a default panel, the 58 its margins at 10 px text), and its height is that figure's 314 for the same shape, scaled with the width and rounded to whole px; `height` overrides. */
export function rayFan(o) {
  o = o || {};
  var f = fanPanels(data(o), o), pw = o.panelWidth || 170, base = f.columns * (pw + 58), width = o.width || base;
  return curve({ panels: f.panels, columns: f.columns, x: f.x, y: f.y, width: width, height: o.height || Math.round(width * 314 / base) });
}
