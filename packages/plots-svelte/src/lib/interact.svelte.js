// The pointer action every plot wrapper reuses: `use:hover={{ onhover, onselect }}` binds `interact` to the wrapper's box while a callback is given or the hover marks or tooltip are on (the default), passes `axes`, `marks` and `tooltip` through.
// `interact` copies the callbacks, `marks` and `tooltip` when it binds and reads `axes` and `values` at event time, so the action binds once with one options object (stable callback wrappers that read the latest ones, and `axes` and `values` replaced on update): a data change (new `values`, `axes` or callbacks) keeps the binding, and a drag in progress. It rebinds only when what the binding is made of changes: a callback, `values`, `marks` or `tooltip` turning on or off.
// Internal: not exported from the package.
import { interact } from '@eleoptics/plots';

const wants = (opts) => !!(opts?.onhover || opts?.onselect || opts?.marks !== false || opts?.tooltip !== false);
const shape = (opts) => [opts?.onhover, opts?.onselect, opts?.onview, opts?.values, opts?.marks !== false, opts?.tooltip !== false].map((v) => (typeof v === 'function' ? 'f' : v ? 1 : 0)).join('');

/**
 * @param {HTMLElement} el
 * @param {import('@eleoptics/plots').InteractOptions} [opts]
 */
export function hover(el, opts) {
  let current = opts ?? {};
  let key = shape(current);
  /** @type {(() => void) | null} */
  let stop = null;
  // one options object for the life of the binding: `axes` and `values` are read by interact at event time, so update replaces those fields on it
  const bound = /** @type {any} */ ({});
  const bind = () => {
    const o = /** @type {any} */ (current);
    bound.axes = o.axes ?? {};
    bound.values = o.values;
    bound.onhover = (/** @type {any} */ e) => current.onhover?.(e);
    bound.onselect = (/** @type {any} */ e) => current.onselect?.(e);
    if (o.onview) bound.onview = (/** @type {any} */ v) => current.onview?.(v); else delete bound.onview;
    bound.marks = o.marks !== false;
    bound.tooltip = o.tooltip !== false;
    stop = wants(o) ? interact(el, bound) : null;
  };
  bind();
  return {
    update(next) {
      current = next ?? {};
      bound.axes = current.axes ?? {};
      bound.values = current.values;
      const k = shape(current);
      if (k === key) return;
      key = k;
      stop?.();
      bind();
    },
    destroy() { stop?.(); },
  };
}
