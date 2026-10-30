// Type usage checked by tests/unit/types.test.js under tsc --strict, against packages/plots/src/index.d.ts.
import type { RecordedLayout, RecordedSurface } from '../../packages/plots/src/index';
import { layout2D } from '../../packages/plots/src/index';

const profile: [number, number][] = [[0, -1], [0, 1]];

// a surface may reflect (mirror) or be an opaque disc (obscuration); CR #360
const surfaces: RecordedSurface[] = [
  { z: 0, sd: 1, stop: true, image: false, glass: null, profile, mirror: true },
  { z: 1, sd: 0.3, stop: false, image: false, glass: null, profile, obscuration: true },
  { z: 2, sd: 1, stop: false, image: true, glass: null, profile },
];
const layout: RecordedLayout = { surfaces, rays: [] };
layout2D({ data: layout });

// an annular mirror (CR #371) and dead rays (CR #372); `dead` is meant for use with `alive`, typed in M2
const annular: RecordedSurface = { z: 0, sd: 55, stop: false, image: false, glass: null, profile, mirror: true, hole: 10 };
const withDead: RecordedLayout = { surfaces: [annular], rays: [], dead: [[true, false]] };
layout2D({ data: withDead });

// @ts-expect-error dead is a boolean per ray, not a number
const badDead: RecordedLayout = { surfaces, rays: [], dead: [[1]] };

// @ts-expect-error mirror is a boolean, not text
const bad: RecordedSurface = { z: 0, sd: 1, stop: false, image: false, glass: null, profile, mirror: 'yes' };

export { bad, badDead };
