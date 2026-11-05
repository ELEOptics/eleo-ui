<!-- Transverse ray aberration or OPD fans, T and S. -->
<script>
  import { rayFan } from '@eleoptics/plots';
  /** @type {import('@eleoptics/plots').RayFanProps & { label?: string }} */
  let { label, width, ...props } = $props();
  let box = $state(0); // the box's clientWidth: 0 on the server, so the server draws the default and the client redraws on hydration
  const w = $derived(width ?? (box > 0 ? box : undefined));
  const svg = $derived(rayFan({ ...props, width: w }));
</script>

<div class="eleo-svg" bind:clientWidth={box} role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
