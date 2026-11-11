<!-- True-scale 2D lens layout with rays, stop and image plane. -->
<script>
  import { layout2D } from '@eleoptics/plots';
  import { hover } from './interact.svelte.js';
  /** @type {import('@eleoptics/plots').Layout2DProps & { label?: string, onhover?: (event: import('@eleoptics/plots').HoverEvent | null) => void, onselect?: (event: import('@eleoptics/plots').SelectEvent) => void, onview?: (view: import('@eleoptics/plots').PlotView | null) => void, view?: import('@eleoptics/plots').PlotView | null }} */
  let { label, width, onhover, onselect, onview, view: viewProp, ...props } = $props();
  let inner = $state(null); // the zoom the layout keeps across data changes until reset; a `view` prop given by the caller controls it instead
  const view = $derived(viewProp !== undefined ? viewProp : inner);
  const setView = (/** @type {any} */ v) => { inner = v; onview?.(v); };
  let rect = $state(); // the box's content rect: unset on the server, so the server draws the default and the client redraws on hydration
  // A box of 8 px or less (a collapsing panel, a transition) draws the default: layout2D throws below its 4 px pad.
  const w = $derived(width ?? (rect?.width > 8 ? +rect.width.toFixed(2) : undefined));
  const svg = $derived(layout2D({ ...props, width: w, view }));
</script>

<div class="eleo-svg" use:hover={{ onhover, onselect, onview: setView, axes: { x: { unit: 'mm' }, y: { unit: 'mm' } } }} bind:contentRect={rect} role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
