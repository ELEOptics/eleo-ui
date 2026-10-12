<!-- Spot diagram per field, with the Airy circle.
  Typed: <SpotDiagram panels={[{ title: '0.0°', series: [{ points: [[0.1, -0.2], [0.3, 0.4]], index: 0 }], airy: 2.4 }]}
    origin="chief ray" reference="centroid" showStats showAiry scale="common" half={5} unit="µm" label="Spot diagrams" width={300} />
  Sample: <SpotDiagram colorBy="wavelength" airy />. Every dot is the same size; no color option. -->
<script>
  import { spot } from '@eleoptics/plots';
  /** @type {import('@eleoptics/plots').SpotDiagramProps & { label?: string }} */
  let { label, ...props } = $props();
  const svg = $derived(spot(props));
</script>

<div class="eleo-svg" role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
