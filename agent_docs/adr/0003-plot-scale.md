# ADR-0003: Plot scale

Status: proposed
Date: 2026-11-04

## Context

Each renderer sized its text in its own viewBox units and the gallery stretched every SVG to its column, so rendered
text ran from 4.3 px (rayFan) to 13.7 px (full-row maps), and a consumer got whatever ratio a renderer happened to
draw (plan [#512], issue [#498]). The user asked for one system for how plots are rendered and at what ratios. ADR-0001
fixed every role at a 1 px stroke at any plot size; that rule cannot hold once text and plots scale together, so this
ADR supersedes it. The rest of ADR-0001 stands. Proposed: M1 of plan [#512] exercises it on `curve`, `rayFan` and
`layout2D`, and its demo gives the verdict.

## Decision

A renderer is given its drawing width in px and sizes its text and heavy strokes from it by one rule. Text is written
as an inline `style="font-size:...px"` (the class size in `plots.css` would win over an attribute).

**Framed renderers** (`curve`, `rayFan`, `bars`, `map2D`, `spot`, `throughFocus`). F is the plot frame's width in px
(for a multi-panel figure, one panel's frame). Text size t(F):

| F | text |
| -- | -- |
| below 162 | 9 px (the floor) |
| 162 to 234 | `F / 18` px (9 to 13 px, the band) |
| above 234 | `13 * (F / 234)^(1/3)` px (the knee, gentler than linear) |

The curves meet at F = 162 and F = 234. Margins, label room (0.6 em a character) and line pitch follow the text size,
so margins are written in text units. Above the band, series strokes, rays and spot dots grow by `sqrt(F / 234)`
(weight w(F), 1 at and below 234). What stays 1 px at any size: the frame, the grid, glass edges and the image line.

**`frameOf(W, m)`** returns F from the drawing width W and the horizontal margins m in text units, which solves
`F + m * t(F) = W`. The solution is closed form, one branch each; take the branch whose F lands in its own range:

- floor: `F = W - 9m`, valid while F < 162 (W < 162 + 9m);
- band: `F = 18W / (18 + m)`, valid for F from 162 to 234 (W from 162 + 9m to 234 + 13m);
- knee: with `u = (F / 234)^(1/3)` the equation is `u^3 + p*u = q` where `p = m / 18` and `q = W / 234`. Its
  discriminant is positive for p, q > 0, so there is one real root, by Cardano:
  `u = cbrt(q/2 + s) + cbrt(q/2 - s)` with `s = sqrt(q^2/4 + p^3/27)`, and `F = 234 * u^3`. Valid for W above
  234 + 13m.

The frame height clamps to at least 1.

**`layout2D`** takes its rule from its drawing width W, since it has no frame. Label and scale-bar text is `W / 70` px
for W from 630 to 910, and 13 px at 910; above 910 text and ray strokes grow: text `13 * sqrt(W / 910)`, stroke
`sqrt(W / 910)`; at and below 910 the stroke is 1 px. Below W = 630 labels and the scale bar are not drawn, and their
room is not reserved.

**Edges.** Labels show where `W / 70 >= 9`, compared unrounded, so W = 630 shows them and 629 does not. At each
boundary the rules are continuous (9 and 13 px, weight 1). A measured width of 0 or less is ignored.

**Default widths.** A caller that passes no `width` gets the renderer's default drawing width with the rule applied at
that width, stretched by CSS as before; only a caller that passes its rendered width gets exact px. Text at the
defaults: a default `curve` (F = 402) 15.6 px, with margins of about 72 units in place of 46; a default `layout2D`
(W = 1000) 13.6 px; a default `spot` panel (F = 150) 9 px; a default `rayFan` panel (F = 170) 9.4 px.

**`fit(el, draw)`** is how a caller passes its rendered width. It draws `draw(el.clientWidth)` synchronously, so a
first paint is drawn, then redraws through one shared `ResizeObserver`, at most once per animation frame and only when
the width changed and is above 0 (so a height a draw sets cannot loop). It returns `stop()`. A shared observer sees a
tile that reflowed in its grid, which a window `resize` listener misses.

**Size table.** `PLOT_SIZES` publishes, per renderer, the default width, the aspect and the minimum width per panel,
which is one frame at the 9 px floor (F = 162) plus its margins. It is computed from the same functions as the
renderers, so it cannot drift, and the gallery sets each row's minimum column from it. Hand-set figures from the
plan: a layout needs 630 px for labels; a 3-panel `spot` at its floor needs about 530 px and `throughFocus` about
894 px.

Canvas renderers (`layout3D`, the sample PSF, wavefront, Airy) are exempt.

## Consequences

- Text is 9 px or more wherever it is drawn, and the same renderer looks the same in the gallery, phos and the website.
- A small plot cannot go below its floor: a caller short of the minimum width gets a clipped or overflowing tile, so
  layouts must respect the table.
- Plots draw heavier lines when large, so recorded baselines and screenshots change at every size above the band; the
  plan re-records them at its verdicts.
- Default drawings (no `width`) change look: larger text and margins than before.
- `spot`'s `textScale` stays and multiplies the rule's size; removing it is breaking.
- Revisit if the M1 demo finds the knee exponent or the 13 px ceiling wrong, if a framed renderer cannot give its plot
  frame width, or if more than one `ResizeObserver` per page is needed.

## Verdict

Pending M1's demo.

[#498]: https://github.com/ELEOptics/eleo-ui/issues/498
[#512]: https://github.com/ELEOptics/eleo-ui/issues/512
