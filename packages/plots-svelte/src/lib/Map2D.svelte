<!-- A 2D color map. Redraws when its props or the theme change.
  Typed: <Map2D values={grid} extent={[-2, 2, -2, 2]} x={{ label: 'x', unit: 'mm' }} y={{ label: 'y', unit: 'mm' }} map="wave" label="Wavefront" />
  renders the SVG of map2D(props) in a div, colored by that div's tokens; `range` is then the color range you give (Map2DGridProps).
  Sample: <Map2D data={system} kind="psf" bind:range /> draws a canvas; `range` reports the colorbar ends. -->
<script>
  import { map2D } from '@eleoptics/plots';
  import { themeTick } from './theme.svelte.js';
  /** @type {Omit<import('@eleoptics/plots').Map2DProps, 'map'> & Partial<Omit<import('@eleoptics/plots').Map2DGridProps, 'range' | 'el'>> & { label?: string, range?: [number, number] | { lo: number, hi: number } }} */
  let { label, range = $bindable(), ...props } = $props();
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
      const grid = /** @type {import('@eleoptics/plots').Map2DGridProps} */ ({ ...props, range, el: host });
      svg = map2D(grid);
    } else if (canvas) {
      range = map2D(canvas, { ...props });
    }
  });
</script>

{#if typed}
  <div class="eleo-svg" bind:this={host} role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
{:else}
  <canvas bind:this={canvas} role={label ? 'img' : undefined} aria-label={label}></canvas>
{/if}
