<!-- MTF, field curvature, distortion or chromatic focus shift. -->
<script>
  import { curve } from '@eleoptics/plots';
  /** @type {import('@eleoptics/plots').CurvePlotProps & { label?: string }} */
  let { label, ...props } = $props();
  const svg = $derived(curve(props));
</script>

<div class="eleo-svg" role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
