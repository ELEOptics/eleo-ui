// Nice axis ticks by Heckbert's loose labeling (Graphics Gems, 1990, "Nice numbers for graph labels").

/* The nice number near x: 1, 2, 5 or 10 times a power of ten. round picks the nearest, else the next one up. */
function nice(x, round) {
  var e = Math.floor(Math.log10(x)), f = x / Math.pow(10, e);
  var m = round ? (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) : (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10);
  return m * Math.pow(10, e);
}

var MAX_TICKS = 1000, MAX_DECIMALS = 100;

/* The fewest decimals (up to 100) that print both ends back exactly. */
function endDecimals(lo, hi) {
  for (var k = 0; k < MAX_DECIMALS; k++) if (Number(lo.toFixed(k)) === lo && Number(hi.toFixed(k)) === hi) return k;
  return MAX_DECIMALS;
}

/* Ticks covering [lo, hi] in about n labels, and the decimals the step needs.
   A span of a few ulps (or below 1e-100) has no usable step: the count would pass 1000, lo / d would pass 2^53
   (k++ stops advancing) or toFixed would throw. Then the ticks are [lo, hi] alone. */
export function niceTicks(lo, hi, n) {
  var d = nice(nice(hi - lo, false) / (n - 1), true);
  var decimals = Math.max(-Math.floor(Math.log10(d)), 0);
  var a = Math.floor(lo / d), b = Math.ceil(hi / d), ticks = [];
  var limit = Number.MAX_SAFE_INTEGER;
  if (!(d > 0 && isFinite(d)) || decimals > MAX_DECIMALS || !(b - a <= MAX_TICKS) || Math.abs(a) > limit || Math.abs(b) > limit) {
    return { ticks: [lo, hi], decimals: endDecimals(lo, hi) };
  }
  for (var k = a; k <= b; k++) ticks.push(Number((k * d).toFixed(decimals)));
  return { ticks: ticks, decimals: decimals };
}

/* The first and last nice tick: the range an axis spans to show whole labels. */
export function niceRange(lo, hi, n) {
  var t = niceTicks(lo, hi, n).ticks;
  return { lo: t[0], hi: t[t.length - 1] };
}
