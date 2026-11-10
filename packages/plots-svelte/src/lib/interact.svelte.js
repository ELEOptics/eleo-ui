// The pointer action every plot wrapper reuses: `use:hover={{ onhover, onselect }}` binds `interact` to the wrapper's box and rebinds when the callbacks change.
// Internal: not exported from the package.
import { interact } from '@eleoptics/plots';

/** @param {HTMLElement} el @param import('@eleoptics/plots').InteractOptions opts */
export function hover(el, opts) {
  let stop = interact(el, opts ?? {});
  return {
    update(next) { stop(); stop = interact(el, next ?? {}); },
    destroy() { stop(); },
  };
}
