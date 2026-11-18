// Plan #1144, issue #1146: the parsers the specs share, run in the page (every parse site is inside an evaluate or the timed rAF harness).
// `pageHelpers(page)` defines window.H = { matrixOf, subpaths, pointsOf, nums } from the helpers' own source, before any page script runs; call it before page.goto.
import { matrixOf, subpaths, pointsOf, nums } from './unit/helpers/svg.js';

const SOURCE = `window.H = (() => {
  const nums = ${nums};
  ${subpaths};
  ${pointsOf};
  ${matrixOf};
  return { matrixOf, subpaths, pointsOf, nums };
})();`;

export const pageHelpers = (page) => page.addInitScript(SOURCE);

// The pixel the browser delivers for a computed client point: Firefox and WebKit truncate pointer coordinates to whole pixels (#1030), so the specs aim at the nearest one.
export const moveTo = (page, x, y) => page.mouse.move(Math.round(x), Math.round(y));
