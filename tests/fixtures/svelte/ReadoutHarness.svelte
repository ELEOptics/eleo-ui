<!-- Test page for tests/svelte.spec.js (#811): a CurvePlot in a PlotCard whose readout line shows the last hover event through readout(). -->
<script>
  import { readout } from '@eleoptics/plots';
  import CurvePlot from '../../../packages/plots-svelte/src/lib/CurvePlot.svelte';
  import PlotCard from '../../../packages/plots-svelte/src/lib/PlotCard.svelte';
  const x = { label: 'Spatial frequency', unit: 'cycles/mm' };
  const y = { label: 'Modulus' };
  let event = $state(null);
</script>

<PlotCard title="Readout" readout={readout(event, { x, y })}>
  <CurvePlot series={[{ points: [[0, 1], [120, 0.62], [240, 0.3]], index: 0, role: 'tangential', label: 'Tangential' }]} {x} {y} onhover={(e) => (event = e)} />
</PlotCard>
