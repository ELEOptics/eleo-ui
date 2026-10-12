/* Adapters from phos-core recordings (README.md) to the typed calls of ELEO.curve and ELEO.spot (plan #162, #174, #179).
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
  /* The y axis: the recorded field angle from 0 to the largest, with curve's default ticks. */
  function yAxis(rec) {
    var angles = rec.sources.map(function (s) { return s.fieldAngleDeg; });
    return { label: 'Field', unit: '°', range: [0, Math.max.apply(null, angles)] };
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
        for (var i = 0; i <= steps; i++) { var nu = nuc * i / steps; pts.push([nu, globalThis.ELEO.mtfDiffraction(nu, lambda, N)]); }
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
      var rs = rec.sources.map(function (s) { return atRef(rec, s); });
      function line(key, role) {
        var pts = rs.map(function (r, i) { return [r[key], rec.sources[i].fieldAngleDeg]; });
        return { points: pts, index: 0, role: role };
      }
      return { series: [line('tangential', 'tangential'), line('sagittal', 'sagittal')], x: { label: 'Focus shift', unit: 'mm' }, y: yAxis(rec) };
    },
    /* spot(recording) -> { panels, unit, origin }: one panel per field titled with its angle, a series per wavelength (index k) with
       the points in µm (the recording is in mm), the Airy radius in µm at the reference wavelength and working f-number as
       the `airy` field, and `origin` naming the reference. No notes: the renderer computes RMS and GEO. */
    spot: function (rec) {
      var fo = rec.firstOrder, N = fo.workingFNumber != null ? fo.workingFNumber : fo.fNumber;
      var airy = globalThis.ELEO.airyRadius(rec.referenceWavelengthNm * 1e-3, N);
      return {
        unit: 'µm',
        origin: 'paraxial chief ray',
        panels: rec.sources.map(function (s) {
          return {
            title: s.fieldAngleDeg.toFixed(1) + '°',
            series: s.points.map(function (pts, k) {
              return { points: pts.map(function (q) { return [q[0] * 1000, q[1] * 1000]; }), index: k };
            }),
            airy: airy
          };
        })
      };
    },
    /* distortion(recording) -> { series, x, y }: percent distortion against the field angle, one solid series. */
    distortion: function (rec) {
      var pts = rec.sources.map(function (s) { return [atRef(rec, s).percent, s.fieldAngleDeg]; });
      return { series: [{ points: pts, index: 0 }], x: { label: 'Distortion', unit: '%' }, y: yAxis(rec) };
    }
  };
})();
