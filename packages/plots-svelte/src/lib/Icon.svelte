<!-- An ELEO icon as inline SVG in the text color. Pass `label` only when the icon itself is the content. -->
<script>
  import { icon } from '@eleoptics/plots';
  /** @type {{ name: string, style?: 'line' | 'glass' | 'blueprint', size?: number, label?: string }} */
  let { name, style = 'line', size = 16, label } = $props();
</script>

{@html icon(name, { style, size, label })}
