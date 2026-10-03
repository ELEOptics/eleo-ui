<!-- Transverse ray aberration or OPD fans, T and S. -->
<script>
  import { rayFan } from '@eleoptics/plots';
  /** @type {import('@eleoptics/plots').RayFanProps & { label?: string }} */
  let { label, ...props } = $props();
  const svg = $derived(rayFan(props));
</script>

<div class="eleo-svg" role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
