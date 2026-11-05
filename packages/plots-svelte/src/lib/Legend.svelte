<!-- Legend keys for a plot card footer: field or wavelength indexes, T/S line styles, ray roles, or a layout's glasses. -->
<script>
  import { legend, glassLegend } from '@eleoptics/plots';
  /** @typedef {import('@eleoptics/plots').RecordedLayout | import('@eleoptics/plots').LayoutSystem} GlassData */
  /** @type {{ kind: 'field' | 'wavelength' | 'ts' | 'rays', n?: number, values?: readonly number[], data?: undefined } | { kind: 'glass', data: GlassData, n?: undefined, values?: undefined }} */
  let { kind, n, values, data } = $props();
  const keys = $derived(kind === 'glass' ? glassLegend(data) : legend(kind, n, values));
</script>

<div class="eleo-legend">{@html keys}</div>
