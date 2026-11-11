<!-- Test page for tests/svelte.spec.js (#830): a CurvePlot whose series the page replaces through `window.setSeries`, to see the zoom survive a data redraw. -->
<script>
  import CurvePlot from '../../../packages/plots-svelte/src/lib/CurvePlot.svelte';
  let series = $state([{ points: [[0, 1], [120, 0.62], [240, 0.3]], index: 0, role: 'tangential' }]);
  window.setSeries = (/** @type {any} */ next) => { series = next; };
</script>

<CurvePlot {series} x={{ label: 'f' }} y={{ label: 'm' }} />
