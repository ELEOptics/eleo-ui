<!-- Transverse ray aberration or OPD fans, T and S. -->
<script>
  import { rayFan } from '@eleoptics/plots';
  import { hover } from './interact.svelte.js';
  /** @type {import('@eleoptics/plots').RayFanProps & { label?: string, onhover?: (event: import('@eleoptics/plots').HoverEvent | null) => void, onselect?: (event: import('@eleoptics/plots').SelectEvent) => void, onview?: (view: import('@eleoptics/plots').View | null) => void }} */
  let { label, width, onhover, onselect, onview, view: viewProp, ...props } = $props();
  let inner = $state(null); // the zoom the wrapper keeps across data changes until reset; a `view` prop given by the caller controls it instead
  const view = $derived(viewProp !== undefined ? viewProp : inner);
  const setView = (/** @type {any} */ v) => { inner = v; onview?.(v); };
  let rect = $state(); // the box's content rect: unset on the server, so the server draws the default and the client redraws on hydration
  const w = $derived(width ?? (rect?.width > 0 ? +rect.width.toFixed(2) : undefined));
  const unit = $derived(props.kind === 'opd' ? 'waves' : 'µm'); // the fans' y unit, as rayFan hands it to curve
  const svg = $derived(rayFan({ ...props, width: w, view }));
</script>

<div class="eleo-svg" use:hover={{ onhover, onselect, onview: setView, axes: { y: { unit } } }} bind:contentRect={rect} role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
