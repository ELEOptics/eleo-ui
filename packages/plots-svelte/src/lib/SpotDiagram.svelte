<!-- Spot diagram per field, with the Airy circle.
  Typed: <SpotDiagram panels={[{ title: '0.0°', series: [{ points: [[0.1, -0.2], [0.3, 0.4]], index: 0 }], airy: 2.4 }]}
    origin="chief ray" reference="centroid" showStats showAiry scale="common" half={5} unit="µm" label="Spot diagrams" width={300} />
  Sample: <SpotDiagram colorBy="wavelength" airy />. Every dot is the same size; no color option. -->
<script>
  import { spot } from '@eleoptics/plots';
  /** @type {import('@eleoptics/plots').SpotDiagramProps & { label?: string }} */
  let { label, width, ...props } = $props();
  let rect = $state(); // the box's content rect: unset on the server, so the server draws the default and the client redraws on hydration
  const w = $derived(width ?? (rect?.width > 0 ? +rect.width.toFixed(2) : undefined));
  const svg = $derived(spot({ ...props, width: w }));
</script>

<div class="eleo-svg" bind:contentRect={rect} role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
