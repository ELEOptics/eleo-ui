/** Bessel function of the first kind, order 1. */
export function j1(x: number, steps?: number): number;
/** Airy intensity (peak 1) at radius r for f-number N at wavelength lambda, in the same units as r. */
export function airy(r: number, lambda: number, N: number): number;
/** First dark ring radius, 1.22 λ N. */
export function airyRadius(lambda: number, N: number): number;
/** Diffraction-limited MTF of a circular aperture, 1 at nu = 0 and 0 at and past the cutoff 1/(lambda N); nu in cycles per unit of lambda's length. */
export function mtfDiffraction(nu: number, lambda: number, N: number): number;
/** TE0 mode of a symmetric slab waveguide, 1 on axis. */
export function slabMode(y: number, halfWidth: number, ka?: number): number;
/** 256 [r, g, b] entries; "ember" and "wave" read the theme's tokens from `el`. */
export function colormap(map?: 'ember' | 'wave' | 'viridis' | 'gray', el?: Element): [number, number, number][];
