/* ELEO plot renderers. Plain functions, no framework. SVG renderers return markup that reads colors from
   tokens.css variables, so one drawing works in both themes. Canvas renderers read the variables at draw time:
   call them again after a theme change. Sample data: a traced AC254-100-A style achromat (see ELEO.sample.note). */
const ELEO = (function () {
  "use strict";
  // Sample data is opt-in (import "@eleoptics/plots/sample"), so apps that draw their own systems
  // don't ship the 190 KB demo trace.
  var S = null;
  function data(o) {
    var D = o.data || S;
    if (!D) throw new Error('ELEO: pass { data }, or import "@eleoptics/plots/sample" to draw the sample achromat.');
    return D;
  }
  function useSample(sample) { S = sample; api.sample = sample; }
  var VIRIDIS = ["#440154","#482878","#3e4989","#31688e","#26828e","#1f9e89","#35b779","#6ece58","#b5de2b","#fde725"];
  var GRAY = ["#000000","#ffffff"];
  var NS = 'vector-effect="non-scaling-stroke"';

  function fmt(v, n) { if (v === null || v === undefined || isNaN(v)) return "—"; return (v < 0 ? "−" : "") + Math.abs(v).toFixed(n == null ? 2 : n); }
  function css(el, name) { return getComputedStyle(el || document.documentElement).getPropertyValue("--" + name).trim(); }
  function rgb(h) { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join(""); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function ramp(stops, t) { t = Math.max(0, Math.min(1, t)); var x = t * (stops.length - 1), k = Math.min(Math.floor(x), stops.length - 2), f = x - k, a = rgb(stops[k]), b = rgb(stops[k + 1]); return a.map(function (v, i) { return Math.round(v + (b[i] - v) * f); }); }
  function mapStops(el, map) {
    if (map === "viridis") return VIRIDIS;
    if (map === "gray") return GRAY;
    var name = map === "wave" ? "map-wave-" : "map-ember-", out = [];
    for (var i = 0; i < 9; i++) out.push(css(el, name + i));
    return out;
  }
  /* A CSS gradient for a colorbar. Token maps use the variables so they follow the theme. */
  function gradient(map, dir) {
    var stops = map === "viridis" ? VIRIDIS : map === "gray" ? GRAY : Array.apply(null, Array(9)).map(function (_, i) { return "var(--map-" + (map === "wave" ? "wave-" : "ember-") + i + ")"; });
    return "linear-gradient(" + (dir || "to top") + "," + stops.join(",") + ")";
  }
  /* The standard order: field token behind --series-k. Must match the `:root, [data-theme]` block in plots.css. */
  var STANDARD = [1, 7, 8, 3, 4, 6, 2, 5];
  /* Index color: 1..8 direct, 9..16 reuse with a hollow marker (see marker()). --series-k follows the palette;
     the fallback is the standard order when plots.css is not loaded. */
  function idx(i) { var k = i % 8; return "var(--series-" + (k + 1) + ", var(--field-" + STANDARD[k] + "))"; }
  function hollow(i) { return i >= 8; }
  function marker(x, y, i) { return hollow(i) ? '<circle cx="' + x + '" cy="' + y + '" r="3.2" fill="var(--surface)" stroke="' + idx(i) + '" stroke-width="1.5"/>' : ""; }
  function svg(w, h, body, label) { return '<svg viewBox="0 0 ' + w + " " + h + '" shape-rendering="geometricPrecision" role="img" aria-label="' + label + '">' + body + "</svg>"; }

  /* ---------------- Layout2D ---------------- */
  function layout2D(o) {
    o = o || {}; var D = data(o), colorBy = o.colorBy || "field", set = o.rays || "marginal-chief";
    var zmin = -8, zmax = D.zimg + 4, W = o.width || 1000, s = W / (zmax - zmin), ym = 13.5, H = Math.round(2 * ym * s) + 30, cy = (H - 24) / 2;
    function X(z) { return ((z - zmin) * s).toFixed(2); } function Y(y) { return (cy - y * s).toFixed(2); }
    var pr = D.profiles;
    function sag(p, y) { return p.R - Math.sign(p.R) * Math.sqrt(p.R * p.R - y * y); }
    function arc(p, from, to) { var r = (Math.abs(p.R) * s).toFixed(2), sweep = (p.R > 0) === (from > to) ? 0 : 1; return "A" + r + "," + r + " 0 0 " + sweep + " " + X(p.z + sag(p, to)) + "," + Y(to); }
    function el(a, b) { return "M" + X(a.z + sag(a, a.sd)) + "," + Y(a.sd) + " " + arc(a, a.sd, -a.sd) + " L" + X(b.z + sag(b, -b.sd)) + "," + Y(-b.sd) + " " + arc(b, -b.sd, b.sd) + " Z"; }
    var g = '<line x1="' + X(zmin + 1) + '" y1="' + Y(0) + '" x2="' + X(zmax - 1) + '" y2="' + Y(0) + '" stroke="var(--plot-axis)" style="stroke-width:var(--stroke-hair)" stroke-dasharray="4 6" ' + NS + "/>";
    g += '<path d="' + el(pr[0], pr[1]) + '" fill="var(--glass-crown)" stroke="var(--glass-edge)" style="stroke-width:var(--stroke-edge)" stroke-linejoin="round" ' + NS + "/>";
    g += '<path d="' + el(pr[1], pr[2]) + '" fill="var(--glass-flint)" stroke="var(--glass-edge)" style="stroke-width:var(--stroke-edge)" stroke-linejoin="round" ' + NS + "/>";
    var groups = colorBy === "wavelength" ? D.layoutWl.rays : D.layout;
    groups.forEach(function (rays, k) {
      var pick = set === "fan" ? rays.map(function (_, i) { return i; }) : set === "chief" ? [3] : [0, 3, rays.length - 1];
      pick.forEach(function (i) {
        var r = rays[i], chief = i === 3;
        g += '<polyline points="' + r.map(function (p) { return X(p[0]) + "," + Y(p[1]); }).join(" ") + '" fill="none" stroke="' + idx(k) + '" style="stroke-width:var(--stroke-ray)" stroke-linecap="round" stroke-linejoin="round"' + (chief && set !== "chief" ? ' stroke-dasharray="6 4"' : "") + " " + NS + "/>";
      });
      var last = rays[3][rays[3].length - 1]; g += '<circle cx="' + X(last[0]) + '" cy="' + Y(last[1]) + '" r="2.4" fill="' + idx(k) + '"/>';
    });
    g += '<line x1="' + X(D.zimg) + '" y1="' + Y(5) + '" x2="' + X(D.zimg) + '" y2="' + Y(-5) + '" stroke="var(--ink)" style="stroke-width:var(--stroke-curve)" stroke-linecap="round" ' + NS + "/>";
    g += '<text class="eleo-tick" x="' + X(0) + '" y="' + Y(13.1) + '" text-anchor="middle">STO</text><text class="eleo-tick" x="' + X(D.zimg) + '" y="' + Y(5.8) + '" text-anchor="middle">IMA</text>';
    var sb = 10 * s, by = H - 8;
    g += '<path d="M8,' + (by - 4) + " V" + (by + 4) + " M8," + by + " H" + (8 + sb).toFixed(1) + " M" + (8 + sb).toFixed(1) + "," + (by - 4) + " V" + (by + 4) + '" fill="none" stroke="var(--ink)" style="stroke-width:var(--stroke-edge)" ' + NS + '/><text class="eleo-tick" x="' + (16 + sb).toFixed(1) + '" y="' + (by + 3) + '">10 mm · true scale</text>';
    return svg(W, H, g, "Lens layout, YZ section, true scale, colored by " + colorBy);
  }

  /* ---------------- Layout3D (canvas) ---------------- */
  function layout3D(canvas, o) {
    o = o || {}; var D = data(o), showRays = o.rays !== false;
    var dpr = Math.max(2, Math.min(3, window.devicePixelRatio || 1)), Wc = o.width || 560, Hc = o.height || 320;
    canvas.width = Wc * dpr; canvas.height = Hc * dpr; var c = canvas.getContext("2d"); c.scale(dpr, dpr);
    var C = function (n) { return css(canvas, n); };
    c.fillStyle = C("surface"); c.fillRect(0, 0, Wc, Hc);
    var th = (o.yaw == null ? -38 : o.yaw) * Math.PI / 180, ph = (o.pitch == null ? 16 : o.pitch) * Math.PI / 180;
    function R3(p) { var h = p[2] * Math.cos(th) - p[0] * Math.sin(th), d = p[2] * Math.sin(th) + p[0] * Math.cos(th); return [h, p[1] * Math.cos(ph) - d * Math.sin(ph), p[1] * Math.sin(ph) + d * Math.cos(ph)]; }
    var zc = D.zimg / 2 + 2, sc = (o.scale || 4.6) * Wc / 560, ox = Wc / 2 + 8, oy = Hc / 2 + 10;
    function S2(p) { var q = R3([p[0], p[1], p[2] - zc]); return [ox + q[0] * sc, oy - q[1] * sc, q[2]]; }
    var segN = 128, ringN = 16, faces = [];
    function sagf(pr, r) { return pr.R - Math.sign(pr.R) * Math.sqrt(pr.R * pr.R - r * r); }
    function surf(pr) { var out = []; for (var i = 0; i <= ringN; i++) { var r = pr.sd * i / ringN, z = pr.z + sagf(pr, r), row = []; for (var j = 0; j < segN; j++) { var a = 2 * Math.PI * j / segN; row.push([r * Math.cos(a), r * Math.sin(a), z]); } out.push(row); } return out; }
    var g1 = surf(D.profiles[0]), g2 = surf(D.profiles[1]), g3 = surf(D.profiles[2]);
    function quads(g, t) { for (var i = 0; i < ringN; i++) for (var j = 0; j < segN; j++) faces.push({ v: [g[i][j], g[i][(j + 1) % segN], g[i + 1][(j + 1) % segN], g[i + 1][j]], t: t }); }
    function rim(a, b, t) { for (var j = 0; j < segN; j++) faces.push({ v: [a[ringN][j], a[ringN][(j + 1) % segN], b[ringN][(j + 1) % segN], b[ringN][j]], t: t }); }
    quads(g1, 0); quads(g2, 1); quads(g3, 1); rim(g1, g2, 0); rim(g2, g3, 1);
    var Lv = [-0.35, 0.75, -0.55], m = Math.hypot(Lv[0], Lv[1], Lv[2]); Lv = Lv.map(function (x) { return x / m; });
    var tone = [rgb(C("glass-crown")), rgb(C("glass-flint"))];
    var prj = faces.map(function (f) {
      var a = f.v.map(function (p) { return R3([p[0], p[1], p[2] - zc]); });
      var u = [0, 1, 2].map(function (i) { return a[2][i] - a[0][i]; }), w = [0, 1, 2].map(function (i) { return a[3][i] - a[1][i]; });
      var n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], nm = Math.hypot(n[0], n[1], n[2]) || 1;
      var k = 0.82 + 0.18 * Math.abs((n[0] * Lv[0] + n[1] * Lv[1] + n[2] * Lv[2]) / nm);
      return { q: f.v.map(S2), d: (a[0][2] + a[1][2] + a[2][2] + a[3][2]) / 4, col: "rgb(" + tone[f.t].map(function (v) { return Math.min(255, Math.round(v * k)); }) + ")" };
    }).sort(function (a, b) { return b.d - a.d; });
    function facing(v) { return R3(v)[2] < 0; }
    var inFront = facing([0, 0, -1]), outFront = facing([0, 0, 1]);
    function line(pts, col, w, dash) { c.beginPath(); pts.forEach(function (p, i) { var q = S2(p); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.strokeStyle = col; c.lineWidth = w; c.setLineDash(dash || []); c.stroke(); c.setLineDash([]); }
    c.lineCap = "round"; c.lineJoin = "round";
    line([[0, 0, -12], [0, 0, D.zimg + 4]], C("plot-axis"), .75, [3, 5]);
    var fields = [C("field-1"), C("field-2"), C("field-3")];
    var rays = D.rays3d.map(function (rs, k) { return { k: k, rs: rs.filter(function (_, i) { return i % 2 === 0 || i === rs.length - 1; }) }; });
    function seg(which) { if (!showRays) return; rays.forEach(function (R) { R.rs.forEach(function (r, i) { var chief = i === R.rs.length - 1; line(which === "in" ? [r[0], r[1]] : [r[3], r[4]], fields[R.k], 1.1, chief ? [5, 4] : null); }); }); }
    if (!inFront) seg("in"); if (!outFront) seg("out");
    prj.forEach(function (f) { c.beginPath(); f.q.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.fillStyle = f.col; c.fill(); c.strokeStyle = f.col; c.lineWidth = .7; c.stroke(); });
    var edge = C("glass-edge");
    [g1, g2, g3].forEach(function (g) { line(g[ringN].concat([g[ringN][0]]), edge, 1.25); });
    var top = 0, tv = 1e9; for (var j = 0; j < segN; j++) { var q = S2(g1[ringN][j]); if (q[1] < tv) { tv = q[1]; top = j; } }
    [top, (top + segN / 2) % segN].forEach(function (j) { line([g1[ringN][j], g3[ringN][j]], edge, 1.25); });
    if (inFront) seg("in"); if (outFront) seg("out");
    var s0 = 4.5, zi = D.zimg, sen = [[-s0, -s0, zi], [s0, -s0, zi], [s0, s0, zi], [-s0, s0, zi]].map(S2);
    c.beginPath(); sen.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.fillStyle = C("mech"); c.fill(); c.strokeStyle = C("ink"); c.lineWidth = 1.25; c.stroke();
    var t0 = [40, Hc - 28]; c.font = '10px "Fira Code", monospace'; c.fillStyle = C("ink-muted"); c.strokeStyle = C("ink-muted"); c.lineWidth = 1;
    [["X", [1, 0, 0]], ["Y", [0, 1, 0]], ["Z", [0, 0, 1]]].forEach(function (a) { var q = R3(a[1]), e = [t0[0] + q[0] * 20, t0[1] - q[1] * 20]; c.beginPath(); c.moveTo(t0[0], t0[1]); c.lineTo(e[0], e[1]); c.stroke(); c.fillText(a[0], e[0] + 3, e[1] + 3); });
  }

  /* ---------------- SpotDiagram ---------------- */
  function spot(o) {
    o = o || {}; var D = data(o), colorBy = o.colorBy || "wavelength", scale = o.scale || "common", airy = o.airy !== false;
    var B = 150, gap = 22, n = D.spots.length, W = n * B + (n - 1) * gap, H = B + 58, g = "";
    var common = o.half || Math.max.apply(null, D.spotStats.map(function (s) { return s.geo; }));
    common = [5, 10, 20, 25, 40, 50, 100, 200].find(function (v) { return v >= common; }) || Math.ceil(common);
    D.spots.forEach(function (per, fi) {
      var half = scale === "auto" ? ([5, 10, 20, 25, 40, 50, 100, 200].find(function (v) { return v >= D.spotStats[fi].geo; }) || common) : common;
      var s = (B / 2) / half, ox = fi * (B + gap), cx = ox + B / 2, cy = B / 2 + 4;
      g += '<rect x="' + (ox + .5) + '" y="4.5" width="' + (B - 1) + '" height="' + (B - 1) + '" rx="3" fill="none" stroke="var(--plot-grid)"/>';
      g += '<path d="M' + (ox + 6) + "," + cy + " H" + (ox + B - 6) + " M" + cx + ",10 V" + (B - 2) + '" stroke="var(--plot-grid)"/>';
      per.forEach(function (pts, wi) { var col = colorBy === "field" ? idx(fi) : idx(wi); pts.forEach(function (p) { g += '<circle cx="' + (cx + p[0] * s).toFixed(1) + '" cy="' + (cy - p[1] * s).toFixed(1) + '" r="1.1" fill="' + col + '" fill-opacity=".85"/>'; }); });
      if (airy) g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (D.airy * s).toFixed(2) + '" fill="none" stroke="var(--ink)" stroke-width=".8"/>';
      var st = D.spotStats[fi];
      g += '<text class="eleo-val" x="' + ox + '" y="' + (B + 22) + '">' + fmt(D.fields[fi], 1) + '°</text><text class="eleo-tick" x="' + (ox + B) + '" y="' + (B + 22) + '" text-anchor="end">±' + half + ' µm</text>';
      g += '<text class="eleo-tick" x="' + ox + '" y="' + (B + 37) + '">RMS <tspan class="eleo-val">' + st.rms.toFixed(2) + '</tspan> µm</text>';
      g += '<text class="eleo-tick" x="' + ox + '" y="' + (B + 51) + '">GEO <tspan class="eleo-val">' + st.geo.toFixed(2) + '</tspan> µm</text>';
    });
    return svg(W, H, g, "Spot diagrams, colored by " + colorBy);
  }
  function throughFocus(o) {
    o = o || {}; var D = data(o), T = D.throughFocus, B = 92, gap = 10, lw = 44, th = 22;
    var cols = T.defocus.length, rows = T.spots.length, W = lw + cols * (B + gap), H = th + rows * (B + 26), g = "", half = o.half || 40, s = (B / 2) / half;
    T.defocus.forEach(function (dz, j) { g += '<text class="eleo-tick" x="' + (lw + j * (B + gap) + B / 2) + '" y="12" text-anchor="middle">' + (dz > 0 ? "+" : dz < 0 ? "−" : "") + Math.abs(dz) + " µm</text>"; });
    T.spots.forEach(function (row, i) {
      var oy = th + i * (B + 26);
      g += '<text class="eleo-val" x="0" y="' + (oy + B / 2 + 4) + '">' + fmt(D.fields[i], 1) + "°</text>";
      row.forEach(function (cell, j) {
        var ox = lw + j * (B + gap), cx = ox + B / 2, cy = oy + B / 2;
        g += '<rect x="' + (ox + .5) + '" y="' + (oy + .5) + '" width="' + (B - 1) + '" height="' + (B - 1) + '" rx="3" fill="none" stroke="' + (j === 2 ? "var(--ink-subtle)" : "var(--plot-grid)") + '"/>';
        cell.pts.forEach(function (pts, wi) { pts.forEach(function (p) { var x = cx + p[0] * s, y = cy - p[1] * s; if (Math.abs(x - cx) < B / 2 && Math.abs(y - cy) < B / 2) g += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r=".9" fill="' + idx(wi) + '" fill-opacity=".85"/>'; }); });
        g += '<text class="eleo-tick" x="' + ox + '" y="' + (oy + B + 13) + '">RMS <tspan class="eleo-val">' + cell.rms.toFixed(1) + "</tspan></text>";
      });
    });
    return svg(W, H, g, "Through-focus spot diagrams, fields by rows, focus shift by columns");
  }

  /* ---------------- RayFan ---------------- */
  function rayFan(o) {
    o = o || {}; var D = data(o), kind = o.kind || "tra", src = kind === "opd" ? D.opdFans : D.fans, pick = o.fields || src.map(function (_, i) { return i; });
    var all = []; pick.forEach(function (fi) { ["T", "S"].forEach(function (k) { src[fi][k].forEach(function (a) { a.forEach(function (v) { if (v !== null) all.push(Math.abs(v)); }); }); }); });
    var mx = Math.max.apply(null, all), steps = kind === "opd" ? [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10] : [5, 10, 20, 25, 50, 100, 200];
    var nice = o.fullScale || steps.find(function (v) { return v >= mx; }) || Math.ceil(mx);
    var pw = o.panelWidth || 170, ph = 92, gx = 26, gy = 30, left = 34, W = left + pick.length * pw + (pick.length - 1) * gx + 4, H = 2 * ph + gy + 54, g = "";
    var unit = kind === "opd" ? "waves" : "µm";
    ["T", "S"].forEach(function (k, r) {
      pick.forEach(function (fi, c) {
        var F = src[fi], ox = left + c * (pw + gx), oy = 18 + r * (ph + gy);
        function X(t) { return (ox + (t + 1) / 2 * pw).toFixed(1); } function Y(v) { return (oy + ph / 2 - v / nice * (ph / 2)).toFixed(1); }
        g += '<rect x="' + ox + '" y="' + oy + '" width="' + pw + '" height="' + ph + '" rx="2" fill="none" stroke="var(--plot-grid)"/>';
        g += '<line x1="' + X(0) + '" y1="' + oy + '" x2="' + X(0) + '" y2="' + (oy + ph) + '" stroke="var(--plot-grid)"/><line x1="' + ox + '" y1="' + Y(0) + '" x2="' + (ox + pw) + '" y2="' + Y(0) + '" stroke="var(--plot-axis)"/>';
        F[k].forEach(function (vals, wi) {
          var d = "", pen = false, N = vals.length;
          vals.forEach(function (v, i) { if (v === null) { pen = false; return; } d += (pen ? " L" : " M") + X(-1 + 2 * i / (N - 1)) + "," + Y(v); pen = true; });
          g += '<path d="' + d + '" fill="none" stroke="' + idx(wi) + '" style="stroke-width:var(--stroke-curve)" stroke-linecap="round" stroke-linejoin="round"/>';
        });
        if (r === 0) g += '<text class="eleo-val" x="' + ox + '" y="' + (oy - 6) + '">' + fmt(D.fields[fi], 1) + "°</text>";
        if (c === 0) g += '<text class="eleo-tick" x="' + (ox - 6) + '" y="' + (oy + 8) + '" text-anchor="end">+' + nice + '</text><text class="eleo-tick" x="' + (ox - 6) + '" y="' + (oy + ph) + '" text-anchor="end">−' + nice + '</text><text class="eleo-tick" x="' + (ox - 6) + '" y="' + Y(0) + '" dy="3" text-anchor="end">0</text>';
        g += '<text class="eleo-tick" x="' + (ox + pw) + '" y="' + (oy + ph + 12) + '" text-anchor="end">' + (k === "T" ? "Py" : "Px") + "</text>";
      });
    });
    g += '<text class="eleo-tick" x="' + left + '" y="' + (H - 4) + '">' + (kind === "opd" ? "Optical path difference" : "Transverse ray aberration") + ", " + unit + ", full scale ±" + nice + " · top: tangential · bottom: sagittal</text>";
    return svg(W, H, g, (kind === "opd" ? "OPD" : "Ray") + " fan plots, tangential and sagittal");
  }

  /* ---------------- Map2D (canvas) ---------------- */
  function map2D(canvas, o) {
    o = o || {}; var D = data(o), kind = o.kind || "psf", map = o.map || (kind === "wavefront" ? "wave" : "ember"), scale = o.scale || "linear";
    var grid, lo = 0, hi = 1;
    if (kind === "wavefront") { grid = D.wavefront.map; var m = 0; grid.forEach(function (r) { r.forEach(function (v) { if (v !== null) m = Math.max(m, Math.abs(v)); }); }); lo = -m; hi = m; }
    else grid = D.psf[o.index || 0].img;
    var stops = mapStops(canvas, map), n = grid.length, off = document.createElement("canvas"); off.width = n; off.height = n;
    var ctx = off.getContext("2d"), im = ctx.createImageData(n, n), ground = rgb(css(canvas, "surface"));
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var v = grid[y][x], i = (y * n + x) * 4, col;
      if (v === null) col = ground;
      else { var t = kind === "wavefront" ? (v - lo) / (hi - lo) : scale === "log" ? Math.max(0, (Math.log10(Math.max(v, 1e-6)) + 4) / 4) : v; col = ramp(stops, t); }
      im.data[i] = col[0]; im.data[i + 1] = col[1]; im.data[i + 2] = col[2]; im.data[i + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    var Sz = o.size || 320; canvas.width = Sz; canvas.height = Sz; var c2 = canvas.getContext("2d"); c2.imageSmoothingEnabled = true; c2.imageSmoothingQuality = "high";
    if (kind === "wavefront") { c2.fillStyle = css(canvas, "surface"); c2.fillRect(0, 0, Sz, Sz); c2.save(); c2.beginPath(); c2.arc(Sz / 2, Sz / 2, Sz / 2 - 1, 0, 2 * Math.PI); c2.clip(); c2.drawImage(off, 0, 0, Sz, Sz); c2.restore(); c2.strokeStyle = css(canvas, "plot-axis"); c2.lineWidth = 1; c2.beginPath(); c2.arc(Sz / 2, Sz / 2, Sz / 2 - 1, 0, 2 * Math.PI); c2.stroke(); }
    else c2.drawImage(off, 0, 0, Sz, Sz);
    return { lo: lo, hi: hi };
  }

  /* ---------------- CurvePlot ---------------- */
  function curve(o) {
    o = o || {}; var D = data(o), kind = o.kind || "mtf", W = o.width || 460, H = o.height || 260, L = 46, R = 12, T = 14, Bm = 36;
    var pw = W - L - R, ph = H - T - Bm, g = "", series = [], xr, yr, xl, yl, xt, yt;
    if (kind === "mtf") {
      var df = D.mtf.df, fx = function (arr) { return arr.map(function (v, i) { return [i * df, v]; }).filter(function (p) { return p[0] <= 400; }); };
      series.push({ pts: fx(D.mtf.diff), col: "var(--ink)", dash: "1 3", w: 1.25 });
      D.mtf.fields.forEach(function (f, i) { series.push({ pts: fx(f.T), col: idx(i) }); series.push({ pts: fx(f.S), col: idx(i), dash: "5 3" }); });
      xr = [0, 400]; yr = [0, 1]; xl = "Spatial frequency, cycles/mm"; yl = "Modulus"; xt = [0, 100, 200, 300, 400]; yt = [0, .2, .4, .6, .8, 1];
    } else if (kind === "fieldCurvature") {
      series.push({ pts: D.fieldCurv.map(function (r) { return [r[1], r[0]]; }), col: idx(0) });
      series.push({ pts: D.fieldCurv.map(function (r) { return [r[2], r[0]]; }), col: idx(0), dash: "5 3" });
      xr = [-0.2, 0.2]; yr = [0, 2]; xl = "Focus shift, mm"; yl = "Field, °"; xt = [-0.2, -0.1, 0, 0.1, 0.2]; yt = [0, 0.5, 1, 1.5, 2];
    } else if (kind === "distortion") {
      series.push({ pts: D.distortion.map(function (r) { return [r[1], r[0]]; }), col: idx(0) });
      xr = [-0.2, 0.2]; yr = [0, 2]; xl = "Distortion, %"; yl = "Field, °"; xt = [-0.2, -0.1, 0, 0.1, 0.2]; yt = [0, 0.5, 1, 1.5, 2];
    } else {
      series.push({ pts: D.chromFocus.map(function (r) { return [r[1], r[0]]; }), col: idx(0) });
      xr = [-50, 200]; yr = [450, 700]; xl = "Focus shift, µm"; yl = "Wavelength, nm"; xt = [-50, 0, 50, 100, 150, 200]; yt = [450, 500, 550, 600, 650, 700];
    }
    function X(v) { return (L + (v - xr[0]) / (xr[1] - xr[0]) * pw).toFixed(1); } function Y(v) { return (T + ph - (v - yr[0]) / (yr[1] - yr[0]) * ph).toFixed(1); }
    g += '<rect x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="var(--plot-grid)"/>';
    xt.forEach(function (v) { g += '<line x1="' + X(v) + '" y1="' + T + '" x2="' + X(v) + '" y2="' + (T + ph) + '" stroke="' + (v === 0 && kind !== "mtf" ? "var(--plot-axis)" : "var(--plot-grid)") + '"/><text class="eleo-tick" x="' + X(v) + '" y="' + (T + ph + 13) + '" text-anchor="middle">' + fmt(v, Math.abs(v) < 1 && v !== 0 ? 1 : 0) + "</text>"; });
    yt.forEach(function (v) { g += '<line x1="' + L + '" y1="' + Y(v) + '" x2="' + (L + pw) + '" y2="' + Y(v) + '" stroke="var(--plot-grid)"/><text class="eleo-tick" x="' + (L - 6) + '" y="' + Y(v) + '" dy="3" text-anchor="end">' + (kind === "mtf" ? v.toFixed(1) : v) + "</text>"; });
    series.forEach(function (s) { g += '<polyline points="' + s.pts.map(function (p) { return X(p[0]) + "," + Y(p[1]); }).join(" ") + '" fill="none" stroke="' + s.col + '" stroke-width="' + (s.w || 1.5) + '" stroke-linecap="round" stroke-linejoin="round"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : "") + "/>"; });
    g += '<text class="eleo-tick" x="' + (L + pw) + '" y="' + (H - 4) + '" text-anchor="end">' + xl + '</text><text class="eleo-tick" x="4" y="' + (T - 4) + '">' + yl + "</text>";
    return svg(W, H, g, kind + " plot");
  }

  /* ---------------- Legends ---------------- */
  function legend(kind, n) {
    var D = S, out = [];
    if (kind === "field") for (var i = 0; i < (n || D.fields.length); i++) out.push('<span class="eleo-key' + (i >= 8 ? " eleo-key--hollow" : "") + '" style="--c:' + idx(i) + '">F' + (i + 1) + (i < D.fields.length ? " " + fmt(D.fields[i], 1) + "°" : "") + "</span>");
    else if (kind === "wavelength") for (var j = 0; j < (n || D.wl.length); j++) out.push('<span class="eleo-key' + (j >= 8 ? " eleo-key--hollow" : "") + '" style="--c:' + idx(j) + '">λ' + (j + 1) + (j < D.wl.length ? " " + D.wl[j].toFixed(1) + " nm" : "") + "</span>");
    else if (kind === "ts") out.push('<span class="eleo-key">T tangential</span><span class="eleo-key eleo-key--dash">S sagittal</span><span class="eleo-key eleo-key--dot">Diffraction limit</span>');
    else if (kind === "rays") out.push('<span class="eleo-key">Marginal ray</span><span class="eleo-key eleo-key--dash">Chief ray</span>');
    return out.join("");
  }

  var OPT = [
  ["lens", "Positive lens", [["g","p","M10.5 3H13.5Q17.5 12 13.5 21H10.5Q6.5 12 10.5 3Z"],["ax","p","M2 12H22"]]],
  ["lens-negative", "Negative lens", [["g","p","M7.5 3H16.5Q12 12 16.5 21H7.5Q12 12 7.5 3Z"],["ax","p","M2 12H22"]]],
  ["doublet", "Cemented doublet", [["g","p","M8.5 3H11Q14 12 11 21H8.5Q4.5 12 8.5 3Z"],["f","p","M11 3H17Q15.5 12 17 21H11Q14 12 11 3Z"],["ax","p","M2 12H22"]]],
  ["mirror", "Mirror", [["s","p","M12 3V21"],["s","p","M12 5L14 3M12 9L15 6M12 13L15 10M12 17L15 14M12 21L15 18"],["lb","p","M3 6L12 12L3 18"]]],
  ["stop", "Aperture stop", [["s","p","M12 3V9.5M12 14.5V21M9.5 3H14.5M9.5 21H14.5"],["ax","p","M2 12H22"]]],
  ["prism", "Prism", [["g","p","M12 4L20.5 19H3.5Z"],["lb","p","M2 14L8.2 12.4L15.8 13.4L22 16.5"]]],
  ["grating", "Grating", [["s","p","M7 3V21M7 5H9M7 9H9M7 13H9M7 17H9M7 21H9"],["lb","p","M2 12H7"],["s","p","M10.5 12H22M10.5 12L21 6.5M10.5 12L21 17.5"]]],
  ["splitter", "Beam splitter", [["g","r",[6,6,12,12,1]],["s","p","M6 18L18 6"],["lb","p","M2 12H22M12 12V2"]]],
  ["fiber", "Fiber", [["s","p","M3 18C9 18 9.5 9 15 9"],["g","r",[15,7,5,4,1]],["lb","p","M20 9H22.5"]]],
  ["source", "Point source", [["lp","c",[5,12,2]],["s","p","M8.5 12H21M8.5 10.6L20.5 5M8.5 13.4L20.5 19"]]],
  ["collimated", "Collimated beam", [["lb","p","M3 7H21M3 12H21M3 17H21"],["rf","p","M9 4V20M15 4V20"]]],
  ["wavelength", "Wavelength", [["s","p","M2 12C3.5 7 5.5 7 7 12S10.5 17 12 12 15.5 7 17 12 20.5 17 22 12"],["s","p","M7 3.5V5.5M17 3.5V5.5M7 4.5H17"]]],
  ["detector", "Detector", [["s","r",[5,4,14,16,1.5]],["s","p","M5 9.33H19M5 14.67H19M9.67 4V20M14.33 4V20"]]],
  ["laser", "Laser", [["s","r",[2.5,8.5,10,7,1.5]],["s","p","M5.5 8.5V15.5"],["lb","p","M12.5 12H22"]]],
  ["layout", "Layout", [["g","p","M6.5 4H9.5Q12 12 9.5 20H6.5Q4 12 6.5 4Z"],["s","p","M2 7H10.2L20 12M2 17H10.2L20 12M20.5 7V17"]]],
  ["view-3d", "3D view", [["s","p","M12 3L20 7.5V16.5L12 21L4 16.5V7.5ZM4 7.5L12 12L20 7.5M12 12V21"]]],
  ["spot","Spot diagram",[["d","c",[12,21,0.75]],["d","c",[12.0,20.28,0.75]],["d","c",[12.0,18.12,0.75]],["d","c",[12.83,18.6,0.75]],["d","c",[12.83,19.56,0.75]],["d","c",[11.17,19.56,0.75]],["d","c",[11.17,18.6,0.75]],["d","c",[12.0,14.52,0.75]],["d","c",[13.39,15.03,0.75]],["d","c",[14.13,16.3,0.75]],["d","c",[13.87,17.76,0.75]],["d","c",[10.13,17.76,0.75]],["d","c",[9.87,16.3,0.75]],["d","c",[10.61,15.03,0.75]],["d","c",[12.0,9.48,0.75]],["d","c",[13.92,9.99,0.75]],["d","c",[15.33,11.4,0.75]],["d","c",[15.84,13.32,0.75]],["d","c",[15.33,15.24,0.75]],["d","c",[12.0,17.16,0.75]],["d","c",[8.67,15.24,0.75]],["d","c",[8.16,13.32,0.75]],["d","c",[8.67,11.4,0.75]],["d","c",[10.08,9.99,0.75]],["d","c",[12.0,3.0,0.75]],["d","c",[14.44,3.52,0.75]],["d","c",[16.46,4.99,0.75]],["d","c",[17.71,7.15,0.75]],["d","c",[17.97,9.63,0.75]],["d","c",[17.2,12.0,0.75]],["d","c",[15.53,13.85,0.75]],["d","c",[8.47,13.85,0.75]],["d","c",[6.8,12.0,0.75]],["d","c",[6.03,9.63,0.75]],["d","c",[6.29,7.15,0.75]],["d","c",[7.54,4.99,0.75]],["d","c",[9.56,3.52,0.75]]]],
  ["ray-fan", "Ray fan", [["z","p","M3 12H21M12 3V21"],["s","p","M3 12C9 -8.8 15 32.8 21 12"]]],
  ["psf", "PSF", [["s","p","M3 19.5H4.7C5.3 15.2 7.4 15.2 8 19.5C9.6 19.5 10.5 4 12 4C13.5 4 14.4 19.5 16 19.5C16.6 15.2 18.7 15.2 19.3 19.5H21"]]],
  ["mtf", "MTF", [["z","p","M4 3V20H21"],["s","p","M4 4.5C8.5 5.5 11 13 14 20C14.9 17.7 15.8 16.3 17 16.3C18.4 16.3 19.6 18 20.5 20"]]],
  ["wavefront", "Wavefront", [["s","c",[12,12,9]],["s","p","M6.3 8.5C9.5 7 14.5 7 17.7 8.5M3.8 13C9 11 15 11 20.2 13M6.3 17.2C9.5 16 14.5 16 17.7 17.2"]]],
  ["tolerance", "Tolerancing", [["g","p","M7 4H10Q12.5 12 10 20H7Q4.5 12 7 4Z"],["s","p","M17 7.5V13.5M14 10.5H20M14 16.5H20"],["ax","p","M2 12H12.5"]]],
  ["optimize", "Optimize", [["s","p","M3 5C6 19 14 19 21 4"],["lp","c",[10.4,15.6,2.8]]]],
  ["focus", "Focus", [["s","p","M3 6L14 12M3 18L14 12M3 12H14"],["lp","c",[15,12,1.9]],["s","p","M20 7V17"]]]
];
  var UI = [
  ["search", "Search", [["s","c",[11,11,6.5]],["s","p","M16 16L21 21"]]],
  ["settings", "Settings", [["s","p","M4 7H20M4 12H20M4 17H20"],["k","c",[9,7,2]],["k","c",[15,12,2]],["k","c",[7.5,17,2]]]],
  ["add", "Add", [["s","p","M12 5V19M5 12H19"]]],
  ["delete", "Delete", [["s","p","M4 7H20M9 7V4.5H15V7M6.5 7L7.5 20H16.5L17.5 7M10 11V16M14 11V16"]]],
  ["export", "Export", [["s","p","M12 15V3M8 7L12 3L16 7M5 12V20H19V12"]]],
  ["import", "Import", [["s","p","M12 3V15M8 11L12 15L16 11M5 14V20H19V14"]]],
  ["undo", "Undo", [["s","p","M9 5L4 10L9 15M4 10H15A5 5 0 0 1 15 20H11"]]],
  ["redo", "Redo", [["s","p","M15 5L20 10L15 15M20 10H9A5 5 0 0 0 9 20H13"]]],
  ["copy", "Copy", [["s","r",[8,8,12,12,2]],["s","p","M16 8V5.5A1.5 1.5 0 0 0 14.5 4H5.5A1.5 1.5 0 0 0 4 5.5V14.5A1.5 1.5 0 0 0 5.5 16H8"]]],
  ["visible", "Visible", [["s","p","M2.5 12C5 7 8.5 5 12 5S19 7 21.5 12C19 17 15.5 19 12 19S5 17 2.5 12Z"],["s","c",[12,12,3]]]],
  ["lock", "Lock", [["s","r",[5,11,14,10,2]],["s","p","M8 11V8A4 4 0 0 1 16 8V11"]]],
  ["close", "Close", [["s","p","M6 6L18 18M18 6L6 18"]]],
  ["check", "Done", [["s","p","M5 12.5L10 17.5L19 7"]]],
  ["info", "Info", [["s","c",[12,12,9]],["s","p","M12 11V16.5"],["d","c",[12,7.8,1.1]]]],
  ["warning", "Warning", [["s","p","M12 3.5L21.5 20H2.5Z"],["s","p","M12 10V14"],["d","c",[12,17,1.1]]]],
  ["run", "Run", [["s","p","M8 5V19L19 12Z"]]],
  ["branch", "Branch", [["s","c",[6,5.5,2]],["s","c",[6,18.5,2]],["s","c",[18,7,2]],["s","p","M6 7.5V16.5M18 9C18 14 8.5 12 6.8 16.6"]]],
  ["comment", "Comment", [["s","p","M4 5H20V16H10L6 20V16H4Z"]]],
  ["chevron", "Expand", [["s","p","M6 9L12 15L18 9"]]]
];


  var ISTYLE = { line: { w: 1.5, cap: "round", join: "round", axis: false }, glass: { w: 1.5, cap: "round", join: "round", axis: false }, blueprint: { w: 1.25, cap: "butt", join: "miter", axis: true } };
  /* One icon as inline SVG. style: "line" (interface default), "glass" (optical objects at 24 px and up), "blueprint" (documentation).
     Line and blueprint use currentColor; glass adds var(--glass-crown), var(--glass-flint) and var(--accent). */
  function icon(name, o) {
    o = o || {}; var style = o.style || "line", set = ISTYLE[style], size = o.size || 16;
    var def = OPT.concat(UI).filter(function (i) { return i[0] === name; })[0];
    if (!def) return "";
    var body = def[2].map(function (e) {
      var role = e[0], type = e[1], a = e[2], sw = role === "z" ? (set.axis ? .75 : 1) : role === "ax" ? .75 : set.w, fill = "none", stroke = "currentColor", extra = "";
      if (role === "ax") { if (!set.axis) return ""; extra = ' stroke-dasharray="1.5 1.5"'; }
      if (role === "rf") extra = set.cap === "round" ? ' stroke-dasharray="0.01 3"' : ' stroke-dasharray="1.5 2"';
      if (role === "d") { fill = "currentColor"; stroke = "none"; }
      if (role === "lp") { fill = style === "glass" ? "var(--accent)" : "currentColor"; stroke = "none"; }
      if (role === "lb" && style === "glass") stroke = "var(--accent)";
      if (role === "g" && style === "glass") fill = "var(--glass-crown)";
      if (role === "f" && style === "glass") fill = "var(--glass-flint)";
      if (role === "k") fill = "var(--surface)";
      var at = ' fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (stroke === "none" ? 0 : sw) + '" stroke-linecap="' + (role === "rf" && set.cap === "round" ? "round" : set.cap) + '" stroke-linejoin="' + set.join + '"' + extra;
      if (type === "p") return '<path d="' + a + '"' + at + "/>";
      if (type === "c") return '<circle cx="' + a[0] + '" cy="' + a[1] + '" r="' + a[2] + '"' + at + "/>";
      return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '" rx="' + a[4] + '"' + at + "/>";
    }).join("");
    var label = o.label ? ' role="img" aria-label="' + o.label + '"' : ' aria-hidden="true" focusable="false"';
    return '<svg class="eleo-icon" viewBox="0 0 24 24" width="' + size + '" height="' + size + '"' + label + ">" + body + "</svg>";
  }
  var ICONS = { optical: OPT.map(function (i) { return { name: i[0], title: i[1] }; }), interface: UI.map(function (i) { return { name: i[0], title: i[1] }; }) };

  var api = { useSample: useSample, icon: icon, icons: ICONS, sample: null, fmt: fmt, css: css, gradient: gradient, layout2D: layout2D, layout3D: layout3D, spot: spot, throughFocus: throughFocus, rayFan: rayFan, map2D: map2D, curve: curve, legend: legend, maps: { viridis: VIRIDIS, gray: GRAY } };
  return api;
})();

export default ELEO;
