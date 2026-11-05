<!-- Signed, grouped bars: a group per category, a bar per series (Seidel sums, per-surface contributions).
  Typed: <BarPlot categories={['1', '2', '3']} series={[{ values: [0.012, -0.004, 0.001], index: 0, label: 'SI' }]}
    total="Σ" y={{ label: 'Seidel sum', unit: 'mm' }} label="Seidel sums" />
  `total` appends a group of per-series sums. `limits` (y only: `[{ y: number | [lo, hi], label? }]`) pass through and draw
  in the `limit` style; an x limit throws. A range left out is the nice range of the values, the limits and 0.
  `label` names the figure (role="img"). No color option: `index` k takes the k-th series color. -->
<script>
  import * as plots from '@eleoptics/plots';
  /** @type {import('@eleoptics/plots').BarPlotProps & { label?: string }} */
  let { label, width, ...props } = $props();
  let rect = $state(); // the box's content rect: unset on the server, so the server draws the default and the client redraws on hydration
  const w = $derived(width ?? (rect?.width > 0 ? +rect.width.toFixed(2) : undefined));
  // A namespace import: plots before 0.5.0 has no `bars`, and a named import would fail the whole package at link time.
  const svg = $derived.by(() => {
    if (typeof plots.bars !== 'function') throw new Error('BarPlot needs @eleoptics/plots 0.5.0 or later (bars)');
    return plots.bars({ ...props, width: w });
  });
</script>

<div class="eleo-svg" bind:contentRect={rect} role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
