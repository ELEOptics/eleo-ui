<!-- Spot diagram per field, with the Airy circle. -->
<script>
  import { spot } from '@eleoptics/plots';
  /** @type {import('@eleoptics/plots').SpotDiagramProps & { label?: string }} */
  let { label, ...props } = $props();
  const svg = $derived(spot(props));
</script>

<div class="eleo-svg" role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
