<!-- Spot diagram per field, with the Airy circle.
  Typed: <SpotDiagram panels={[{ title: '0.0°', series: [{ points: [[0.1, -0.2], [0.3, 0.4]], index: 0 }], airy: 2.4 }]}
    origin="chief ray" reference="centroid" showStats showAiry scale="common" half={5} unit="µm" label="Spot diagrams" width={300} />
  Sample: <SpotDiagram colorBy="wavelength" airy />. Every dot is the same size; no color option. -->
<script>
  import { spot } from '@eleoptics/plots';
  import { hover } from './interact.svelte.js';
  /** @type {import('@eleoptics/plots').SpotDiagramProps & { label?: string, onhover?: (event: import('@eleoptics/plots').HoverEvent | null) => void, onselect?: (event: import('@eleoptics/plots').SelectEvent) => void, onview?: (view: import('@eleoptics/plots').View | null) => void, view?: import('@eleoptics/plots').SpotView | null }} */
  let { label, width, onhover, onselect, onview, view: viewProp, ...props } = $props();
  let inner = $state(null); // the zoom the wrapper keeps across data changes until reset; a `view` prop given by the caller controls it instead
  const view = $derived(viewProp !== undefined ? viewProp : inner);
  const setView = (/** @type {any} */ v) => { inner = v; onview?.(v); };
  let rect = $state(); // the box's content rect: unset on the server, so the server draws the default and the client redraws on hydration
  const w = $derived(width ?? (rect?.width > 0 ? +rect.width.toFixed(2) : undefined));
  const unit = $derived(props.panels ? /** @type {any} */ (props).unit : 'µm'); // the sample call draws in µm
  const svg = $derived(spot(/** @type {any} */ ({ ...props, width: w, view })));
</script>

<div class="eleo-svg" use:hover={{ onhover, onselect, onview: setView, axes: { x: { unit }, y: { unit } } }} bind:contentRect={rect} role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
