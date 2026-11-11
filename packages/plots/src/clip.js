// Internal geometry: cut polylines and polygons to an axis-aligned rectangle [x0, y0, x1, y1].
// Not exported from the package index.

// Liang-Barsky: the parameter range [t0, t1] of a to b inside rect, or null.
function segment(a, b, [x0, y0, x1, y1]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [t0, t1];
}

// The runs of `points` inside `rect`: { from, points, cut }.
// from: index of the data segment the run starts on; the first and last points are cut at the edge (unless
// they are data points inside it), every point between is a data point.
// cut: length of polyline before the run's first point, in the points' own units.
export function clipPolyline(points, rect) {
  const runs = [];
  let run = null, along = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const t = segment(a, b, rect);
    if (t && t[1] > t[0]) {
      if (!run) {
        run = { from: i, points: [t[0] === 0 ? a : [a[0] + (b[0] - a[0]) * t[0], a[1] + (b[1] - a[1]) * t[0]]], cut: along + len * t[0] };
        runs.push(run);
      }
      if (t[1] === 1) run.points.push(b);
      else { run.points.push([a[0] + (b[0] - a[0]) * t[1], a[1] + (b[1] - a[1]) * t[1]]); run = null; }
    } else run = null;
    along += len;
  }
  return runs;
}

// Sutherland-Hodgman: the polygon cut to rect; empty when it misses or touches only at a point or edge.
export function clipPolygon(points, [x0, y0, x1, y1]) {
  const edges = [
    [([x]) => x >= x0, (a, b) => { const t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + (b[1] - a[1]) * t]; }],
    [([x]) => x <= x1, (a, b) => { const t = (x1 - a[0]) / (b[0] - a[0]); return [x1, a[1] + (b[1] - a[1]) * t]; }],
    [([, y]) => y >= y0, (a, b) => { const t = (y0 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, y0]; }],
    [([, y]) => y <= y1, (a, b) => { const t = (y1 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, y1]; }],
  ];
  let out = points;
  for (const [inside, cross] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[(i + input.length - 1) % input.length], b = input[i];
      if (inside(b)) { if (!inside(a)) out.push(cross(a, b)); out.push(b); } else if (inside(a)) out.push(cross(a, b));
    }
  }
  out = out.filter((p, i) => { const q = out[(i + out.length - 1) % out.length]; return p[0] !== q[0] || p[1] !== q[1]; });
  return out.length < 3 ? [] : out;
}
