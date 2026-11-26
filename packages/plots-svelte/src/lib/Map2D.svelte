<!-- A 2D color map. Redraws when its props or the theme change.
  Typed: <Map2D values={grid} extent={[-2, 2, -2, 2]} x={{ label: 'x', unit: 'mm' }} y={{ label: 'y', unit: 'mm' }} map="wave" label="Wavefront" />
  renders the SVG of map2D(props) in a div, colored by that div's tokens; `range` is the color range you give, [lo, hi] (Map2DGridProps); a { lo, hi } there is a type error. -->
<script>
  import { map2D } from '@eleoptics/plots';
  import { themeTick } from './theme.svelte.js';
  import { hover } from './interact.svelte.js';
  /**
   * @typedef {{ onhover?: (event: import('@eleoptics/plots').HoverEvent | null) => void, onselect?: (event: import('@eleoptics/plots').SelectEvent) => void, onview?: (view: import('@eleoptics/plots').PlotView | null) => void, view?: import('@eleoptics/plots').PlotView | null }} HoverProps
   * @typedef {Omit<import('@eleoptics/plots').Map2DGridProps, 'range' | 'el'> & { label?: string, range?: [number, number] } & HoverProps} TypedProps
   */
  /** @type {TypedProps} */
  let { label, width, onhover, onselect, onview, view: viewProp, range = $bindable(), ...props } = $props();
  let inner = $state(null); // the zoom the typed map keeps across data changes until reset; a `view` prop given by the caller controls it instead
  const view = $derived(viewProp !== undefined ? viewProp : inner);
  const setView = (/** @type {any} */ v) => { inner = v; onview?.(v); };
  let rect = $state(); // the box's content rect: unset on the server, so the server draws the default and the client redraws on hydration
  /** @type {HTMLDivElement | undefined} */
  let host = $state();
  let svg = $state('');
  $effect(() => {
    themeTick();
    if (!host) return;
    const grid = /** @type {import('@eleoptics/plots').Map2DGridProps} */ ({ ...props, width: width ?? (rect?.width > 0 ? +rect.width.toFixed(2) : undefined), range, el: host, view });
    svg = map2D(grid);
  });
</script>

<div class="eleo-svg" use:hover={{ onhover, onselect, onview: setView, values: props.values, axes: { x: /** @type {any} */ (props).x, y: /** @type {any} */ (props).y, value: /** @type {any} */ (props).value } }} bind:this={host} bind:contentRect={rect} role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
