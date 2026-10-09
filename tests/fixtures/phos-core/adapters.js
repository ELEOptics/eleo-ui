/* Adapters from phos-core recordings (README.md) to the typed curve call of ELEO.curve (plan #162, #174).
   A classic script: the gallery loads it with a <script> tag and the unit tests with import(), so it has no
   import or export and assigns globalThis.ELEOAdapters. */
globalThis.ELEOAdapters = {
  /* mtf(recording) -> { series, x, y }: one tangential and one sagittal series per field. The recorded grid runs past
     cutoff, so x.range stops at 400 cycles/mm and the viewport clips the rest. */
  mtf: function (rec) {
    var series = [];
    rec.sources.forEach(function (s, i) {
      series.push({ points: s.tangential, index: i, role: 'tangential' });
      series.push({ points: s.sagittal, index: i, role: 'sagittal' });
    });
    return {
      series: series,
      x: { label: 'Spatial frequency', unit: 'cycles/mm', range: [0, 400], ticks: [0, 100, 200, 300, 400] },
      y: { label: 'Modulus', range: [0, 1], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] }
    };
  }
};
