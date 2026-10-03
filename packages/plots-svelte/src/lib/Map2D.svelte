<!-- A 2D color map (PSF, irradiance, wavefront). Redraws when its props or the theme change; `range` reports the colorbar ends. -->
<script>
  import { map2D } from '@eleoptics/plots';
  import { themeTick } from './theme.svelte.js';
  /** @type {import('@eleoptics/plots').Map2DProps & { label?: string, range?: { lo: number, hi: number } }} */
  let { label, range = $bindable(), ...props } = $props();
  /** @type {HTMLCanvasElement} */
  let canvas;
  $effect(() => { themeTick(); range = map2D(canvas, { ...props }); });
</script>

<canvas bind:this={canvas} role={label ? 'img' : undefined} aria-label={label}></canvas>
