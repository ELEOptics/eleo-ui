# ADR-0004: Observable Plot weighed again, not adopted

Status: accepted
Date: 2026-11-06

## Context

At plan [#677]'s M1 demo the user asked whether eleo-ui should adopt an existing plotting library and put our design
rules on top of it, instead of building legends, grids, colorbars and label placement itself. ADR-0001 (Observable
Plot, d3) and ADR-0002 (LayerChart) said no before. Spike [#734] rebuilt the gallery's MTF-limits tile and the
recorded PSF map in Observable Plot 0.6.16, styled only with `@eleoptics/tokens`, and scored it against our rules.

## Decision

Keep our renderers. `@observablehq/plot` is not a dependency of any `@eleoptics/*` package.

| Option | For | Against |
| -- | -- | -- |
| Observable Plot 0.6.16 for `curve`, `bars` and `map2D`, the optical renderers kept | Accepts `var(--x)` colours, so ADR-0001's roles objection falls; scales, ticks, facets (`fx`/`fy`) and `tip` for free; labelled limits in about 8 lines; the MTF tile matched ours | ADR-0003's text rule is not applied: every px default is overridden by hand, and facets miss t(F) by 2.6-3.6 %; legends are HTML with no dash swatch, so in-SVG keys and the colorbar are custom marks (about the size of `key.js`); a raster takes no CSS variables, renders in 23.4 ms against our 1.17 ms, and needs native `canvas` in Node; output is not byte-identical across renders (a `plot-clip-N` counter), which breaks the renderer baselines; 97.5-129.7 KB gzip and 42 packages (the `d3` umbrella) against 23.8 KB and none; no zoom, pan, brush or export |

The work a plan like [#677] spends its time on (text sizing, in-SVG keys and colorbars, the map pipeline, and
roadmap rows H and I) stays ours under either option. The library would replace scale, tick and facet arithmetic
that is already written and tested.

## Consequences

- One drawing path stays: the renderers in `@eleoptics/plots`, wrapped by `plots-svelte`.
- When chart chrome costs too much, narrow our rules (for example, an HTML legend for a whole figure, outside
  ADR-0003) rather than add a library.
- Revisit if hover, zoom and export (roadmap rows H and I) turn out to be most of a plan; if a consumer needs
  general charts we would otherwise rebuild (ADR-0002's trigger); or if Observable Plot gains deterministic ids and
  in-SVG legends. The spike measured 0.6.16; 0.6.19 was current and was not checked.

[#677]: https://github.com/ELEOptics/eleo-ui/issues/677
[#734]: https://github.com/ELEOptics/eleo-ui/issues/734
