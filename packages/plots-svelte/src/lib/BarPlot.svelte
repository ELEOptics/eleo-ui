<!-- Signed, grouped bars: a group per category, a bar per series (Seidel sums, per-surface contributions).
  Typed: <BarPlot categories={['1', '2', '3']} series={[{ values: [0.012, -0.004, 0.001], index: 0, label: 'SI' }]}
    total="Σ" y={{ label: 'Seidel sum', unit: 'mm' }} label="Seidel sums" />
  `total` appends a group of per-series sums. `limits` (y only: `[{ y: number | [lo, hi], label? }]`) pass through and draw
  in the `limit` style; an x limit throws. A range left out is the nice range of the values, the limits and 0.
  `label` names the figure (role="img"). No color option: `index` k takes the k-th series color. -->
<script>
  import { bars } from '@eleoptics/plots';
  /** @type {import('@eleoptics/plots').BarPlotProps & { label?: string }} */
  let { label, ...props } = $props();
  const svg = $derived(bars(props));
</script>

<div class="eleo-svg" role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
