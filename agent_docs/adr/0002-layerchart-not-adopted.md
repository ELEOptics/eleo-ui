# ADR-0002: LayerChart weighed, not adopted

Status: accepted
Date: 2026-10-13

## Context

ADR-0001 weighed Observable Plot and d3 against our own renderers. LayerChart, a Svelte chart library, went stable
for Svelte 5 at 2.0.0 (2026-07-01) and was raised as a way to stop hand-rolling charts. ADR-0001 is accepted and
not edited, so this ADR adds a fourth row to its table.

## Decision

Keep our own renderers. LayerChart is not a dependency of any `@eleoptics/*` package.

| Option | For | Against |
| -- | -- | -- |
| LayerChart 2.x | Svelte 5 native; marks, scales, axes, tooltips, brush, zoom and pan for free; canvas and SVG layers | Svelte only, so it cannot serve `@eleoptics/plots` or the bundler-less entries (`eleo-layout.js` and its size budget); series are styled by color and class props, the opposite of the roles rule; about 30 runtime dependencies (d3 modules, prerelease `@layerstack/*`, Tailwind 3 through `@layerstack/tailwind`); fast churn (9 minors from 2.0.0 to 2.8.0 in 3.5 months); layouts, glass fills, ray status, spot diagrams and the canvas map are outside its marks |

The part it would help most is the plot shell (hover readout, zoom, export), and only in `plots-svelte`, so the
framework-free renderers would still need their own.

## Consequences

- One drawing path stays: the renderers in `@eleoptics/plots`, wrapped by `plots-svelte`.
- We still write hover, zoom and brush ourselves (roadmap U13).
- A consumer app (phos, the website) may use LayerChart for charts outside eleo-ui's data shapes, beside our plots,
  not under them; it then styles them itself, outside the roles rule.
- Revisit if a second consumer needs general charts (scatter matrices, brushed heatmaps, non-optical dashboards) we
  would otherwise rebuild, if `@eleoptics/plots` stops serving non-Svelte pages, or if LayerChart drops Tailwind and
  accepts style by CSS custom property per series role.
