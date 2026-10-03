# @eleoptics/plots

Optical plots for the web, without a framework: lens layouts in 2D and 3D, spot diagrams, ray fans, PSF and wavefront maps, MTF, field curvature, distortion and chromatic focus shift, plus ELEO's optical icons. Geometry is exact and true to scale; colors come from [`@eleoptics/tokens`](https://www.npmjs.com/package/@eleoptics/tokens), so every plot follows the light or dark theme.

```bash
npm install @eleoptics/tokens @eleoptics/plots
```

```js
import '@eleoptics/tokens/tokens.css';
import '@eleoptics/plots/plots.css';
import { layout2D, spot, map2D, gradient } from '@eleoptics/plots';

layoutEl.innerHTML = layout2D({ data: system, colorBy: 'field', rays: 'fan' });
spotEl.innerHTML = spot({ data: system });
map2D(psfCanvas, { data: system, kind: 'psf', scale: 'log' });
colorbarEl.style.background = gradient('ember');
```

- **SVG renderers** (`layout2D`, `spot`, `throughFocus`, `rayFan`, `curve`, `legend`, `icon`) return markup whose colors are CSS variables: one drawing works in both themes.
- **Canvas renderers** (`map2D`, `layout3D`) read the variables when they draw: call them again after a theme change.
- **Data:** pass your traced system as `data`. To try things out, `import '@eleoptics/plots/sample'` makes a traced achromat the default (190 KB, so it is opt-in).
- **Fonts:** Fira Sans and Fira Code. Load them yourself.

## Physics helpers

```js
import { airy, airyRadius, j1, slabMode, colormap } from '@eleoptics/plots/physics';

airy(r, 0.5876, 4);      // Airy intensity at r µm for f/4 at 587.6 nm, peak 1
airyRadius(0.5876, 4);   // 2.87 µm: first dark ring, 1.22 λN
slabMode(y, 5);          // TE0 mode of a slab waveguide with a 5-unit core half-width
colormap('ember');       // 256 [r, g, b] entries in the current theme
```

## Without a bundler

```html
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="plots.css">
<script src="eleo-plots.js"></script>         <!-- window.ELEO -->
<script src="eleo-plots-sample.js"></script>  <!-- optional: the sample system -->
```

`eleo-physics.js` is the physics helpers alone (1 KB).

For Svelte, see [`@eleoptics/plots-svelte`](https://www.npmjs.com/package/@eleoptics/plots-svelte). MIT licensed. Part of [eleo-ui](https://github.com/ELEOptics/eleo-ui).
