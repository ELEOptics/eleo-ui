# @eleoptics/tokens

ELEO's design tokens: colors for light and dark themes, the `ember` and `wave` colormaps, index colors for fields and wavelengths, type, spacing, radii and line weights.

```bash
npm install @eleoptics/tokens
```

## CSS

```js
import '@eleoptics/tokens/tokens.css';
```

Every token becomes a CSS variable (`--ink`, `--accent`, `--glass-edge`, `--map-ember-0` … `--map-ember-8`, `--space-4`, `--stroke-ray` and so on). The light theme is the default, the dark theme follows the OS, and `data-theme="light"` or `data-theme="dark"` on any element forces one for everything inside it.

## Data

```js
import tokens from '@eleoptics/tokens';

tokens.color.accent;   // { light: '#e07a1f', dark: '#f29a45' }
tokens.size['space-4']; // '16px'
tokens.font.mono;       // '"Fira Code", "Fira Mono", ui-monospace, Menlo, monospace'
```

For code that can't read CSS: exports, native views, canvas drawing outside a page. The raw source is `@eleoptics/tokens/tokens.json`.

## Rules the values encode

- Text tokens hold 4.5:1 or more on `surface` in both themes; data marks hold 3:1.
- Stop 0 of `ember` and stop 4 (zero) of `wave` equal the plot ground in each theme, so zero disappears into the plot.
- `map-grid-<map>` (and `-minor`) are the grid lines over a colormap image, one pair per map (`ember`, `wave`, `viridis`, `gray`): 2:1 (minor 1.3:1) or more against that map's lowest and highest stops in both themes, and under 2.6:1 (minor 1.7:1) against its ground stop (`ember` stop 0, `wave` stop 4: they fill most of an image) or, for `viridis` and `gray`, against the nearer end stop, so the lines stay soft. Each major is at least as strong as its minor against that ground (the middle stop for `viridis` and `gray`).
- `accent` is the one warm light, for the primary action. It never colors data.

MIT licensed. Part of [eleo-ui](https://github.com/ELEOptics/eleo-ui).
