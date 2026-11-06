// Type usage checked by tests/unit/types.test.js under tsc --strict, against packages/plots/src/index.d.ts.
// oracle: spec the Rust RayStatus names (Alive, Virtual, Dead), row M's rule; plan #642 Decisions (Core index.d.ts)
import type { RecordedLayout, RecordedSurface, RayStatus } from '../../packages/plots/src/index';
import { layout2D } from '../../packages/plots/src/index';

const profile: [number, number][] = [[0, -1], [0, 1]];
const surfaces: RecordedSurface[] = [{ z: 0, sd: 1, stop: true, image: false, glass: null, profile }];

// status[field][ray][point]: one RayStatus per kept point (Plan #642)
const s: RayStatus = 'Virtual';
const layout: RecordedLayout = {
  surfaces,
  rays: [[[[0, 0], [1, 0], [2, 0]]]],
  status: [[['Alive', s, 'Dead']]],
};
layout2D({ data: layout });
layout2D({ data: layout, show: ['Alive', 'Virtual'] });

// @ts-expect-error status names are Alive, Virtual and Dead, not upper case
const badStatus: RecordedLayout = { surfaces, rays: [], status: [[['ALIVE']]] };

// @ts-expect-error show is an array of statuses, not one
layout2D({ data: layout, show: 'Dead' });

export { badStatus };
