// The pointer action every plot wrapper reuses: `use:hover={{ onhover, onselect }}` binds `interact` to the wrapper's box while a callback is given or the hover marks or tooltip are on (the default), passes `axes`, `marks` and `tooltip` through.
// `interact` copies its options when it binds, so the action binds once with stable options that read the latest ones at event time: a data change (new `values`, `axes` or callbacks) keeps the binding, and a drag in progress. It rebinds only when what the binding is made of changes: a callback, `values`, `marks` or `tooltip` turning on or off.
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
  const axes = { get x() { return current.axes?.x; }, get y() { return current.axes?.y; }, get value() { return /** @type {any} */ (current.axes)?.value; } };
  const values = new Proxy({}, { get: (_, k) => /** @type {any} */ (current.values)?.[k] });
  const bind = () => {
    const o = /** @type {any} */ (current);
    stop = wants(o) ? interact(el, /** @type {any} */ ({
      onhover: (/** @type {any} */ e) => current.onhover?.(e),
      onselect: (/** @type {any} */ e) => current.onselect?.(e),
      ...(o.onview ? { onview: (/** @type {any} */ v) => current.onview?.(v) } : {}),
      ...(o.values ? { values } : {}),
      axes,
      marks: o.marks !== false,
      tooltip: o.tooltip !== false,
    })) : null;
  };
  bind();
  return {
    update(next) {
      current = next ?? {};
      const k = shape(current);
      if (k === key) return;
      key = k;
      stop?.();
      bind();
    },
    destroy() { stop?.(); },
  };
}
