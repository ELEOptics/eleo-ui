import ELEO from './index.js';
// The API object itself becomes window.ELEO, so useSample (eleo-plots-sample.js) sets window.ELEO.sample.
// Merging into an existing window.ELEO, a getter reads the API's sample instead of a stale copy.
if (!window.ELEO) window.ELEO = ELEO;
else {
  var target = window.ELEO;
  Object.keys(ELEO).forEach(function (k) { if (k !== 'sample') target[k] = ELEO[k]; });
  Object.defineProperty(target, 'sample', { get: function () { return ELEO.sample; }, configurable: true, enumerable: true });
}
