<!-- Test page for tests/svelte.spec.js (#811): a CurvePlot in a PlotCard with no callback; its hover tooltip is the readout (CR #857). -->
<script>
  import CurvePlot from '../../../packages/plots-svelte/src/lib/CurvePlot.svelte';
  import PlotCard from '../../../packages/plots-svelte/src/lib/PlotCard.svelte';
  const x = { label: 'Spatial frequency', unit: 'cycles/mm' };
  const y = { label: 'Modulus' };
</script>

<PlotCard title="Readout">
  <CurvePlot series={[{ points: [[0, 1], [120, 0.62], [240, 0.3]], index: 0, role: 'tangential', label: 'Tangential' }]} {x} {y} />
</PlotCard>
