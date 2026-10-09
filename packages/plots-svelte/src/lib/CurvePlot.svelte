<!-- A line plot of typed series, or an analysis kind (mtf, fieldCurvature, distortion, chromaticFocus).
  Typed: <CurvePlot series={[{ points: [[0, 1], [100, 0.62]], index: 0, role: 'tangential' }]}
    x={{ label: 'Spatial frequency', unit: 'cycles/mm', range: [0, 400] }} y={{ label: 'Modulus', range: [0, 1] }} />
  Every role draws 1 px; the plot area clips; ranges default to the nice range of the data. No color option. -->
<script>
  import { curve } from '@eleoptics/plots';
  /** @type {import('@eleoptics/plots').CurvePlotProps & { label?: string }} */
  let { label, ...props } = $props();
  const svg = $derived(curve(props));
</script>

<div class="eleo-svg" role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
