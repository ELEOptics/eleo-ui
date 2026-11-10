// The pointer action every plot wrapper reuses: `use:hover={{ onhover, onselect }}` binds `interact` to the wrapper's box only while a callback is given, and rebinds when the callbacks change.
// Internal: not exported from the package.
import { interact } from '@eleoptics/plots';

const bind = (el, opts) => (opts?.onhover || opts?.onselect ? interact(el, opts) : null);

/** @param {HTMLElement} el @param import('@eleoptics/plots').InteractOptions opts */
export function hover(el, opts) {
  let stop = bind(el, opts);
  return {
    update(next) { stop?.(); stop = bind(el, next); },
    destroy() { stop?.(); },
  };
}
