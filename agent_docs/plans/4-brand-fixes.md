# Plan [#4]: Brand fixes: standard field order, vision palettes, glass segmented control

Status: done 2026-10-05
Branch: `plan/4-brand-fixes` PR: [#12] Depends on: none Roadmap: `agent_docs/roadmap.md`, row A

## Problem

Every renderer colors fields `--field-1`, `-2`, `-3` in that order. `--field-2` reads as amber, and the brand keeps
amber for the one accent. The first plan looked for one order (with field-7/8 retuned) that stays distinct under
every colour-vision condition at once. Spike [#6] showed the dark theme can't get there. The user's direction ([#14]):
pick the fields for standard vision, and add a setting that switches to on-brand palettes made for a vision
condition. The palettes don't all have to work at once. `.eleo-seg` marks its selected option in amber, a second
accent next to a page's amber button. The website's Switch row waits on both.

## Ground truth

- `packages/plots/src/renderers.js:36` `idx(i)` returns `var(--field-<i%8+1>)`, the index color for fields or
  wavelengths in `layout2D`, `spot`, `throughFocus`, `rayFan`, `curve` (MTF) and `legend`. `layout3D` (`:101`)
  hard-codes `C("field-1")`, `-2`, `-3` through `css(el, name)` (`:20`), which reads `getComputedStyle` at draw time.

- Themes follow the same pattern: `tokens.css` sets every token on `:root` and on any `[data-theme]` element, and
  SVG output is plain `var(--…)`, so one drawing serves both themes. Canvas renderers redraw on a change.
  `plots-svelte/src/lib/theme.svelte.js:9` redraws on a `data-theme`/`class` change on `<html>` (a MutationObserver).

- CSS gotcha: a custom property that holds `var(--field-1)` resolves where it is declared. A mapping declared only
  on `:root` would carry the light hex into a `[data-theme="dark"]` column. It must be re-declared on every
  `[data-theme]` and `[data-palette]` element.

- Measured on today's tokens (no retune), culori, Machado 2009 severity 1, CIEDE2000, both themes. Each order is
  the triple that maximizes the minimum ΔE2000 pairwise and to `--accent`, then a greedy fill for 4 to 8:

  | Palette | Judged under | Order | Triple min ΔE | Steps 4–8 |
  | -- | -- | -- | -- | -- |
  | standard | normal vision | 1, 7, 8, 3, 4, 6, 2, 5 | 25.2 | 16.4 14.6 14.2 11.3 10.3 |
  | red-green | protanopia and deuteranopia | 3, 4, 8, 7, 5, 1, 6, 2 | 15.0 | 10.3 6.4 6.1 5.4 3.9 |
  | blue-yellow | tritanopia | 1, 4, 6, 7, 3, 2, 8, 5 | 19.7 | 19.3 9.1 8.5 5.6 2.7 |
  | (one order for all four) | all | 3, 4, 7, 8, … | 9.1 | (why the first plan failed) |

  The website's 1, 7, 8 is already the best standard triple. Protan alone gives 3, 4, 8 at 16.1, deutan alone
  1, 3, 8 at 19.0.

- Done and kept: [#5] (culori, skipped tests that this revision rewrites), [#6] (measurements; values not adopted),
  [#10] (`.eleo-seg` in glass, gallery specimen, its test).

- Unit tests: `node --test tests/unit/*.test.js`, the only tests `check.sh --fast` runs. New test files need an
  `oracle:` line.

## Outcomes

Rule R (one rule, applied per palette): over both themes and the palette's vision conditions, indices 1 to 3 are
the triple of field tokens with the largest minimum ΔE2000 (pairwise and to `--accent`). Each next index is the
remaining field with the largest minimum ΔE2000 to those placed and to `--accent`. Ties go to the lower token number. Floor F: each palette's first three are at least 10 ΔE2000 apart and from `--accent` under its own conditions, in both themes (measured 25.2, 15.0, 19.7).

| ID | Outcome | Acceptance test (given / when / then) | Oracle | Test |
| -- | -- | -- | -- | -- |
| O1 (U1) | With no palette set, every renderer colors index 1 to 8 in the standard order, which starts 1, 7, 8 | given today's tokens and the sample; when `layout2D`, `spot`, `throughFocus`, `rayFan`, `curve` (MTF and the single-series kinds), `legend` and `layout3D` draw, with and without `plots.css`; then each resolves index k to field `standard[k]`, and `standard` equals rule R under normal vision and meets floor F | `paper CIEDE2000 via culori; property: rule R and floor F under normal vision` | `tests/unit/field-order.test.js::standard order is rule R under normal vision` |
| O2 (U2) | `.eleo-seg` marks the selected option in glass, not amber | (unchanged) given the gallery's segmented control in both theme columns; when an option is checked; then its marker is `--glass-edge`, and no computed color of the control equals `--accent` | `user ELEO design system: one amber accent per view` | `tests/gallery.spec.js::segmented control marks in glass` |
| O3 | Setting `data-palette="red-green"` or `"blue-yellow"` on any element recolors the plots inside it with that palette's order, in either theme | given the gallery; when its palette switch sets `<html data-palette="red-green">` (then blue-yellow); then in both theme columns the `spot` tile's index-1 and index-2 marker fills compute to that column's `--field-3`, `--field-4` (blue-yellow: `--field-1`, `--field-4`; standard again: `--field-1`, `--field-7`), and each palette's order equals rule R under its conditions and meets floor F | `paper Machado, Oliveira & Fernandes 2009 via culori's deficiency filters, CIEDE2000; property: rule R and floor F under the palette's conditions` | `tests/unit/field-order.test.js::each palette is rule R under its conditions`, `tests/gallery.spec.js::palette switch recolors both themes` |

## Non-goals

- Retuning field tokens (spike [#6]'s values): standard vision needs none, since 1, 7, 8 is already the best triple at 25.2.
- One order safe for every condition at once: measured best 9.1 ([#14]).
- Persisting the user's choice and a settings UI: apps own their settings. The website's Switch row sets `data-palette` on `<html>`.
- A per-call renderer option (`{ palette }`): the attribute covers a page and a single card alike.
- Screenshot baselines: the M1 demo in both themes is the visual check.
- Updating the design system artifact: the user does, if the palettes become brand data.
- The release: it ships with the Layouts row; this plan adds its changeset only.

## Existing issues

| Issue | Bucket | Where or why |
| -- | -- | -- |
| [#2] | absorb | the row's issue |
| [#13] | absorb | the order becomes public as CSS variables `--series-1` to `--series-8`, which any app's chart can use. The name is this plan's choice |
| [#3] | related | Layouts row, waits on this one (both edit `renderers.js`) |
| [#7] | supersede | no token retune. Closes as moot, citing this revision |
| [#14] | related | rejected CR. Its decision is this revision |

## Constraints and assumptions

- Index 9 to 16 keeps today's rule (reuse with a hollow marker), over the active palette.
- Without `plots.css`, SVG renderers fall back to the standard order (`var(--series-k, var(--field-<standard[k]>))`),
  and `layout3D` falls back in JS (`C("series-k") || C("field-<standard[k]>")`). Verified by the critic: an empty
  `--series-1` would leave the canvas `strokeStyle` unchanged.
- The CSS mapping was verified in Chromium by the critic (scratchpad `css-check.mjs`, `nest.mjs`): correct hexes for a
  palette on `<html>` or `<body>` with theme columns, a palette inside a dark column, both attributes on one
  element, and OS dark with and without `html[data-theme=light]`. Limit: two different palettes nested, with a
  `[data-theme]` inside the inner one, resolve by source order. One palette per page (on `<html>`) is the supported use.
- Palette blocks beat `:root, [data-theme]` by source order only (equal specificity), so the standard block comes first.
- eleoptics.com's field-7/8 copies stay valid: no token changes.

## Decisions

No ADR: the orders are pinned data checked by a test. Roadmap changes, approved here and committed with the
approval (`Plan #4: revise after #14`): U1 reworded to "with no palette set, renderers color in the standard
order (rule R, normal vision); `data-palette` switches to the red-green or blue-yellow order (rule R under its
conditions); every palette meets floor F". U1's oracle becomes rule R and floor F (the WCAG contrast clause is
dropped, since the tokens' own 3:1 usage covers normal vision). Row A's scope drops "field-7/8 retuned" and gains
the palettes and `--series-k`. The A/U1 kill criterion retires. Core: none.

## Milestones

### M1 (done 2026-10-05): standard order, two vision palettes, glass segmented control GitHub: `P4 M1: Brand fixes`

Demo: `npm run gallery`. Both theme columns draw in the standard order: index 1 to 3 are blue, violet and rose, with
no amber. The palette switch in the gallery header (Standard / Red-green / Blue-yellow) sets
`<html data-palette>`, and every tile in both columns recolors, the `layout3D` canvas and the single-series
curves included. The segmented controls mark in glass. Proves: O1, O2, O3

| Issue | Work item | Approach | Files | Test | After |
| -- | -- | -- | -- | -- | -- |
| [#5] | done: culori, first acceptance tests | | | | |
| [#6] | done: spike (measurements kept, values not adopted) | | | | |
| [#10] | done: `.eleo-seg` in glass, gallery specimen | | | | |
| [#15] | Acceptance tests rewritten for O1 and O3, skipped | forced (`workflow.md`, TDD). The unit tests parse `--series-k` per selector in `plots.css` and recompute rule R and floor F from `tokens.json`. The condition sets are the palette's own (standard: normal; red-green: protan and deutan; blue-yellow: tritan), with ties to the lower number in both the triple search (ascending scan, strict >) and the greedy tail. O1 also asserts that `idx`'s fallback fields equal the parsed `:root` mapping, and its drawn set adds `curve` `fieldCurvature`, `distortion` and `chromaticFocus`. The oracle line drops the WCAG clause. Regex parsing because the format is fixed and written by this plan; considered `postcss`/`css-tree`, ruled out because each is a new dependency. The gallery test is `test.skip`, reads computed `fill` of `spot`'s `circle[fill^="var(--series-1"]` and `-2` | | `tests/unit/field-order.test.js`, `tests/gallery.spec.js` | none |
| [#16] | `plots.css` maps `--series-1..8` to fields per palette, theme-safe | Three blocks in this order: `:root, [data-theme]` (standard), then `[data-palette="standard"], [data-palette="standard"] [data-theme]`, then `red-green` and `blue-yellow` in the same form. A mapping resolves where it is declared, and palettes win by source order (Constraints). Considered generating it in `tokens/build.mjs`, ruled out because `tokens.json` is the design system's file and the order is plots' concern. README gains a "Palettes" section: `<html data-palette="red-green">`, the three values, one palette per page, canvas plots redraw as on a theme change, and "`--series-1` to `--series-8` are the index colors for any chart on the page. They follow the palette and theme. The token number is not the index" (delivers [#13]) | `packages/plots/src/plots.css`, `packages/plots/README.md` | `tests/unit/palettes.test.js::each palette maps all 8 fields once, standard block first` | #15 |
| [#17] | SVG renderers color through `--series-k` | `idx(i)` returns `var(--series-k, var(--field-<standard[k]>))`, and `curve`'s single-series kinds (`renderers.js:213`, `:214`, `:217`, `:220`) use `idx(0)` instead of `var(--field-1)`, because every SVG color then goes through one function. Considered a JS `ELEO.palette()` state, ruled out because SVG would need a redraw and per-element scope is lost | `packages/plots/src/renderers.js` | `tests/unit/field-order.test.js::standard order is rule R under normal vision` (moved by #23) | #16 |
| [#18] | `layout3D` strokes `--series-1..3` | `C("series-" + (k+1)) \|\| C("field-" + STANDARD[k])` because it reads tokens through `css()` at draw time, so it follows the palette and still draws without `plots.css`. Node stubs as in [#5]'s O1 test, plus a case where `--series-*` reads `""`. Considered routing it through `idx` and parsing the var string, ruled out because canvas needs a hex | `packages/plots/src/renderers.js` | `tests/unit/field-order.test.js::standard order is rule R under normal vision` (moved by #23) | #17 |
| [#19] | Svelte canvases redraw on a palette change | add `'data-palette'` to `theme.svelte.js`'s `attributeFilter` (it watches `<html>`) because that is how theme redraws work, and `plots-svelte/README.md:3` gains "or the palette". Considered a separate store, ruled out by duplication. Test recipe (critic, verified): `compileModule(src, { generate: 'client' })` from `svelte/compiler`, write the output under the repo so `svelte/internal/client` resolves, stub `window`, `document.documentElement`, `MutationObserver` (capture options and callback) and `matchMedia`; assert `attributeFilter` includes `data-palette` and two callbacks bump `themeTick()` by 2. `oracle: spec DOM MutationObserver attributeFilter` | `packages/plots-svelte/src/lib/theme.svelte.js`, `packages/plots-svelte/README.md` | `tests/unit/theme-tick.test.js::a data-palette change bumps the tick` | none |
| [#20] | Gallery palette switch | an `.eleo-seg` in the page header (Standard / Red-green / Blue-yellow) sets `data-palette` on `<html>` (where apps and the Svelte observer put it) and redraws the canvas tiles, because the demo has to show both columns switching together. Considered per-column switches, ruled out because they hide that one attribute serves a page. Canvas recoloring in the browser is checked only by the demo; D's unit test covers the logic | `gallery/index.html` | `tests/gallery.spec.js::palette switch recolors both themes` (O3, written skipped in #15) | #16, #18 |
| [#11] reuse | Unskip O1, O2, O3. Changeset. README token note | forced (`workflow.md`, TDD). One changeset: minor for `@eleoptics/plots` (index order, palettes, `--series-k`, seg marker) and patch for `@eleoptics/plots-svelte`. `README.md:62` gains "except the field order: it is pinned per palette in `packages/plots/src/plots.css` and checked against the tokens, so a field token change reruns that check" | `.changeset/brand-fixes.md`, `README.md` | the acceptance tests, green | all above |
| [#22] | README and plots-svelte description: canvases redraw on a palette change | review finding 2; edits the lines in place because `packages/plots-svelte/README.md:3` already says it and each fact has one owner per file; considered linking instead, ruled out for a one-word change | `README.md`, `packages/plots-svelte/package.json` (description) | none (docs; grep check in the issue) | #11 |
| [#23] | Drop `renderers.test.js` | review finding 3; deletes the file because `field-order.test.js` O1 asserts a strict superset now that it is unskipped; considered importing shared helpers, ruled out since nothing would remain. #17's and #18's Test is now `tests/unit/field-order.test.js::standard order is rule R under normal vision` | `tests/unit/renderers.test.js`, `tests/unit/field-order.test.js` (CR [#26]) | `tests/unit/field-order.test.js::standard order is rule R under normal vision`, green | #11 |
| [#24] | Drop the #10 gallery test | review finding 4; O2 repeats its assertion and adds the no-accent check; considered keeping both, ruled out as duplicate coverage | `tests/gallery.spec.js` | `tests/gallery.spec.js::segmented control marks in glass`, green | #11 |
| [#25] | Gallery test covers `data-palette="standard"` | review finding 5; a step in the O3 test because the `standard` block is otherwise only checked as text; considered a separate test, ruled out since the setup is the same | `tests/gallery.spec.js` | `tests/gallery.spec.js::palette switch recolors both themes` | #24 |

[#7], [#8] and [#9] close as superseded by this revision. Their scope moves to #16 to #18.

## Risks and spikes

| Risk | Impact | Spike or mitigation |
| -- | -- | -- |
| The `--series` mapping resolves in the wrong theme | a dark column shows light hexes | verified in Chromium (Constraints). The gallery test checks both columns, and B's test checks the block order |
| Red-green's 3, 4, 8 reads off-brand to standard viewers | user surprise at the demo | it is opt-in. The demo shows it |
| A token change reorders or degrades a palette | silent drift | the orders are pinned in CSS. A's tests recompute rule R and floor F and go red |

## Change log

One bullet per entry (bare lines render as one paragraph).

- 2026-10-05: plan [#4] approved and published (see `4-brand-fixes.md` history). [#5], [#6] and [#10] done.
- 2026-10-05 [#14] (user): re-scope. "Choose the field colors based on what is best for standard vision. Then, have a setting to allow users to choose color palettes that account for their visual conditions … They don't all have to work simultaneously."
- 2026-10-05: revision drafted. Measured orders per palette on today's tokens (Ground truth).
- 2026-10-05 round 1 (user): buckets confirmed ([#2], [#13] absorb; [#3] related; [#7], [#8], [#9] superseded); palettes standard, red-green, blue-yellow; mechanism `data-palette` attribute; best triple wins (field-1 not forced first).
- 2026-10-05 round 2 (user): public name `--series-1..8` ([#13]); floor F (triple min ≥ 10) on every palette.
- 2026-10-05 critique (plan critic, claude-fable-5-1, mechanism verified in Chromium, Ground truth reproduced): applied 1 (`layout3D` JS fallback), 2 (`curve` single-series through `idx`), 3 (`standard` declared), 4 (block order), 5 (`<html>`), 8 (Svelte test recipe), 9 (`spot` fill), 10 (fallback cross-check), 11 (#13 README line), 12 (roadmap at approval), 13 (canvas checked by demo, stated), 14 (oracle line), 15 (README drift lines), 16 (oracle line on new test), 17 (regex, reason stated). Rejected: none.
- 2026-10-05 approval (user): revision approved. Work items #15 to #20 created, #11 revised, and #7, #8 and #9 closed as superseded. Roadmap U1, row A and the kill criterion updated.
- 2026-10-05: M1 items #15 to #20 and #11 done. On #20, the gallery's pointer-events override was dropped, so the specimen behaves like the library, and O3's click became `getByRole('radio').check()` in #11 (orchestrator; oracle and assertions unchanged).
- 2026-10-05: M1 review round 1: 0 blocking, 5 backlog. Findings 2 to 5 pulled into M1 as [#22] to [#25] (small, named, in files M1 changed). Finding 1 filed as [#21] (release config, a non-goal; it waits for the Layouts release).
- 2026-10-05: #23 hit a gap: two renderers.test.js assertions had no counterpart in field-order. CR [#26] accepted (orchestrator; keeps every invariant): they moved into field-order before the delete.
- 2026-10-05: M1 review round 2: 0 blocking, 2 backlog. Finding 1 filed as [#27] (four files, more than one item). Finding 2 (stale Test cells for #17 and #18) fixed here. M1 done: every item done, O1 to O3 green, `scripts/check.sh` green on 0304e95.
- 2026-10-05 M1 demo (user): go. `npm ci` showed audit warnings: 15 high and 4 moderate, from `braces` and `sprintf-js` under `@changesets/cli` (dev only, already on main). Outside this plan.
- 2026-10-05: `CLAUDE.md` commands re-verified on 07fe796: `npm ci && npm run build`, `npm run test:unit` (10 pass), `npx playwright test` (4 pass), `npm run gallery` (200), `npx changeset status`, `scripts/check.sh --fast` and `scripts/check.sh` (green), `core.hooksPath` is `.githooks`. Plan done.

[#2]: https://github.com/ELEOptics/eleo-ui/issues/2
[#3]: https://github.com/ELEOptics/eleo-ui/issues/3
[#4]: https://github.com/ELEOptics/eleo-ui/issues/4
[#5]: https://github.com/ELEOptics/eleo-ui/issues/5
[#6]: https://github.com/ELEOptics/eleo-ui/issues/6
[#7]: https://github.com/ELEOptics/eleo-ui/issues/7
[#8]: https://github.com/ELEOptics/eleo-ui/issues/8
[#9]: https://github.com/ELEOptics/eleo-ui/issues/9
[#10]: https://github.com/ELEOptics/eleo-ui/issues/10
[#11]: https://github.com/ELEOptics/eleo-ui/issues/11
[#12]: https://github.com/ELEOptics/eleo-ui/issues/12
[#13]: https://github.com/ELEOptics/eleo-ui/issues/13
[#14]: https://github.com/ELEOptics/eleo-ui/issues/14
[#15]: https://github.com/ELEOptics/eleo-ui/issues/15
[#16]: https://github.com/ELEOptics/eleo-ui/issues/16
[#17]: https://github.com/ELEOptics/eleo-ui/issues/17
[#18]: https://github.com/ELEOptics/eleo-ui/issues/18
[#19]: https://github.com/ELEOptics/eleo-ui/issues/19
[#20]: https://github.com/ELEOptics/eleo-ui/issues/20
[#21]: https://github.com/ELEOptics/eleo-ui/issues/21
[#22]: https://github.com/ELEOptics/eleo-ui/issues/22
[#23]: https://github.com/ELEOptics/eleo-ui/issues/23
[#24]: https://github.com/ELEOptics/eleo-ui/issues/24
[#25]: https://github.com/ELEOptics/eleo-ui/issues/25
[#26]: https://github.com/ELEOptics/eleo-ui/issues/26
[#27]: https://github.com/ELEOptics/eleo-ui/issues/27
