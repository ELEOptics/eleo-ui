# ADR-0001: Plot boundary and styling rule

Status: accepted
Date: 2026-10-09

## Context

phos wants to build its analysis plots from eleo-ui's plot types instead of keeping its own, so the line between what
eleo-ui draws and what the app decides has to be written down before more renderers are added (roadmap U5). Today
`curve` takes an analysis `kind` and reads the sample's own shapes, and the styles live in the renderers. Observable
Plot and d3 are the obvious ready-made alternatives and were raised in the roadmap's 2026-10-05 review (finding 14).

## Decision

**Boundary.** eleo-ui ships renderers by data shape (layout, points, curves, maps, bars) and the plot shell
(`PlotCard`, legend, colorbar, hover readout, zoom, export). It emits typed interaction events and holds no app
state. phos's app components (editors, workflow, tables) stay in phos; one moves here only once a second consumer
needs it. The plot shell is not an app component, so hover, zoom and export belong here (roadmap review finding 1).

**Roles, not colors.** A renderer's options carry data, labels, units and a role per series (field k, wavelength k,
tangential, sagittal, reference, limit), never a color, font or stroke width. One table in the renderers maps role to
style. Every role draws a 1 px stroke at any plot size (the user at plan #162's M1 demo, as `layout2D`'s rays):

| Role | Style |
| -- | -- |
| `index: k` | the k-th series color, `idx(k)` |
| `tangential` | solid |
| `sagittal` | dash `5 3` |
| `reference` | `var(--ink)`, dash `1 3` |

An axis range that straddles 0 draws a zero line in `--plot-axis`. The option-name rule (no color, font or stroke
option) is checked at each row's review. A unit test scans `packages/plots/src` for color and font literals; the
exemptions are the named colormaps (viridis and gray in `color.js`, viridis in `physics.js`) and `layout3D`'s tone
composition and label font.

**One override.** CSS custom properties on an ancestor (`--series-1..8`, `--ink`, `--plot-axis` and the other tokens)
are the only way a consumer restyles a plot. There is no per-call style option.

**Curve drawing.** `curve` draws each series in a nested `<svg>` (it clips, and needs no page-unique ids as a
`clipPath` would) holding a `<g transform>` in data coordinates under `vector-effect="non-scaling-stroke"`, as
`layout2D` does. Inverting the transform then recovers the data, which is the literal wording of roadmap U6's oracle.
Every point is drawn and the viewport clips: dropping out-of-range points would join non-adjacent points. Points and
the transform are written unrounded (the shortest round-trip form) and converted to numbers first, so no caller
string reaches the markup.

**Alternative kept in reserve: px-space polylines.** The renderer computes pixel coordinates itself and writes plain
polylines, with the data value on each mark as `data-x`/`data-y`. Strokes, dashes and joins are then exact, and the
inverse is read from the attributes. It costs the transform for zoom (U13 rewrites the `viewBox` or redraws) and
changes the wording of U6's oracle, which is the user's to change.

**Observable Plot and d3 weighed, not adopted.**

| Option | For | Against |
| -- | -- | -- |
| Own renderers (chosen) | No dependency; roles and tokens are native; the oracles (inverting a transform) are ours; the bundle stays small and a page without a bundler can load one renderer | We write and test each mark, scale and tick rule |
| Observable Plot | Marks, scales, ticks and facets for free | Styling is by color, stroke and font options, the opposite of the roles rule; adds a dependency tree (it pulls in d3 modules); optical layouts, glass fills and the 3D tone composition are outside its marks and need custom marks anyway; no standalone-entry story for a bundler-less page |
| d3 (scale, shape, axis) | Mature scales and ticks | Imperative DOM code per renderer, a dependency for a few hundred lines of arithmetic; the pieces we want (nice ticks, a linear scale) are small enough to own and test |

## Consequences

- phos passes data and roles and never a style, so a visual change is made once, in eleo-ui, and reaches every
  consumer.
- A consumer who needs a one-off look can set tokens on an ancestor, but cannot style a single series.
- `curve` and its siblings need no analysis branch: MTF, field curvature and distortion are built by the caller.
- We own tick selection, scales and the zero-line rule, and must test them.
- Revisit if a role needs a style the table cannot express, if the transform group changes the look (dashes under a
  non-scaling stroke at an anisotropic scale, line joins) in a way the M1 demo rejects, in which case move to px-space
  polylines, or if a second consumer wants marks we would otherwise rebuild from Plot.

## Verdict

Go (the user, plan #162 M1 demo, 2026-10-09). The skeleton drew the recorded phos-core MTF of the sample achromat and
the Cooke triplet through the transform group: inverting it recovers every point within 0.5 px at 460 and 920 px
(`tests/unit/curve.test.js::recorded MTF round trip (U6)`), with the transform pinned to the caller's ranges. The
roles table covered MTF, field curvature, distortion and chromatic focus with no analysis branch in the drawing. Every
non-curve tile stayed pixel-identical to main in both themes and three palettes. What changed because of it: the
look was heavier (1.5 screen px), so every role now draws 1 px (CR #209), and the `reference` role lost its own
width; tick labels print at one shared precision (`0.0`, `1.0`).
