<!-- Type fixture for Map2D's typed `range` (#461). Never rendered or shipped: svelte-package builds only src/lib.
  `npm run check` (svelte-check) reads it. An unused @ts-expect-error is itself an error, so widening the union fails the check.
  svelte-check honours @ts-expect-error only in <script>, not in markup comments, so the rejected calls are typed props objects. -->
<script>
  import Map2D from '../lib/Map2D.svelte';
  /** @typedef {import('svelte').ComponentProps<typeof Map2D>} Props */
  const values = [[0, 1], [1, 0]];
  const extent = /** @type {[number, number, number, number]} */ ([-1, 1, -1, 1]);

  /** @type {Props} */
  const typedOk = { values, extent, range: [0, 1] };
  /** @type {Props} */
  // @ts-expect-error typed mode rejects { lo, hi }
  const typedBad = { values, extent, range: { lo: 0, hi: 1 } };
  /** @type {Props} */
  // @ts-expect-error the sample call (no values) was removed
  const sampleBad = { kind: 'psf' };
  /** @type {Props} */
  // @ts-expect-error values without extent
  const noExtent = { values };
</script>

<!-- accepted: typed with [lo, hi] -->
<Map2D {...typedOk} />
