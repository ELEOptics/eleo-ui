/* Adapters from the sample system (packages/plots/src/sample.json) to the typed calls the gallery and scripts/record-renderers.mjs draw its tiles with (plan #1258, #1204).
   The renderers no longer read the sample; the gallery fetches sample.json and passes what these return.
   A classic script, as tests/fixtures/phos-core/adapters.js is: the gallery loads it with a <script> tag and the unit tests and
   record-renderers.mjs with import(), so it has no import or export and assigns globalThis.ELEOSampleAdapters. Each function takes the
   parsed sample as `S`. */
(function () {
  /* ELEO.fmt(v, n) of packages/plots/src/color.js (copied: this script runs before, and without, the plots build): n decimals, U+2212 for a negative. */
  function fmt(v, n) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(n); }
  globalThis.ELEOSampleAdapters = {
    /* chromaticFocus(S) -> { series, x, y } for ELEO.curve: the focus shift in µm against the wavelength in nm, one series. */
    chromaticFocus: function (S) {
      return {
        series: [{ points: S.chromFocus.map(function (r) { return [r[1], r[0]]; }), index: 0 }],
        x: { label: 'Focus shift', unit: 'µm', range: [-50, 200], ticks: [-50, 0, 50, 100, 150, 200] },
        y: { label: 'Wavelength', unit: 'nm', range: [450, 700], ticks: [450, 500, 550, 600, 650, 700] }
      };
    },
    /* fanPanels(S, { kind, fields, fullScale }) -> { panels, columns, x, y }: the sample's ray fans ('tra', the default) or OPD fans ('opd') as curve panels: row T (Py)
       then row S (Px), a column per picked field (default all), one series per wavelength on pupil -1..1. The y range is symmetric at the next nice step
       over the largest |value|, or `fullScale`. Copied from fanPanels of packages/plots/src/fan.js, which dies in #1207. */
    fanPanels: function (S, o) {
      o = o || {};
      var kind = o.kind === 'opd' ? 'opd' : 'tra', src = kind === 'opd' ? S.opdFans : S.fans, pick = o.fields || src.map(function (_, i) { return i; });
      var all = [];
      pick.forEach(function (fi) { ['T', 'S'].forEach(function (k) { src[fi][k].forEach(function (a) { a.forEach(function (v) { if (v !== null) all.push(Math.abs(v)); }); }); }); });
      var mx = Math.max.apply(null, all), steps = kind === 'opd' ? [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10] : [5, 10, 20, 25, 50, 100, 200];
      var nice = o.fullScale || steps.find(function (v) { return v >= mx; }) || Math.ceil(mx);
      var panels = [];
      [['T', 'Py'], ['S', 'Px']].forEach(function (row) {
        pick.forEach(function (fi) {
          panels.push({
            title: fmt(S.fields[fi], 1) + '° · ' + row[1],
            series: src[fi][row[0]].map(function (vals, wi) { return { points: vals.map(function (v, i) { return [-1 + 2 * i / (vals.length - 1), v]; }), index: wi }; })
          });
        });
      });
      return {
        panels: panels, columns: pick.length, x: { label: 'Pupil', range: [-1, 1] },
        y: kind === 'opd' ? { label: 'Optical path difference', unit: 'waves', range: [-nice, nice] } : { label: 'Transverse ray aberration', unit: 'µm', range: [-nice, nice] }
      };
    },
    /* rayFan(S, { kind, fields, fullScale, key, width, height, panelWidth, keyAt, grid, view }) -> the ELEO.curve props of rayFan's old call (packages/plots/src/fan.js): fanPanels
       with rayFan's size and key line. `width` is the figure's width in px; without it the figure is columns × (panelWidth + 58) wide (panelWidth default 170) and its height is
       that figure's 314 for the same shape, scaled with the width and rounded to whole px; `height` overrides. `key: true` keys each sample wavelength ("486.1 nm") below the fans. */
    rayFan: function (S, o) {
      o = o || {};
      var f = globalThis.ELEOSampleAdapters.fanPanels(S, o), pw = o.panelWidth || 170, base = f.columns * (pw + 58), width = o.width || base;
      var spec = { panels: f.panels, columns: f.columns, x: f.x, y: f.y, width: width, height: o.height || Math.round(width * 314 / base), keyAt: o.keyAt, grid: o.grid, view: o.view };
      if (o.key === true) spec.key = S.wl.map(function (w, i) { return { label: w.toFixed(1) + ' nm', index: i }; });
      return spec;
    },
    /* layouts(S) -> { field, wavelength }: the sample's two recorded layouts, the rays by field and by wavelength, each a `{ surfaces, rays }` for ELEO.layout2D's and ELEO.layout3D's `data`. */
    layouts: function (S) { return { field: S.layout, wavelength: S.layoutWl }; },
    /* keyLabels(S, 'field' | 'wavelength') -> key entries as the footer legends were labelled: "F1 0.0°" per field, "λ1 486.1 nm" per wavelength; index = position. */
    keyLabels: function (S, kind) {
      return (kind === 'field' ? S.fields : S.wl).map(function (v, i) {
        return { label: kind === 'field' ? 'F' + (i + 1) + ' ' + fmt(v, 1) + '°' : 'λ' + (i + 1) + ' ' + v.toFixed(1) + ' nm', index: i };
      });
    }
  };
})();
