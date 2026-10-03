<!-- True-scale 2D lens layout with rays, stop and image plane. -->
<script>
  import { layout2D } from '@eleoptics/plots';
  /** @type {import('@eleoptics/plots').Layout2DProps & { label?: string }} */
  let { label, ...props } = $props();
  const svg = $derived(layout2D(props));
</script>

<div class="eleo-svg" role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
