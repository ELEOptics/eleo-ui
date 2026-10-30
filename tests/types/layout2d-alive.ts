// Type usage checked by tests/unit/types.test.js under tsc --strict, against packages/plots/src/index.d.ts.
import type { RecordedLayout, RecordedSurface } from '../../packages/plots/src/index';
import { layout2D } from '../../packages/plots/src/index';

const profile: [number, number][] = [[0, -1], [0, 1]];
const surfaces: RecordedSurface[] = [{ z: 0, sd: 1, stop: true, image: false, glass: null, profile }];

// alive[field][ray]: leading alive points; dead is valid only with alive (Plan #337)
const layout: RecordedLayout = {
  surfaces,
  rays: [[[[0, 0], [1, 0], [2, 0]]]],
  alive: [[2]],
  dead: [[true]],
};
layout2D({ data: layout });

// @ts-expect-error alive is a count per ray, not a boolean
const bad: RecordedLayout = { surfaces, rays: [], alive: [[true]] };

export { bad };
