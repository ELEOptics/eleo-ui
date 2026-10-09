// Small, exact optics helpers for plots and diagrams. No DOM except
// colormap(), which reads the theme's map tokens from CSS.

/** Bessel function of the first kind, order 1, by its integral (accurate to ~1e-6 for |x| < 40). */
export function j1(x, steps = 64) {
  let s = 0;
  for (let i = 0; i < steps; i++) {
    const tau = ((i + 0.5) / steps) * Math.PI;
    s += Math.cos(tau - x * Math.sin(tau));
  }
  return s / steps;
}

/** Airy intensity, normalized to 1 at the peak, at radius r in an image of f-number N at wavelength λ (same units for r and λ). */
export function airy(r, lambda, N) {
  const v = (Math.PI * r) / (lambda * N);
  return v < 1e-9 ? 1 : (2 * j1(v) / v) ** 2;
}

/** Radius of the first dark ring of the Airy pattern: 1.22 λ N. */
export function airyRadius(lambda, N) {
  return 1.22 * lambda * N;
}

/** Diffraction-limited MTF of a circular aperture (Goodman): 2/π (φ − cos φ sin φ), φ = acos(ν/ν_c), ν_c = 1/(λN); 0 at and past cutoff. ν in cycles per unit of λ's length. */
export function mtfDiffraction(nu, lambda, N) {
  const x = Math.abs(nu) * lambda * N;
  if (x >= 1) return 0;
  const phi = Math.acos(x);
  return (2 / Math.PI) * (phi - Math.cos(phi) * Math.sin(phi));
}

/**
 * Fundamental even (TE0) mode of a symmetric slab waveguide, normalized to 1 on axis: cos inside the
 * core, a matched exponential outside. `ka` is the transverse phase across the core half-width (0 to π/2).
 */
export function slabMode(y, halfWidth, ka = 1.1) {
  const kappa = ka / halfWidth, gamma = kappa * Math.tan(ka), d = Math.abs(y);
  return d <= halfWidth ? Math.cos(kappa * d) : Math.cos(ka) * Math.exp(-gamma * (d - halfWidth));
}

const VIRIDIS = ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'];

function hex(c) {
  let h = c.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/**
 * A 256-entry [r, g, b] lookup table for a colormap. "ember" and "wave" read the current theme's
 * tokens from `el` (default: the document root), so call it again after a theme change.
 */
export function colormap(map = 'ember', el) {
  let stops;
  if (map === 'viridis') stops = VIRIDIS;
  else if (map === 'gray') stops = ['#000000', '#ffffff'];
  else {
    const cs = getComputedStyle(el || document.documentElement);
    stops = Array.from({ length: 9 }, (_, i) => cs.getPropertyValue(`--map-${map === 'wave' ? 'wave' : 'ember'}-${i}`));
  }
  const rgb = stops.map(hex), out = [];
  for (let j = 0; j < 256; j++) {
    const p = (j / 255) * (rgb.length - 1), k = Math.min(rgb.length - 2, Math.floor(p)), f = p - k, a = rgb[k], b = rgb[k + 1];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
  }
  return out;
}
