// Type usage checked by tests/unit/types.test.js under tsc --strict, against packages/plots/src/index.d.ts.
import { layout2D } from '../../packages/plots/src/index';

// a null or undefined entry skips that fan (#67)
layout2D({ labels: ['0°', null, undefined, '24°'] });

// @ts-expect-error a label is text, not a number
layout2D({ labels: [1] });
