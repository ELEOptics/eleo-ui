/* Adapters from phos-core recordings (README.md) to the typed curve call of ELEO.curve (plan #162, #174, #179).
   A classic script: the gallery loads it with a <script> tag and the unit tests with import(), so it has no
   import or export and assigns globalThis.ELEOAdapters. */
(function () {
  /* The result of source s whose wavelength is nearest the reference: the recorded 656.272 against 656.273 shows
     names are not exact. */
  function atRef(rec, s) {
    return s.results.reduce(function (a, r) {
      return Math.abs(r.wavelengthNm - rec.referenceWavelengthNm) < Math.abs(a.wavelengthNm - rec.referenceWavelengthNm) ? r : a;
    });
  }
  /* A 1-2-5 step, a range that covers [lo, hi] and 0 in whole steps, and its ticks. */
  function niceAxis(values) {
    var lo = Math.min.apply(null, values.concat(0)), hi = Math.max.apply(null, values.concat(0));
    if (hi === lo) { lo = -1; hi = 1; }
    var raw = (hi - lo) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
    var digits = Math.max(0, -Math.floor(Math.log10(step)) + 1);
    var a = Math.floor(lo / step + 1e-9), b = Math.ceil(hi / step - 1e-9), ticks = [];
    for (var k = a; k <= b; k++) ticks.push(+(k * step).toFixed(digits));
    return { range: [ticks[0], ticks[ticks.length - 1]], ticks: ticks };
  }
  function yAxis(rec) {
    var angles = rec.sources.map(function (s) { return s.fieldAngleDeg; });
    return { label: 'Field', unit: '°', range: [Math.min.apply(null, angles.concat(0)), Math.max.apply(null, angles)], ticks: angles };
  }
  /* physics.js's mtfDiffraction, the one implementation: the page (or the test) must have it on globalThis.ELEO. */
  function diffraction(nu, lambda, N) {
    var E = globalThis.ELEO;
    if (!E || typeof E.mtfDiffraction !== 'function') throw new Error('ELEOAdapters.mtf: diffraction needs globalThis.ELEO.mtfDiffraction (load eleo-plots.js, or set it in the test)');
    return E.mtfDiffraction(nu, lambda, N);
  }
  globalThis.ELEOAdapters = {
    /* mtf(recording, { diffraction }) -> { series, x, y }: one tangential and one sagittal series per field. The recorded
       grid runs past cutoff, so x.range stops at 400 cycles/mm and the viewport clips the rest. With diffraction, a last
       series with role 'reference' is the diffraction limit at the reference wavelength and working f-number. */
    mtf: function (rec, opts) {
      var series = [];
      rec.sources.forEach(function (s, i) {
        series.push({ points: s.tangential, index: i, role: 'tangential' });
        series.push({ points: s.sagittal, index: i, role: 'sagittal' });
      });
      if (opts && opts.diffraction) {
        var lambda = rec.referenceWavelengthNm * 1e-6, fo = rec.firstOrder, N = fo.workingFNumber != null ? fo.workingFNumber : fo.fNumber;
        var nuc = 1 / (lambda * N), steps = 80, pts = [];
        for (var i = 0; i <= steps; i++) { var nu = nuc * i / steps; pts.push([nu, diffraction(nu, lambda, N)]); }
        series.push({ points: pts, role: 'reference' });
      }
      return {
        series: series,
        x: { label: 'Spatial frequency', unit: 'cycles/mm', range: [0, 400], ticks: [0, 100, 200, 300, 400] },
        y: { label: 'Modulus', range: [0, 1], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] }
      };
    },
    /* fieldCurvature(recording) -> { series, x, y }: tangential and sagittal focus shift against the field angle. */
    fieldCurvature: function (rec) {
      var rs = rec.sources.map(function (s) { return atRef(rec, s); }), all = [];
      function line(key, role) {
        var pts = rs.map(function (r, i) { all.push(r[key]); return [r[key], rec.sources[i].fieldAngleDeg]; });
        return { points: pts, index: 0, role: role };
      }
      var series = [line('tangential', 'tangential'), line('sagittal', 'sagittal')], ax = niceAxis(all);
      return { series: series, x: { label: 'Focus shift', unit: 'mm', range: ax.range, ticks: ax.ticks }, y: yAxis(rec) };
    },
    /* distortion(recording) -> { series, x, y }: percent distortion against the field angle, one solid series. */
    distortion: function (rec) {
      var vals = [], pts = rec.sources.map(function (s) { var r = atRef(rec, s); vals.push(r.percent); return [r.percent, s.fieldAngleDeg]; });
      var ax = niceAxis(vals);
      return { series: [{ points: pts, index: 0 }], x: { label: 'Distortion', unit: '%', range: ax.range, ticks: ax.ticks }, y: yAxis(rec) };
    }
  };
})();
