<!-- Transverse ray aberration or OPD fans, T and S. -->
<script>
  import { rayFan } from '@eleoptics/plots';
  /** @type {import('@eleoptics/plots').RayFanProps & { label?: string }} */
  let { label, width, ...props } = $props();
  let rect = $state(); // the box's content rect: unset on the server, so the server draws the default and the client redraws on hydration
  const w = $derived(width ?? (rect?.width > 0 ? +rect.width.toFixed(2) : undefined));
  const svg = $derived(rayFan({ ...props, width: w }));
</script>

<div class="eleo-svg" bind:contentRect={rect} role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
