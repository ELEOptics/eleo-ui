<!-- A 2D color map. Redraws when its props or the theme change.
  Typed: <Map2D values={grid} extent={[-2, 2, -2, 2]} x={{ label: 'x', unit: 'mm' }} y={{ label: 'y', unit: 'mm' }} map="wave" label="Wavefront" />
  renders the SVG of map2D(props) in a div, colored by that div's tokens; `range` is then the color range you give, [lo, hi] (Map2DGridProps); a { lo, hi } there is a type error.
  Sample: <Map2D data={system} kind="psf" bind:range /> draws a canvas; `range` reports the colorbar ends, { lo, hi }. -->
<script>
  import { map2D } from '@eleoptics/plots';
  import { themeTick } from './theme.svelte.js';
  /**
   * @typedef {Omit<import('@eleoptics/plots').Map2DProps, 'map'> & Omit<import('@eleoptics/plots').Map2DGridProps, 'range' | 'el'> & { label?: string, range?: [number, number] }} TypedProps
   * @typedef {Omit<import('@eleoptics/plots').Map2DProps, 'map'> & Partial<Omit<import('@eleoptics/plots').Map2DGridProps, 'range' | 'el' | 'values'>> & { values?: undefined, label?: string, range?: { lo: number, hi: number } }} SampleProps
   */
  /** @type {TypedProps | SampleProps} */
  let { label, width, range = $bindable(), ...props } = $props();
  let rect = $state(); // the box's content rect: unset on the server, so the server draws the default and the client redraws on hydration
  /** @type {HTMLCanvasElement | undefined} */
  let canvas = $state();
  /** @type {HTMLDivElement | undefined} */
  let host = $state();
  let svg = $state('');
  const typed = $derived(props.values !== undefined);
  $effect(() => {
    themeTick();
    if (typed) {
      if (!host) return;
      const grid = /** @type {import('@eleoptics/plots').Map2DGridProps} */ ({ ...props, width: width ?? (rect?.width > 0 ? rect.width : undefined), range, el: host });
      svg = map2D(grid);
    } else if (canvas) {
      range = map2D(canvas, { ...props });
    }
  });
</script>

{#if typed}
  <div class="eleo-svg" bind:this={host} bind:contentRect={rect} role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
{:else}
  <canvas bind:this={canvas} role={label ? 'img' : undefined} aria-label={label}></canvas>
{/if}
