/* Adapters from phos-core recordings (README.md) to the typed calls of ELEO.curve, ELEO.spot, ELEO.bars and ELEO.layout2D and the typed ELEO.map2D (plan #162, #174, #179, #284, #389).
   A classic script: the gallery loads it with a <script> tag and the unit tests with import(), so it has no
   import or export and assigns globalThis.ELEOAdapters. */
(function () {
  /* The result of s (a source, or the recording itself for Seidel) whose wavelength is nearest the reference: the recorded 656.272 against 656.273 shows
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
    /* mtf(recording, { diffraction }) -> { series, x, y }: one tangential and one sagittal series per field, labelled `<angle>° tangential` or `<angle>° sagittal`. The recorded
       grid runs past cutoff, so x.range stops at 400 cycles/mm and the viewport clips the rest. With diffraction, a last
       series with role 'reference' is the diffraction limit at the reference wavelength and working f-number. */
    mtf: function (rec, opts) {
      var series = [];
      rec.sources.forEach(function (s, i) {
        series.push({ points: s.tangential, index: i, role: 'tangential', label: s.fieldAngleDeg + '° tangential' });
        series.push({ points: s.sagittal, index: i, role: 'sagittal', label: s.fieldAngleDeg + '° sagittal' });
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
    /* fieldCurvature(recording) -> { series, x, y }: tangential and sagittal focus shift against the field angle, labelled `Tangential` and `Sagittal`. */
    fieldCurvature: function (rec) {
      var rs = rec.sources.map(function (s) { return atRef(rec, s); });
      function line(key, role) {
        var pts = rs.map(function (r, i) { return [r[key], rec.sources[i].fieldAngleDeg]; });
        return { points: pts, index: 0, role: role, label: role === 'tangential' ? 'Tangential' : 'Sagittal' };
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
    /* footprint(recording) -> { panels, unit, origin, ... }: one panel, a series per field (index = field, labelled `F<k> <angle>°`) of the alive rays' stop-local
       x/y in mm (verbatim, at the wavelength nearest the header's referenceWavelengthNm), and the stop's semi-diameter as `circle`.
       Every field fills the stop and the overlap is the point, so no panel per field. */
    footprint: function (rec) {
      return {
        unit: 'mm',
        origin: 'stop vertex, local x/y',
        showStats: false,
        showAiry: false,
        label: 'Beam footprint',
        panels: [{
          series: rec.sources.map(function (s, i) {
            var w = 0;
            s.wavelengths.forEach(function (nm, j) { if (Math.abs(nm - rec.referenceWavelengthNm) < Math.abs(s.wavelengths[w] - rec.referenceWavelengthNm)) w = j; });
            return { points: s.points[w], index: i, label: 'F' + (i + 1) + ' ' + s.fieldAngleDeg.toFixed(1) + '°' };
          }),
          circle: { radius: rec.semiDiameter, label: 'Semi-diameter' }
        }]
      };
    },
    /* seidel(recording) -> { categories, series, total, y }: at the result nearest the reference wavelength, the surface numbers as
       categories and a series per Seidel term (SI to SV, CL, CT; index 0 to 6) found by key name, in a fixed order. phos-core's total
       (the last element of each term) is stripped: bars() recomputes the sum from `total`, 'Σ'.
       seidel(recording, { by: 'term' }) transposes it, as phos would: the terms SI to CT as categories, a series per surface (S1, S2, ...;
       index 0 to n-1) and a Σ series (index n) of phos-core's recorded totals, with no `total`. The default, by: 'surface', is the above.
       Any other `by` throws. */
    seidel: function (rec, opts) {
      var res = atRef(rec, rec);
      var terms = [['spherical', 'SI'], ['coma', 'SII'], ['astigmatism', 'SIII'], ['fieldCurvature', 'SIV'], ['distortion', 'SV'], ['axialColor', 'CL'], ['lateralColor', 'CT']];
      var by = opts && opts.by;
      if (by !== undefined && by !== 'surface' && by !== 'term') throw new Error("seidel: by must be 'surface' or 'term', got " + String(by));
      if (by === 'term') {
        var n = res.terms[terms[0][0]].length - 1;
        var row = function (k) { return terms.map(function (t) { return res.terms[t[0]][k]; }); };
        var surfaces = [];
        for (var k = 0; k < n; k++) surfaces.push({ values: row(k), index: k, label: 'S' + (k + 1) });
        surfaces.push({ values: row(n), index: n, label: 'Σ' });
        return { categories: terms.map(function (t) { return t[1]; }), series: surfaces, y: { label: 'Seidel sum', unit: 'mm' } };
      }
      return {
        categories: res.terms[terms[0][0]].slice(0, -1).map(function (_, i) { return String(i + 1); }),
        series: terms.map(function (t, i) { return { values: res.terms[t[0]].slice(0, -1), index: i, label: t[1] }; }),
        total: 'Σ',
        y: { label: 'Seidel sum', unit: 'mm' }
      };
    },
    /* layout(recording) -> the layout2D props: the recorded layout itself (its extra header keys are ignored), the fan rays
       (with their alive counts) and a label per field, the header's fieldsDeg as degrees. */
    layout: function (rec) {
      return { data: rec, rays: 'fan', width: 1000, labels: rec.fieldsDeg.map(function (a) { return a + '°'; }) };
    },
    /* psf(recording, { log }) -> the typed map2D props (without `el`, which the caller sets): the recorded PointSpread grid and its extent in mm,
       linear over its range, on the ember map; with `log` on the log scale, divided by its peak, and a colorbar for the relative intensity. */
    psf: function (rec, opts) {
      var values = rec.values;
      if (opts && opts.log) { var pk = 0; rec.values.forEach(function (r) { r.forEach(function (v) { if (v > pk) pk = v; }); }); if (pk > 0) values = rec.values.map(function (r) { return r.map(function (v) { return v / pk; }); }); }
      var props = { values: values, extent: rec.extent, x: { label: 'x', unit: 'mm' }, y: { label: 'y', unit: 'mm' }, map: 'ember', label: 'Point spread' };
      if (opts && opts.log) { props.scale = 'log'; props.value = { label: 'Intensity', unit: 'relative' }; }
      return props;
    },
    /* wavefront(recording) -> the typed map2D props (without `el`): the recorded WavefrontError as polar samples on the ember map
       (sequential over [min, max]: the recorded OPD has no sign change), its pupil as the aperture, an extent 5 % wider than the pupil, and a colorbar in waves. */
    wavefront: function (rec) {
      var e = rec.pupilRadius * 1.05;
      return {
        values: rec.values, polar: { radii: rec.radii, angles: rec.angles }, extent: [-e, e, -e, e],
        x: { label: 'x', unit: 'mm' }, y: { label: 'y', unit: 'mm' }, map: 'ember', label: 'Wavefront error',
        aperture: { x: 0, y: 0, r: rec.pupilRadius }, value: { label: 'OPD', unit: 'waves' }
      };
    },
    /* fans(recording) -> { panels, columns, x, y, key } (key: `<nm> nm` per wavelength of the first source, index = wavelength) in the shape of fanPanels (packages/plots/src/fan.js): row T (the y fan, Py) then row S
       (the x fan, Px), a column per field titled `<angle>° · Py`, a series per wavelength (index = wavelength) of [pupil, error in µm]
       (the recording is in mm) minus the fan's chief-ray error (the sample at rec.referenceWavelengthNm with the smallest |pupil|, under 1e-9, so that wavelength's fan crosses 0 at pupil 0 and
       the others keep their lateral-colour offset); a chief ray that is not Alive, or a reference not recorded, throws a TypeError naming the field.
       Every sample whose status is not Alive is null: a virtual, missed or dead ray's error is not an image error.
       The y range is symmetric at fanPanels' next nice step (copied: fanPanels is not on ELEO; the unit test pins it). The title's number is fanPanels' fmt(angle, 1), copied too: U+2212 for a negative. */
    fans: function (rec) {
      var mx = 0, panels = [];
      [['y', 'Py'], ['x', 'Px']].forEach(function (row) {
        rec.sources.forEach(function (s) {
          var fan = s[row[0]], where = 'ELEOAdapters.fans: field ' + s.fieldAngleDeg + '° ' + row[1];
          var rw = s.wavelengths.indexOf(rec.referenceWavelengthNm);
          if (rw < 0) throw new TypeError(where + ': reference wavelength ' + rec.referenceWavelengthNm + ' nm is not recorded');
          var ci = -1, near = 1e-9;
          fan.points[rw].forEach(function (q, i) { if (Math.abs(q[0]) < near) { near = Math.abs(q[0]); ci = i; } });
          if (ci < 0 || fan.statuses[rw][ci] !== 'Alive') throw new TypeError(where + ': the chief ray (pupil 0 within 1e-9 at ' + rec.referenceWavelengthNm + ' nm) is not Alive');
          var chief = fan.points[rw][ci][1];
          panels.push({
            title: (s.fieldAngleDeg < 0 ? '\u2212' : '') + Math.abs(s.fieldAngleDeg).toFixed(1) + '° · ' + row[1],
            series: fan.points.map(function (pts, w) {
              return {
                points: pts.map(function (q, i) {
                  if (fan.statuses[w][i] !== 'Alive') return [q[0], null];
                  var v = (q[1] - chief) * 1000;
                  mx = Math.max(mx, Math.abs(v));
                  return [q[0], v];
                }),
                index: w
              };
            })
          });
        });
      });
      var nice = [5, 10, 20, 25, 50, 100, 200].find(function (v) { return v >= mx; }) || Math.ceil(mx);
      return {
        panels: panels, columns: rec.sources.length, x: { label: 'Pupil', range: [-1, 1] },
        key: rec.sources[0].wavelengths.map(function (nm, w) { return { label: nm.toFixed(1) + ' nm', index: w }; }),
        y: { label: 'Transverse ray aberration', unit: 'µm', range: [-nice, nice] }
      };
    },
    /* distortion(recording) -> { series, x, y }: percent distortion against the field angle, one solid series labelled `Distortion`. */
    distortion: function (rec) {
      var pts = rec.sources.map(function (s) { return [atRef(rec, s).percent, s.fieldAngleDeg]; });
      return { series: [{ points: pts, index: 0, label: 'Distortion' }], x: { label: 'Distortion', unit: '%' }, y: yAxis(rec) };
    }
  };
})();
