import { idx } from "./common.js";

export var VIRIDIS = ["#440154","#482878","#3e4989","#31688e","#26828e","#1f9e89","#35b779","#6ece58","#b5de2b","#fde725"];
export var GRAY = ["#000000","#ffffff"];

export function fmt(v, n) { if (v === null || v === undefined || isNaN(v)) return "—"; return (v < 0 ? "−" : "") + Math.abs(v).toFixed(n == null ? 2 : n); }
export function css(el, name) { return getComputedStyle(el || document.documentElement).getPropertyValue("--" + name).trim(); }
export function rgb(h) { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join(""); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
export function ramp(stops, t) { t = Math.max(0, Math.min(1, t)); var x = t * (stops.length - 1), k = Math.min(Math.floor(x), stops.length - 2), f = x - k, a = rgb(stops[k]), b = rgb(stops[k + 1]); return a.map(function (v, i) { return Math.round(v + (b[i] - v) * f); }); }
export function mapStops(el, map) {
  if (map === "viridis") return VIRIDIS;
  if (map === "gray") return GRAY;
  var name = map === "wave" ? "map-wave-" : "map-ember-", out = [];
  for (var i = 0; i < 9; i++) out.push(css(el, name + i));
  return out;
}
/* A CSS gradient for a colorbar. Token maps use the variables so they follow the theme. */
export function gradient(map, dir) {
  var stops = map === "viridis" ? VIRIDIS : map === "gray" ? GRAY : Array.apply(null, Array(9)).map(function (_, i) { return "var(--map-" + (map === "wave" ? "wave-" : "ember-") + i + ")"; });
  return "linear-gradient(" + (dir || "to top") + "," + stops.join(",") + ")";
}
/* Index color (idx), STANDARD, NS and svg() live in common.js. */
export function hollow(i) { return i >= 8; }
export function marker(x, y, i) { return hollow(i) ? '<circle cx="' + x + '" cy="' + y + '" r="3.2" fill="var(--surface)" stroke="' + idx(i) + '" stroke-width="1.5"/>' : ""; }
