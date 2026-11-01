// A typed map2D call compiles under --strict and returns a string; the sample call still takes a canvas (#393, plan 389).
// oracle: spec roadmap Constraints (typed API alongside the old one)
import type { Map2DGridProps } from '../../packages/plots/src/index';
import ELEO, { map2D } from '../../packages/plots/src/index';

// A PSF: a grid of rows, an extent in mm, curve axes, a colormap and the element whose tokens color it.
const psf: Map2DGridProps = {
  values: [[0, 0.5], [0.25, 1]],
  extent: [-0.02, 0.02, -0.02, 0.02],
  x: { label: 'x', unit: 'mm' },
  y: { label: 'y', unit: 'mm' },
  map: 'ember',
  el: document.body,
  width: 460,
  height: 360,
};
const a: string = map2D(psf);

// A wavefront: NaN-masked cells, a symmetric range, a pupil aperture and a colorbar axis.
const b: string = ELEO.map2D({
  values: [[NaN, 0.1], [-0.1, 0]],
  extent: [-1, 1, -1, 1],
  map: 'wave',
  scale: 'linear',
  range: [-0.5, 0.5],
  aperture: { x: 0, y: 0, r: 1 },
  value: { label: 'OPD', unit: 'waves' },
  label: 'Wavefront',
});

// A log PSF over four decades.
const c: string = map2D({ values: [[1, 0.01]], extent: [0, 1, 0, 1], scale: 'log', decades: 4 });

// Recorded wavefront samples: values[ring][spoke] on polar radii (extent units) and angles (radians from +x, counter-clockwise).
const d: string = map2D({
  values: [[0.1, -0.1, 0.2], [0, 0.05, -0.05]],
  polar: { radii: [0.5, 1], angles: [0, 2.0944, 4.18879] },
  extent: [-1, 1, -1, 1],
  map: 'wave',
  aperture: { x: 0, y: 0, r: 1 },
});

// The sample call keeps its canvas signature and result.
const r: { lo: number; hi: number } = map2D(document.createElement('canvas'), { kind: 'psf', scale: 'log' });

// @ts-expect-error a grid needs its extent
map2D({ values: [[1]] });
// @ts-expect-error values are rows of numbers
map2D({ values: [['a']], extent: [0, 1, 0, 1] });
// @ts-expect-error the map names a colormap, not a color
map2D({ values: [[1]], extent: [0, 1, 0, 1], map: 'red' });
// @ts-expect-error polar needs both radii and angles
map2D({ values: [[1]], extent: [-1, 1, -1, 1], polar: { radii: [1] } });
export { a, b, c, d, r };
