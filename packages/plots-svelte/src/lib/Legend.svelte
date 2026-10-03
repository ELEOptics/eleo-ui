<!-- Legend keys for a plot card footer: field or wavelength indexes, T/S line styles, or ray roles. -->
<script>
  import { legend } from '@eleoptics/plots';
  /** @type {{ kind: 'field' | 'wavelength' | 'ts' | 'rays', n?: number }} */
  let { kind, n } = $props();
</script>

<div class="eleo-legend">{@html legend(kind, n)}</div>
