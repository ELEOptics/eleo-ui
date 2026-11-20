<!-- Orthographic 3D view of the system: three.js-shaded opaque glass from a recorded layout, with its rays drawn in the air gaps (`rays` picks the set, `view` the camera). Redraws on prop, theme or palette change. -->
<script>
  import { layout3D } from '@eleoptics/plots/layout3d';
  import { themeTick } from './theme.svelte.js';
  /** @type {import('@eleoptics/plots/layout3d').Layout3DProps & { label?: string }} */
  let { label, ...props } = $props();
  /** @type {HTMLCanvasElement} */
  let canvas;
  $effect(() => { themeTick(); layout3D(canvas, { ...props }); });
</script>

<canvas bind:this={canvas} role={label ? 'img' : undefined} aria-label={label}></canvas>
