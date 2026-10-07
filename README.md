# eleo-ui

The design tokens and optical plots behind ELEO's tools, including Phos and eleoptics.com, open for anyone building on Aurora or drawing their own optical systems.

| Package | What it is |
| -- | -- |
| [`@eleoptics/tokens`](packages/tokens) | Colors for light and dark themes, colormaps, type, spacing and line weights, as `tokens.css` and as data |
| [`@eleoptics/plots`](packages/plots) | Framework-free renderers: Layout2D, Layout3D, SpotDiagram, RayFan, Map2D (PSF, wavefront), CurvePlot (MTF and more), icons and legends; plus small, exact physics helpers (`airy`, `j1`, `slabMode`, `colormap`) |
| [`@eleoptics/plots-svelte`](packages/plots-svelte) | Svelte 5 components around `@eleoptics/plots`: PlotCard, Layout2D, Map2D and the rest, redrawn on a theme or palette change |

## Use it

```bash
npm install @eleoptics/tokens @eleoptics/plots
```

```js
import '@eleoptics/tokens/tokens.css';
import '@eleoptics/plots/plots.css';
import { layout2D, map2D } from '@eleoptics/plots';

el.innerHTML = layout2D({ data: mySystem });   // SVG; follows the theme by itself
map2D(canvas, { data: mySystem, kind: 'psf' });  // canvas; call again after a theme or palette change
```

- Pass your traced system as `data`, or `import '@eleoptics/plots/sample'` to draw the sample achromat (190 KB, so it is opt-in).
- Themes: light by default, dark when the OS prefers it, or force either with `data-theme="light"` or `"dark"` on any element; plots inside follow it.
- Fonts: the plots use Fira Sans and Fira Code. Load them yourself (Google Fonts on the web, bundled files in a desktop app).
- Without a bundler: load `@eleoptics/plots/eleo-plots.js` (then `eleo-plots-sample.js` if you want the sample); both add to `window.ELEO`. `eleo-physics.js` is the 1 KB physics helpers alone. `eleo-layout.js` is `layout2D` and `layoutBounds` alone, with no sample (6 KB minified, 2.3 KB gzipped).

In Svelte:

```svelte
<script>
  import '@eleoptics/tokens/tokens.css';
  import '@eleoptics/plots/plots.css';
  import { PlotCard, Map2D } from '@eleoptics/plots-svelte';
  let { system } = $props();
</script>

<PlotCard title="PSF" meta="0.0°, linear">
  <Map2D data={system} kind="psf" label="Point spread function" />
</PlotCard>
```

## Work on it

```bash
npm install
npm run build          # all three packages
npm run gallery        # http://localhost:4173/gallery/: every renderer in both themes
npm test               # unit tests (physics, tokens) and the gallery check in Chromium
npm run check          # Svelte type check
```

First time only: `npx playwright install chromium` for the gallery check.

`npm audit --omit=dev` checks what ships to users; plain `npm audit` also covers dev tooling.

To try an unpublished change in another project, link it: `npm link` in `packages/plots`, then `npm link @eleoptics/plots` in that project.

### Changing things

- **A token:** edit `packages/tokens/src/tokens.json`, keeping every color in both themes and each text color at 4.5:1 on its ground. The renderers read tokens as CSS variables, so most token changes need no renderer change, except the field order: it is pinned per palette in `packages/plots/src/plots.css` and checked against the tokens, so a field token change reruns that check.
- **A renderer:** edit `packages/plots/src/layout2d.js` for `layout2D`, `packages/plots/src/common.js` for the shared helpers (`STANDARD`, `NS`, `idx`, `svg`) and `packages/plots/src/renderers.js` for the rest, then check the gallery in both themes. A new renderer also gets a gallery tile, a type in `index.d.ts` and a Svelte wrapper.
- **Every PR that changes a package** adds a changeset (`npx changeset`): patch for fixes, minor for new renderers, props or tokens, major for anything that breaks a consumer.

## Release

Releases run from GitHub Actions (`.github/workflows/release.yml`). Merging to main opens a "Version packages" PR from the pending changesets; merging that PR publishes the new versions to npm through trusted publishing, with provenance and no stored token.

## License

MIT. See [LICENSE](LICENSE).
