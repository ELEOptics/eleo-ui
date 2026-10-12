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

/* panelWidth is the plot area's width in px (default 170); the figure is columns × (panelWidth + 58) wide, the 58 being curve's left and right margins, and 2 rows of 150 and 14 tall. */
export function rayFan(o) {
  o = o || {};
  var f = fanPanels(data(o), o), pw = o.panelWidth || 170;
  return curve({ panels: f.panels, columns: f.columns, x: f.x, y: f.y, width: f.columns * (pw + 58), height: 314 });
}
