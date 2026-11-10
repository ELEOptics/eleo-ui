<!-- A line plot of typed series or panels, or an analysis kind (mtf, fieldCurvature, distortion, chromaticFocus).
  Typed: <CurvePlot series={[{ points: [[0, 1], [100, 0.62]], index: 0, role: 'tangential' }]}
    x={{ label: 'Spatial frequency', unit: 'cycles/mm', range: [0, 400] }} y={{ label: 'Modulus', range: [0, 1] }} />
  Panels: <CurvePlot panels={[{ title: '1.0° · Py', series: [{ points: [[-1, 2], [0, 0], [0.5, null], [1, -3]], index: 0 }] }, { series: [{ points: [[-1, 1], [1, -1]], index: 1 }] }]}
    columns={3} x={{ label: 'Pupil', range: [-1, 1] }} y={{ label: 'Ray error', unit: 'µm' }} width={460} />
  Limits: <CurvePlot series={[...]} limits={[{ y: 0.5, label: 'spec' }, { x: [100, 200] }]} /> draws a line (a number) or a band (a pair) in the `limit` style; on panels, in every panel. A series may take role: 'limit' for a dash-dot ink line of its own.
  Panels share one scale and draw the axis labels once; a null coordinate breaks the line.
  Every role draws the same stroke: 1 px up to a 234 px frame, `sqrt(F / 234)` above it (ADR-0003); the plot area clips; ranges default to the nice range of the data. No color option. -->
<script>
  import { curve } from '@eleoptics/plots';
  import { hover } from './interact.svelte.js';
  /** @type {import('@eleoptics/plots').CurvePlotProps & { label?: string, onhover?: (event: import('@eleoptics/plots').HoverEvent | null) => void, onselect?: (event: object | null) => void }} */
  let { label, width, onhover, onselect, ...props } = $props();
  let rect = $state(); // the box's content rect: unset on the server, so the server draws the default and the client redraws on hydration
  const w = $derived(width ?? (rect?.width > 0 ? +rect.width.toFixed(2) : undefined));
  const svg = $derived(curve({ ...props, width: w }));
</script>

<div class="eleo-svg" use:hover={{ onhover, onselect, axes: { x: /** @type {any} */ (props).x, y: /** @type {any} */ (props).y } }} bind:contentRect={rect} role={label ? 'img' : undefined} aria-label={label}>{@html svg}</div>
