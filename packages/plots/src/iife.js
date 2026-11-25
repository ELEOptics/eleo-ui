import ELEO from './index.js';
// The API object itself becomes window.ELEO. Merging into an existing window.ELEO adds the API's keys in place.
if (!window.ELEO) window.ELEO = ELEO;
else {
  var target = window.ELEO;
  Object.keys(ELEO).forEach(function (k) { target[k] = ELEO[k]; });
}
