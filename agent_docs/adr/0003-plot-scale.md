# ADR-0003: Plot scale

Status: accepted
Date: 2026-11-04

## Context

Each renderer sized its text in its own viewBox units and the gallery stretched every SVG to its column, so rendered
text ran from 4.3 px (rayFan) to 13.7 px (full-row maps), and a consumer got whatever ratio a renderer happened to
draw (plan [#512], issue [#498]). The user asked for one system for how plots are rendered and at what ratios. ADR-0001
fixed every role at a 1 px stroke at any plot size; that rule cannot hold once text and plots scale together, so this
ADR supersedes it. The rest of ADR-0001 stands. M1 of plan [#512] exercised it on `curve`, `rayFan` and `layout2D`;
the Decision below is written as built, and the Verdict says what changed.

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
so margins are written in text units (`curve`: 4.6 left, 3.6 bottom, 2.6 top, and on the right 1.2 or 0.3 a character
of the widest x label). Above the band, series strokes of every role (`limit` included), rays and spot dots grow by
`sqrt(F / 234)` (weight w(F), 1 at and below 234). What stays 1 px at any size: the frame, the grid, the `limits`
option's marks (guides, like the grid), glass edges and the image line.

**`frameOf(W, m)`** returns F from the drawing width W and the horizontal margins m in text units, which solves
`F + m * t(F) = W`. The solution is closed form, one branch each; take the branch whose F lands in its own range:

- floor: `F = W - 9m`, valid while F < 162 (W < 162 + 9m);
- band: `F = 18W / (18 + m)`, valid for F from 162 to 234 (W from 162 + 9m to 234 + 13m);
- knee: with `u = (F / 234)^(1/3)` the equation is `u^3 + p*u = q` where `p = m / 18` and `q = W / 234`. Its
  discriminant is positive for p, q > 0, so there is one real root, by Cardano:
  `u = cbrt(q/2 + s) + cbrt(q/2 - s)` with `s = sqrt(q^2/4 + p^3/27)`, and `F = 234 * u^3`. Valid for W above
  234 + 13m.

The frame height clamps to at least 1. The frame's position and size are rounded to 2 decimals once, so every line,
text and the data matrix beside it share them, and a default height (no `height` given) is a whole px, so an
auto-height SVG lays out at scale 1.

**`layout2D`** takes its rule from its drawing width W, since it has no frame. Label and scale-bar text is `W / 70` px
for W from 630 to 910, and 13 px at 910; above 910 text and ray strokes grow: text `13 * sqrt(W / 910)`, stroke
`sqrt(W / 910)`; at and below 910 the stroke is 1 px. Below W = 630 the labels, the STO and IMA marks and the scale
bar are not drawn, and their room is not reserved. Label room is 0.6 em a character, an East Asian wide character
counting two. The viewBox height is a whole px.

**Edges.** Labels show where `W / 70 >= 9`, compared unrounded, so W = 630 shows them and 629 does not. At each
boundary the rules are continuous (9 and 13 px, weight 1). A measured width of 0 or less is ignored.

**Default widths.** A caller that passes no `width` gets the renderer's default drawing width with the rule applied at
that width, stretched by CSS as before; only a caller that passes its rendered width gets exact px. Text at the
defaults, as built: a default `curve` (460 wide) has F = 372.0, 15.17 px text and margins of 69.8 px left and 18.2 px
right in place of 46 and 12; a default `rayFan` column (228 wide) F = 172.4, 9.58 px; a default `layout2D` (W = 1000)
13.63 px. `spot` and `throughFocus` are M2's.

**`fit(el, draw)`** is how a caller passes its rendered width. It draws at the element's content width, the fractional
`getBoundingClientRect().width` minus its padding and borders, to 2 decimals (`clientWidth` is an integer, and in a
fractional grid column draws up to 0.5 px too wide); a CSS transform on an ancestor scales the measured box. The first
draw is synchronous, so a first paint is drawn, and is skipped at a width of 0 or less; it then redraws through one shared `ResizeObserver`, at most once per animation frame and only when
the width changed and is above 0 (so a height a draw sets cannot loop). It returns `stop()`. A shared observer sees a
tile that reflowed in its grid, which a window `resize` listener misses.

**Size table.** `PLOT_SIZES` publishes, per renderer, the default width, the aspect and the minimum width per panel,
which is one frame at the 9 px floor (F = 162) plus its margins. It is computed from the same functions as the
renderers, so it cannot drift, and the gallery sets each tile's minimum width from `minWidth(name, props)`
(plan [#603]). Figures from the plan: a layout needs 630 px for labels; a 3-panel `spot` at its floor needs about 530 px and `throughFocus` about
894 px. `scale.js`'s functions and constants are on the module and on the classic build's `window.ELEO`.

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

Go (the user, plan [#512] M1 demo, 2026-11-04). The skeleton drew `curve`, `rayFan` and `layout2D` to the rule at
their measured width in the gallery: the O1 unit test checks every text size and stroke weight against the formulas
at widths below, inside and above each band, and O2 measures every curve, rayFan and layout tile's rendered text at
1440, 1100 and 700 px in both themes within 1 %. The website's layout fixtures drew as planned: larger labels at
1200 px, no labels, marks or scale bar at 600. U14 held (curve 1.30 ms, panels 0.90 ms, layout2D 2.20 ms against
16 ms). What changed because of it:

- `fit` measures the fractional content box, not `clientWidth`, and default heights are whole px: an integer width and
  a fractional height each put floor text just under 9 px (CRs [#538], [#562]).
- The `limit` role grows with the other series roles; the `limits` option's marks stay 1 px (CR [#548], [#567]).
- Frame geometry is rounded once to 2 decimals, for smaller markup and strings that don't depend on `Math.cbrt`'s
  last bits (server render then hydrate).
- The default `curve`'s figures were wrong in the proposal (its right margin was left out); the built ones are above.
- A row minimum couldn't give a 3-panel `rayFan` its floor frame in a 656 px gallery column (two themes at 1440 px): its
  frames were 157.8 px there, text at the floor (CR [#547]). That held until plan [#603]'s one-tile-per-line gallery
  (CR [#622]).

[#538]: https://github.com/ELEOptics/eleo-ui/issues/538
[#547]: https://github.com/ELEOptics/eleo-ui/issues/547
[#548]: https://github.com/ELEOptics/eleo-ui/issues/548
[#562]: https://github.com/ELEOptics/eleo-ui/issues/562
[#567]: https://github.com/ELEOptics/eleo-ui/issues/567

[#498]: https://github.com/ELEOptics/eleo-ui/issues/498
[#512]: https://github.com/ELEOptics/eleo-ui/issues/512
[#603]: https://github.com/ELEOptics/eleo-ui/issues/603
[#622]: https://github.com/ELEOptics/eleo-ui/issues/622
