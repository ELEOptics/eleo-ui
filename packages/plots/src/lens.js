// Internal: a lens element's vertex radii and focal length from a layout2D recording (CR #958). Not exported from the package.

// The signed radius of a surface at its vertex, from its [z, y] profile (41 points, -sd to +sd): positive when the centre of curvature is at greater z,
// Infinity for a flat surface. A least-squares circle centred on the axis and through the vertex, over the points within sd/2 of it (the recorded z is rounded to 0.001 mm: at sd/4 a weak surface's sag is a few quanta and R2 of the triplet's third surface moves 3%): (z - zv)^2 + y^2 = 2 R (z - zv),
// so an asphere's fit is its base radius, and sampling noise is averaged where a three-point circle would carry it.
export function vertexRadius(profile) {
  var sd = 0, v = profile[0];
  profile.forEach(function (p) { sd = Math.max(sd, Math.abs(p[1])); if (Math.abs(p[1]) < Math.abs(v[1])) v = p; });
  var num = 0, den = 0;
  profile.forEach(function (p) {
    if (Math.abs(p[1]) > sd / 2) return;
    var u = p[0] - v[0];
    num += (u * u + p[1] * p[1]) * u; den += u * u;
  });
  // A sag under 1e-9 of the semi-diameter is flat (a sphere of R = 1e6 sd is still fitted).
  if (!(den > 1e-18 * sd * sd)) return Infinity;
  return num / (2 * den);
}

// The focal length in air of a thick lens of index n, vertex radii r1 and r2 (signed, Infinity for flat) and vertex thickness ct, from
// 1/f = (n - 1) [1/R1 - 1/R2 + (n - 1) ct / (n R1 R2)]. Infinity when the power is zero.
export function thickLensF(n, r1, r2, ct) {
  var p = (n - 1) * (1 / r1 - 1 / r2 + (n - 1) * ct / (n * r1 * r2));
  return p === 0 ? Infinity : 1 / p;
}
