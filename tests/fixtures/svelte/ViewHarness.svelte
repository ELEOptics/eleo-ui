<!-- Test page for tests/svelte.spec.js (#830): a CurvePlot whose series the page replaces through `window.setSeries`, to see the zoom survive a data redraw. -->
<script>
  import CurvePlot from '../../../packages/plots-svelte/src/lib/CurvePlot.svelte';
  let series = $state([{ points: [[0, 1], [120, 0.62], [240, 0.3]], index: 0, role: 'tangential' }]);
  window.setSeries = (/** @type {any} */ next) => { series = next; };
  // `controlled`: the page owns the view (#946), as a caller binding `view` and setting it from `onview`; `window.setView(null)` resets it.
  let { controlled = false } = $props();
  let view = $state(null);
  window.setView = (/** @type {any} */ next) => { view = next; };
</script>

{#if controlled}
  <CurvePlot {series} {view} onview={(v) => (view = v)} x={{ label: 'f' }} y={{ label: 'm' }} />
{:else}
  <CurvePlot {series} x={{ label: 'f' }} y={{ label: 'm' }} />
{/if}
