# eleo-ui

ELEO's shared visual layer: one source for the design tokens and optical plots used by Phos, eleoptics.com and anyone building on Aurora.

| Package | What it is | Used by |
| -- | -- | -- |
| [`@eleoptics/tokens`](packages/tokens) | Colors for both themes, colormaps, type, spacing and line weights, as `tokens.css` and as data | everything |
| [`@eleoptics/plots`](packages/plots) | Framework-free renderers: Layout2D, Layout3D, SpotDiagram, RayFan, Map2D (PSF, wavefront), CurvePlot (MTF and more), icons, legends; plus small exact physics helpers (`airy`, `j1`, `slabMode`, `colormap`) | the website (classic scripts), Phos (through the Svelte package), Aurora users |
| [`@eleoptics/plots-svelte`](packages/plots-svelte) | Svelte 5 components around `@eleoptics/plots`: PlotCard, Layout2D, Map2D and the rest, redrawn on theme change | Phos |

This repo is the source of truth. The ELEO design system artifact (claude.ai/artifact/JRXsjqrJmdRspmiPEtvEMt) holds the brand book and re-syncs its tokens and bundle from here.

## Use it

```bash
npm install @eleoptics/tokens @eleoptics/plots
```

```js
import '@eleoptics/tokens/tokens.css';
import '@eleoptics/plots/plots.css';
import { layout2D, map2D } from '@eleoptics/plots';

el.innerHTML = layout2D({ data: mySystem });   // SVG; follows the theme by itself
map2D(canvas, { data: mySystem, kind: 'psf' });  // canvas; call again after a theme change
```

- Pass your traced system as `data`, or `import '@eleoptics/plots/sample'` to draw the sample achromat (190 KB, so it is opt-in).
- Themes: light by default, dark when the OS prefers it, or force either with `data-theme="light"` / `"dark"` on any element; plots inside follow it.
- Without a bundler: load `@eleoptics/plots/eleo-plots.js` (then `eleo-plots-sample.js` if you want the sample); both add to `window.ELEO`. `eleo-physics.js` is the 1 KB physics helpers alone.

In Svelte (Phos):

```svelte
<script>
  import '@eleoptics/tokens/tokens.css';
  import '@eleoptics/plots/plots.css';
  import { PlotCard, Layout2D, Map2D, Colorbar } from '@eleoptics/plots-svelte';
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

To try a change in Phos or the website before it's published, link it: `npm link` in `packages/plots`, then `npm link @eleoptics/plots` in the other repo. CI there always builds against published versions.

### Changing things

- **A token:** edit `packages/tokens/src/tokens.json`, keeping every color in both themes and each text color at 4.5:1 on its ground. The renderers read tokens as CSS variables, so most token changes need no renderer change.
- **A renderer:** edit `packages/plots/src/renderers.js` and check the gallery in both themes. A new renderer also gets a gallery tile, a type in `index.d.ts` and a Svelte wrapper.
- **Every PR that changes a package** adds a changeset (`npx changeset`): patch for fixes, minor for new renderers, props or tokens, major for anything that breaks a consumer.

## Release

Releases run from GitHub Actions (`.github/workflows/release.yml`). Merging to main opens a "Version packages" PR from the pending changesets; merging that PR publishes to npm with provenance, and Dependabot or Renovate in Phos and the website opens the upgrade PRs.

Before the first release, add the `NPM_TOKEN` secret to the GitHub repo: a granular npm token that can publish to the `eleoptics` organization. After the first publish, you can switch each package to npm trusted publishing and delete the token.

The packages are MIT licensed (`LICENSE`).
