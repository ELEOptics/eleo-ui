// Type usage checked by tests/unit/types.test.js under tsc --strict, against packages/plots/src/index.d.ts.
import type { Glass, LayoutSystem, RecordedSurface } from '../../packages/plots/src/index';
import { glassLegend } from '../../packages/plots/src/index';

const profile: [number, number][] = [[0, -1], [0, 1]];
const bk7: Glass = { name: 'N-BK7', nd: 1.5168, vd: 64.17 };

// a surface's glass is the shorthand, a {name, nd, vd} glass (#96), or null for air
const surfaces: RecordedSurface[] = [
  { z: 0, sd: 1, stop: true, image: false, glass: bk7, profile },
  { z: 1, sd: 1, stop: false, image: false, glass: 'flint', profile },
  { z: 2, sd: 1, stop: false, image: false, glass: null, profile },
];

// @ts-expect-error a catalog name alone is not a glass: give {name, nd, vd}
const bare: RecordedSurface = { z: 0, sd: 1, stop: false, image: false, glass: 'BK7', profile };

// glassLegend takes what layout2D's data takes (#122): a recorded layout or a LayoutSystem, no cast
const system: LayoutSystem = { layout: { surfaces, rays: [] }, layoutWl: { surfaces, rays: [] } };
const keys: string = glassLegend(system) + glassLegend({ surfaces, rays: [] });

export { surfaces, bare, keys };
