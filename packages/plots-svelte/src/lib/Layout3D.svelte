<!-- Orthographic 3D view of the system: flat-shaded glass from a recorded layout, with its rays drawn in the air gaps (`rays` picks the set). Redraws on prop, theme or palette change. -->
<script>
  import { layout3D } from '@eleoptics/plots';
  import { themeTick } from './theme.svelte.js';
  /** @type {import('@eleoptics/plots').Layout3DProps & { label?: string }} */
  let { label, ...props } = $props();
  /** @type {HTMLCanvasElement} */
  let canvas;
  $effect(() => { themeTick(); layout3D(canvas, { ...props }); });
</script>

<canvas bind:this={canvas} role={label ? 'img' : undefined} aria-label={label}></canvas>
