<!-- Test page for tests/svelte.spec.js (#830, #951): a zoomable wrapper (`component`: CurvePlot, RayFan, SpotDiagram or Map2D) with `props`, which the page changes through `window.setProps(patch)`, to see the zoom survive a data redraw. -->
<script>
  let { component, props: initial, controlled = false } = $props();
  const Plot = component;
  let props = $state(initial);
  window.setProps = (/** @type {any} */ patch) => { props = { ...props, ...patch }; };
  // `controlled`: the page owns the view (#946), as a caller binding `view` and setting it from `onview`; `window.setView(null)` resets it.
  let view = $state(null);
  window.setView = (/** @type {any} */ next) => { view = next; };
</script>

{#if controlled}
  <Plot {...props} {view} onview={(v) => (view = v)} />
{:else}
  <Plot {...props} />
{/if}
